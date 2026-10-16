import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { publicationFixture, digest } from './fixtures/publication.mjs';
import { dispatchReview } from '../../scripts/review/dispatch.mjs';
import { createReviewDispatchApi } from '../../scripts/review/dispatch-api.mjs';
import { collectIssue } from '../../scripts/triage/collect.mjs';
import { collectReview } from '../../scripts/review/collect.mjs';
import { collectWorkflow } from '../../scripts/review/workflow.mjs';

function git(root, ...args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}
async function fixture(t, triage = false) {
  const f = await publicationFixture(t); const configRoot = join(f.root, 'consumer');
  git(f.root, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), configRoot);
  git(configRoot, 'checkout', '--quiet', '--detach', f.snapshot.base_sha); git(configRoot, 'config', 'user.name', 'Fixture'); git(configRoot, 'config', 'user.email', 'fixture@example.test');
  await mkdir(join(configRoot, '.github/review'), { recursive: true }); await mkdir(join(configRoot, '.github/triage'));
  const config = { ...f.config, triage_handoff: { workflow_path: '.github/workflows/triage.yml', config_path: '.github/triage/config.json', finish_job: 'triage / finish' } };
  const triageConfig = { schema_version: 1, project: { owner: 'owner', number: 1 }, fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
    llm_configs: { plan: 'plan.json', patch: 'patch.json' }, reviewer: 'reviewer', allowed_paths: ['main.go'], checks: config.checks, stacked_bases: {} };
  await writeFile(join(configRoot, '.github/review/config.json'), JSON.stringify(config)); await writeFile(join(configRoot, '.github/triage/config.json'), JSON.stringify(triageConfig));
  git(configRoot, 'add', '.'); git(configRoot, 'commit', '-qm', 'config'); const configSha = git(configRoot, 'rev-parse', 'HEAD');
  const repo = { full_name: 'owner/app', private: true, fork: false, default_branch: 'master' };
  const pull = { ...structuredClone(f.snapshot.pull), head: { ...f.snapshot.pull.head, repo: { full_name: 'owner/app' } }, base: { ...f.snapshot.pull.base, repo: { full_name: 'owner/app' } } };
  const event = { repository: 'owner/app', event_name: triage ? 'issues' : 'pull_request_target', action: 'opened', actor: 'human', actor_id: 20,
    pull_number: 9, issue_number: 7, sha: configSha, workflow_sha: configSha, ref: 'refs/heads/master', server_url: 'https://github.com',
    workflow_ref: `owner/app/.github/workflows/${triage ? 'triage' : 'review-bridge'}.yml@refs/heads/master`, run_id: '100', run_attempt: '1' };
  const sourceRun = { id: 100, run_attempt: 1, repository: repo, head_repository: repo, path: '.github/workflows/triage.yml', head_branch: 'master', head_sha: configSha,
    event: 'issues', actor: { id: 20, login: 'human' }, status: 'in_progress', conclusion: null };
  const sourceJobs = [{ id: 5, run_id: 100, head_sha: configSha, name: 'triage / finish', status: 'completed', conclusion: 'success' }];
  const state = { runs: [], posts: [], failAfter: false, failBefore: false, configSha, repo, pull, sourceRun, sourceJobs, commit: null, permission: 'write', identity: { id: 10, login: 'automation[bot]' } };
  const api = { getRepository: async () => state.repo, getBranch: async (_r, ref) => ({ name: ref, commit: { sha: ref === 'master' ? state.configSha : f.snapshot.base_sha } }),
    getPull: async () => structuredClone(state.pull), getPermission: async (_r, actor) => ({ permission: state.permission, user: { login: actor } }),
    getWorkflow: async () => ({ id: 99, path: '.github/workflows/review.yml', state: 'active' }), getIdentity: async () => state.identity,
    getRun: async (_r, id) => Number(id) === 100 ? structuredClone(state.sourceRun) : structuredClone(state.runs.find(r => r.id === Number(id))),
    getRunJobs: async () => structuredClone(state.sourceJobs), getCommit: async () => state.commit,
    getIssue: async () => ({ number: 7, node_id: 'I7', state: 'open', title: 'Fix typo', body: 'A small typo.', updated_at: '2026-10-15T10:00:00Z',
      user: { login: 'human' }, repository_url: 'https://api.github.com/repos/owner/app', type: { name: 'Bug' }, milestone: { number: 1, title: 'v1.0.0' } }),
    getDependencies: async () => [], getParent: async () => ({ number: 3, state: 'open' }), getIssueFields: async () => [],
    getProjectMetadata: async () => ({ fields: ['Effort', 'Size', 'Estimate', 'Release'].map((name, i) => ({ id: String(i), name })),
      values: [{ field: { id: '0' }, value: 'Low' }, { field: { id: '1' }, value: 'XS' }, { field: { id: '2' }, value: 1 }] }),
    listWorkflowRuns: async () => structuredClone(state.runs), dispatch: async (_r, _id, payload) => {
      state.posts.push(structuredClone(payload)); if (state.failBefore) throw new Error('private token failure');
      const run = { id: state.runs.length + 200, event: 'workflow_dispatch', repository: repo, head_repository: repo, path: '.github/workflows/review.yml',
        head_branch: 'master', head_sha: state.configSha, display_title: `review:9:${payload.inputs.dispatch_id}`, actor: state.identity, status: 'queued', conclusion: null };
      state.runs.push(run); if (state.failAfter) { state.failAfter = false; throw new Error('ambiguous timeout'); } return { workflow_run_id: run.id };
    } };
  let handoff;
  if (triage) {
    const snapshot = await collectIssue({ event, config: triageConfig }, api);
    const proof = `Entrada: ${snapshot.fingerprint}\nBase: ${snapshot.source_sha}\nConfiguração: ${snapshot.config_source_sha}`;
    const marker = '<!-- triage:v1:owner/app:7 -->'; const body = `${marker}\nRefs #7\n${proof}\n`;
    pull.user = state.identity; pull.head.ref = 'feature/triage-issue-7'; pull.body = `<!-- triage-body-sha256:${digest(body)} -->\n${body}`;
    state.commit = { sha: pull.head.sha, parents: [{ sha: snapshot.source_sha }], tree: { sha: 'c'.repeat(40) },
      message: `Triage proposal for issue #7\n\n${marker}\n${proof}\nPatch: ${'d'.repeat(64)}` };
    handoff = { source_run_id: '100', source_run_attempt: '1', issue_number: 7, source_fingerprint: snapshot.fingerprint };
  }
  return { ...f, configRoot, config, event, state, api, pull: 9, expected_head_sha: pull.head.sha, handoff,
    target: { repository: 'owner/app', ref: 'master', workflow_path: '.github/workflows/review.yml', config_path: '.github/review/config.json' } };
}

