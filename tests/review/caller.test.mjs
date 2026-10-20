import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, cp, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { publicationFixture, digest } from './fixtures/publication.mjs';
import { packageReviewResult } from '../../scripts/review/result.mjs';
import { validateReviewConfig } from '../../scripts/review/policy.mjs';
import { reviewFingerprint } from '../../scripts/review/collect.mjs';
import { prepareInstructions } from '../../scripts/llm/instructions.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
const pin = '907c00b3f1202ddf811cd7d5578fdeb2b1aed939';
const repository = fileURLToPath(new URL('../../', import.meta.url));
function git(root, ...args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}

test('REV-01/17/20/21: integrated callers pin existing code, isolate auth, and dispatch only after successful triage and inspection', async () => {
  const root = new URL('../../examples/callers/review/.github/', import.meta.url);
  const review = parse(await readFile(new URL('workflows/review.yml', root), 'utf8'));
  assert.deepEqual(Object.keys(review.on.workflow_dispatch.inputs).sort(), ['dispatch_id', 'expected_head_sha', 'pull_number', 'review_handoff_json']);
  assert.equal(review['run-name'], "${{ format('review:{0}:{1}', inputs.pull_number, inputs.dispatch_id || 'manual') }}");
  assert.equal(review.jobs.review.uses, `aplicacoesBoilerplate/.github/.github/workflows/pr-code-review.yml@${pin}`);
  assert.equal(review.jobs.review.with.expected_head_sha, '${{ inputs.expected_head_sha }}');
  assert.equal(review.jobs.review.with.auth_mode, 'chatgpt-session'); assert.equal(review.jobs.review.with.session_secret_name, 'CLI_CODEX_SESSION');
  assert.deepEqual(review.jobs.review.secrets, { REVIEW_READ_TOKEN: '${{ secrets.AUTOMATION_METADATA_READ_TOKEN }}', REVIEW_PUBLISH_TOKEN: '${{ github.token }}',
    CODEX_AUTH_JSON: '${{ secrets.CLI_CODEX_SESSION }}', CODEX_AUTH_WRITE_PAT: '${{ secrets.CLI_CODEX_SESSION_WRITE_PAT }}' });
  const triage = parse(await readFile(new URL('workflows/triage.yml', root), 'utf8'));
  assert.equal(triage.jobs.triage.uses, `aplicacoesBoilerplate/.github/.github/workflows/issue-triage.yml@${pin}`);
  const dispatch = triage.jobs.dispatch;
  assert.deepEqual(dispatch.needs, ['triage', 'inspect']); assert.ok(dispatch.if.includes("needs.triage.result == 'success'"));
  assert.ok(dispatch.if.includes("needs.inspect.result == 'success'")); assert.ok(dispatch.if.includes('draft-checks-failed'));
  assert.equal(dispatch.permissions.actions, 'write'); assert.equal(dispatch.concurrency, undefined);
  const step = dispatch.steps.find(s => s.run?.includes('dispatch-run.mjs'));
  assert.equal(step.env.TRIAGE_SOURCE_FINGERPRINT, '${{ needs.triage.outputs.fingerprint }}'); assert.equal(step.env.REVIEW_DISPATCH_TOKEN, '${{ github.token }}');
  const bridge = parse(await readFile(new URL('workflows/review-bridge.yml', root), 'utf8'));
  assert.deepEqual(bridge.on.pull_request_target.types, ['opened', 'reopened', 'synchronize']);
  assert.ok(bridge.jobs.dispatch.if.includes('github.event.pull_request.head.repo.full_name == github.repository'));
  assert.equal(bridge.jobs.dispatch.steps.find(s => s.with?.path === 'consumer').with.ref, '${{ github.workflow_sha }}');
  assert.equal(bridge.jobs.dispatch.steps.find(s => s.run?.includes('dispatch-run.mjs')).env.REVIEW_DISPATCH_TOKEN, '${{ secrets.REVIEW_DISPATCH_TOKEN }}');
  for (const job of [dispatch, bridge.jobs.dispatch]) {
    const text = JSON.stringify(job); for (const secret of ['CODEX_AUTH', 'OPENAI_API_KEY', 'CLI_CODEX_SESSION']) assert.equal(text.includes(secret), false);
    assert.equal(job.steps.find(s => s.with?.path === 'automation').with.ref, pin);
    assert.equal(job.steps.some(s => s.with?.path === 'consumer-source'), false);
    for (const s of job.steps.filter(s => s.uses?.startsWith('actions/checkout@'))) assert.equal(s.with['persist-credentials'], false);
  }
  assert.ok(git(repository, 'show', `${pin}:scripts/review/dispatch-run.mjs`).includes('dispatchReview'));
  assert.ok(git(repository, 'show', `${pin}:.github/workflows/pr-code-review.yml`).includes('expected_head_sha:'));
  const policy = validateReviewConfig(JSON.parse(await readFile(new URL('review/config.json', root), 'utf8')));
  assert.equal(policy.reviewer, 'consumer-maintainer'); assert.equal(policy.triage_handoff.finish_job, 'triage / finish');
  assert.equal(policy.automation_actors[0].login, 'consumer-automation');
});

