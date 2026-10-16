import { readFile, writeFile, appendFile, mkdir, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { contractError, readTrustedFile } from '../llm/validate-request.mjs';
import { verifyTriageOrigin, createTriageApi } from './collect.mjs';
import { checkedHead, validateWorkflowInputs, collectWorkflow, invocationInputs, prepareWorkflow, publishWorkflow, workflowOutcome } from './workflow.mjs';

const env = process.env; const phase = process.argv[2];
const safeCodes = new Set(['UNTRUSTED_CONTEXT', 'INVALID_CONFIG', 'INVALID_TRIAGE_CONFIG', 'INVALID_TRIAGE_INPUT', 'INVALID_RESULT',
  'INVALID_TRIAGE_PATCH', 'INVALID_TRIAGE_VERIFICATION', 'STALE_TRIAGE_INPUT', 'TRIAGE_METADATA_UNAVAILABLE', 'TRIAGE_PUBLISH_FAILED',
  'TRIAGE_RESOURCE_CONFLICT', 'CHECK_CLEANUP_FAILED', 'ARTIFACT_FAILED', 'INSTRUCTIONS_INVALID']);
async function emit(values) {
  const lines = Object.entries(values).map(([key, value]) => {
    const text = String(value ?? ''); if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(text)) throw contractError('INVALID_RESULT'); return `${key}=${text}\n`;
  }).join('');
  if (Buffer.byteLength(lines) > 8192) throw contractError('INVALID_RESULT');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, lines);
}
function rootFor(issue) {
  if (!env.RUNNER_TEMP || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
    || !Number.isSafeInteger(issue) || issue < 1) throw contractError('UNTRUSTED_CONTEXT');
  return join(resolve(env.RUNNER_TEMP), `triage-run-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-issue${issue}`);
}
async function cleanup(root) {
  try {
    const canonical = await realpath(root); const base = await realpath(env.RUNNER_TEMP); const path = relative(base, canonical);
    if (canonical !== root || isAbsolute(path) || path.startsWith('..') || !/^triage-run-[1-9][0-9]*-[1-9][0-9]*-issue[1-9][0-9]*$/.test(path)) throw contractError('UNTRUSTED_CONTEXT');
    await rm(canonical, { recursive: true, force: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

try {
  if (phase === 'finish') {
    await emit({ status: workflowOutcome({ collect: env.COLLECT_OUTCOME, publish: env.PUBLISH_OUTCOME, cleanup: env.CLEANUP_OUTCOME, status: env.RESULT_STATUS }), error_code: '' });
  } else {
    const inputs = validateWorkflowInputs(JSON.parse(env.INPUTS_JSON ?? '{}'));
    const payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
    const issue = env.GITHUB_EVENT_NAME === 'issues' ? payload.issue?.number : inputs.issue_number;
    if (env.GITHUB_EVENT_NAME === 'issues' && inputs.issue_number !== 0 && inputs.issue_number !== issue) throw contractError('UNTRUSTED_CONTEXT');
    if (env.GITHUB_EVENT_NAME === 'workflow_dispatch' && payload.inputs?.issue_number !== undefined && Number(payload.inputs.issue_number) !== issue) throw contractError('UNTRUSTED_CONTEXT');
    const event = { repository: env.GITHUB_REPOSITORY, event_name: env.GITHUB_EVENT_NAME, action: payload.action, issue_number: issue, actor: env.GITHUB_ACTOR,
      sha: env.GITHUB_SHA, ref: env.GITHUB_REF, workflow_sha: env.GITHUB_WORKFLOW_SHA, workflow_ref: env.GITHUB_WORKFLOW_REF,
      server_url: env.GITHUB_SERVER_URL, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT };
    const root = rootFor(issue);
    if (phase === 'cleanup') await cleanup(root);
    else {
      if (checkedHead(resolve(env.GITHUB_WORKSPACE, 'automation')) !== env.AUTOMATION_SHA) throw contractError('UNTRUSTED_CONTEXT');
      const configRoot = resolve(env.GITHUB_WORKSPACE, 'consumer');
      if (phase === 'bootstrap') {
        const metadata = await verifyTriageOrigin(event, createTriageApi(env.TRIAGE_READ_TOKEN));
        await mkdir(root, { mode: 0o700 }); await writeFile(join(root, 'origin.json'), JSON.stringify(metadata.config_source_sha), { mode: 0o600, flag: 'wx' });
        await emit({ config_source_sha: metadata.config_source_sha });
      } else if (phase === 'collect') {
        const { snapshot, config } = await collectWorkflow({ configRoot, event, inputs }, createTriageApi(env.TRIAGE_READ_TOKEN));
        if (JSON.parse(await readFile(join(root, 'origin.json'), 'utf8')) !== snapshot.config_source_sha) throw contractError('STALE_TRIAGE_INPUT');
        const directory = join(root, 'snapshot'); await mkdir(directory);
        const bytes = JSON.stringify(snapshot); if (Buffer.byteLength(bytes) > 1048576) throw contractError('INVALID_TRIAGE_INPUT');
        await writeFile(join(directory, 'snapshot.json'), bytes, { mode: 0o600, flag: 'wx' });
        const invocation = invocationInputs(inputs, snapshot, config);
        await emit({ route: snapshot.route.route, issue_number: issue, source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha,
          source_ref: invocation.source_ref, llm_config_path: invocation.config_path, fingerprint: snapshot.fingerprint,
          artifact_name: `triage-${event.run_id}-${event.run_attempt}-issue${issue}`, artifact_directory: directory });
      } else if (['prepare', 'publish'].includes(phase)) {
        const snapshot = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'triage-input'), 'snapshot.json', 1048576, 'INVALID_TRIAGE_INPUT')).toString('utf8'));
        const sourceRoot = snapshot.route?.route === 'needs-human' ? undefined : resolve(env.GITHUB_WORKSPACE, 'consumer-source');
        const input = { configRoot, sourceRoot, event, inputs, snapshot, automation_sha: env.AUTOMATION_SHA, artifactRoot: resolve(env.GITHUB_WORKSPACE, 'llm-result') };
        if (phase === 'prepare') {
          await mkdir(root, { mode: 0o700 }); const directory = join(root, 'checks'); await mkdir(directory);
          const { verification } = await prepareWorkflow(input);
          await writeFile(join(directory, 'verification.json'), JSON.stringify(verification), { mode: 0o600, flag: 'wx' });
          await emit({ verification_status: verification.status, artifact_directory: directory,
            artifact_name: `triage-checks-${event.run_id}-${event.run_attempt}-issue${issue}` });
        } else {
          let verification;
          if (snapshot.route.route !== 'needs-human') verification = JSON.parse((await readTrustedFile(resolve(env.GITHUB_WORKSPACE, 'triage-checks'), 'verification.json', 8192, 'INVALID_TRIAGE_VERIFICATION')).toString('utf8'));
          const result = await publishWorkflow({ ...input, verification }, { metadataApi: createTriageApi(env.TRIAGE_READ_TOKEN), token: env.TRIAGE_PUBLISH_TOKEN });
          await emit(result);
        }
      } else throw contractError('INVALID_TRIAGE_CONFIG');
    }
  }
} catch (error) {
  const code = safeCodes.has(error.code) ? error.code : 'TRIAGE_PUBLISH_FAILED';
  await emit({ status: 'failed', error_code: code }); process.stderr.write(`${code}\n`); process.exitCode = 1;
}
