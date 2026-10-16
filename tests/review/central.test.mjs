import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInvocation } from '../../scripts/llm/orchestrate.mjs';
import { collectReview } from '../../scripts/review/collect.mjs';
import { patchGitEnvironment } from '../../scripts/triage/prepare-patch.mjs';
import { validateRequest } from '../../scripts/llm/validate-request.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
function git(root, args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=NUL', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env: patchGitEnvironment(), encoding: 'utf8', windowsHide: true });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}
async function fixture(t, mode = 'single', largeSource = false) {
  const root = await mkdtemp(join(tmpdir(), 'review-central-')); t.after(() => rm(root, { recursive: true, force: true }));
  const configRoot = join(root, 'consumer'); const sourceRoot = join(root, 'consumer-source'); const outputRoot = join(root, 'results');
  await mkdir(join(configRoot, '.github/llm'), { recursive: true }); await mkdir(join(configRoot, '.github/review')); await mkdir(outputRoot);
  const config = { schema_version: 1, invocation_mode: mode, execution: { model: 'own-review', effort: 'high', template_path: '.github/llm/prompt.md' },
    ...(mode === 'single' ? {} : { decision: { model: 'own-decision', effort: 'low', template_path: '.github/llm/decision.md' } }) };
  const policy = { schema_version: 1, reviewer: 'reviewer', automation_actors: [], llm_configs: { review: '.github/llm/review.json', correction: '.github/llm/correction.json' },
    protected_branches: ['master', 'develop'], correctable_prefixes: ['feature/'], allowed_paths: ['main.go'], checks: [{ command: 'go', args: ['test', './...'] }] };
  await writeFile(join(configRoot, '.github/review/config.json'), JSON.stringify(policy));
  for (const name of ['review.json', 'correction.json']) await writeFile(join(configRoot, '.github/llm', name), JSON.stringify(config));
  await writeFile(join(configRoot, '.github/llm/prompt.md'), 'OWN REVIEW PROMPT'); await writeFile(join(configRoot, '.github/llm/decision.md'), 'OWN DECISION PROMPT');
  await writeFile(join(configRoot, 'AGENTS.md'), 'trusted consumer instructions');
  await writeFile(join(configRoot, 'unrelated.txt'), 'x'.repeat(2 * 1048576));
  const prefix = largeSource ? 'unchanged\n'.repeat(110000) : '';
  await writeFile(join(configRoot, 'main.go'), prefix + 'old\n'); git(configRoot, ['init', '-q', '-b', 'master']); git(configRoot, ['add', '.']); git(configRoot, ['commit', '-qm', 'trusted baseline']);
  const configSha = git(configRoot, ['rev-parse', 'HEAD']);
  git(root, ['clone', '-q', '--no-hardlinks', '--', configRoot.replaceAll('\\', '/'), sourceRoot]);
  await writeFile(join(sourceRoot, 'main.go'), prefix + 'new\n'); await writeFile(join(sourceRoot, 'AGENTS.md'), 'untrusted head instructions');
  git(sourceRoot, ['add', '.']); git(sourceRoot, ['commit', '-qm', 'untrusted changes']); const sourceSha = git(sourceRoot, ['rev-parse', 'HEAD']);
  const repo = { full_name: 'owner/app', private: true, fork: false, default_branch: 'master' };
  const pull = { number: 9, title: 'Review code', body: 'Evaluate the changed lines.', draft: true, state: 'open', updated_at: '2026-10-15T12:00:00Z',
    user: { id: 10, login: 'author' }, head: { ref: 'feature/example', sha: sourceSha, repo: { full_name: 'owner/app' } },
    base: { ref: 'release/v1.0.0', sha: configSha, repo: { full_name: 'owner/app' } } };
  const api = { getRepository: async () => structuredClone(repo), getPull: async () => structuredClone(pull),
    getBranch: async () => ({ name: 'master', commit: { sha: configSha } }), getPermission: async (_repo, actor) => ({ permission: 'write', user: { login: actor } }) };
  const event = { repository: 'owner/app', event_name: 'workflow_dispatch', pull_number: 9, actor: 'operator', actor_id: 11, sha: configSha, workflow_sha: configSha,
    ref: 'refs/heads/master', workflow_ref: 'owner/app/.github/workflows/review.yml@refs/heads/master', server_url: 'https://github.com', run_id: '42', run_attempt: '1' };
  const domainInputs = { config_path: '.github/review/config.json', pull_number: 9, expected_source_sha: sourceSha };
  const snapshot = await collectReview({ event, configRoot, sourceRoot, inputs: domainInputs }, api);
  const inputs = { caller_profile: 'review', invocation_id: 'review-9', config_path: '.github/llm/correction.json', source_ref: 'feature/example',
    auth_mode: 'api-key', session_secret_name: '', pull_number: 9, review_config_path: domainInputs.config_path,
    expected_source_sha: sourceSha, review_fingerprint: snapshot.fingerprint, review_handoff_json: '{}', context_json: '{}' };
  const calls = [];
  const options = { reviewApi: api, checkedConfigSha: configSha, checkedOutSha: sourceSha,
    execution: { cliPath: fileURLToPath(new URL('./fixtures/codex-review.mjs', import.meta.url)),
      onInvocation: data => calls.push({ ...data, instructions: readFileSync(join(data.args[data.args.indexOf('--cd') + 1], 'AGENTS.md'), 'utf8') }) } };
  return { root, sourceRoot, configRoot, outputRoot, event, inputs, snapshot, policy, config, pull, repo, api, options, calls,
    secrets: { OPENAI_API_KEY: 'api-fixture', REVIEW_READ_TOKEN: 'metadata-read-fixture' }, automation_sha: 'c'.repeat(40) };
}

test('REV-03/04/06: review profile propagates caller model, effort and prompt, using only changed committed source', async t => {
  for (const mode of ['single', 'decision-then-prompt']) {
    const f = await fixture(t, mode); await writeFile(join(f.sourceRoot, 'main.go'), 'uncommitted injection\n');
    const result = await runInvocation(f, f.options);
    const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
    assert.equal(envelope.schema_version, 3); assert.equal(envelope.source_sha, f.snapshot.source_sha); assert.equal(envelope.config_source_sha, f.snapshot.config_source_sha);
    assert.equal(envelope.summary, 'own-review|high|OWN REVIEW PROMPT');
    assert.equal(f.calls.length, mode === 'single' ? 1 : 2);
    assert.deepEqual(f.calls.at(-1).prompt.source_files, [{ path: 'main.go', content: 'new\n' }]);
    assert.equal(f.calls.at(-1).prompt.task, 'OWN REVIEW PROMPT'); assert.equal(f.calls.at(-1).stage.model, 'own-review');
    assert.equal(f.calls.at(-1).env.REVIEW_READ_TOKEN, undefined); assert.equal(f.calls.at(-1).env.GITHUB_TOKEN, undefined);
    assert.equal(f.calls.at(-1).args.includes('features.shell_tool=false'), true);
    assert.equal(f.calls.at(-1).prompt.context.diff.includes('untrusted head instructions'), true);
    assert.equal(f.calls.at(-1).instructions.includes('trusted consumer instructions'), true);
    assert.equal(f.calls.at(-1).instructions.includes('untrusted head instructions'), false);
    assert.equal(await readFile(join(f.configRoot, 'AGENTS.md'), 'utf8'), 'trusted consumer instructions');
  }
});

test('REV-02/03/08: forged inputs, wrong paths or missing metadata credentials cannot reach authentication', async t => {
  const f = await fixture(t); let authUsed = false; const options = { ...f.options, onAuth: () => { authUsed = true; } };
  for (const [change, code] of [[{ source_ref: 'master' }, 'UNTRUSTED_CONTEXT'], [{ config_path: '.github/llm/review.json' }, 'UNTRUSTED_CONTEXT'],
    [{ review_fingerprint: 'f'.repeat(64) }, 'STALE_REVIEW_INPUT'], [{ expected_source_sha: 'a'.repeat(40) }, 'STALE_REVIEW_INPUT'],
    [{ context_json: '{"injected":true}' }, 'UNTRUSTED_CONTEXT']])
    await assert.rejects(runInvocation({ ...f, inputs: { ...f.inputs, ...change } }, options), { code });
  await assert.rejects(runInvocation({ ...f, secrets: { OPENAI_API_KEY: 'api-fixture' } }, options), { code: 'REVIEW_METADATA_UNAVAILABLE' });
  await assert.rejects(runInvocation({ ...f, secrets: { REVIEW_READ_TOKEN: 'metadata-read-fixture' } }, options), { code: 'AUTH_CONFIG_ERROR' });
  assert.equal(authUsed, false); assert.deepEqual(await readdir(f.outputRoot), []);
  assert.throws(() => validateRequest(f.config, { ...f.inputs, caller_profile: 'manual' }), { code: 'INVALID_CONFIG' });
});

test('REV-04/08: a skip decision prevents the execution stage and produces no findings or patch', async t => {
  const f = await fixture(t, 'decision-then-prompt'); f.pull.body = 'skip-review';
  const current = await collectReview({ ...f, inputs: { config_path: f.inputs.review_config_path, pull_number: 9, expected_source_sha: f.snapshot.source_sha } }, f.api);
  f.inputs.review_fingerprint = current.fingerprint;
  const result = await runInvocation(f, f.options); const sidecar = JSON.parse(await readFile(join(result.directory, 'review.json'), 'utf8'));
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].stage.model, 'own-decision');
  assert.equal(result.envelope.status, 'skipped'); assert.equal(result.envelope.patch_file, null); assert.deepEqual(sidecar.findings, []);
});

