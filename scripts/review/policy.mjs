import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { validateRelativePath, contractError } from '../llm/validate-request.mjs';

const require = createRequire(new URL('../llm/package.json', import.meta.url));
const Ajv = require('ajv');
const ajv = new Ajv({ strict: true });
ajv.addSchema(JSON.parse(await readFile(new URL('../triage/schemas/config.schema.json', import.meta.url))), 'triage-policy');
const checkConfig = ajv.compile(JSON.parse(await readFile(new URL('./schemas/config.schema.json', import.meta.url))));

function validBranch(ref) {
  return typeof ref === 'string' && ref.length <= 240 && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(ref)
    && !ref.startsWith('refs/') && !ref.includes('..') && !ref.endsWith('.')
    && ref.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.lock'));
}

/** Configuration grants only domain eligibility; collection independently proves API origin. */
export function validateReviewConfig(config) {
  try {
    if (Buffer.byteLength(JSON.stringify(config) ?? '') > 32768 || !checkConfig(config)) throw new Error();
    for (const path of [...Object.values(config.llm_configs), ...config.allowed_paths,
      ...[config.triage_handoff?.workflow_path, config.triage_handoff?.config_path].filter(value => value !== undefined)]) {
      validateRelativePath(path);
      if (/[\*?\[\]{}]/.test(path)) throw new Error();
    }
    if (config.triage_handoff && !/^\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml$/.test(config.triage_handoff.workflow_path)) throw new Error();
    if (config.protected_branches.some(ref => !validBranch(ref))
      || config.correctable_prefixes.some(prefix => !prefix.endsWith('/') || !validBranch(prefix.slice(0, -1))
        || /^(?:master|develop|release)(?:\/|$)/.test(prefix))) throw new Error();
    if (new Set(config.automation_actors.map(actor => actor.id)).size !== config.automation_actors.length
      || new Set(config.automation_actors.map(actor => actor.login.toLowerCase())).size !== config.automation_actors.length) throw new Error();
    return structuredClone(config);
  } catch { throw contractError('INVALID_REVIEW_CONFIG'); }
}

/** automation_origin is resolved by the collector, never parsed from a PR body or login. */
export function classifyPull(pr, config) {
  const policy = validateReviewConfig(config);
  if (pr?.automation_origin === 'review') return 'skip-correction';
  const head = pr?.head?.ref;
  if (!validBranch(head) || /^(?:master|develop|release)(?:\/|$)/.test(head)
    || policy.protected_branches.includes(head) || !policy.correctable_prefixes.some(prefix => head.startsWith(prefix))) return 'review-only';
  return 'correction';
}
