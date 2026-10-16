import { readFile, writeFile, mkdir, appendFile, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyContext, githubMetadataApi } from './preflight.mjs';
import { validateRequest, contractError } from './validate-request.mjs';
import { runInvocation, publicationStatus } from './orchestrate.mjs';
import { createTriageApi } from '../triage/api.mjs';
import { resolveTriageInvocation } from '../triage/invocation.mjs';
import { createReviewApi } from '../review/api.mjs';
import { resolveReviewInvocation } from '../review/invocation.mjs';

const env = process.env;
let inputs;
const event = { repository: env.GITHUB_REPOSITORY, event_name: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, sha: env.GITHUB_SHA, workflow_sha: env.GITHUB_WORKFLOW_SHA, workflow_ref: env.GITHUB_WORKFLOW_REF, server_url: env.GITHUB_SERVER_URL, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT };
const phase = process.argv[2];
const safeCodes = new Set(['INVALID_CONFIG', 'INSTRUCTIONS_INVALID', 'UNTRUSTED_CONTEXT', 'AUTH_CONFIG_ERROR', 'AUTH_REQUIRED', 'AUTH_SNAPSHOT_STALE', 'AUTH_STATE_CONFLICT', 'AUTH_PERSIST_FAILED', 'PROVIDER_ERROR', 'TIMEOUT', 'INVALID_RESULT', 'ARTIFACT_FAILED', 'INVALID_TRIAGE_CONFIG', 'INVALID_TRIAGE_INPUT', 'TRIAGE_METADATA_UNAVAILABLE', 'STALE_TRIAGE_INPUT']);
for (const code of ['INVALID_REVIEW_CONFIG', 'REVIEW_METADATA_UNAVAILABLE', 'REVIEW_INCONCLUSIVE', 'STALE_REVIEW_INPUT']) safeCodes.add(code);

function head(path) {
  const git = spawnSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true,
    env: { PATH: env.PATH, ...(env.SystemRoot ? { SystemRoot: env.SystemRoot } : {}), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } });
  if (git.status !== 0 || !/^[a-f0-9]{40}$/.test(git.stdout?.trim() ?? '')) throw contractError('UNTRUSTED_CONTEXT');
  return git.stdout.trim();
}

async function emit(values) {
  const text = Object.entries(values).map(([key, value]) => {
    if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
    if (!/^[a-z_]+$/.test(key) || typeof value !== 'string' || /[\r\n]/.test(value)) throw contractError('INVALID_RESULT');
    return `${key}=${value}\n`;
  }).join('');
  if (Buffer.byteLength(text) > 8192) throw contractError('INVALID_RESULT');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, text);
}

function stateRoot() {
  validateRequest({ schema_version: 1, invocation_mode: 'single', execution: { model: 'validation-only', effort: 'low', template: 'analyze' } }, inputs);
  if (!env.RUNNER_TEMP || !/^[1-9][0-9]*$/.test(event.run_id) || !/^[1-9][0-9]*$/.test(event.run_attempt)) throw contractError('UNTRUSTED_CONTEXT');
  return join(resolve(env.RUNNER_TEMP), `llm-run-${event.run_id}-${event.run_attempt}-${inputs.invocation_id}`);
}

