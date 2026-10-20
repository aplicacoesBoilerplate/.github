import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectWorkflow, invocationInputs, prepareWorkflow, publishWorkflow, workflowOutcome } from '../../scripts/triage/workflow.mjs';
import { runInvocation } from '../../scripts/llm/orchestrate.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
function git(root, ...args) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
async function fixture(t, effort = 'Low') {
  const root = await mkdtemp(join(tmpdir(), 'triage-workflow-')); t.after(() => rm(root, { recursive: true, force: true }));
  const configRoot = join(root, 'consumer'); await mkdir(configRoot); git(configRoot, 'init', '-qb', 'master');
  git(configRoot, 'config', 'user.name', 'Fixture'); git(configRoot, 'config', 'user.email', 'fixture@example.test');
  await mkdir(join(configRoot, '.github/triage'), { recursive: true }); await mkdir(join(configRoot, '.github/llm'));
  const config = { schema_version: 1, project: { owner: 'owner', number: 12 }, fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
    llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' }, reviewer: 'reviewer', allowed_paths: ['main.go'],
    checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {} };
  await writeFile(join(configRoot, '.github/triage/config.json'), JSON.stringify(config)); await writeFile(join(configRoot, 'main.go'), 'old\n');
  for (const kind of ['plan', 'patch']) await writeFile(join(configRoot, `.github/llm/${kind}.json`), JSON.stringify({ schema_version: 1, invocation_mode: 'single', execution: { model: `own-${kind}`, effort: 'high', template: 'analyze' } }));
  git(configRoot, 'add', '.'); git(configRoot, 'commit', '-qm', 'release base'); const sourceSha = git(configRoot, 'rev-parse', 'HEAD');
  git(configRoot, 'branch', 'release/v1.0.0'); await writeFile(join(configRoot, 'AGENTS.md'), 'trusted instructions'); git(configRoot, 'add', '.'); git(configRoot, 'commit', '-qm', 'trusted config');
  const configSha = git(configRoot, 'rev-parse', 'HEAD'); const sourceRoot = join(root, 'source'); git(root, 'clone', '-q', '--branch', 'release/v1.0.0', '--', configRoot, sourceRoot);
  const event = { repository: 'owner/app', event_name: 'issues', action: 'opened', actor: 'author', issue_number: 7, ref: 'refs/heads/master',
    sha: configSha, workflow_sha: configSha, workflow_ref: 'owner/app/.github/workflows/triage.yml@refs/heads/master', server_url: 'https://github.com', run_id: '42', run_attempt: '1' };
  const issue = { number: 7, node_id: 'I7', state: 'open', title: 'Fix typo', body: 'Correct the typo', updated_at: '2026-10-14T10:00:00Z',
    repository_url: 'https://api.github.com/repos/owner/app', user: { login: 'author' }, type: { name: 'Bug' }, milestone: { number: 1, title: 'v1.0.0' } };
  const metadataApi = { getRepository: async () => ({ full_name: 'owner/app', private: true, fork: false, default_branch: 'master' }), getIssue: async () => issue,
    getPermission: async (_repo, actor) => ({ permission: 'write', user: { login: actor } }), getDependencies: async () => [], getParent: async () => null, getIssueFields: async () => [],
    getBranch: async (_repo, ref) => ({ name: ref, commit: { sha: ref === 'master' ? configSha : sourceSha } }),
    getProjectMetadata: async () => ({ fields: ['Effort', 'Size', 'Estimate', 'Release'].map((name, i) => ({ id: String(i), name })),
      values: [{ field: { id: '0' }, value: effort }, { field: { id: '1' }, value: 'XS' }, { field: { id: '2' }, value: 1 }] }) };
  const inputs = { config_path: '.github/triage/config.json', issue_number: 0, auth_mode: 'api-key', session_secret_name: '', verification_image: `docker.io/library/golang@sha256:${'f'.repeat(64)}` };
  const outputRoot = join(root, 'results'); await mkdir(outputRoot);
  return { configRoot, sourceRoot, event, inputs, metadataApi, outputRoot, automation_sha: 'c'.repeat(40) };
}