test('REV-01/17/20: human bridge and finished triage dispatch a new run with only PR/head/correlation and source proof', async t => {
  for (const triage of [false, true]) {
    const f = await fixture(t, triage); const value = await dispatchReview(f, f.api); const again = await dispatchReview(f, f.api);
    assert.equal(value.status, 'dispatched'); assert.equal(value.run_id, '200'); assert.equal(again.status, 'recovered'); assert.equal(again.run_id, '200'); assert.equal(f.state.posts.length, 1);
    const p = f.state.posts[0]; assert.equal(p.ref, 'master'); assert.deepEqual(Object.keys(p.inputs).sort(), ['dispatch_id', 'expected_head_sha', 'pull_number', 'review_handoff_json']);
    assert.equal(p.inputs.pull_number, '9'); assert.equal(p.inputs.expected_head_sha, f.expected_head_sha); assert.deepEqual(JSON.parse(p.inputs.review_handoff_json), f.handoff ?? {});
    assert.match(p.inputs.dispatch_id, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(p).includes('CLI_CODEX_SESSION'), false);
    if (triage) {
      const configEvent = { ...f.event, event_name: 'workflow_dispatch', pull_number: 9, actor: 'automation[bot]', actor_id: 10 };
      await assert.rejects(collectReview({ configRoot: f.configRoot, sourceRoot: f.sourceRoot, event: configEvent, inputs: { config_path: f.target.config_path, pull_number: 9, handoff: f.handoff } }, f.api), { code: 'UNTRUSTED_CONTEXT' });
      const next = await collectReview({ configRoot: f.configRoot, sourceRoot: f.sourceRoot, event: { ...configEvent, run_id: '200' }, inputs: { config_path: f.target.config_path, pull_number: 9, handoff: f.handoff } }, f.api);
      assert.equal(next.pull.automation_origin, 'triage'); assert.equal(next.route, 'correction');
    }
  }
});

