import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runInvocation, publicationStatus } from '../../scripts/llm/orchestrate.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url));
const { parse } = require('yaml');

const sha = 'a'.repeat(40);
async function caller(t, name, auth_mode = 'api-key') {
  const dir = await mkdtemp(join(tmpdir(), 'llm-caller-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sourceRoot = join(dir, 'consumer'); await mkdir(sourceRoot);
  await mkdir(join(sourceRoot, '.github', 'llm'), { recursive: true });
  const prompt = `${name}: executar análise com o meu template`;
  await writeFile(join(sourceRoot, '.github', 'llm', 'prompt.md'), prompt);
  await writeFile(join(sourceRoot, '.github', 'llm', 'request.json'), JSON.stringify({ schema_version: 1, invocation_mode: 'single', execution: { model: `${name}-model`, effort: 'high', template_path: '.github/llm/prompt.md' } }));
  const outputRoot = join(dir, 'results'); await mkdir(outputRoot);
  const repository = `owner/${name}`;
  const metadataApi = { getRepository: async () => ({ full_name: repository, private: true, fork: false, default_branch: 'master' }), getBranch: async () => ({ name: 'master', commit: { sha } }) };
  const event = { repository, event_name: 'workflow_dispatch', ref: 'refs/heads/master', sha, workflow_sha: sha, workflow_ref: `${repository}/.github/workflows/llm.yml@refs/heads/master`, server_url: 'https://github.com', run_id: '42', run_attempt: '1' };
  const inputs = { invocation_id: name, config_path: '.github/llm/request.json', source_ref: 'master', context_json: '{"scenario":"caller"}', auth_mode, session_secret_name: auth_mode === 'chatgpt-session' ? 'MY_CODEX_AUTH' : '' };
  const session = JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'access-fixture', id_token: 'id-fixture', refresh_token: 'refresh-fixture' } });
  const secrets = auth_mode === 'api-key' ? { OPENAI_API_KEY: 'api-fixture' } : { CODEX_AUTH_JSON: session, CODEX_AUTH_WRITE_PAT: 'pat-fixture', GITHUB_TOKEN: 'github-fixture' };
  const options = { metadataApi, execution: { cliPath: fileURLToPath(new URL('./fixtures/codex.mjs', import.meta.url)) } };
  return { sourceRoot, outputRoot, event, inputs, secrets, automation_sha: 'b'.repeat(40), prompt, options };
}

test('T9/LLM-01/06/17: two real caller fixtures consume the same orchestration with their own model and prompt', async t => {
  for (const name of ['triage', 'review']) {
    const c = await caller(t, name);
    const result = await runInvocation(c, c.options);
    const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
    assert.equal(envelope.repository, c.event.repository);
    assert.equal(envelope.source_sha, sha);
    assert.equal(envelope.invocation_id, name);
    assert.equal(envelope.summary, `${name}-model|high|${c.prompt}`);
    assert.equal(envelope.status, 'succeeded');
    assert.equal(envelope.patch_file, null);
    assert.equal(result.outputs.artifact_name, `llm-42-1-${name}`);
  }
});
test('T9/LLM-11/12: provider failure still attempts session persistence and always cleans auth', async t => {
  const c = await caller(t, 'review', 'chatgpt-session');
  let authDirectory; let persisted = false;
  const options = { ...c.options,
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/runs/') ? { id: 42, created_at: '2026-10-13T12:00:01Z', repository: { full_name: c.event.repository } } : { name: 'MY_CODEX_AUTH', updated_at: '2026-10-13T12:00:00Z' } }),
    execute: async (_request, { auth }) => { authDirectory = auth.dir; throw Object.assign(new Error('provider'), { code: 'PROVIDER_ERROR' }); },
    persist: async () => { persisted = true; return { persisted: false }; },
  };
  await assert.rejects(runInvocation(c, options), { code: 'PROVIDER_ERROR' });
  assert.equal(persisted, true);
  await assert.rejects(readdir(authDirectory), { code: 'ENOENT' });
  assert.deepEqual(await readdir(c.outputRoot), []);
});
test('T9/LLM-11/21: session persistence failure cannot release an otherwise successful result', async t => {
  const c = await caller(t, 'triage', 'chatgpt-session');
  const options = { ...c.options,
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/runs/') ? { id: 42, created_at: '2026-10-13T12:00:01Z', repository: { full_name: c.event.repository } } : { name: 'MY_CODEX_AUTH', updated_at: '2026-10-13T12:00:00Z' } }),
    execute: async () => ({ status: 'succeeded', decision: 'none', summary: 'valid result', patch: null }),
    persist: async () => { throw Object.assign(new Error('persist'), { code: 'AUTH_PERSIST_FAILED' }); },
  };
  await assert.rejects(runInvocation(c, options), { code: 'AUTH_PERSIST_FAILED' });
  assert.deepEqual(await readdir(c.outputRoot), []);
});
test('T9/LLM-11/12: external rotation without CLI refresh blocks artifacts and cleans authentication', async t => {
  const c = await caller(t, 'rotation', 'chatgpt-session');
  let metadataReads = 0; let authDirectory;
  const options = { ...c.options,
    fetchImpl: async (url, options) => {
      assert.notEqual(options.method, 'PUT');
      if (url.includes('/runs/')) return { ok: true, json: async () => ({ id: 42, created_at: '2026-10-13T12:00:01Z', repository: { full_name: c.event.repository } }) };
      metadataReads++;
      return { ok: true, json: async () => ({ name: 'MY_CODEX_AUTH', updated_at: metadataReads === 1 ? '2026-10-13T12:00:00Z' : '2026-10-13T12:00:02Z' }) };
    },
    execute: async (_request, { auth }) => {
      authDirectory = auth.dir;
      return { status: 'succeeded', decision: 'none', summary: 'valid result', patch: null };
    },
  };
  await assert.rejects(runInvocation(c, options), { code: 'AUTH_STATE_CONFLICT' });
  assert.deepEqual(await readdir(c.outputRoot), []);
  await assert.rejects(readdir(authDirectory), { code: 'ENOENT' });
});

