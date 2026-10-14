import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runInvocation } from '../../scripts/llm/orchestrate.mjs';
import { validateAndPackage, validateEnvelope } from '../../scripts/llm/result.mjs';
import { collectIssue } from '../../scripts/triage/collect.mjs';

async function fixture(t, effort = 'Low') {
  const root = await mkdtemp(join(tmpdir(), 'triage-central-')); t.after(() => rm(root, { recursive: true, force: true }));
  const configRoot = join(root, 'consumer'); const sourceRoot = join(root, 'consumer-source'); const outputRoot = join(root, 'results');
  for (const dir of [configRoot, sourceRoot, outputRoot]) await mkdir(dir);
  for (const path of ['.github/triage', '.github/llm']) await mkdir(join(configRoot, path), { recursive: true });
  await writeFile(join(configRoot, 'AGENTS.md'), 'trusted consumer instructions');
  await writeFile(join(sourceRoot, 'AGENTS.md'), 'untrusted release instructions');
  await writeFile(join(sourceRoot, 'main.go'), 'release code');
  const config = { schema_version: 1, project: { owner: 'owner', number: 12 },
    fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
    llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' },
    reviewer: 'reviewer', allowed_paths: ['main.go'], checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {} };
  await writeFile(join(configRoot, '.github/triage/config.json'), JSON.stringify(config));
  for (const kind of ['plan', 'patch']) {
    await writeFile(join(configRoot, `.github/llm/${kind}.json`), JSON.stringify({ schema_version: 1, invocation_mode: 'single', execution: { model: `consumer-${kind}`, effort: 'high', template_path: `.github/llm/${kind}.md` } }));
    await writeFile(join(configRoot, `.github/llm/${kind}.md`), `Own ${kind} prompt`);
  }
  const event = { repository: 'owner/app', event_name: 'issues', action: 'opened', issue_number: 7, actor: 'author',
    ref: 'refs/heads/master', sha: 'a'.repeat(40), workflow_sha: 'a'.repeat(40), workflow_ref: 'owner/app/.github/workflows/triage.yml@refs/heads/master',
    server_url: 'https://github.com', run_id: '42', run_attempt: '1' };
  const issue = { number: 7, node_id: 'I7', title: 'Fix typo', body: 'issue body', state: 'open', updated_at: '2026-10-14T10:00:00Z',
    repository_url: 'https://api.github.com/repos/owner/app', user: { login: 'author' }, type: { name: 'Bug' }, milestone: { title: 'v1.0.0', number: 1 } };
  const api = { getRepository: async () => ({ full_name: 'owner/app', private: true, fork: false, default_branch: 'master' }),
    getIssue: async () => issue, getPermission: async (_repo, actor) => ({ permission: 'write', user: { login: actor } }),
    getDependencies: async () => [], getParent: async () => ({ number: 3, state: 'open' }), getIssueFields: async () => [],
    getProjectMetadata: async () => ({ fields: ['Effort', 'Size', 'Estimate', 'Release'].map((name, i) => ({ id: String(i), name })),
      values: [{ field: { id: '0' }, value: effort }, { field: { id: '1' }, value: 'XS' }, { field: { id: '2' }, value: 1 }] }),
    getBranch: async (_repo, ref) => ({ name: ref, commit: { sha: ref === 'master' ? 'a'.repeat(40) : 'b'.repeat(40) } }) };
  const snapshot = await collectIssue({ event, config }, api);
  const calls = [];
  const inputs = { invocation_id: 'triage-7', config_path: config.llm_configs[snapshot.route.route === 'propose-patch' ? 'patch' : 'plan'],
    source_ref: 'release/v1.0.0', expected_source_sha: 'b'.repeat(40), caller_profile: 'triage', issue_number: 7,
    triage_config_path: '.github/triage/config.json', auth_mode: 'api-key', context_json: snapshot.context_json };
  return { root, sourceRoot, configRoot, outputRoot, event, inputs, issue, config, automation_sha: 'c'.repeat(40),
    secrets: { OPENAI_API_KEY: 'api-fixture', TRIAGE_READ_TOKEN: 'read-fixture' },
    options: { triageApi: api, checkedOutSha: 'b'.repeat(40), checkedConfigSha: 'a'.repeat(40),
      execution: { cliPath: fileURLToPath(new URL('../llm/fixtures/codex.mjs', import.meta.url)), onInvocation: data => {
        calls.push({ ...data, instructions: readFileSync(join(data.args[data.args.indexOf('--cd') + 1], 'AGENTS.md'), 'utf8') });
      } } }, calls };
}

