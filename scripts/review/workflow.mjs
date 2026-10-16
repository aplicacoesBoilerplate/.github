import { createHash } from 'node:crypto';
import { readTrustedFile, loadRequest, contractError, validateRelativePath } from '../llm/validate-request.mjs';
import { prepareInstructions } from '../llm/instructions.mjs';
import { checkedHead } from '../triage/workflow.mjs';
import { verifyProduct, validateVerificationImage } from '../shared/verify-product.mjs';
import { collectReview, reviewFingerprint } from './collect.mjs';
import { validateReviewConfig, classifyPull } from './policy.mjs';
import { readReviewPackage } from './result.mjs';
import { prepareReviewPatch, cleanupPreparedPatch } from './prepare-patch.mjs';
import { publishReview } from './publish.mjs';
import { createReviewPublicationApi } from './publication-api.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw contractError(code); };
export function validateWorkflowInputs(inputs) {
  try {
    if (!inputs || Object.keys(inputs).some(k => !['config_path', 'pull_number', 'review_handoff_json', 'auth_mode', 'session_secret_name', 'verification_image'].includes(k))
      || !['api-key', 'chatgpt-session'].includes(inputs.auth_mode) || !Number.isSafeInteger(inputs.pull_number) || inputs.pull_number < 1) throw new Error();
    validateRelativePath(inputs.config_path); validateVerificationImage(inputs.verification_image);
    const secret = inputs.session_secret_name ?? '';
    if (inputs.auth_mode === 'chatgpt-session' ? !/^[A-Z][A-Z0-9_]{0,99}$/.test(secret) || secret.startsWith('GITHUB_') : secret !== '') throw new Error();
    const handoff = inputs.review_handoff_json ?? '{}';
    if (typeof handoff !== 'string' || Buffer.byteLength(handoff) > 2048) throw new Error();
    const parsed = JSON.parse(handoff); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    const keys = Object.keys(parsed);
    if (keys.length && (keys.length !== 4 || keys.some(k => !['source_run_id', 'source_run_attempt', 'issue_number', 'source_fingerprint'].includes(k))
      || !/^[1-9][0-9]*$/.test(parsed.source_run_id) || !/^[1-9][0-9]*$/.test(parsed.source_run_attempt)
      || !Number.isSafeInteger(parsed.issue_number) || parsed.issue_number < 1 || !/^[a-f0-9]{64}$/.test(parsed.source_fingerprint))) throw new Error();
    return inputs;
  } catch { fail('INVALID_REVIEW_CONFIG'); }
}
async function policy(root, inputs) {
  validateWorkflowInputs(inputs);
  try { return validateReviewConfig(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readTrustedFile(root, inputs.config_path, 32768, 'INVALID_REVIEW_CONFIG')))); }
  catch { fail('INVALID_REVIEW_CONFIG'); }
}
function collectionInputs(inputs) {
  const handoff = JSON.parse(inputs.review_handoff_json ?? '{}');
  return { config_path: inputs.config_path, pull_number: inputs.pull_number, ...(Object.keys(handoff).length ? { handoff } : {}) };
}
export async function collectWorkflow({ configRoot, sourceRoot, event, inputs }, api) {
  const config = await policy(configRoot, inputs);
  const snapshot = await collectReview({ configRoot, sourceRoot, event, inputs: collectionInputs(inputs) }, api);
  return { config, snapshot };
}
export function invocationInputs(inputs, snapshot, config) {
  validateWorkflowInputs(inputs);
  return { invocation_id: `review-${snapshot.pull.number}`, caller_profile: 'review', pull_number: snapshot.pull.number,
    config_path: config.llm_configs[snapshot.route === 'correction' ? 'correction' : 'review'], source_ref: snapshot.pull.head.ref,
    expected_source_sha: snapshot.source_sha, review_config_path: inputs.config_path, review_fingerprint: snapshot.fingerprint,
    review_handoff_json: inputs.review_handoff_json ?? '{}', context_json: '{}', auth_mode: inputs.auth_mode, session_secret_name: inputs.session_secret_name ?? '' };
}
async function readResult({ configRoot, sourceRoot, event, inputs, snapshot, artifactRoot, automation_sha }) {
  const config = await policy(configRoot, inputs);
  if (snapshot?.repository !== event.repository || snapshot.pull?.number !== inputs.pull_number || snapshot.pull.state !== 'open'
    || snapshot.config_source_sha !== checkedHead(configRoot) || snapshot.source_sha !== checkedHead(sourceRoot)) fail('STALE_REVIEW_INPUT');
  if (snapshot.route === 'needs-human') {
    if (snapshot.error_code !== 'REVIEW_INCONCLUSIVE') fail('INVALID_REVIEW_INPUT');
    return { config, result: null };
  }
  if (snapshot.route !== classifyPull(snapshot.pull, config)
    || snapshot.fingerprint !== reviewFingerprint(snapshot, await readTrustedFile(configRoot, inputs.config_path, 32768, 'INVALID_REVIEW_CONFIG'))
    || JSON.stringify(snapshot.handoff ?? {}) !== JSON.stringify(collectionInputs(inputs).handoff ?? {})) fail('INVALID_REVIEW_INPUT');
  if (!/^[a-f0-9]{40}$/.test(automation_sha ?? '') || !/^[1-9][0-9]*$/.test(String(event.run_id)) || !/^[1-9][0-9]*$/.test(String(event.run_attempt))) fail('UNTRUSTED_CONTEXT');
  const invocation = invocationInputs(inputs, snapshot, config); await loadRequest(configRoot, invocation);
  const expected = { repository: snapshot.repository, source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha,
    run_id: event.run_id, run_attempt: event.run_attempt, invocation_id: invocation.invocation_id, automation_sha,
    config_sha256: hash(await readTrustedFile(configRoot, invocation.config_path, 32768)), instructions_sha256: (await prepareInstructions(configRoot)).sha256,
    pull_number: snapshot.pull.number, base_sha: snapshot.base_sha, merge_base_sha: snapshot.merge_base_sha, review_fingerprint: snapshot.fingerprint };
  return { config, result: { ...await readReviewPackage(artifactRoot, expected, snapshot), expected } };
}
const reportIdentity = (snapshot, result) => ({ source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha, patch_sha256: result?.patch ? hash(result.patch) : '' });
export async function prepareWorkflow(input, options = {}) {
  const { config, result } = await readResult(input); let prepared;
  const identity = reportIdentity(input.snapshot, result);
  if (!result?.patch) return { result, verification: { status: 'not-required', ...identity, checks: [] } };
  try {
    prepared = await prepareReviewPatch({ snapshot: input.snapshot, envelope: result.envelope, expected: result.expected, patch: result.patch, sourceRoot: input.sourceRoot, config });
    const verification = await verifyProduct({ sourceRoot: prepared.sourceRoot, checks: config.checks, image: input.inputs.verification_image,
      ...identity, configError: 'INVALID_REVIEW_CONFIG', verificationError: 'INVALID_REVIEW_VERIFICATION' }, options.verify);
    return { result, verification };
  } finally { if (prepared) await cleanupPreparedPatch(prepared); }
}
export async function publishWorkflow(input, { metadataApi, publicationApi, token } = {}) {
  const { config, result } = await readResult(input); let prepared;
  try {
    if (result?.patch) {
      const identity = reportIdentity(input.snapshot, result); const report = input.verification;
      if (!report || Object.entries(identity).some(([key, value]) => report[key] !== value) || !['passed', 'failed'].includes(report.status)
        || !Array.isArray(report.checks) || !report.checks.length || report.checks.length > config.checks.length
        || report.checks.some((c, i) => c.index !== i || !Number.isInteger(c.exit_code) || !['', 'CHECK_FAILED', 'CHECK_TIMEOUT'].includes(c.error_code))
        || (report.status === 'passed' && (report.checks.length !== config.checks.length || report.checks.some(c => c.exit_code !== 0 || c.error_code !== '')))
        || (report.status === 'failed' && !report.checks.some(c => c.exit_code !== 0 && c.error_code))) fail('INVALID_REVIEW_VERIFICATION');
      // Reconstruct the original patch; never publish the tree which executed product checks.
      prepared = await prepareReviewPatch({ snapshot: input.snapshot, envelope: result.envelope, expected: result.expected, patch: result.patch, sourceRoot: input.sourceRoot, config });
    }
    const api = publicationApi ?? createReviewPublicationApi(token, { recollect: () => collectReview({ configRoot: input.configRoot, sourceRoot: input.sourceRoot,
      event: input.event, inputs: collectionInputs(input.inputs) }, metadataApi) });
    return await publishReview({ snapshot: input.snapshot, result, prepared, verification: input.verification, config }, api);
  } finally { if (prepared) await cleanupPreparedPatch(prepared); }
}
export function workflowOutcome({ collect, llm, checks, publish, cleanup, status, route }) {
  if (collect !== 'success' || publish !== 'success' || cleanup !== 'success'
    || (route === 'needs-human' ? llm !== 'skipped' || checks !== 'skipped' : llm !== 'success' || checks !== 'success')
    || !['reviewed', 'needs-human', 'skipped', 'draft', 'draft-checks-failed'].includes(status)) fail('ARTIFACT_FAILED');
  return status;
}