test('REV-02/17/24: failed finish, mismatched source run, edited PR and invalid bridge never dispatch', async t => {
  const f = await fixture(t, true);
  for (const change of [{ name: 'other job' }, { conclusion: 'failure' }, { head_sha: 'f'.repeat(40) }]) {
    const original = f.state.sourceJobs[0]; f.state.sourceJobs[0] = { ...original, ...change };
    await assert.rejects(dispatchReview(f, f.api), { code: 'UNTRUSTED_CONTEXT' }); f.state.sourceJobs[0] = original;
  }
  await assert.rejects(dispatchReview({ ...f, event: { ...f.event, run_id: '101' } }, f.api), { code: 'UNTRUSTED_CONTEXT' });
  await assert.rejects(dispatchReview({ ...f, handoff: { ...f.handoff, source_run_attempt: '2' } }, f.api), { code: 'UNTRUSTED_CONTEXT' });
  f.state.pull.body += '\nHuman edit'; await assert.rejects(dispatchReview(f, f.api), { code: 'UNTRUSTED_CONTEXT' }); assert.deepEqual(f.state.posts, []);
  const h = await fixture(t); h.state.repo.private = false; await assert.rejects(dispatchReview(h, h.api), { code: 'UNTRUSTED_CONTEXT' }); h.state.repo.private = true;
  await assert.rejects(dispatchReview({ ...h, event: { ...h.event, event_name: 'pull_request' } }, h.api), { code: 'UNTRUSTED_CONTEXT' });
  await assert.rejects(dispatchReview({ ...h, expected_head_sha: 'f'.repeat(40) }, h.api), { code: 'STALE_REVIEW_INPUT' });
  h.state.permission = 'read'; await assert.rejects(dispatchReview(h, h.api), { code: 'UNTRUSTED_CONTEXT' }); assert.deepEqual(h.state.posts, []);
});

test('REV-18/25/26: ambiguous dispatch recovers the exact run, never the latest or an unsuccessful old run', async t => {
  const f = await fixture(t); f.state.failAfter = true;
  const recovered = await dispatchReview(f, f.api); assert.equal(recovered.status, 'recovered'); assert.equal(recovered.run_id, '200'); assert.equal(f.state.posts.length, 1);
  f.state.runs.push({ ...f.state.runs[0], id: 999, display_title: 'unrelated latest run' });
  assert.equal((await dispatchReview(f, f.api)).run_id, '200'); assert.equal(f.state.posts.length, 1);
  f.state.runs[0].status = 'completed'; f.state.runs[0].conclusion = 'failure';
  await assert.rejects(dispatchReview(f, f.api), { code: 'REVIEW_DISPATCH_FAILED' }); assert.equal(f.state.posts.length, 1);
  const failed = await fixture(t); failed.state.failBefore = true;
  await assert.rejects(dispatchReview(failed, failed.api), { code: 'REVIEW_DISPATCH_FAILED', message: 'REVIEW_DISPATCH_FAILED' }); assert.equal(failed.state.posts.length, 1); assert.equal(failed.state.runs.length, 0);
});

test('REV-24: dispatch head expectation is enforced again by the called collector', async t => {
  const f = await fixture(t); const inputs = { config_path: f.target.config_path, pull_number: 9, expected_head_sha: 'f'.repeat(40),
    auth_mode: 'api-key', verification_image: `golang@sha256:${'f'.repeat(64)}` };
  await assert.rejects(collectWorkflow({ ...f, event: { ...f.event, event_name: 'workflow_dispatch', run_id: '200' }, inputs }, f.api), { code: 'STALE_REVIEW_INPUT' });
});