test('TRI-04/06/07: triage uses trusted model/prompt/directives and release source in a bound v2 result', async t => {
  const f = await fixture(t);
  const result = await runInvocation(f, f.options);
  const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
  assert.equal(envelope.schema_version, 2);
  assert.equal(envelope.source_sha, 'b'.repeat(40));
  assert.equal(envelope.config_source_sha, 'a'.repeat(40));
  assert.equal(f.calls[0].stage.model, 'consumer-patch');
  assert.equal(f.calls[0].stage.effort, 'high');
  assert.equal(f.calls[0].prompt.task, 'Own patch prompt');
  assert.deepEqual(f.calls[0].prompt.source_files, [{ path: 'main.go', content: 'release code' }]);
  assert.equal(f.calls[0].instructions.includes('trusted consumer instructions'), true);
  assert.equal(f.calls[0].instructions.includes('untrusted release instructions'), false);
  assert.equal(f.calls[0].env.TRIAGE_READ_TOKEN, undefined);
  assert.equal(f.calls[0].env.GITHUB_TOKEN, undefined);
});

test('TRI-03/07/20: forged context, base and config revisions cannot reach authentication or artifacts', async t => {
  for (const scenario of ['context', 'source', 'config', 'base', 'issue', 'read-token']) {
    const f = await fixture(t); let authUsed = false;
    if (scenario === 'context') f.inputs.context_json = '{}';
    if (scenario === 'source') f.inputs.expected_source_sha = 'd'.repeat(40);
    if (scenario === 'config') f.options.checkedConfigSha = 'd'.repeat(40);
    if (scenario === 'base') f.inputs.source_ref = 'master';
    if (scenario === 'issue') f.inputs.issue_number = 8;
    if (scenario === 'read-token') delete f.secrets.TRIAGE_READ_TOKEN;
    const code = ['context', 'source', 'config'].includes(scenario) ? 'STALE_TRIAGE_INPUT'
      : scenario === 'read-token' ? 'TRIAGE_METADATA_UNAVAILABLE' : 'UNTRUSTED_CONTEXT';
    await assert.rejects(runInvocation(f, { ...f.options, onAuth: () => { authUsed = true; } }), { code, message: code });
    assert.equal(authUsed, false);
    assert.deepEqual(await readdir(f.outputRoot), []);
  }
});

test('TRI-09/13: mandatory planning cannot publish an otherwise valid model patch', async t => {
  const f = await fixture(t, 'High');
  f.options.execute = async () => ({ status: 'succeeded', decision: 'none', summary: 'valid summary',
    patch: 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n' });
  await assert.rejects(runInvocation(f, f.options), { code: 'INVALID_RESULT' });
  assert.deepEqual(await readdir(f.outputRoot), []);
});

test('TRI-07/13: v2 inspector refuses config SHA spoofing and schema downgrade', async t => {
  const f = await fixture(t); const result = await runInvocation(f, f.options); const expected = { ...result.envelope };
  assert.equal(validateEnvelope(result.envelope, expected).status, 'succeeded');
  for (const forged of [{ ...result.envelope, config_source_sha: 'd'.repeat(40) }, { ...result.envelope, schema_version: 1 }]) {
    assert.throws(() => validateEnvelope(forged, expected), { code: 'INVALID_RESULT' });
  }
  const manual = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'manual', patch: null }, {
    repository: 'owner/app', source_sha: 'a'.repeat(40), automation_sha: 'c'.repeat(40), run_id: '43', run_attempt: '1', invocation_id: 'manual',
    config_sha256: 'e'.repeat(64), instructions_sha256: 'f'.repeat(64) }, f.outputRoot);
  assert.equal(manual.envelope.schema_version, 1);
  assert.equal(Object.hasOwn(manual.envelope, 'config_source_sha'), false);
});

test('TRI-22: v2 refreshed-session write failure withholds artifacts and cleans auth', async t => {
  const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url));
  const sodium = require('libsodium-wrappers'); await sodium.ready; const keys = sodium.crypto_box_keypair();
  const f = await fixture(t); let authDirectory; let writes = 0;
  f.inputs.auth_mode = 'chatgpt-session'; f.inputs.session_secret_name = 'MY_CODEX_AUTH';
  delete f.secrets.OPENAI_API_KEY;
  f.secrets.CODEX_AUTH_WRITE_PAT = 'pat-fixture'; f.secrets.GITHUB_TOKEN = 'github-fixture';
  f.secrets.CODEX_AUTH_JSON = JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'old-access', id_token: 'old-id', refresh_token: 'old-refresh' } });
  f.options.fetchImpl = async (url, options) => {
    if (options.method === 'PUT') { writes++; return { status: 403, ok: false }; }
    return { ok: true, json: async () => url.includes('/runs/')
      ? { id: 42, created_at: '2026-10-14T10:00:01Z', repository: { full_name: f.event.repository } }
      : url.endsWith('/public-key') ? { key_id: 'key-fixture', key: sodium.to_base64(keys.publicKey, sodium.base64_variants.ORIGINAL) }
        : { name: 'MY_CODEX_AUTH', updated_at: '2026-10-14T10:00:00Z' } };
  };
  f.options.execute = async (_request, { auth }) => {
    authDirectory = auth.dir;
    const session = JSON.parse(f.secrets.CODEX_AUTH_JSON); session.tokens.refresh_token = 'new-refresh';
    await writeFile(auth.file, JSON.stringify(session));
    return { status: 'succeeded', decision: 'none', summary: 'valid result', patch: null };
  };
  await assert.rejects(runInvocation(f, f.options), { code: 'AUTH_PERSIST_FAILED' });
  assert.equal(writes, 1);
  assert.deepEqual(await readdir(f.outputRoot), []);
  await assert.rejects(readdir(authDirectory), { code: 'ENOENT' });
});