test('REV-05: selected source exceeding snapshot size fails before session restoration', async t => {
  const f = await fixture(t, 'single', true); let authUsed = false;
  await assert.rejects(runInvocation(f, { ...f.options, onAuth: () => { authUsed = true; } }), { code: 'REVIEW_INCONCLUSIVE' });
  assert.equal(authUsed, false); assert.deepEqual(await readdir(f.outputRoot), []);
});

test('REV-20/26: review persistence failure prevents artifacts and removes the temporary authentication', async t => {
  const f = await fixture(t); let authDirectory;
  f.inputs.auth_mode = 'chatgpt-session'; f.inputs.session_secret_name = 'CONSUMER_SESSION';
  f.secrets = { REVIEW_READ_TOKEN: 'metadata-read-fixture', CODEX_AUTH_WRITE_PAT: 'pat-fixture', GITHUB_TOKEN: 'github-fixture',
    CODEX_AUTH_JSON: JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'access-fixture', id_token: 'id-fixture', refresh_token: 'refresh-fixture' } }) };
  await assert.rejects(runInvocation(f, { ...f.options, onAuth: auth => { authDirectory = auth.dir; },
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/runs/') ? { id: 42, created_at: '2026-10-15T12:00:01Z', repository: { full_name: 'owner/app' } }
      : { name: 'CONSUMER_SESSION', updated_at: '2026-10-15T12:00:00Z' } }),
    persist: async () => { throw Object.assign(new Error('private failure'), { code: 'AUTH_PERSIST_FAILED' }); } }), { code: 'AUTH_PERSIST_FAILED' });
  assert.deepEqual(await readdir(f.outputRoot), []); await assert.rejects(readdir(authDirectory), { code: 'ENOENT' });
});