test('TRI-01/04/07/17: consumer collection flows through the central invocation into a verified bound patch', async t => {
  const f = await fixture(t); const collected = await collectWorkflow(f, f.metadataApi); const inputs = invocationInputs(f.inputs, collected.snapshot, collected.config);
  assert.equal(inputs.triage_fingerprint, collected.snapshot.fingerprint); assert.equal(inputs.context_json, '{}'); assert.equal(inputs.source_ref, 'release/v1.0.0');
  const modelPatch = 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n'; let receivedModel;
  const result = await runInvocation({ ...f, inputs, secrets: { OPENAI_API_KEY: 'fixture-key', TRIAGE_READ_TOKEN: 'fixture-read' } }, {
    triageApi: f.metadataApi, checkedConfigSha: collected.snapshot.config_source_sha, checkedOutSha: collected.snapshot.source_sha,
    execute: async request => { receivedModel = request.config.execution.model; return { status: 'succeeded', decision: 'none', summary: 'proposed fix', patch: modelPatch }; } });
  const prepared = await prepareWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory }, { verify: { execute: async () => ({}) } });
  assert.equal(receivedModel, 'own-patch'); assert.equal(prepared.verification.status, 'passed');
  assert.equal(prepared.verification.source_sha, collected.snapshot.source_sha); assert.equal(prepared.verification.config_source_sha, collected.snapshot.config_source_sha);
  assert.equal(prepared.result.envelope.source_sha, collected.snapshot.source_sha); assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'old\n');
  const identity = { id: 10, login: 'automation[bot]' }; const state = { comments: [], pulls: [], ref: null, commit: null };
  const publicationApi = { recollect: async () => collected.snapshot, getIdentity: async () => identity,
    listComments: async () => state.comments, createComment: async (_repo, _issue, body) => { const c = { id: 1, body, user: identity }; state.comments.push(c); return c; },
    getRef: async () => state.ref, getCommit: async () => state.commit,
    createCommit: async (_repo, p) => (state.commit = { sha: 'f'.repeat(40), tree: { sha: p.tree_sha }, parents: [{ sha: p.base_sha }], message: p.message }),
    createRef: async (_repo, ref, sha) => (state.ref = { ref: `refs/heads/${ref}`, object: { sha } }), listPulls: async () => state.pulls,
    getPull: async () => state.pulls[0], createPull: async (_repo, p) => { const pull = { ...p, number: 20, user: identity, state: 'open', html_url: 'https://github.com/owner/app/pull/20',
      head: { ref: p.head, sha: state.commit.sha, repo: { full_name: 'owner/app' } }, base: { ref: p.base, sha: collected.snapshot.source_sha, repo: { full_name: 'owner/app' } },
      requested_reviewers: [], milestone: null }; state.pulls.push(pull); return pull; },
    setMilestone: async (_repo, _n, milestone) => Object.assign(state.pulls[0], { milestone: { number: milestone } }),
    requestReview: async (_repo, _n, reviewer) => { state.pulls[0].requested_reviewers.push({ login: reviewer }); return state.pulls[0]; }, listReviews: async () => [] };
  const published = await publishWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory, verification: prepared.verification }, { metadataApi: f.metadataApi, publicationApi });
  assert.equal(published.status, 'draft'); assert.equal(published.pr_number, 20); assert.equal(state.pulls[0].draft, true);
  assert.equal(state.pulls[0].milestone.number, 1); assert.equal(state.pulls[0].requested_reviewers[0].login, 'reviewer');
  assert.equal(state.commit.parents[0].sha, collected.snapshot.source_sha); assert.ok(state.comments[0].body.includes('https://github.com/owner/app/pull/20'));
});

test('TRI-11: insufficient API metadata bypasses inference and publishes only intervention', async t => {
  const f = await fixture(t); f.metadataApi.getProjectMetadata = async () => ({ fields: [], values: [] });
  const collected = await collectWorkflow(f, f.metadataApi); assert.equal(collected.snapshot.route.route, 'needs-human');
  const comments = []; const identity = { id: 10, login: 'automation[bot]' };
  const value = await publishWorkflow({ ...f, snapshot: collected.snapshot }, { metadataApi: f.metadataApi,
    publicationApi: { recollect: async () => collected.snapshot, getIdentity: async () => identity, listComments: async () => comments,
      createComment: async (_repo, _issue, body) => { const c = { id: 1, body, user: identity }; comments.push(c); return c; } } });
  assert.equal(value.status, 'needs-human'); assert.equal(value.pr_number, null); assert.ok(comments[0].body.includes('METADATA_INCOMPLETE'));
});