test('REV-17/25/26: dispatch transport handles the documented run ID, limits pagination and never retries POST', async () => {
  const calls = []; const response = value => ({ ok: true, status: 200, json: async () => value });
  const api = createReviewDispatchApi('dispatch-fixture', { readToken: 'read-fixture', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/dispatches')) return response({ workflow_run_id: 200, run_url: 'https://api.github.com/repos/owner/app/actions/runs/200' });
    if (url.includes('/runs?')) return response({ total_count: 101, workflow_runs: url.includes('page=2') ? [{ id: 101 }] : Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) });
    if (url.endsWith('/graphql')) return response({ data: { viewer: { databaseId: 10, login: 'automation[bot]' } } });
    if (url.endsWith('/review.yml')) return response({ id: 99, path: '.github/workflows/review.yml', state: 'active' });
    if (url.endsWith('/repos/owner/app')) return response({ full_name: 'owner/app', private: true });
    throw new Error('private transport error');
  } });
  assert.equal((await api.getRepository('owner/app')).private, true); assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer read-fixture');
  assert.deepEqual(await api.getIdentity(), { id: 10, login: 'automation[bot]' }); assert.equal((await api.getWorkflow('owner/app', '.github/workflows/review.yml')).id, 99);
  assert.equal((await api.listWorkflowRuns('owner/app', 99)).at(-1).id, 101);
  const body = { ref: 'master', inputs: { pull_number: '9', expected_head_sha: 'a'.repeat(40), review_handoff_json: '{}', dispatch_id: 'b'.repeat(64) } };
  assert.equal((await api.dispatch('owner/app', 99, body)).workflow_run_id, 200);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), body); assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer dispatch-fixture');
  assert.equal(calls.at(-1).options.redirect, 'error');
  let deniedPosts = 0;
  const denied = createReviewDispatchApi('dispatch-fixture', { readToken: 'read-fixture', fetchImpl: async () => { deniedPosts++; throw new Error('private dispatch failure'); } });
  await assert.rejects(denied.dispatch('owner/app', 99, body), { code: 'REVIEW_DISPATCH_FAILED', message: 'REVIEW_DISPATCH_FAILED' });
  assert.equal(deniedPosts, 1);
  assert.throws(() => api.dispatch('owner/app', 99, { ...body, inputs: { ...body.inputs, CODEX_AUTH_JSON: 'not-allowed' } }), { code: 'REVIEW_DISPATCH_FAILED' });
  assert.throws(() => api.getWorkflow('owner/app', '../other.yml'), { code: 'REVIEW_DISPATCH_FAILED' });
  const before = calls.length;
  await assert.rejects(api.dispatch('owner/app', 99, { ...body, inputs: { ...body.inputs, review_handoff_json: 'dispatch-fixture' } }), { code: 'REVIEW_DISPATCH_FAILED' });
  assert.equal(calls.length, before);
});

test('REV-19: verified complementary review PR stops the dispatch chain instead of blanket ignoring bot PRs', async t => {
  const f = await fixture(t); const parent = structuredClone(f.state.pull); const head = 'c'.repeat(40);
  const marker = '<!-- review:v1:owner/app:9 -->'; const proof = `Entrada: ${'f'.repeat(64)}\nHead original: ${parent.head.sha}\nConfiguração: ${f.state.configSha}`;
  const body = `${marker}\n${proof}\n`;
  f.state.pull = { ...parent, number: 30, user: f.state.identity, body: `<!-- review-body-sha256:${digest(body)} -->\n${body}`,
    head: { ref: `feature/review-pr-9-${parent.head.sha.slice(0, 12)}`, sha: head, repo: { full_name: 'owner/app' } },
    base: { ref: parent.head.ref, sha: parent.head.sha, repo: { full_name: 'owner/app' } } };
  f.state.commit = { sha: head, tree: { sha: 'd'.repeat(40) }, parents: [{ sha: parent.head.sha }],
    message: `Review correction for PR #9\n\n${marker}\n${proof}\nPatch: ${'e'.repeat(64)}` };
  f.api.getPull = async (_repo, number) => structuredClone(number === 9 ? parent : f.state.pull);
  const stopped = await dispatchReview({ ...f, pull: 30, expected_head_sha: head, event: { ...f.event, pull_number: 30 } }, f.api);
  assert.deepEqual(stopped, { status: 'skipped-correction', run_id: null, dispatch_id: null }); assert.deepEqual(f.state.posts, []);
  f.state.commit.parents = [{ sha: 'f'.repeat(40) }];
  await assert.rejects(dispatchReview({ ...f, pull: 30, expected_head_sha: head, event: { ...f.event, pull_number: 30 } }, f.api), { code: 'UNTRUSTED_CONTEXT' });
});

