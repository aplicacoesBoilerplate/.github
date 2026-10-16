import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, cp, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { publicationFixture } from './fixtures/publication.mjs';
import { collectWorkflow as collectTriage, invocationInputs as triageInputs, prepareWorkflow as checkTriage, publishWorkflow as publishTriage } from '../../scripts/triage/workflow.mjs';
import { collectWorkflow as collectReview, invocationInputs as reviewInputs, prepareWorkflow as checkReview, publishWorkflow as publishReview } from '../../scripts/review/workflow.mjs';
import { runInvocation } from '../../scripts/llm/orchestrate.mjs';
import { dispatchReview } from '../../scripts/review/dispatch.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const sodium = require('libsodium-wrappers');
await sodium.ready;
function git(root, ...args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}

test('REV-04/17/20/21: copied configuration drives triage → encrypted rotation → new review run, not a queued stale session', async t => {
  const f = await publicationFixture(t); const configRoot = join(f.root, 'consumer');
  const examples = fileURLToPath(new URL('../../examples/callers/review/.github', import.meta.url));
  await cp(examples, join(configRoot, '.github'), { recursive: true });
  const reviewPolicyPath = join(configRoot, '.github/review/config.json'); const reviewPolicy = JSON.parse(await readFile(reviewPolicyPath, 'utf8'));
  reviewPolicy.automation_actors = [{ id: 10, login: 'automation[bot]' }]; await writeFile(reviewPolicyPath, JSON.stringify(reviewPolicy));
  for (const [name, model, prompt] of [['triage-patch', 'consumer-triage', 'OWN TRIAGE PROMPT'], ['review-correction', 'consumer-review', 'OWN REVIEW PROMPT']]) {
    const path = join(configRoot, `.github/llm/${name}.json`); const config = JSON.parse(await readFile(path, 'utf8'));
    config.execution.model = model; await writeFile(path, JSON.stringify(config)); await writeFile(join(configRoot, `.github/llm/${name}.md`), prompt);
  }
  git(configRoot, 'init', '-q'); git(configRoot, 'config', 'user.name', 'Fixture'); git(configRoot, 'config', 'user.email', 'fixture@example.test');
  git(configRoot, 'add', '.'); git(configRoot, 'commit', '-qm', 'trusted config'); const configSha = git(configRoot, 'rev-parse', 'HEAD');
  const sourceRoot = join(f.root, 'triage-source'); git(f.root, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), sourceRoot);
  git(sourceRoot, 'checkout', '--quiet', '--detach', f.snapshot.base_sha);
  const product = join(f.root, 'published-product'); git(f.root, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), product);
  git(product, 'config', 'user.name', 'Fixture'); git(product, 'config', 'user.email', 'fixture@example.test');
  const event = { repository: 'owner/app', event_name: 'issues', action: 'opened', actor: 'human', actor_id: 20, issue_number: 7,
    sha: configSha, workflow_sha: configSha, ref: 'refs/heads/master', workflow_ref: 'owner/app/.github/workflows/triage.yml@refs/heads/master',
    server_url: 'https://github.com', run_id: '100', run_attempt: '1' };
  const image = `golang@sha256:${'f'.repeat(64)}`;
  const inputs = { config_path: '.github/triage/config.json', issue_number: 0, auth_mode: 'chatgpt-session', session_secret_name: 'CLI_CODEX_SESSION', verification_image: image };
  const sourceRun = { id: 100, run_attempt: 1, repository: { full_name: 'owner/app' }, head_repository: { full_name: 'owner/app' }, path: '.github/workflows/triage.yml',
    head_branch: 'master', head_sha: configSha, event: 'issues', actor: { login: 'human' }, status: 'in_progress', conclusion: null };
  const jobs = [{ id: 1, run_id: 100, head_sha: configSha, name: 'triage / finish', status: 'in_progress', conclusion: null }];
  const metadata = { getRepository: async () => ({ full_name: 'owner/app', private: true, fork: false, default_branch: 'master' }),
    getBranch: async (_r, ref) => ({ name: ref, commit: { sha: ref === 'master' ? configSha : f.snapshot.base_sha } }),
    getPermission: async (_r, actor) => ({ permission: 'write', user: { login: actor } }),
    getIssue: async () => ({ number: 7, node_id: 'I7', state: 'open', title: 'Fix typo', body: 'Small typo.', updated_at: '2026-10-15T10:00:00Z',
      user: { login: 'human' }, repository_url: 'https://api.github.com/repos/owner/app', type: { name: 'Bug' }, milestone: { number: 1, title: 'v1.0.0' } }),
    getDependencies: async () => [], getParent: async () => ({ number: 3, state: 'open' }), getIssueFields: async () => [],
    getProjectMetadata: async () => ({ fields: ['Effort', 'Size', 'Estimate', 'Release'].map((name, i) => ({ id: String(i), name })),
      values: [{ field: { id: '0' }, value: 'Low' }, { field: { id: '1' }, value: 'XS' }, { field: { id: '2' }, value: 1 }] }),
    getPull: f.api.getPull, getCommit: f.api.getCommit, getRun: async () => sourceRun, getRunJobs: async () => jobs };
  const outputRoot = join(f.root, 'artifacts'); await mkdir(outputRoot);
  const keys = sodium.crypto_box_keypair();
  const initial = JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'old-access-fixture', id_token: 'id-fixture', refresh_token: 'refresh-fixture' } });
  const renewed = initial.replace('old-access-fixture', 'renewed-access-fixture');
  const store = { session: initial, updated_at: '2026-10-15T10:00:00Z', writes: 0 };
  const created = { 100: '2026-10-15T10:00:01Z', 200: '2026-10-15T10:00:04Z', 300: '2026-10-15T10:00:01Z' };
  const fetchImpl = async (url, options) => {
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body); assert.equal(body.key_id, 'fixture-key');
      store.session = sodium.crypto_box_seal_open(sodium.from_base64(body.encrypted_value, sodium.base64_variants.ORIGINAL), keys.publicKey, keys.privateKey, 'text');
      store.updated_at = '2026-10-15T10:00:03Z'; store.writes++; return { status: 204 };
    }
    if (url.endsWith('/public-key')) return { ok: true, json: async () => ({ key_id: 'fixture-key', key: sodium.to_base64(keys.publicKey, sodium.base64_variants.ORIGINAL) }) };
    const run = /\/actions\/runs\/(\d+)$/.exec(url);
    if (run) return { ok: true, json: async () => ({ id: Number(run[1]), repository: { full_name: 'owner/app' }, created_at: created[run[1]] }) };
    return { ok: true, json: async () => ({ name: 'CLI_CODEX_SESSION', updated_at: store.updated_at }) };
  };
  const secrets = () => ({ CODEX_AUTH_JSON: store.session, CODEX_AUTH_WRITE_PAT: 'pat-fixture', GITHUB_TOKEN: 'github-fixture',
    TRIAGE_READ_TOKEN: 'read-fixture', REVIEW_READ_TOKEN: 'read-fixture' });
  const baseInput = { configRoot, sourceRoot, outputRoot, event, inputs, automation_sha: 'e2027dd021a0dcfbb2f8fce08600d8aadb935284' };
  const collected = await collectTriage(baseInput, metadata); const authDirs = [];
  const central = await runInvocation({ ...baseInput, inputs: triageInputs(inputs, collected.snapshot, collected.config), secrets: secrets() }, {
    triageApi: metadata, fetchImpl, checkedConfigSha: configSha, checkedOutSha: collected.snapshot.source_sha, onAuth: auth => authDirs.push(auth.dir),
    execute: async (request, { auth }) => {
      assert.equal(request.config.execution.model, 'consumer-triage'); assert.equal(request.prompts.execution, 'OWN TRIAGE PROMPT');
      assert.equal(await readFile(auth.file, 'utf8'), initial); await writeFile(auth.file, renewed);
      return { status: 'succeeded', decision: 'none', summary: 'Typo proposal.', patch: 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n' };
    } });
  assert.equal(store.session, renewed); assert.equal(store.writes, 1);
  const triageExecution = { ...baseInput, snapshot: collected.snapshot, artifactRoot: central.directory };
  const checked = await checkTriage(triageExecution, { verify: { execute: async () => ({}) } });
  const publisher = { ...f.api, recollect: async () => collected.snapshot,
    createCommit: async (_r, p) => {
      git(product, 'checkout', '--quiet', '--detach', p.base_sha);
      for (const c of p.changes) { assert.equal(c.path, 'main.go'); await writeFile(join(product, c.path), Buffer.from(c.content, 'base64')); }
      git(product, 'add', '.'); git(product, 'commit', '-qm', p.message);
      const value = { sha: git(product, 'rev-parse', 'HEAD'), tree: { sha: git(product, 'rev-parse', 'HEAD^{tree}') }, parents: [{ sha: p.base_sha }], message: p.message };
      assert.equal(value.tree.sha, p.tree_sha); f.state.commits.set(value.sha, value); return value;
    },
    createPull: async (_r, p) => {
      const value = { ...p, number: 30, state: 'open', user: { id: 10, login: 'automation[bot]' }, updated_at: '2026-10-15T10:00:03Z',
        head: { ref: p.head, sha: f.state.refs.get(p.head).object.sha, repo: { full_name: 'owner/app' } },
        base: { ref: p.base, sha: collected.snapshot.source_sha, repo: { full_name: 'owner/app' } }, requested_reviewers: [], milestone: null, html_url: 'https://github.com/owner/app/pull/30' };
      f.state.pulls.push(value); return value;
    }, setMilestone: async (_r, _n, milestone) => Object.assign(f.state.pulls[0], { milestone: { number: milestone } }) };
  const published = await publishTriage({ ...triageExecution, verification: checked.verification }, { metadataApi: metadata, publicationApi: publisher });
  assert.equal(published.status, 'draft'); assert.equal(published.pr_number, 30); jobs[0].status = 'completed'; jobs[0].conclusion = 'success';
  const handoff = { source_run_id: '100', source_run_attempt: '1', issue_number: 7, source_fingerprint: collected.snapshot.fingerprint };
  let reviewRun; let capturedSession;
  const dispatcher = { ...metadata, getIdentity: f.api.getIdentity, getWorkflow: async () => ({ id: 99, path: '.github/workflows/review.yml', state: 'active' }),
    listWorkflowRuns: async () => [], getRun: async (_r, id) => Number(id) === 100 ? sourceRun : reviewRun,
    dispatch: async (_r, _id, payload) => {
      capturedSession = store.session; assert.deepEqual(Object.keys(payload.inputs).sort(), ['dispatch_id', 'expected_head_sha', 'pull_number', 'review_handoff_json']);
      reviewRun = { id: 200, event: 'workflow_dispatch', repository: { full_name: 'owner/app' }, head_repository: { full_name: 'owner/app' }, path: '.github/workflows/review.yml',
        head_branch: 'master', head_sha: configSha, display_title: `review:30:${payload.inputs.dispatch_id}`, actor: { id: 10, login: 'automation[bot]' }, status: 'queued', conclusion: null };
      return { workflow_run_id: 200 };
    } };
  const dispatched = await dispatchReview({ pull: 30, expected_head_sha: f.state.pulls[0].head.sha, handoff, configRoot, event,
    target: { repository: 'owner/app', ref: 'master', config_path: '.github/review/config.json', workflow_path: '.github/workflows/review.yml' } }, dispatcher);
  assert.equal(dispatched.run_id, '200'); assert.equal(capturedSession, renewed);
  const reviewEvent = { ...event, event_name: 'workflow_dispatch', pull_number: 30, actor: 'automation[bot]', actor_id: 10,
    workflow_ref: 'owner/app/.github/workflows/review.yml@refs/heads/master', run_id: '200' };
  const domainInputs = { config_path: '.github/review/config.json', pull_number: 30, expected_head_sha: f.state.pulls[0].head.sha,
    review_handoff_json: JSON.stringify(handoff), auth_mode: 'chatgpt-session', session_secret_name: 'CLI_CODEX_SESSION', verification_image: image };
  const review = await collectReview({ configRoot, sourceRoot: product, event: reviewEvent, inputs: domainInputs }, metadata);
  const invocation = reviewInputs(domainInputs, review.snapshot, review.config);
  const reviewInput = { ...baseInput, sourceRoot: product, event: reviewEvent, inputs: invocation, secrets: secrets() };
  const reviewed = await runInvocation(reviewInput, { reviewApi: metadata, fetchImpl, checkedConfigSha: configSha, checkedOutSha: review.snapshot.source_sha,
    onAuth: auth => authDirs.push(auth.dir), execute: async (request, { auth }) => {
      assert.equal(await readFile(auth.file, 'utf8'), renewed); assert.equal(request.config.execution.model, 'consumer-review'); assert.equal(request.prompts.execution, 'OWN REVIEW PROMPT');
      return { status: 'succeeded', decision: 'none', summary: 'Review after triage.', findings: [{ severity: 'suggestion', path: 'main.go', line: 1, message: 'Consider this detail.' }], patch: null };
    } });
  const reviewExecution = { ...reviewInput, inputs: domainInputs, snapshot: review.snapshot, artifactRoot: reviewed.directory };
  const reviewChecked = await checkReview(reviewExecution);
  publisher.recollect = async () => (await collectReview({ configRoot, sourceRoot: product, event: reviewEvent, inputs: domainInputs }, metadata)).snapshot;
  const outcome = await publishReview({ ...reviewExecution, verification: reviewChecked.verification }, { metadataApi: metadata, publicationApi: publisher });
  assert.equal(outcome.status, 'reviewed'); assert.equal(outcome.pull_number, 30); assert.equal(outcome.pr_number, null); assert.equal(store.writes, 1);
  assert.ok(f.state.comments.some(c => c.body.includes('Review after triage.'))); assert.equal(f.state.pulls.length, 1);
  for (const path of authDirs) await assert.rejects(access(path), { code: 'ENOENT' });
  const before = await readdir(outputRoot);
  await assert.rejects(runInvocation({ ...reviewInput, secrets: { ...secrets(), CODEX_AUTH_JSON: undefined } }, { reviewApi: metadata, fetchImpl }), { code: 'AUTH_CONFIG_ERROR' });
  await assert.rejects(runInvocation({ ...reviewInput, event: { ...reviewEvent, run_id: '300' }, secrets: secrets() }, { reviewApi: metadata, fetchImpl,
    execute: async () => assert.fail('A queued stale run must never execute the model') }), { code: 'AUTH_SNAPSHOT_STALE' });
  assert.deepEqual(await readdir(outputRoot), before);
});