test('TRI-04/22: metadata read credential cannot escape in a v2 result', async t => {
  const f = await fixture(t);
  f.options.execute = async () => ({ status: 'succeeded', decision: 'none', summary: f.secrets.TRIAGE_READ_TOKEN, patch: null });
  await assert.rejects(runInvocation(f, f.options), { code: 'INVALID_RESULT' });
  assert.deepEqual(await readdir(f.outputRoot), []);
});

test('TRI-06/07: actual runner validates the platform event and config Git SHA before source checkout', async t => {
  const f = await fixture(t);
  const gitEnv = { PATH: process.env.PATH, ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  for (const args of [['init', '-b', 'master', f.configRoot], ['-C', f.configRoot, 'add', '.'],
    ['-C', f.configRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']]) {
    const result = spawnSync('git', args, { env: gitEnv, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  }
  const configSha = spawnSync('git', ['-C', f.configRoot, 'rev-parse', 'HEAD'], { env: gitEnv, encoding: 'utf8', windowsHide: true }).stdout.trim();
  f.event.sha = configSha; f.event.workflow_sha = configSha;
  const api = f.options.triageApi;
  api.getBranch = async (_repo, ref) => ({ name: ref, commit: { sha: ref === 'master' ? configSha : 'b'.repeat(40) } });
  f.inputs.context_json = (await collectIssue({ event: f.event, config: f.config }, api)).context_json;
  const runtime = join(f.root, 'runtime'); await mkdir(runtime);
  const eventPath = join(runtime, 'event.json'); const output = join(runtime, 'github-output'); const apiPath = join(runtime, 'api.json');
  await writeFile(eventPath, JSON.stringify({ action: 'opened', issue: { number: 7 } })); await writeFile(output, '');
  await writeFile(apiPath, JSON.stringify({ repo: await api.getRepository(), issue: f.issue, project: await api.getProjectMetadata(), config_sha: configSha }));
  const env = { ...gitEnv, GITHUB_WORKSPACE: f.root, RUNNER_TEMP: runtime, INPUTS_JSON: JSON.stringify(f.inputs),
    GITHUB_REPOSITORY: 'owner/app', GITHUB_EVENT_NAME: 'issues', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: configSha,
    GITHUB_WORKFLOW_SHA: configSha, GITHUB_WORKFLOW_REF: f.event.workflow_ref, GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', GITHUB_ACTOR: 'author', GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: output, TRIAGE_READ_TOKEN: 'read-fixture', TRIAGE_API_FIXTURE: apiPath };
  const run = phase => spawnSync(process.execPath, ['--import', new URL('./fixtures/triage-api.mjs', import.meta.url).href,
    fileURLToPath(new URL('../../scripts/llm/run.mjs', import.meta.url)), phase], { env, encoding: 'utf8', windowsHide: true });
  for (const phase of ['preflight', 'source']) {
    const result = run(phase); assert.equal(result.status, 0, result.stderr);
  }
  const outputs = await readFile(output, 'utf8');
  assert.equal(outputs.includes(`source_sha=${'b'.repeat(40)}\n`), true);
  assert.equal(outputs.includes(`config_source_sha=${configSha}\n`), true);
  assert.deepEqual(await readdir(join(runtime, 'llm-run-42-1-triage-7')), ['state.json']);
  await writeFile(eventPath, JSON.stringify({ action: 'opened', issue: { number: 8 } }));
  const rejected = run('source');
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stderr, 'UNTRUSTED_CONTEXT\n');
});

test('TRI-06/07: workflow defaults retain manual caller and separate trusted/source checkout phases', async () => {
  const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
  const workflow = parse(await readFile(new URL('../../.github/workflows/llm-execute.yml', import.meta.url), 'utf8'));
  assert.equal(workflow.on.workflow_call.inputs.caller_profile.default, 'manual');
  assert.equal(workflow.on.workflow_call.inputs.issue_number.default, 0);
  const steps = workflow.jobs.invoke.steps;
  assert.equal(steps.find(s => s.with?.path === 'consumer').with.ref, '${{ steps.preflight.outputs.source_sha }}');
  assert.equal(steps.find(s => s.id === 'source').if, "inputs.caller_profile == 'triage'");
  assert.equal(steps.find(s => s.with?.path === 'consumer-source').with.ref, '${{ steps.source.outputs.source_sha }}');
  for (const step of steps.filter(s => s.id === 'preflight' || s.id === 'source')) {
    assert.equal(step.env.TRIAGE_READ_TOKEN, '${{ secrets.TRIAGE_READ_TOKEN }}');
    assert.equal(step.env.CODEX_AUTH_JSON, undefined);
    assert.equal(step.env.CODEX_AUTH_WRITE_PAT, undefined);
  }
});
