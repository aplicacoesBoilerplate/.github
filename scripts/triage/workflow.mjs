import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readTrustedFile, loadRequest, contractError, validateRelativePath } from '../llm/validate-request.mjs';
import { prepareInstructions } from '../llm/instructions.mjs';
import { validateEnvelope } from '../llm/result.mjs';
import { collectIssue } from './collect.mjs';
import { validateTriageConfig, selectRoute, resolveBase } from './policy.mjs';
import { preparePatch, cleanupPreparedPatch, patchGitEnvironment } from './prepare-patch.mjs';
import { verifyProduct, validateVerificationImage } from './verify-product.mjs';
import { publishTriage } from './publish.mjs';
import { createPublicationApi } from './publication-api.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw contractError(code); };
export function checkedHead(root) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '-C', root, 'rev-parse', 'HEAD'], { env: patchGitEnvironment(), encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(result.stdout?.trim() ?? '')) fail('UNTRUSTED_CONTEXT'); return result.stdout.trim();
}
export function validateWorkflowInputs(inputs) {
  if (!inputs || Object.keys(inputs).some(k => !['config_path', 'issue_number', 'auth_mode', 'session_secret_name', 'verification_image'].includes(k))
    || !['api-key', 'chatgpt-session'].includes(inputs.auth_mode) || !Number.isSafeInteger(inputs.issue_number ?? 0) || (inputs.issue_number ?? 0) < 0) fail('INVALID_TRIAGE_CONFIG');
  validateRelativePath(inputs.config_path); validateVerificationImage(inputs.verification_image);
  const secret = inputs.session_secret_name ?? '';
  if (inputs.auth_mode === 'chatgpt-session' ? !/^[A-Z][A-Z0-9_]{0,99}$/.test(secret) || secret.startsWith('GITHUB_') : secret !== '') fail('INVALID_TRIAGE_CONFIG');
  return inputs;
}
async function policy(root, inputs) {
  validateWorkflowInputs(inputs);
  return validateTriageConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readTrustedFile(root, inputs.config_path, 32768, 'INVALID_TRIAGE_CONFIG'))));
}
export async function collectWorkflow({ configRoot, event, inputs }, api) {
  const config = await policy(configRoot, inputs); const snapshot = await collectIssue({ event, config }, api);
  if (checkedHead(configRoot) !== snapshot.config_source_sha) fail('STALE_TRIAGE_INPUT');
  return { config, snapshot };
}
export function invocationInputs(inputs, snapshot, config) {
  validateWorkflowInputs(inputs);
  return { invocation_id: `triage-${snapshot.issue.number}`, config_path: config.llm_configs[snapshot.route.route === 'propose-patch' ? 'patch' : 'plan'],
    source_ref: snapshot.base_ref ?? snapshot.default_branch, expected_source_sha: snapshot.source_sha, caller_profile: 'triage', issue_number: snapshot.issue.number,
    triage_config_path: inputs.config_path, triage_fingerprint: snapshot.fingerprint, context_json: '{}', auth_mode: inputs.auth_mode, session_secret_name: inputs.session_secret_name ?? '' };
}
function snapshotMatches(snapshot, event, configRoot, sourceRoot, config) {
  if (!snapshot || snapshot.repository !== event.repository || snapshot.issue?.number !== event.issue_number || snapshot.issue.state !== 'open'
    || snapshot.config_source_sha !== checkedHead(configRoot) || (sourceRoot && snapshot.source_sha !== checkedHead(sourceRoot))) fail('STALE_TRIAGE_INPUT');
  let context; try { context = JSON.parse(snapshot.context_json); } catch { fail('INVALID_TRIAGE_INPUT'); }
  if (Buffer.byteLength(snapshot.context_json) > 32768 || hash(snapshot.context_json) !== snapshot.fingerprint
    || JSON.stringify(context.issue) !== JSON.stringify(snapshot.issue) || JSON.stringify(context.metadata) !== JSON.stringify(snapshot.metadata)
    || JSON.stringify(context.route) !== JSON.stringify(snapshot.route) || context.source_sha !== snapshot.source_sha || context.config_source_sha !== snapshot.config_source_sha
    || JSON.stringify(selectRoute(snapshot.metadata)) !== JSON.stringify(snapshot.route)
    || (snapshot.base_ref && resolveBase(snapshot.metadata, config) !== snapshot.base_ref)) fail('INVALID_TRIAGE_INPUT');
}
async function readResult({ configRoot, sourceRoot, inputs, event, snapshot, automation_sha, artifactRoot }) {
  const config = await policy(configRoot, inputs); snapshotMatches(snapshot, event, configRoot, sourceRoot, config);
  if (snapshot.route.route === 'needs-human') return { config, result: null };
  if (!/^[a-f0-9]{40}$/.test(automation_sha ?? '') || !/^[1-9][0-9]*$/.test(String(event.run_id)) || !/^[1-9][0-9]*$/.test(String(event.run_attempt))) fail('UNTRUSTED_CONTEXT');
  const invocation = invocationInputs(inputs, snapshot, config); await loadRequest(configRoot, invocation);
  const expected = { repository: snapshot.repository, source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha,
    run_id: event.run_id, run_attempt: event.run_attempt, invocation_id: invocation.invocation_id, automation_sha,
    config_sha256: hash(await readTrustedFile(configRoot, invocation.config_path, 32768)), instructions_sha256: (await prepareInstructions(configRoot)).sha256 };
  const bytes = await readTrustedFile(artifactRoot, 'result.json', 1048576, 'INVALID_RESULT');
  let envelope; try { envelope = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_RESULT'); }
  validateEnvelope(envelope, expected);
  const patchBytes = envelope.patch_file ? await readTrustedFile(artifactRoot, 'proposal.patch', 1048576, 'INVALID_RESULT') : null;
  if (bytes.length + (patchBytes?.length ?? 0) > 1048576) fail('INVALID_RESULT');
  let patch = null; try { if (patchBytes) patch = new TextDecoder('utf-8', { fatal: true }).decode(patchBytes); } catch { fail('INVALID_RESULT'); }
  if (snapshot.route.route === 'plan' && patch !== null) fail('INVALID_RESULT');
  return { config, result: { envelope, expected, patch } };
}
function reportIdentity(snapshot, result) {
  return { source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha, patch_sha256: result?.patch ? hash(result.patch) : '' };
}
export async function prepareWorkflow(input, options = {}) {
  const { config, result } = await readResult(input); let prepared;
  const identity = reportIdentity(input.snapshot, result);
  if (input.snapshot.route.route !== 'propose-patch' || result?.envelope.status !== 'succeeded' || !result.patch)
    return { result, verification: { status: 'not-required', ...identity, checks: [] } };
  try {
    try { prepared = await preparePatch({ envelope: result.envelope, expected: result.expected, patch: result.patch, sourceRoot: input.sourceRoot, config }); }
    catch (error) {
      if (!['INVALID_RESULT', 'INVALID_TRIAGE_PATCH'].includes(error.code)) throw error;
      return { result, verification: { status: 'rejected', ...identity, checks: [], error_code: error.code } };
    }
    return { result, verification: await verifyProduct({ sourceRoot: prepared.sourceRoot, config, image: input.inputs.verification_image, ...identity }, options.verify) };
  } finally { if (prepared) await cleanupPreparedPatch(prepared); }
}
export async function publishWorkflow(input, { metadataApi, publicationApi, token } = {}) {
  const { config, result } = await readResult(input); let prepared;
  const verification = input.verification;
  if (result?.patch && input.snapshot.route.route === 'propose-patch') {
    const identity = reportIdentity(input.snapshot, result);
    if (!verification || Object.entries(identity).some(([key, value]) => verification[key] !== value)
      || !['passed', 'failed', 'rejected'].includes(verification.status) || !Array.isArray(verification.checks)
      || verification.checks.length > config.checks.length || verification.checks.some((c, i) => c.index !== i || !Number.isInteger(c.exit_code)
        || !['', 'CHECK_FAILED', 'CHECK_TIMEOUT'].includes(c.error_code))
      || (verification.status === 'passed' && (verification.checks.length !== config.checks.length || verification.checks.some(c => c.exit_code !== 0 || c.error_code !== '')))
      || (verification.status === 'failed' && !verification.checks.some(c => c.exit_code !== 0 && c.error_code))) fail('INVALID_TRIAGE_VERIFICATION');
    if (verification.status !== 'rejected') prepared = await preparePatch({ envelope: result.envelope, expected: result.expected, patch: result.patch, sourceRoot: input.sourceRoot, config });
  }
  try {
    const api = publicationApi ?? createPublicationApi(token, { recollect: () => collectIssue({ event: input.event, config }, metadataApi) });
    return await publishTriage({ snapshot: input.snapshot, config, result, prepared, verification }, api);
  } finally { if (prepared) await cleanupPreparedPatch(prepared); }
}
export function workflowOutcome({ collect, publish, cleanup, status }) {
  if (collect !== 'success' || publish !== 'success' || cleanup !== 'success' || !['planned', 'needs-human', 'skipped', 'draft', 'draft-checks-failed'].includes(status)) fail('ARTIFACT_FAILED');
  return status;
}
