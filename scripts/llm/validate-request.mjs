import Ajv from 'ajv';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';

const ajv = new Ajv({ strict: true, allErrors: false });
const schema = JSON.parse(await readFile(new URL('./schemas/request.schema.json', import.meta.url), 'utf8'));
const checkConfig = ajv.compile(schema);
const checkInputs = ajv.compile({
  type: 'object', additionalProperties: false,
  required: ['invocation_id', 'config_path', 'source_ref', 'auth_mode'],
  properties: {
    invocation_id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,47}$' },
    config_path: { type: 'string', minLength: 1, maxLength: 240 },
    source_ref: { type: 'string', minLength: 1, maxLength: 240 },
    context_json: { type: 'string' },
    auth_mode: { enum: ['chatgpt-session', 'api-key'] },
    session_secret_name: { type: 'string' },
    caller_profile: { enum: ['manual', 'triage'] },
    issue_number: { type: 'integer', minimum: 0 },
    triage_config_path: { type: 'string', maxLength: 240 },
    expected_source_sha: { type: 'string' },
    triage_fingerprint: { type: 'string', pattern: '^(?:[a-f0-9]{64})?$' },
  },
});

export function contractError(code) {
  return Object.assign(new Error(code), { code });
}

export function validateRelativePath(path) {
  if (typeof path !== 'string' || !path || path.length > 240 || /[\\:\x00-\x1f]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')) throw contractError('INVALID_CONFIG');
  return path;
}

export function validateRequest(config, inputs) {
  if (!checkInputs(inputs) || !checkConfig(config)) throw contractError('INVALID_CONFIG');
  const profile = inputs.caller_profile ?? 'manual';
  if (profile === 'triage') {
    if (!Number.isSafeInteger(inputs.issue_number) || inputs.issue_number < 1 || !/^[a-f0-9]{40}$/.test(inputs.expected_source_sha ?? '')) throw contractError('INVALID_CONFIG');
    validateRelativePath(inputs.triage_config_path);
  } else if ((inputs.issue_number ?? 0) !== 0 || (inputs.triage_config_path ?? '') !== '' || (inputs.expected_source_sha ?? '') !== '' || (inputs.triage_fingerprint ?? '') !== '') throw contractError('INVALID_CONFIG');
  validateRelativePath(inputs.config_path);
  for (const stage of [config.execution, config.decision].filter(Boolean)) {
    if (stage.template_path !== undefined) validateRelativePath(stage.template_path);
  }
  const ref = inputs.source_ref;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(ref) || ref.startsWith('refs/') || ref.includes('..')
    || ref.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock')) || ref.endsWith('.')) throw contractError('INVALID_CONFIG');
  const secret = inputs.session_secret_name ?? '';
  if (inputs.auth_mode === 'chatgpt-session'
    ? !/^[A-Z][A-Z0-9_]{0,99}$/.test(secret) || secret.startsWith('GITHUB_')
    : secret !== '') throw contractError('INVALID_CONFIG');
  const raw = inputs.context_json ?? '{}';
  if (Buffer.byteLength(raw, 'utf8') > 32768) throw contractError('INVALID_CONFIG');
  let context;
  try { context = JSON.parse(raw); } catch { throw contractError('INVALID_CONFIG'); }
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw contractError('INVALID_CONFIG');
  return { ...inputs, session_secret_name: secret, config: structuredClone(config), context };
}

export async function readTrustedFile(root, path, maxBytes, errorCode = 'INVALID_CONFIG') {
  try {
    validateRelativePath(path);
    const base = await realpath(root);
    let target = base;
    for (const part of path.split('/')) {
      target = join(target, part);
      const info = await lstat(target);
      if (info.isSymbolicLink()) throw contractError(errorCode);
    }
    const canonical = await realpath(target);
    const rel = relative(base, canonical);
    const info = await lstat(target);
    if (isAbsolute(rel) || rel.startsWith('..') || !info.isFile() || info.size > maxBytes) throw contractError(errorCode);
    const bytes = await readFile(resolve(target));
    if (bytes.length > maxBytes) throw contractError(errorCode);
    return bytes;
  } catch { throw contractError(errorCode); }
}

export async function loadRequest(root, inputs) {
  try {
    const bytes = await readTrustedFile(root, inputs.config_path, 32768);
    const request = validateRequest(JSON.parse(bytes.toString('utf8')), inputs);
    request.prompts = {};
    for (const kind of ['decision', 'execution']) {
      const stage = request.config[kind];
      if (!stage?.template_path) continue;
      const content = await readTrustedFile(root, stage.template_path, 32768);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (!text.trim()) throw contractError('INVALID_CONFIG');
      request.prompts[kind] = text;
    }
    return request;
  } catch { throw contractError('INVALID_CONFIG'); }
}