try {
  inputs = JSON.parse(env.INPUTS_JSON ?? '{}');
  if (inputs.caller_profile === 'triage' && ['preflight', 'source', 'invoke'].includes(phase)) {
    let payload;
    try { payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8')); }
    catch { throw contractError('UNTRUSTED_CONTEXT'); }
    event.action = payload.action;
    event.actor = env.GITHUB_ACTOR;
    event.issue_number = event.event_name === 'issues' ? payload.issue?.number : inputs.issue_number;
    if (event.event_name === 'workflow_dispatch' && payload.inputs?.issue_number !== undefined && Number(payload.inputs.issue_number) !== inputs.issue_number) throw contractError('UNTRUSTED_CONTEXT');
  }
  if (inputs.caller_profile === 'review' && ['preflight', 'source', 'invoke'].includes(phase)) {
    let payload;
    try { payload = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8')); }
    catch { throw contractError('UNTRUSTED_CONTEXT'); }
    if (event.event_name !== 'workflow_dispatch' || Number(payload.inputs?.pull_number) !== inputs.pull_number
      || (payload.inputs?.review_handoff_json ?? '{}') !== (inputs.review_handoff_json ?? '{}')) throw contractError('UNTRUSTED_CONTEXT');
    event.pull_number = Number(payload.inputs.pull_number); event.actor = env.GITHUB_ACTOR; event.actor_id = Number(env.GITHUB_ACTOR_ID);
  }
  const root = stateRoot();
  const stateFile = join(root, 'state.json');
  if (phase === 'preflight') {
    const api = inputs.caller_profile === 'review' ? createReviewApi(env.REVIEW_READ_TOKEN)
      : inputs.caller_profile === 'triage' ? createTriageApi(env.TRIAGE_READ_TOKEN) : githubMetadataApi(env.GITHUB_TOKEN);
    const metadata = await verifyContext(event, inputs, api);
    await mkdir(root, { mode: 0o700 });
    await writeFile(stateFile, JSON.stringify(metadata), { mode: 0o600, flag: 'wx' });
    await emit({ source_sha: metadata.source_sha, ...(metadata.config_source_sha ? { config_source_sha: metadata.config_source_sha } : {}),
      ...(metadata.review_source_sha ? { review_source_sha: metadata.review_source_sha } : {}) });
  } else if (phase === 'source') {
    if (!['triage', 'review'].includes(inputs.caller_profile)) throw contractError('INVALID_CONFIG');
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    const configRoot = resolve(env.GITHUB_WORKSPACE, 'consumer');
    const checkedConfigSha = head(configRoot);
    if (checkedConfigSha !== state.config_source_sha) throw contractError('UNTRUSTED_CONTEXT');
    const snapshot = inputs.caller_profile === 'review'
      ? await resolveReviewInvocation({ configRoot, sourceRoot: resolve(env.GITHUB_WORKSPACE, 'consumer-source'), event, inputs, checkedConfigSha }, createReviewApi(env.REVIEW_READ_TOKEN))
      : await resolveTriageInvocation({ configRoot, event, inputs, checkedConfigSha }, createTriageApi(env.TRIAGE_READ_TOKEN));
    const saved = inputs.caller_profile === 'review' ? { source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha } : snapshot;
    await writeFile(stateFile, JSON.stringify({ ...state, snapshot: saved }), { mode: 0o600 });
    await emit({ source_sha: snapshot.source_sha, config_source_sha: snapshot.config_source_sha });
  } else if (phase === 'invoke') {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    const triage = ['triage', 'review'].includes(inputs.caller_profile);
    const configRoot = resolve(env.GITHUB_WORKSPACE, 'consumer');
    const sourceRoot = triage ? resolve(env.GITHUB_WORKSPACE, 'consumer-source') : configRoot;
    const checkedConfigSha = head(configRoot); const checkedOutSha = head(sourceRoot);
    if (checkedConfigSha !== (triage ? state.config_source_sha : state.source_sha)
      || checkedOutSha !== (triage ? state.snapshot?.source_sha : state.source_sha)
      || !/^[a-f0-9]{40}$/.test(env.AUTOMATION_SHA ?? '')) throw contractError('UNTRUSTED_CONTEXT');
    const outputRoot = join(root, 'artifacts'); await mkdir(outputRoot);
    const result = await runInvocation({ sourceRoot, configRoot, outputRoot, inputs, event, automation_sha: env.AUTOMATION_SHA,
      secrets: { CODEX_AUTH_JSON: env.CODEX_AUTH_JSON, CODEX_AUTH_WRITE_PAT: env.CODEX_AUTH_WRITE_PAT, OPENAI_API_KEY: env.OPENAI_API_KEY, GITHUB_TOKEN: env.GITHUB_TOKEN, TRIAGE_READ_TOKEN: env.TRIAGE_READ_TOKEN, REVIEW_READ_TOKEN: env.REVIEW_READ_TOKEN } },
      { checkedOutSha, checkedConfigSha, auth: { tempRoot: root } });
    await emit({ ...result.outputs, result_directory: result.directory });
  } else if (phase === 'cleanup') {
    try {
      const target = await realpath(root);
      const temp = await realpath(env.RUNNER_TEMP);
      const path = relative(temp, target);
      if (target !== root || isAbsolute(path) || path.startsWith('..') || !path.startsWith('llm-run-')) throw contractError('UNTRUSTED_CONTEXT');
      await rm(target, { recursive: true, force: true });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  } else if (phase === 'finish') {
    await emit({ status: publicationStatus(env.INVOCATION_OUTCOME, env.UPLOAD_OUTCOME, env.CLEANUP_OUTCOME, env.RESULT_STATUS), error_code: '' });
  } else throw contractError('INVALID_CONFIG');
} catch (error) {
  const code = safeCodes.has(error.code) ? error.code : 'PROVIDER_ERROR';
  await emit({ status: 'failed', error_code: code });
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