test('TRI-11/12/20: planning and insufficient metadata use the same publisher; wrong configuration and artifacts are refused', async t => {
  const f = await fixture(t, 'High'); const collected = await collectWorkflow(f, f.metadataApi); const inputs = invocationInputs(f.inputs, collected.snapshot, collected.config);
  const result = await runInvocation({ ...f, inputs, secrets: { OPENAI_API_KEY: 'fixture-key', TRIAGE_READ_TOKEN: 'fixture-read' } }, {
    triageApi: f.metadataApi, checkedConfigSha: collected.snapshot.config_source_sha, checkedOutSha: collected.snapshot.source_sha,
    execute: async () => ({ status: 'succeeded', decision: 'none', summary: 'SDD proposal', patch: null }) });
  const comments = []; const identity = { id: 10, login: 'automation[bot]' };
  const publicationApi = { recollect: async () => collected.snapshot, getIdentity: async () => identity, listComments: async () => comments,
    createComment: async (_repo, _issue, body) => { const value = { id: 1, body, user: identity }; comments.push(value); return value; } };
  const published = await publishWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory }, { metadataApi: f.metadataApi, publicationApi });
  assert.equal(published.status, 'planned'); assert.ok(comments[0].body.includes('SDD proposal'));
  await assert.rejects(prepareWorkflow({ ...f, snapshot: { ...collected.snapshot, config_source_sha: 'f'.repeat(40) }, artifactRoot: result.directory }), { code: 'STALE_TRIAGE_INPUT' });
  const envelopePath = join(result.directory, 'result.json'); const envelope = JSON.parse(await readFile(envelopePath, 'utf8'));
  await writeFile(envelopePath, JSON.stringify({ ...envelope, automation_sha: 'f'.repeat(40) }));
  await assert.rejects(prepareWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory }), { code: 'INVALID_RESULT' });
});

test('TRI-11/22: a central needs-human decision remains intervention, never a planning success or a PR', async t => {
  const f = await fixture(t, 'High'); const collected = await collectWorkflow(f, f.metadataApi);
  const inputs = invocationInputs(f.inputs, collected.snapshot, collected.config);
  const result = await runInvocation({ ...f, inputs, secrets: { OPENAI_API_KEY: 'fixture-key', TRIAGE_READ_TOKEN: 'fixture-read' } }, {
    triageApi: f.metadataApi, checkedConfigSha: collected.snapshot.config_source_sha, checkedOutSha: collected.snapshot.source_sha,
    execute: async () => ({ status: 'needs-human', decision: 'needs-human', summary: 'More information required', patch: null }) });
  const checks = await prepareWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory });
  assert.equal(checks.verification.status, 'not-required');
  const comments = []; const identity = { id: 10, login: 'automation[bot]' };
  const published = await publishWorkflow({ ...f, snapshot: collected.snapshot, artifactRoot: result.directory, verification: checks.verification }, {
    metadataApi: f.metadataApi, publicationApi: { recollect: async () => collected.snapshot, getIdentity: async () => identity,
      listComments: async () => comments, createComment: async (_repo, _issue, body) => { const value = { id: 1, body, user: identity }; comments.push(value); return value; } } });
  assert.equal(published.status, 'needs-human'); assert.equal(published.pr_number, null); assert.ok(comments[0].body.includes('More information required'));
});

test('TRI-04/17/19/22: reusable workflow has explicit secret boundaries, no inherited secrets and no successful finalization after failed upload', async () => {
  const workflow = parse(await readFile(new URL('../../.github/workflows/issue-triage.yml', import.meta.url), 'utf8'));
  assert.equal(workflow.concurrency['cancel-in-progress'], false); assert.equal(workflow.concurrency.queue, 'max');
  assert.ok(workflow.concurrency.group.includes('github.repository')); assert.ok(workflow.concurrency.group.includes('github.event.issue.number'));
  assert.equal(workflow.jobs.llm.uses, './.github/workflows/llm-execute.yml'); assert.notEqual(workflow.jobs.llm.secrets, 'inherit');
  assert.equal(workflow.jobs.llm.if, "needs.collect.outputs.route != 'needs-human'");
  assert.equal(workflow.jobs.llm.with.triage_fingerprint, '${{ needs.collect.outputs.fingerprint }}'); assert.equal(workflow.jobs.llm.with.context_json, undefined);
  assert.deepEqual(workflow.jobs.checks.permissions, { contents: 'read', actions: 'read' });
  const checksEnv = Object.assign({}, ...workflow.jobs.checks.steps.map(step => step.env ?? {}));
  assert.equal(checksEnv.CODEX_AUTH_JSON, undefined); assert.equal(checksEnv.TRIAGE_PUBLISH_TOKEN, undefined); assert.equal(checksEnv.CODEX_AUTH_WRITE_PAT, undefined);
  const publisherEnv = Object.assign({}, ...workflow.jobs.publish.steps.map(step => step.env ?? {}));
  assert.equal(publisherEnv.CODEX_AUTH_JSON, undefined); assert.equal(publisherEnv.OPENAI_API_KEY, undefined);
  assert.equal(publisherEnv.TRIAGE_PUBLISH_TOKEN, '${{ secrets.TRIAGE_PUBLISH_TOKEN }}');
  for (const job of Object.values(workflow.jobs)) for (const step of job.steps ?? []) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  for (const job of ['collect', 'checks', 'publish']) assert.equal(workflow.jobs[job].steps.find(step => step.id === 'cleanup').if, 'always()');
  assert.equal(workflowOutcome({ collect: 'success', publish: 'success', cleanup: 'success', status: 'planned' }), 'planned');
  for (const outcomes of [{ collect: 'failure', publish: 'skipped', cleanup: 'success', status: '' }, { collect: 'success', publish: 'failure', cleanup: 'success', status: 'draft' }])
    assert.throws(() => workflowOutcome(outcomes), { code: 'ARTIFACT_FAILED' });
});

