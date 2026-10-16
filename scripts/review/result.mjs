import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { contractError, readTrustedFile, validateRelativePath } from '../llm/validate-request.mjs';
import { resultIdentity, validatePatch } from '../llm/result.mjs';
import { buildDiffIndex } from './diff.mjs';

const require = createRequire(new URL('../llm/package.json', import.meta.url));
const Ajv = require('ajv');
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
const core = JSON.parse(await readFile(new URL('../llm/schemas/result.schema.json', import.meta.url), 'utf8'));
export const reviewExecutionSchema = JSON.parse(await readFile(new URL('./schemas/result.schema.json', import.meta.url), 'utf8'));
const checkResult = ajv.compile({ ...reviewExecutionSchema,
  required: [...reviewExecutionSchema.required, 'status', 'decision'],
  properties: { ...reviewExecutionSchema.properties, status: core.properties.status, decision: core.properties.decision } });
const sha = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const extension = { config_source_sha: sha, pull_number: { type: 'integer', minimum: 1, maximum: 9007199254740991 },
  base_sha: sha, merge_base_sha: sha, review_fingerprint: hash, review_file: { const: 'review.json' }, review_sha256: hash,
  patch_sha256: { anyOf: [hash, { type: 'null' }] } };
const checkEnvelope = ajv.compile({ ...core, required: [...core.required, ...Object.keys(extension)],
  properties: { ...core.properties, schema_version: { const: 3 }, ...extension } });
const checkSidecar = ajv.compile({ type: 'object', additionalProperties: false, required: ['schema_version', 'findings'],
  properties: { schema_version: { const: 1 }, findings: reviewExecutionSchema.properties.findings } });
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw contractError('INVALID_RESULT'); };
const fields = ['pull_number', 'base_sha', 'merge_base_sha', 'review_fingerprint'];

function consistent(result) {
  return result.status === 'succeeded' ? ['none', 'proceed'].includes(result.decision)
    : result.status === 'skipped' ? result.decision === 'skip' && result.patch_file === null
      : result.status === 'needs-human' && result.decision === 'needs-human' && result.patch_file === null;
}
function reviewIdentity(expected) {
  return { ...resultIdentity(expected), ...Object.fromEntries(fields.map(key => [key, expected[key]])) };
}
function snapshotIdentity(snapshot) {
  if (!snapshot || snapshot.error_code || snapshot.source_sha !== snapshot.pull?.head?.sha || snapshot.base_sha !== snapshot.pull?.base?.sha
    || !['correction', 'review-only', 'skip-correction'].includes(snapshot.route)) fail();
  return { repository: snapshot.repository, source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha,
    pull_number: snapshot.pull.number, base_sha: snapshot.base_sha, merge_base_sha: snapshot.merge_base_sha, review_fingerprint: snapshot.fingerprint };
}

/** Validate references against the actual diff, not an index supplied by the model or artifact. */
export function validateReviewResult(result, snapshot) {
  try {
    if (!checkResult(result) || !consistent({ ...result, patch_file: result.patch === null ? null : 'proposal.patch' })) fail();
    snapshotIdentity(snapshot);
    const index = buildDiffIndex(snapshot.diff);
    if (JSON.stringify(index) !== JSON.stringify(snapshot.diff_index)) fail();
    if (result.status !== 'succeeded' && result.findings.length) fail();
    for (const finding of result.findings) {
      validateRelativePath(finding.path);
      if (!finding.message.trim() || !index.files.some(file => file.path === finding.path && file.added_lines.includes(finding.line))) fail();
    }
    if (result.patch !== null) {
      if (snapshot.route !== 'correction') fail();
      validatePatch(result.patch);
      const paths = [...result.patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)\r?$/gm)].flatMap(match => [match[1], match[2]]);
      if (paths.some(path => !index.files.some(file => file.path === path) || /^\.github\/(?:triage|review)\//.test(path))) fail();
    }
    return structuredClone(result);
  } catch { fail(); }
}

/** expected is reconstructed independently by the trusted caller; never use envelope fields as expectations. */
export function validateReviewEnvelope(envelope, expected) {
  try {
    const trusted = reviewIdentity(expected);
    if (!checkEnvelope(envelope) || !consistent(envelope)
      || Object.entries(trusted).some(([key, value]) => envelope[key] !== value)
      || (envelope.patch_file === null ? envelope.patch_sha256 !== null : envelope.patch_sha256 === null)) fail();
    return envelope;
  } catch { fail(); }
}