test('T9/LLM-07: public reusable code grants no authentication when caller supplies no credentials', async t => {
  for (const mode of ['api-key', 'chatgpt-session']) {
    const c = await caller(t, 'no-auth', mode); c.secrets = {};
    await assert.rejects(runInvocation(c, c.options), { code: 'AUTH_CONFIG_ERROR' });
    assert.deepEqual(await readdir(c.outputRoot), []);
  }
});
test('T9/LLM-21: freshly rotated credentials cannot escape in the result artifact', async t => {
  const c = await caller(t, 'leak', 'chatgpt-session');
  const options = { ...c.options,
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/runs/') ? { id: 42, created_at: '2026-10-13T12:00:01Z', repository: { full_name: c.event.repository } } : { name: 'MY_CODEX_AUTH', updated_at: '2026-10-13T12:00:00Z' } }),
    execute: async (_request, { auth }) => {
      const data = JSON.parse(await readFile(auth.file, 'utf8'));
      data.tokens.access_token = 'new-private-token-sentinel'; await writeFile(auth.file, JSON.stringify(data));
      return { status: 'succeeded', decision: 'none', summary: data.tokens.access_token, patch: null };
    },
    persist: async () => ({ persisted: true }),
  };
  await assert.rejects(runInvocation(c, options), { code: 'INVALID_RESULT' });
  assert.deepEqual(await readdir(c.outputRoot), []);
});
test('T9: workflow contract preserves caller ownership, pinned code, serialization and publication failure', async () => {
  const workflow = parse(await readFile(new URL('../../.github/workflows/llm-execute.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on.workflow_call.inputs).sort(), ['auth_mode', 'config_path', 'context_json', 'invocation_id', 'session_secret_name', 'source_ref']);
  assert.deepEqual(Object.keys(workflow.on.workflow_call.secrets).sort(), ['CODEX_AUTH_JSON', 'CODEX_AUTH_WRITE_PAT', 'OPENAI_API_KEY']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  const job = workflow.jobs.invoke;
  assert.equal(job.concurrency['cancel-in-progress'], false);
  assert.equal(job.concurrency.queue, 'max');
  assert.equal(job.concurrency.group.includes('github.repository, inputs.session_secret_name'), true);
  const steps = job.steps;
  for (const step of steps.filter(step => step.uses)) assert.match(step.uses, /@[a-f0-9]{40}$/);
  assert.equal(steps[0].with.repository, '${{ job.workflow_repository }}');
  assert.equal(steps[0].with.ref, '${{ job.workflow_sha }}');
  assert.equal(steps.find(step => step.id === 'invoke').env.CODEX_AUTH_JSON, '${{ secrets.CODEX_AUTH_JSON }}');
  assert.equal(steps.filter(step => step.env?.CODEX_AUTH_JSON).length, 1);
  const upload = steps.find(step => step.id === 'upload');
  assert.equal(upload.with['retention-days'], 1);
  assert.equal(upload.with.overwrite, false);
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.equal(steps.find(step => step.id === 'cleanup').if, 'always()');
  assert.equal(job.outputs.status, '${{ steps.finish.outputs.status }}');
  assert.equal(publicationStatus('success', 'success', 'success', 'succeeded'), 'succeeded');
  for (const outcomes of [['failure', 'skipped', 'success'], ['success', 'failure', 'success'], ['success', 'success', 'failure'], ['cancelled', 'skipped', 'success']]) assert.throws(() => publicationStatus(...outcomes, 'succeeded'), { code: 'ARTIFACT_FAILED' });
});
test('T9: actual runner finalization writes failure instead of success when upload fails', async t => {
  const c = await caller(t, 'finalize');
  const output = join(c.outputRoot, 'github-output'); await writeFile(output, '');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    INPUTS_JSON: JSON.stringify(c.inputs), RUNNER_TEMP: c.outputRoot,
    GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', GITHUB_OUTPUT: output,
    INVOCATION_OUTCOME: 'success', UPLOAD_OUTCOME: 'failure', CLEANUP_OUTCOME: 'success', RESULT_STATUS: 'succeeded' };
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/llm/run.mjs', import.meta.url)), 'finish'], { env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(await readFile(output, 'utf8'), 'status=failed\nerror_code=ARTIFACT_FAILED\n');
  assert.equal(result.stderr, 'ARTIFACT_FAILED\n');
});
