import { readFile, writeFile, mkdir, appendFile, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyContext, githubMetadataApi } from './preflight.mjs';
import { validateRequest, contractError } from './validate-request.mjs';
import { runInvocation, publicationStatus } from './orchestrate.mjs';

const env = process.env;
let inputs;
const event = { repository: env.GITHUB_REPOSITORY, event_name: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, sha: env.GITHUB_SHA, workflow_sha: env.GITHUB_WORKFLOW_SHA, workflow_ref: env.GITHUB_WORKFLOW_REF, server_url: env.GITHUB_SERVER_URL, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT };
const phase = process.argv[2];
const safeCodes = new Set(['INVALID_CONFIG', 'INSTRUCTIONS_INVALID', 'UNTRUSTED_CONTEXT', 'AUTH_CONFIG_ERROR', 'AUTH_REQUIRED', 'AUTH_SNAPSHOT_STALE', 'AUTH_STATE_CONFLICT', 'AUTH_PERSIST_FAILED', 'PROVIDER_ERROR', 'TIMEOUT', 'INVALID_RESULT', 'ARTIFACT_FAILED']);

async function emit(values) {
  const text = Object.entries(values).map(([key, value]) => {
    if (!/^[a-z_]+$/.test(key) || typeof value !== 'string' || /[\r\n]/.test(value)) throw contractError('INVALID_RESULT');
    return `${key}=${value}\n`;
  }).join('');
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, text);
}

function stateRoot() {
  validateRequest({ schema_version: 1, invocation_mode: 'single', execution: { model: 'validation-only', effort: 'low', template: 'analyze' } }, inputs);
  if (!env.RUNNER_TEMP || !/^[1-9][0-9]*$/.test(event.run_id) || !/^[1-9][0-9]*$/.test(event.run_attempt)) throw contractError('UNTRUSTED_CONTEXT');
  return join(resolve(env.RUNNER_TEMP), `llm-run-${event.run_id}-${event.run_attempt}-${inputs.invocation_id}`);
}

try {
  inputs = JSON.parse(env.INPUTS_JSON ?? '{}');
  const root = stateRoot();
  const stateFile = join(root, 'state.json');
  if (phase === 'preflight') {
    const metadata = await verifyContext(event, inputs, githubMetadataApi(env.GITHUB_TOKEN));
    await mkdir(root, { mode: 0o700 });
    await writeFile(stateFile, JSON.stringify(metadata), { mode: 0o600, flag: 'wx' });
    await emit({ source_sha: metadata.source_sha });
  } else if (phase === 'invoke') {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    const sourceRoot = resolve(env.GITHUB_WORKSPACE, 'consumer');
    const git = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
    if (git.status !== 0 || git.stdout.trim() !== state.source_sha || !/^[a-f0-9]{40}$/.test(env.AUTOMATION_SHA ?? '')) throw contractError('UNTRUSTED_CONTEXT');
    const outputRoot = join(root, 'artifacts'); await mkdir(outputRoot);
    const result = await runInvocation({ sourceRoot, outputRoot, inputs, event, automation_sha: env.AUTOMATION_SHA,
      secrets: { CODEX_AUTH_JSON: env.CODEX_AUTH_JSON, CODEX_AUTH_WRITE_PAT: env.CODEX_AUTH_WRITE_PAT, OPENAI_API_KEY: env.OPENAI_API_KEY, GITHUB_TOKEN: env.GITHUB_TOKEN } },
      { checkedOutSha: state.source_sha, auth: { tempRoot: root } });
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
