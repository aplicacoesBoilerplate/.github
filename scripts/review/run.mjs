import { readFile, writeFile, appendFile, mkdir, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { contractError, readTrustedFile } from '../llm/validate-request.mjs';
import { checkedHead } from '../triage/workflow.mjs';
import { verifyReviewOrigin } from './collect.mjs';
import { createReviewApi } from './api.mjs';
import { validateWorkflowInputs, collectWorkflow, invocationInputs, prepareWorkflow, publishWorkflow, workflowOutcome } from './workflow.mjs';

const env = process.env; const phase = process.argv[2];
const safeCodes = new Set(['UNTRUSTED_CONTEXT', 'INVALID_CONFIG', 'INVALID_REVIEW_CONFIG', 'INVALID_REVIEW_INPUT', 'INVALID_RESULT',
  'INVALID_REVIEW_PATCH', 'INVALID_REVIEW_VERIFICATION', 'STALE_REVIEW_INPUT', 'REVIEW_METADATA_UNAVAILABLE', 'REVIEW_PUBLISH_FAILED',
  'REVIEW_RESOURCE_CONFLICT', 'REVIEW_INCONCLUSIVE', 'CHECK_CLEANUP_FAILED', 'ARTIFACT_FAILED', 'INSTRUCTIONS_INVALID']);
async function emit(values) {
  const lines = Object.entries(values).map(([key, value]) => {
    if (value != null && !['string', 'number'].includes(typeof value)) throw contractError('INVALID_RESULT');
    const text = String(value ?? ''); if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(text)) throw contractError('INVALID_RESULT'); return `${key}=${text}\n`;
  }).join('');
  if (Buffer.byteLength(lines) > 8192) throw contractError('INVALID_RESULT');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, lines);
}
function rootFor(pull) {
  if (!env.RUNNER_TEMP || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
    || !Number.isSafeInteger(pull) || pull < 1) throw contractError('UNTRUSTED_CONTEXT');
  return join(resolve(env.RUNNER_TEMP), `review-run-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-pr${pull}`);
}
async function cleanup(root) {
  try {
    const canonical = await realpath(root); const base = await realpath(env.RUNNER_TEMP); const path = relative(base, canonical);
    if (canonical !== root || isAbsolute(path) || path.startsWith('..') || !/^review-run-[1-9][0-9]*-[1-9][0-9]*-pr[1-9][0-9]*$/.test(path)) throw contractError('UNTRUSTED_CONTEXT');
    await rm(canonical, { recursive: true, force: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
try {
  if (phase === 'finish') {
    await emit({ status: workflowOutcome({ collect: env.COLLECT_OUTCOME, llm: env.LLM_OUTCOME, checks: env.CHECKS_OUTCOME,
      publish: env.PUBLISH_OUTCOME, cleanup: env.CLEANUP_OUTCOME, status: env.RESULT_STATUS, route: env.RESULT_ROUTE }), error_code: '' });
  } else {
    const inputs = validateWorkflowInputs(JSON.parse(env.INPUTS_JSON ?? '{}'));
    const payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
    if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || Number(payload.inputs?.pull_number) !== inputs.pull_number
      || (payload.inputs?.review_handoff_json ?? '{}') !== (inputs.review_handoff_json ?? '{}')) throw contractError('UNTRUSTED_CONTEXT');
    const event = { repository: env.GITHUB_REPOSITORY, event_name: env.GITHUB_EVENT_NAME, pull_number: inputs.pull_number,
      actor: env.GITHUB_ACTOR, actor_id: Number(env.GITHUB_ACTOR_ID), sha: env.GITHUB_SHA, ref: env.GITHUB_REF,
      workflow_sha: env.GITHUB_WORKFLOW_SHA, workflow_ref: env.GITHUB_WORKFLOW_REF, server_url: env.GITHUB_SERVER_URL,
      run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT };
    const root = rootFor(inputs.pull_number);
    if (phase === 'cleanup') await cleanup(root);
    else {
      if (checkedHead(resolve(env.GITHUB_WORKSPACE, 'automation')) !== env.AUTOMATION_SHA) throw contractError('UNTRUSTED_CONTEXT');
      const configRoot = resolve(env.GITHUB_WORKSPACE, 'consumer'); const sourceRoot = resolve(env.GITHUB_WORKSPACE, 'consumer-source');
      if (phase === 'bootstrap') {
        const origin = await verifyReviewOrigin(event, createReviewApi(env.REVIEW_READ_TOKEN));
        if (inputs.expected_head_sha && origin.pull.head.sha !== inputs.expected_head_sha) throw contractError('STALE_REVIEW_INPUT');
        await mkdir(root, { mode: 0o700 }); await writeFile(join(root, 'origin.json'), JSON.stringify(origin), { mode: 0o600, flag: 'wx' });
        await emit({ config_source_sha: origin.config_source_sha, source_sha: origin.pull.head.sha, base_sha: origin.pull.base.sha });
      } else if (phase === 'collect') {
        const { snapshot, config } = await collectWorkflow({ configRoot, sourceRoot, event, inputs }, createReviewApi(env.REVIEW_READ_TOKEN));
        const origin = JSON.parse(await readFile(join(root, 'origin.json'), 'utf8'));
        if (origin.config_source_sha !== snapshot.config_source_sha || origin.pull.head.sha !== snapshot.source_sha || origin.pull.base.sha !== snapshot.base_sha) throw contractError('STALE_REVIEW_INPUT');
        const directory = join(root, 'snapshot'); await mkdir(directory);
        const bytes = JSON.stringify(snapshot); if (Buffer.byteLength(bytes) > 1048576) throw contractError('INVALID_REVIEW_INPUT');
        await writeFile(join(directory, 'snapshot.json'), bytes, { mode: 0o600, flag: 'wx' });
        const invocation = invocationInputs(inputs, snapshot, config);
        await emit({ route: snapshot.route, pull_number: inputs.pull_number, source_sha: snapshot.source_sha, base_sha: snapshot.base_sha,
          merge_base_sha: snapshot.merge_base_sha, config_source_sha: snapshot.config_source_sha, source_ref: invocation.source_ref,
          llm_config_path: invocation.config_path, fingerprint: snapshot.fingerprint,
          artifact_name: `review-${event.run_id}-${event.run_attempt}-pr${inputs.pull_number}`, artifact_directory: directory });
      } else if (['prepare', 'publish'].includes(phase)) {
        const snapshot = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'review-input'), 'snapshot.json', 1048576, 'INVALID_REVIEW_INPUT')).toString('utf8'));
        const input = { configRoot, sourceRoot, event, inputs, snapshot, automation_sha: env.AUTOMATION_SHA, artifactRoot: resolve(env.GITHUB_WORKSPACE, 'llm-result') };
        if (phase === 'prepare') {
          await mkdir(root, { mode: 0o700 }); const directory = join(root, 'checks'); await mkdir(directory);
          const { verification } = await prepareWorkflow(input);
          await writeFile(join(directory, 'verification.json'), JSON.stringify(verification), { mode: 0o600, flag: 'wx' });
          await emit({ verification_status: verification.status, artifact_directory: directory, artifact_name: `review-checks-${event.run_id}-${event.run_attempt}-pr${inputs.pull_number}` });
        } else {
          let verification;
          if (snapshot.route !== 'needs-human') verification = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'review-checks'), 'verification.json', 8192, 'INVALID_REVIEW_VERIFICATION')).toString('utf8'));
          await emit(await publishWorkflow({ ...input, verification }, { metadataApi: createReviewApi(env.REVIEW_READ_TOKEN), token: env.REVIEW_PUBLISH_TOKEN }));
        }
      } else throw contractError('INVALID_REVIEW_CONFIG');
    }
  }
} catch (error) {
  const code = safeCodes.has(error.code) ? error.code : 'REVIEW_PUBLISH_FAILED';
  await emit({ status: 'failed', error_code: code }); process.stderr.write(`${code}\n`); process.exitCode = 1;
}
