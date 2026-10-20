import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { validateRelativePath, contractError } from '../llm/validate-request.mjs';

const require = createRequire(new URL('../llm/package.json', import.meta.url));
const Ajv = require('ajv');
const schema = JSON.parse(await readFile(new URL('./schemas/config.schema.json', import.meta.url), 'utf8'));
const checkConfig = new Ajv({ strict: true }).compile(schema);
const shaPattern = /^[a-f0-9]{40}$/;

function validBase(ref) {
  return typeof ref === 'string' && ref.length <= 240
    && /^(?:release|feature|codex|hotfix)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(ref)
    && !ref.includes('..') && !ref.endsWith('.')
    && ref.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.lock'));
}

/** Validate caller-owned policy without including its values in diagnostics. */
export function validateTriageConfig(config) {
  try {
    const raw = JSON.stringify(config);
    if (!raw || Buffer.byteLength(raw, 'utf8') > 32768 || !checkConfig(config)) throw contractError('INVALID_TRIAGE_CONFIG');
    const fieldNames = Object.values(config.fields);
    if (new Set(fieldNames).size !== fieldNames.length || fieldNames.some(name => !name.trim() || /[\x00-\x1f]/.test(name))) throw contractError('INVALID_TRIAGE_CONFIG');
    for (const path of [...Object.values(config.llm_configs), ...config.allowed_paths]) {
      validateRelativePath(path);
      if (/[\*?\[\]{}]/.test(path)) throw contractError('INVALID_TRIAGE_CONFIG');
    }
    if (Object.values(config.stacked_bases).some(ref => !validBase(ref))) throw contractError('INVALID_TRIAGE_CONFIG');
    return structuredClone(config);
  } catch { throw contractError('INVALID_TRIAGE_CONFIG'); }
}

/** SDD authorization is domain policy; issue text and labels cannot grant a patch. */
export function selectRoute(metadata) {
  const result = (route, reason) => ({ route, reasons: [reason] });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return result('needs-human', 'METADATA_INCOMPLETE');
  if (metadata.release === 'MAJOR' || ['High', 'Team'].includes(metadata.effort)) return result('plan', 'SDD_REQUIRED');
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const coherent = sizes.indexOf(metadata.size) + 1 === metadata.estimate
    || (metadata.estimate === 0 && metadata.type === 'Task')
    || (metadata.estimate === 6 && metadata.type === 'Hotfix')
    || (metadata.type === 'Release' && [7, 8, 9, 10].includes(metadata.estimate));
  if (metadata.complete !== true || !['Bug', 'Task', 'Feature', 'Release', 'Hotfix'].includes(metadata.type)
    || !['Low', 'Medium'].includes(metadata.effort) || !sizes.includes(metadata.size)
    || !Number.isInteger(metadata.estimate) || !coherent
    || ![null, 'MINOR', 'PATCH'].includes(metadata.release)
    || !Array.isArray(metadata.blockers) || metadata.blockers.some(b => !b || !['open', 'closed'].includes(b.state))) {
    return result('needs-human', 'METADATA_INCOMPLETE');
  }
  if (metadata.blockers.some(b => b.state === 'open')) return result('plan', 'BLOCKED');
  const simple = ['Bug', 'Task'].includes(metadata.type) && metadata.effort === 'Low'
    && ((metadata.size === 'XS' && metadata.estimate === 1) || (metadata.size === 'S' && metadata.estimate === 2));
  if (!simple) return result('plan', 'SDD_REQUIRED');
  if (!validBase(metadata.base_ref) || !shaPattern.test(metadata.base_sha ?? '')) return result('needs-human', 'BASE_UNRESOLVED');
  return result('propose-patch', 'SIMPLE_ELIGIBLE');
}

/** Resolve a candidate only; collection must prove that its GitHub branch exists. */
export function resolveBase(metadata, config) {
  const policy = validateTriageConfig(config);
  if (!Number.isSafeInteger(metadata?.issue_number) || metadata.issue_number < 1) return null;
  const issue = String(metadata.issue_number);
  if (Object.hasOwn(policy.stacked_bases, issue)) return policy.stacked_bases[issue];
  const title = metadata.milestone?.title;
  if (typeof title !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(title)) return null;
  const ref = `release/${title}`;
  return validBase(ref) ? ref : null;
}