test('REV-01/17/26: actual dispatch runner reads platform event and emits only identifiers without LLM credentials', async t => {
  const f = await fixture(t); const automation = join(f.root, 'automation'); await mkdir(automation);
  git(automation, 'init', '-q'); git(automation, 'config', 'user.name', 'Fixture'); git(automation, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(automation, 'version'), 'fixture'); git(automation, 'add', '.'); git(automation, 'commit', '-qm', 'automation');
  const payloadPath = join(f.root, 'event.json'); await writeFile(payloadPath, JSON.stringify({ action: 'opened', repository: f.state.repo, pull_request: f.state.pull }));
  const apiPath = join(f.root, 'api.json'); await writeFile(apiPath, JSON.stringify({ repo: f.state.repo, pull: f.state.pull, config_sha: f.state.configSha, identity: f.state.identity }));
  const output = join(f.root, 'output'); const capture = join(f.root, 'dispatch.json'); await writeFile(output, '');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_WORKSPACE: f.root, GITHUB_EVENT_PATH: payloadPath,
    GITHUB_REPOSITORY: f.event.repository, GITHUB_EVENT_NAME: f.event.event_name, GITHUB_ACTOR: f.event.actor, GITHUB_ACTOR_ID: '20', GITHUB_SHA: f.event.sha,
    GITHUB_WORKFLOW_SHA: f.event.workflow_sha, GITHUB_REF: f.event.ref, GITHUB_WORKFLOW_REF: f.event.workflow_ref, GITHUB_SERVER_URL: f.event.server_url,
    GITHUB_RUN_ID: f.event.run_id, GITHUB_RUN_ATTEMPT: f.event.run_attempt, AUTOMATION_SHA: git(automation, 'rev-parse', 'HEAD'),
    REVIEW_READ_TOKEN: 'read-fixture', REVIEW_DISPATCH_TOKEN: 'dispatch-fixture', GITHUB_OUTPUT: output, DISPATCH_API_FIXTURE: apiPath, DISPATCH_CAPTURE: capture };
  const run = overrides => spawnSync(process.execPath, ['--import', new URL('./fixtures/dispatch-api.mjs', import.meta.url).href,
    fileURLToPath(new URL('../../scripts/review/dispatch-run.mjs', import.meta.url))], { env: { ...env, ...overrides }, encoding: 'utf8' });
  const valid = run(); assert.equal(valid.status, 0, valid.stderr); assert.equal(valid.stdout, 'Review dispatch: dispatched\n');
  assert.ok((await readFile(output, 'utf8')).includes('run_id=200\n'));
  const payload = JSON.parse(await readFile(capture, 'utf8')); assert.equal(payload.inputs.expected_head_sha, f.expected_head_sha);
  assert.equal(payload.inputs.review_handoff_json, '{}'); assert.equal(JSON.stringify(payload).includes('fixture'), false);
  const refused = run({ REVIEW_PULL_NUMBER: '10' }); assert.equal(refused.status, 1); assert.equal(refused.stderr, 'UNTRUSTED_CONTEXT\n');
  assert.deepEqual(JSON.parse(await readFile(capture, 'utf8')), payload);
});
