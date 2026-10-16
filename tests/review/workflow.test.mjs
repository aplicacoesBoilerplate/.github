import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { publicationFixture } from './fixtures/publication.mjs';
import { collectWorkflow, invocationInputs, prepareWorkflow, publishWorkflow, workflowOutcome, validateWorkflowInputs } from '../../scripts/review/workflow.mjs';
import { runInvocation } from '../../scripts/llm/orchestrate.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
function git(root, ...args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}
async function fixture(t) {
  const f = await publicationFixture(t); const configRoot = join(f.root, 'consumer');
  git(f.root, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), configRoot);
  git(configRoot, 'checkout', '--quiet', '--detach', f.snapshot.base_sha);
  git(configRoot, 'config', 'user.name', 'Fixture'); git(configRoot, 'config', 'user.email', 'fixture@example.test');
  await mkdir(join(configRoot, '.github/review'), { recursive: true }); await mkdir(join(configRoot, '.github/llm'));
  await writeFile(join(configRoot, '.github/review/config.json'), JSON.stringify(f.config));
  for (const kind of ['review', 'correction']) await writeFile(join(configRoot, `.github/llm/${kind}.json`), JSON.stringify({ schema_version: 1, invocation_mode: 'single',
    execution: { model: 'consumer-review', effort: 'high', template_path: '.github/llm/prompt.md' } }));
  await writeFile(join(configRoot, '.github/llm/prompt.md'), 'OWN PROMPT'); await writeFile(join(configRoot, 'AGENTS.md'), 'consumer rules');
  git(configRoot, 'add', '.'); git(configRoot, 'commit', '-qm', 'trusted config'); const configSha = git(configRoot, 'rev-parse', 'HEAD');
  const event = { repository: 'owner/app', event_name: 'workflow_dispatch', actor: 'human', actor_id: 20, pull_number: 9,
    sha: configSha, workflow_sha: configSha, ref: 'refs/heads/master', workflow_ref: 'owner/app/.github/workflows/review.yml@refs/heads/master',
    server_url: 'https://github.com', run_id: '42', run_attempt: '1' };
  const metadataApi = { getRepository: async () => ({ full_name: 'owner/app', private: true, fork: false, default_branch: 'master' }),
    getPull: async () => ({ ...f.snapshot.pull, head: { ...f.snapshot.pull.head, repo: { full_name: 'owner/app' } }, base: { ...f.snapshot.pull.base, repo: { full_name: 'owner/app' } } }),
    getBranch: async () => ({ name: 'master', commit: { sha: configSha } }), getPermission: async (_r, actor) => ({ permission: 'write', user: { login: actor } }) };
  const inputs = { config_path: '.github/review/config.json', pull_number: 9, review_handoff_json: '{}', auth_mode: 'api-key', session_secret_name: '',
    verification_image: `docker.io/library/golang@sha256:${'f'.repeat(64)}` };
  const outputRoot = join(f.root, 'results'); await mkdir(outputRoot);
  return { ...f, configRoot, event, metadataApi, inputs, outputRoot, automation_sha: 'c'.repeat(40) };
}
async function inferred(f) {
  const { snapshot, config } = await collectWorkflow(f, f.metadataApi); f.state.current = structuredClone(snapshot);
  const invocation = invocationInputs(f.inputs, snapshot, config); let received;
  const result = await runInvocation({ ...f, inputs: invocation, secrets: { OPENAI_API_KEY: 'fixture-key', REVIEW_READ_TOKEN: 'fixture-read' } }, {
    reviewApi: f.metadataApi, checkedConfigSha: snapshot.config_source_sha, checkedOutSha: snapshot.source_sha,
    execute: async request => { received = request.config.execution; return { status: 'succeeded', decision: 'none', summary: 'A correction.',
      findings: [{ severity: 'warning', path: 'main.go', line: 1, message: 'Fix this behavior.' }],
      patch: 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-new\n+fixed\n' }; } });
  return { ...f, snapshot, artifactRoot: result.directory, received, invocation };
}

test('REV-04/13/14/15: collection uses the central result and isolated checks cannot supply a mutated publication tree', async t => {
  const f = await inferred(await fixture(t)); let checkedRoot;
  const checked = await prepareWorkflow(f, { verify: { execute: async (command, args, options) => {
    assert.equal(command, 'docker');
    if (args[0] === 'run') {
      assert.ok(args.includes('--network=none')); assert.ok(args.includes('--read-only')); assert.ok(args.includes('--cap-drop=ALL'));
      assert.equal(args.filter(a => a === '--mount').length, 1); assert.equal(args.some(a => a.includes('docker.sock')), false);
      assert.deepEqual(Object.keys(options.env).sort(), ['DOCKER_CONFIG', 'PATH', 'SystemRoot']);
      const mount = args[args.indexOf('--mount') + 1]; checkedRoot = mount.slice('type=bind,source='.length).split(',target=')[0];
      assert.notEqual(checkedRoot, f.sourceRoot); assert.equal(mount.includes('automation'), false);
      await writeFile(join(checkedRoot, 'main.go'), 'poison from product checks\n');
      throw Object.assign(new Error('product failed with private output'), { code: 1 });
    }
    return {};
  } } });
  assert.equal(f.received.model, 'consumer-review'); assert.equal(f.received.effort, 'high'); assert.equal(f.invocation.context_json, '{}');
  assert.equal(checked.verification.status, 'failed'); await assert.rejects(readFile(join(checkedRoot, 'main.go')), { code: 'ENOENT' });
  const published = await publishWorkflow({ ...f, verification: checked.verification }, { metadataApi: f.metadataApi, publicationApi: f.api });
  assert.equal(published.status, 'draft-checks-failed'); assert.equal(f.state.pulls[0].base.sha, f.snapshot.source_sha);
  const payload = f.state.writes.find(w => w.kind === 'commit').payload;
  assert.deepEqual(payload.changes, [{ path: 'main.go', mode: '100644', type: 'blob', content: Buffer.from('fixed\n').toString('base64') }]);
  assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'new\n');
});

test('REV-06/24/26: mutated snapshots, artifacts, incomplete checks and cleanup failures cannot publish success', async t => {
  const f = await inferred(await fixture(t));
  await assert.rejects(prepareWorkflow({ ...f, snapshot: { ...f.snapshot, fingerprint: 'f'.repeat(64) } }), { code: 'INVALID_REVIEW_INPUT' });
  await assert.rejects(prepareWorkflow({ ...f, snapshot: { ...f.snapshot, config_source_sha: 'f'.repeat(40) } }), { code: 'STALE_REVIEW_INPUT' });
  await assert.rejects(prepareWorkflow({ ...f, automation_sha: 'f'.repeat(40) }), { code: 'INVALID_RESULT' });
  const prepared = await prepareWorkflow(f, { verify: { execute: async () => ({}) } });
  await assert.rejects(publishWorkflow({ ...f, verification: { ...prepared.verification, checks: [] } }, { publicationApi: f.api }), { code: 'INVALID_REVIEW_VERIFICATION' });
  await assert.rejects(prepareWorkflow(f, { verify: { execute: async (_cmd, args) => { if (args[0] === 'rm') throw new Error('cleanup failed'); return {}; } } }), { code: 'CHECK_CLEANUP_FAILED' });
  assert.deepEqual(f.state.writes, []);
  assert.throws(() => validateWorkflowInputs({ ...f.inputs, verification_image: 'golang:latest' }), { code: 'INVALID_REVIEW_CONFIG' });
  assert.throws(() => validateWorkflowInputs({ ...f.inputs, model: 'central-default' }), { code: 'INVALID_REVIEW_CONFIG' });
  const stages = { collect: 'success', llm: 'success', checks: 'success', publish: 'success', cleanup: 'success', status: 'draft' };
  assert.equal(workflowOutcome(stages), 'draft');
  for (const key of ['collect', 'llm', 'checks', 'publish', 'cleanup']) assert.throws(() => workflowOutcome({ ...stages, [key]: 'failure' }), { code: 'ARTIFACT_FAILED' });
});

test('REV-01/20/26: reusable workflow isolates jobs, session queue and CI discovery without weakening old gates', async () => {
  const w = parse(await readFile(new URL('../../.github/workflows/pr-code-review.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(w.jobs), ['collect', 'llm', 'checks', 'publish', 'finish']);
  assert.ok(w.concurrency.group.includes('review-')); assert.equal(w.concurrency['cancel-in-progress'], false); assert.equal(w.concurrency.queue, 'max');
  assert.equal(w.jobs.llm.uses, './.github/workflows/llm-execute.yml'); assert.equal(w.jobs.llm.with.caller_profile, 'review');
  assert.equal(w.jobs.llm.with.review_handoff_json, '${{ inputs.review_handoff_json }}');
  assert.deepEqual(Object.keys(w.jobs.llm.secrets).sort(), ['REVIEW_READ_TOKEN', 'CODEX_AUTH_JSON', 'CODEX_AUTH_WRITE_PAT', 'OPENAI_API_KEY'].sort());
  assert.equal(w.jobs.llm.concurrency, undefined);
  const checks = JSON.stringify(w.jobs.checks); for (const secret of ['REVIEW_READ_TOKEN', 'REVIEW_PUBLISH_TOKEN', 'CODEX_AUTH', 'OPENAI_API_KEY']) assert.equal(checks.includes(secret), false);
  const writer = JSON.stringify(w.jobs.publish); assert.equal(writer.includes('CODEX_AUTH'), false); assert.equal(writer.includes('OPENAI_API_KEY'), false);
  assert.equal(w.jobs.publish.permissions['pull-requests'], 'write'); assert.equal(w.jobs.checks.permissions.contents, 'read');
  for (const gate of ["needs.collect.result == 'success'", "needs.llm.result == 'success'", "needs.checks.result == 'success'"])
    assert.ok(w.jobs.publish.if.includes(gate));
  for (const name of ['collect', 'checks', 'publish']) {
    const steps = w.jobs[name].steps; assert.equal(steps.find(s => s.id === 'cleanup').if, 'always()');
    assert.equal(steps.some(s => s['continue-on-error']), false);
    for (const s of steps.filter(s => s.uses?.startsWith('actions/upload-artifact@'))) { assert.equal(s.with['if-no-files-found'], 'error'); assert.equal(s.with['retention-days'], 1); assert.equal(s.with.overwrite, false); }
    for (const s of steps.filter(s => s.uses?.startsWith('actions/checkout@'))) assert.equal(s.with['persist-credentials'], false);
  }
  assert.equal(w.jobs.finish.if, 'always()'); assert.equal(w.jobs.finish.steps.find(s => s.id === 'finish').env.CHECKS_OUTCOME, '${{ needs.checks.result }}');
  const pkg = JSON.parse(await readFile(new URL('../../scripts/llm/package.json', import.meta.url), 'utf8'));
  for (const group of ['llm', 'triage', 'review']) assert.ok(pkg.scripts.test.includes(`tests/${group}/*.test.mjs`));
  const discovery = await readFile(new URL('../../scripts/llm/check.mjs', import.meta.url), 'utf8'); assert.ok(discovery.includes('../review/')); assert.ok(discovery.includes('../shared/'));
  const lint = await readFile(new URL('../../scripts/llm/lint-workflow.mjs', import.meta.url), 'utf8'); assert.ok(lint.includes('pr-code-review.yml'));
});

test('REV-01/26: actual runner reads the platform event, emits bounded identities and cleans its snapshot', async t => {
  const f = await fixture(t); const workspace = f.root; const automation = join(workspace, 'automation'); await mkdir(automation);
  git(automation, 'init', '-q'); git(automation, 'config', 'user.name', 'Fixture'); git(automation, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(automation, 'version'), 'fixture'); git(automation, 'add', '.'); git(automation, 'commit', '-qm', 'automation');
  git(workspace, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), join(workspace, 'consumer-source'));
  const payload = join(workspace, 'event.json'); await writeFile(payload, JSON.stringify({ inputs: { pull_number: '9', review_handoff_json: '{}' } }));
  const apiPath = join(workspace, 'api.json'); await writeFile(apiPath, JSON.stringify({ repo: await f.metadataApi.getRepository(), pull: await f.metadataApi.getPull(), config_sha: f.event.sha }));
  const output = join(workspace, 'output'); await writeFile(output, '');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, INPUTS_JSON: JSON.stringify(f.inputs), RUNNER_TEMP: f.outputRoot,
    GITHUB_WORKSPACE: workspace, GITHUB_EVENT_PATH: payload, GITHUB_REPOSITORY: f.event.repository, GITHUB_EVENT_NAME: f.event.event_name,
    GITHUB_ACTOR: f.event.actor, GITHUB_ACTOR_ID: '20', GITHUB_SHA: f.event.sha, GITHUB_REF: f.event.ref, GITHUB_WORKFLOW_SHA: f.event.workflow_sha,
    GITHUB_WORKFLOW_REF: f.event.workflow_ref, GITHUB_SERVER_URL: f.event.server_url, GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_OUTPUT: output, REVIEW_API_FIXTURE: apiPath, REVIEW_READ_TOKEN: 'read-fixture', AUTOMATION_SHA: git(automation, 'rev-parse', 'HEAD') };
  const run = phase => spawnSync(process.execPath, ['--import', new URL('./fixtures/review-api.mjs', import.meta.url).href,
    fileURLToPath(new URL('../../scripts/review/run.mjs', import.meta.url)), phase], { env, encoding: 'utf8' });
  for (const phase of ['bootstrap', 'collect']) { const p = run(phase); assert.equal(p.status, 0, p.stderr); }
  const outputs = await readFile(output, 'utf8'); assert.ok(outputs.includes('route=correction\n')); assert.ok(outputs.includes(`source_sha=${f.snapshot.source_sha}\n`));
  assert.ok(Buffer.byteLength(outputs) < 8192); assert.equal(outputs.includes('read-fixture'), false); assert.equal(outputs.includes('Feature'), false);
  const snapshot = join(f.outputRoot, 'review-run-42-1-pr9/snapshot/snapshot.json'); assert.equal(JSON.parse(await readFile(snapshot, 'utf8')).pull.number, 9);
  assert.equal(run('cleanup').status, 0); await assert.rejects(readFile(snapshot), { code: 'ENOENT' });
  await writeFile(payload, JSON.stringify({ inputs: { pull_number: '10' } })); assert.equal(run('bootstrap').stderr, 'UNTRUSTED_CONTEXT\n');
  delete env.INPUTS_JSON; env.COLLECT_OUTCOME = 'success'; env.LLM_OUTCOME = 'success'; env.CHECKS_OUTCOME = 'success';
  env.PUBLISH_OUTCOME = 'failure'; env.CLEANUP_OUTCOME = 'success'; env.RESULT_STATUS = 'draft';
  assert.equal(run('finish').stderr, 'ARTIFACT_FAILED\n'); assert.ok((await readFile(output, 'utf8')).includes('error_code=ARTIFACT_FAILED\n'));
});