test('REV-01/03: actual runner resolves review source from the platform event and rejects a forged PR number', async t => {
  const f = await fixture(t); const runtime = join(f.root, 'runtime'); await mkdir(runtime);
  const eventPath = join(runtime, 'event.json'); const output = join(runtime, 'output'); const apiPath = join(runtime, 'api.json');
  await writeFile(eventPath, JSON.stringify({ inputs: { pull_number: '9', review_handoff_json: '{}' } })); await writeFile(output, '');
  await writeFile(apiPath, JSON.stringify({ repo: f.repo, pull: f.pull, config_sha: f.snapshot.config_source_sha }));
  const env = { ...patchGitEnvironment(), GITHUB_WORKSPACE: f.root, RUNNER_TEMP: runtime, INPUTS_JSON: JSON.stringify(f.inputs), REVIEW_READ_TOKEN: 'metadata-read-fixture',
    GITHUB_REPOSITORY: 'owner/app', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: f.event.sha, GITHUB_WORKFLOW_SHA: f.event.sha,
    GITHUB_WORKFLOW_REF: f.event.workflow_ref, GITHUB_SERVER_URL: 'https://github.com', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_ACTOR: 'operator', GITHUB_ACTOR_ID: '11', GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: output, REVIEW_API_FIXTURE: apiPath };
  const run = phase => spawnSync(process.execPath, ['--import', new URL('./fixtures/review-api.mjs', import.meta.url).href,
    fileURLToPath(new URL('../../scripts/llm/run.mjs', import.meta.url)), phase], { env, encoding: 'utf8', windowsHide: true });
  for (const phase of ['preflight', 'source']) { const p = run(phase); assert.equal(p.status, 0, p.stderr); }
  assert.equal((await readFile(output, 'utf8')).includes(`source_sha=${f.snapshot.source_sha}\n`), true);
  await writeFile(eventPath, JSON.stringify({ inputs: { pull_number: '10' } }));
  const rejected = run('source'); assert.equal(rejected.status, 1); assert.equal(rejected.stderr, 'UNTRUSTED_CONTEXT\n');
});

test('REV-03/20/26: workflow keeps legacy paths and isolates review metadata from LLM credentials', async () => {
  const workflow = parse(await readFile(new URL('../../.github/workflows/llm-execute.yml', import.meta.url), 'utf8'));
  assert.equal(workflow.on.workflow_call.inputs.caller_profile.default, 'manual'); assert.equal(workflow.on.workflow_call.inputs.pull_number.default, 0);
  const steps = workflow.jobs.invoke.steps; const source = steps.find(s => s.id === 'review-source');
  assert.equal(source.if, "inputs.caller_profile == 'review'"); assert.equal(source.env.REVIEW_READ_TOKEN, '${{ secrets.REVIEW_READ_TOKEN }}');
  assert.equal(source.env.CODEX_AUTH_JSON, undefined); assert.equal(source.env.CODEX_AUTH_WRITE_PAT, undefined);
  const checkout = steps.find(s => s.name === 'Checkout separately authorized review analysis source');
  assert.equal(checkout.with.ref, '${{ steps.preflight.outputs.review_source_sha }}'); assert.equal(checkout.with['fetch-depth'], 0); assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(workflow.jobs.invoke.concurrency.group.includes('llm-session-{0}-{1}'), true);
});