test('TRI-22: actual triage runner finalizes failed pipeline stages explicitly without credentials', async t => {
  const root = await mkdtemp(join(tmpdir(), 'triage-finish-')); t.after(() => rm(root, { recursive: true, force: true })); const output = join(root, 'output'); await writeFile(output, '');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/triage/run.mjs', import.meta.url)), 'finish'], {
    encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_OUTPUT: output,
      COLLECT_OUTCOME: 'success', PUBLISH_OUTCOME: 'failure', CLEANUP_OUTCOME: 'success', RESULT_STATUS: 'draft' } });
  assert.equal(result.status, 1); assert.equal(result.stderr, 'ARTIFACT_FAILED\n'); assert.equal(await readFile(output, 'utf8'), 'status=failed\nerror_code=ARTIFACT_FAILED\n');
});

test('TRI-01/05/22: actual collector runner publishes only bounded identity outputs and cleans its snapshot', async t => {
  const f = await fixture(t); const workspace = join(f.configRoot, '..'); const automation = join(workspace, 'automation'); await mkdir(automation);
  git(automation, 'init', '-q'); git(automation, 'config', 'user.name', 'Fixture'); git(automation, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(automation, 'version'), 'fixture'); git(automation, 'add', '.'); git(automation, 'commit', '-qm', 'automation');
  const payloadPath = join(workspace, 'event.json'); await writeFile(payloadPath, JSON.stringify({ action: 'opened', issue: { number: 7 } }));
  const apiPath = join(workspace, 'api.json'); await writeFile(apiPath, JSON.stringify({ repo: await f.metadataApi.getRepository(), issue: await f.metadataApi.getIssue(),
    config_sha: f.event.sha, source_sha: git(f.sourceRoot, 'rev-parse', 'HEAD'), project: await f.metadataApi.getProjectMetadata() }));
  const output = join(workspace, 'output'); await writeFile(output, '');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, INPUTS_JSON: JSON.stringify(f.inputs), RUNNER_TEMP: f.outputRoot,
    GITHUB_WORKSPACE: workspace, GITHUB_EVENT_PATH: payloadPath, GITHUB_REPOSITORY: f.event.repository, GITHUB_EVENT_NAME: f.event.event_name,
    GITHUB_ACTOR: f.event.actor, GITHUB_SHA: f.event.sha, GITHUB_REF: f.event.ref, GITHUB_WORKFLOW_SHA: f.event.workflow_sha,
    GITHUB_WORKFLOW_REF: f.event.workflow_ref, GITHUB_SERVER_URL: f.event.server_url, GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_OUTPUT: output, TRIAGE_API_FIXTURE: apiPath, TRIAGE_READ_TOKEN: 'read-fixture', AUTOMATION_SHA: git(automation, 'rev-parse', 'HEAD') };
  const run = phase => spawnSync(process.execPath, ['--import', new URL('./fixtures/triage-api.mjs', import.meta.url).href,
    fileURLToPath(new URL('../../scripts/triage/run.mjs', import.meta.url)), phase], { env, encoding: 'utf8' });
  for (const phase of ['bootstrap', 'collect']) { const value = run(phase); assert.equal(value.status, 0, value.stderr); }
  const outputs = await readFile(output, 'utf8'); assert.ok(outputs.includes('route=propose-patch\n')); assert.ok(Buffer.byteLength(outputs) < 8192);
  assert.equal(outputs.includes('Correct the typo'), false); assert.equal(outputs.includes('read-fixture'), false);
  const snapshotPath = join(f.outputRoot, 'triage-run-42-1-issue7/snapshot/snapshot.json'); const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  assert.equal(snapshot.issue.body, 'Correct the typo'); assert.equal(snapshot.config_source_sha, f.event.sha); assert.equal(snapshot.source_sha, git(f.sourceRoot, 'rev-parse', 'HEAD'));
  assert.equal(run('cleanup').status, 0); await assert.rejects(readFile(snapshotPath), { code: 'ENOENT' }); assert.equal(git(f.configRoot, 'rev-parse', 'HEAD'), f.event.sha);
});
