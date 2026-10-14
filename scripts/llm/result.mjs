import Ajv from 'ajv';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { contractError, validateRelativePath } from './validate-request.mjs';

const schema = JSON.parse(await readFile(new URL('./schemas/result.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: true });
const check = ajv.compile(schema);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fields = ['repository', 'run_id', 'run_attempt', 'invocation_id', 'source_sha', 'automation_sha', 'config_sha256', 'instructions_sha256'];

function identity(provenance) {
  const p = Object.fromEntries(fields.map(key => [key, provenance[key]]));
  p.run_id = String(p.run_id); p.run_attempt = String(p.run_attempt);
  return { ...p, artifact_name: `llm-${p.run_id}-${p.run_attempt}-${p.invocation_id}`, request_id: sha256(JSON.stringify([p.repository, p.run_id, p.run_attempt, p.invocation_id, p.source_sha])) };
}

function patchPath(path) {
  validateRelativePath(path);
  const parts = path.split('/');
  if (parts.some(p => ['.git', '.codex', '.agents', '.husky'].includes(p) || p.startsWith('.env') || /^(auth\.json|AGENTS(?:\.override)?\.md|\.gitmodules|\.gitattributes)$/.test(p) || /\.(pem|key)$/i.test(p))
    || path.startsWith('.github/workflows/') || path.startsWith('.github/llm/')) throw contractError('INVALID_RESULT');
}

export function validatePatch(patch) {
  try {
    if (!patch || patch.includes('\0') || /^(?:GIT binary patch|Binary files |(?:new|old|deleted) (?:file )?mode (?:120000|160000)|rename (?:from|to) |copy (?:from|to) )/m.test(patch)) throw contractError('INVALID_RESULT');
    let paths = null; let headers = 0; let hunkSeen = false;
    for (const line of patch.split('\n')) {
      if (line.startsWith('diff --git ')) {
        if (paths && (headers !== 2 || !hunkSeen)) throw contractError('INVALID_RESULT');
        const match = /^diff --git a\/(\S+) b\/(\S+)\r?$/.exec(line);
        if (!match) throw contractError('INVALID_RESULT');
        paths = [match[1], match[2]]; paths.forEach(patchPath); headers = 0; hunkSeen = false;
      } else if (!hunkSeen && (line.startsWith('--- ') || line.startsWith('+++ '))) {
        if (!paths || headers > 1) throw contractError('INVALID_RESULT');
        const prefix = headers === 0 ? '--- a/' : '+++ b/';
        const value = line.replace(/\r$/, '');
        if (value !== `${prefix}${paths[headers]}` && value !== (headers === 0 ? '--- /dev/null' : '+++ /dev/null')) throw contractError('INVALID_RESULT');
        headers++;
      } else if (line.startsWith('@@ ')) {
        if (headers !== 2 || !/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) throw contractError('INVALID_RESULT');
        hunkSeen = true;
      }
    }
    if (!paths || headers !== 2 || !hunkSeen) throw contractError('INVALID_RESULT');
  } catch { throw contractError('INVALID_RESULT'); }
}

export function validateEnvelope(envelope, expected) {
  if (!check(envelope)) throw contractError('INVALID_RESULT');
  const consistent = envelope.status === 'succeeded' ? ['none', 'proceed'].includes(envelope.decision)
    : envelope.status === 'skipped' ? envelope.decision === 'skip' && envelope.patch_file === null
      : envelope.decision === 'needs-human' && envelope.patch_file === null;
  const trusted = identity(expected);
  if (!consistent || Object.entries(trusted).some(([key, value]) => envelope[key] !== value)) throw contractError('INVALID_RESULT');
  return envelope;
}

export async function validateAndPackage(result, provenance, outputRoot, { sensitiveValues = [] } = {}) {
  const allowed = ['status', 'decision', 'summary', 'patch'];
  if (!result || Object.keys(result).some(key => !allowed.includes(key)) || typeof result.summary !== 'string'
    || !(result.patch === null || typeof result.patch === 'string')) throw contractError('INVALID_RESULT');
  if (result.patch !== null) validatePatch(result.patch);
  const trusted = identity(provenance);
  const envelope = { schema_version: 1, ...trusted, status: result.status, decision: result.decision, summary: result.summary, patch_file: result.patch === null ? null : 'proposal.patch', error_code: '' };
  validateEnvelope(envelope, provenance);
  const json = JSON.stringify(envelope, null, 2) + '\n';
  const payload = json + (result.patch ?? '');
  if (Buffer.byteLength(payload) > 1048576 || sensitiveValues.some(value => typeof value === 'string' && value.length > 0 && payload.includes(value))) throw contractError('INVALID_RESULT');
  const outputs = Object.fromEntries(['status', 'decision', 'artifact_name', 'source_sha', 'automation_sha', 'request_id', 'error_code'].map(key => [key, envelope[key]]));
  if (Buffer.byteLength(JSON.stringify(outputs)) > 8192) throw contractError('INVALID_RESULT');
  const directory = join(outputRoot, trusted.artifact_name);
  let created = false;
  try {
    await mkdir(directory, { mode: 0o700 }); created = true;
    await writeFile(join(directory, 'result.json'), json, { mode: 0o600, flag: 'wx' });
    if (result.patch !== null) await writeFile(join(directory, 'proposal.patch'), result.patch, { mode: 0o600, flag: 'wx' });
    return { directory, outputs, envelope };
  } catch {
    if (created) await rm(directory, { recursive: true, force: true });
    throw contractError('ARTIFACT_FAILED');
  }
}