function containsSensitive(values, sensitive) {
  return sensitive.some(secret => typeof secret === 'string' && secret.length > 0 && values.some(value => value?.includes(secret)));
}

export async function packageReviewResult(raw, provenance, snapshot, outputRoot, { sensitiveValues = [] } = {}) {
  const result = validateReviewResult(raw, snapshot);
  const source = snapshotIdentity(snapshot);
  if (['repository', 'source_sha', 'config_source_sha'].some(key => source[key] !== provenance[key])) fail();
  const expected = { ...provenance, ...source }; const trusted = reviewIdentity(expected);
  const sidecar = JSON.stringify({ schema_version: 1, findings: result.findings }, null, 2) + '\n';
  const envelope = { schema_version: 3, ...trusted, status: result.status, decision: result.decision, summary: result.summary,
    error_code: '', review_file: 'review.json', review_sha256: digest(sidecar), patch_file: result.patch === null ? null : 'proposal.patch',
    patch_sha256: result.patch === null ? null : digest(result.patch) };
  validateReviewEnvelope(envelope, expected);
  const json = JSON.stringify(envelope, null, 2) + '\n';
  if (Buffer.byteLength(json) + Buffer.byteLength(sidecar) + Buffer.byteLength(result.patch ?? '') > 1048576
    || containsSensitive([json, sidecar, result.summary, result.patch, ...result.findings.flatMap(f => [f.path, f.message])], sensitiveValues)) fail();
  const outputs = Object.fromEntries(['status', 'decision', 'artifact_name', 'source_sha', 'config_source_sha', 'automation_sha',
    'request_id', 'error_code', 'pull_number', 'base_sha', 'merge_base_sha', 'review_fingerprint'].map(key => [key, envelope[key]]));
  if (Buffer.byteLength(JSON.stringify(outputs)) > 8192) fail();
  const directory = join(outputRoot, envelope.artifact_name); let created = false;
  try {
    await mkdir(directory, { mode: 0o700 }); created = true;
    await writeFile(join(directory, 'result.json'), json, { mode: 0o600, flag: 'wx' });
    await writeFile(join(directory, 'review.json'), sidecar, { mode: 0o600, flag: 'wx' });
    if (result.patch !== null) await writeFile(join(directory, 'proposal.patch'), result.patch, { mode: 0o600, flag: 'wx' });
    return { directory, outputs, envelope };
  } catch {
    if (created) await rm(directory, { recursive: true, force: true });
    throw contractError('ARTIFACT_FAILED');
  }
}

export async function readReviewPackage(root, expected, snapshot) {
  try {
    const bytes = await readTrustedFile(root, 'result.json', 1048576, 'INVALID_RESULT');
    const envelope = validateReviewEnvelope(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), expected);
    const source = snapshotIdentity(snapshot);
    if (Object.entries(source).some(([key, value]) => expected[key] !== value)) fail();
    const names = ['result.json', 'review.json', ...(envelope.patch_file === null ? [] : ['proposal.patch'])].sort();
    if (JSON.stringify((await readdir(root)).sort()) !== JSON.stringify(names)) fail();
    const reviewBytes = await readTrustedFile(root, 'review.json', 1048576, 'INVALID_RESULT');
    const sidecar = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(reviewBytes));
    if (digest(reviewBytes) !== envelope.review_sha256 || !checkSidecar(sidecar)) fail();
    const patchBytes = envelope.patch_file === null ? null : await readTrustedFile(root, 'proposal.patch', 1048576, 'INVALID_RESULT');
    if (bytes.length + reviewBytes.length + (patchBytes?.length ?? 0) > 1048576
      || (patchBytes !== null && digest(patchBytes) !== envelope.patch_sha256)) fail();
    const patch = patchBytes === null ? null : new TextDecoder('utf-8', { fatal: true }).decode(patchBytes);
    const result = validateReviewResult({ status: envelope.status, decision: envelope.decision, summary: envelope.summary, findings: sidecar.findings, patch }, snapshot);
    return { envelope, findings: result.findings, patch };
  } catch { fail(); }
}