test('REV-06/08/21: copied inspector validates independent identities and sidecar without applying or approving a patch', async t => {
  const f = await publicationFixture(t); const consumer = join(f.root, 'consumer');
  await cp(join(repository, 'examples/callers/review/.github'), join(consumer, '.github'), { recursive: true });
  await writeFile(join(consumer, 'AGENTS.md'), 'consumer-specific directives');
  git(consumer, 'init', '-q'); git(consumer, 'config', 'user.name', 'Fixture'); git(consumer, 'config', 'user.email', 'fixture@example.test');
  git(consumer, 'add', '.'); git(consumer, 'commit', '-qm', 'consumer'); const configSha = git(consumer, 'rev-parse', 'HEAD');
  await symlink(repository, join(f.root, 'automation'), process.platform === 'win32' ? 'junction' : 'dir');
  git(f.root, 'clone', '--quiet', '--no-hardlinks', '--', f.sourceRoot.replaceAll('\\', '/'), join(f.root, 'consumer-source'));
  const snapshot = { ...f.snapshot, config_source_sha: configSha, handoff: null };
  const policyBytes = await readFile(join(consumer, '.github/review/config.json')); snapshot.fingerprint = reviewFingerprint(snapshot, policyBytes);
  await mkdir(join(f.root, 'review-input')); await writeFile(join(f.root, 'review-input/snapshot.json'), JSON.stringify(snapshot));
  const config = JSON.parse(policyBytes); const configBytes = await readFile(join(consumer, config.llm_configs.correction));
  const expected = { ...f.result.expected, config_source_sha: configSha, automation_sha: git(repository, 'rev-parse', 'HEAD'),
    review_fingerprint: snapshot.fingerprint, config_sha256: digest(configBytes), instructions_sha256: (await prepareInstructions(consumer)).sha256 };
  const artifacts = join(f.root, 'results'); await mkdir(artifacts);
  const result = await packageReviewResult({ status: 'succeeded', decision: 'none', summary: 'Valid review.', findings: f.result.findings, patch: null }, expected, snapshot, artifacts);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_WORKSPACE: f.root, GITHUB_REPOSITORY: 'owner/app', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
    EXPECTED_PULL_NUMBER: '9', EXPECTED_SOURCE_SHA: snapshot.source_sha, EXPECTED_BASE_SHA: snapshot.base_sha, EXPECTED_MERGE_BASE_SHA: snapshot.merge_base_sha,
    EXPECTED_CONFIG_SOURCE_SHA: configSha, EXPECTED_AUTOMATION_SHA: expected.automation_sha, EXPECTED_FINGERPRINT: snapshot.fingerprint, RESULT_DIRECTORY: result.directory };
  const run = overrides => spawnSync(process.execPath, [join(consumer, '.github/review/inspect-result.mjs')], { env: { ...env, ...overrides }, encoding: 'utf8' });
  const valid = run(); assert.equal(valid.status, 0, valid.stderr); assert.equal(valid.stdout, 'Verified review result: succeeded\n');
  for (const override of [{ EXPECTED_PULL_NUMBER: '10' }, { GITHUB_RUN_ID: '43' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/app' },
    { EXPECTED_SOURCE_SHA: 'f'.repeat(40) }, { EXPECTED_BASE_SHA: 'f'.repeat(40) }, { EXPECTED_MERGE_BASE_SHA: 'f'.repeat(40) },
    { EXPECTED_CONFIG_SOURCE_SHA: 'f'.repeat(40) }, { EXPECTED_AUTOMATION_SHA: 'f'.repeat(40) }, { EXPECTED_FINGERPRINT: 'f'.repeat(64) }]) {
    const refused = run(override); assert.equal(refused.status, 1); assert.equal(refused.stderr, 'INVALID_RESULT\n');
  }
  await writeFile(join(result.directory, 'review.json'), '{}'); assert.equal(run().status, 1);
  assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'new\n'); assert.equal(git(consumer, 'status', '--porcelain'), '');
});
