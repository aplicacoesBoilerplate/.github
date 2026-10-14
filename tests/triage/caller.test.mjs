import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { validateAndPackage } from '../../scripts/llm/result.mjs';
import { prepareInstructions } from '../../scripts/llm/instructions.mjs';

const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url)); const { parse } = require('yaml');
const pin = '3f7ec89a9e2457e1e839a22d6db6f9dc1c4784f6';
const digest = value => createHash('sha256').update(value).digest('hex');
function git(root, ...args) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
test('TRI-04/23: caller triggers use explicit consumer identity, private/default guards and one real immutable revision', async () => {
  const file = fileURLToPath(new URL('../../examples/callers/triage/.github/workflows/triage.yml', import.meta.url));
  const workflow = parse(await readFile(file, 'utf8')); const job = workflow.jobs.triage;
  assert.deepEqual(workflow.on.issues.types, ['opened']); assert.equal(workflow.on.workflow_dispatch.inputs.issue_number.type, 'number');
  assert.ok(job.if.includes('github.event.repository.private')); assert.ok(job.if.includes('github.event.repository.default_branch'));
  assert.equal(job.uses, `aplicacoesBoilerplate/.github/.github/workflows/issue-triage.yml@${pin}`);
  assert.equal(job.with.auth_mode, 'chatgpt-session'); assert.equal(job.with.session_secret_name, 'CLI_CODEX_SESSION');
  assert.equal(job.with.verification_image, '${{ vars.TRIAGE_VERIFICATION_IMAGE }}');
  assert.deepEqual(job.secrets, { TRIAGE_READ_TOKEN: '${{ secrets.TRIAGE_METADATA_READ_TOKEN }}', TRIAGE_PUBLISH_TOKEN: '${{ github.token }}',
    CODEX_AUTH_JSON: '${{ secrets.CLI_CODEX_SESSION }}', CODEX_AUTH_WRITE_PAT: '${{ secrets.CLI_CODEX_SESSION_WRITE_PAT }}' });
  assert.deepEqual(job.permissions, { contents: 'write', issues: 'write', 'pull-requests': 'write', actions: 'read' });
  assert.ok(git(fileURLToPath(new URL('../../', import.meta.url)), 'show', `${pin}:.github/workflows/issue-triage.yml`).includes('workflow_call:'));
  const inspector = workflow.jobs.inspect; assert.deepEqual(inspector.permissions, { contents: 'read', actions: 'read' });
  assert.equal(inspector.steps.find(s => s.with?.path === 'automation').with.ref, pin);
  assert.equal(inspector.steps.find(s => s.with?.path === 'consumer').with.ref, '${{ needs.triage.outputs.config_source_sha }}');
  assert.equal(inspector.steps.find(s => s.with?.path === 'consumer-source').with.ref, '${{ needs.triage.outputs.source_sha }}');
});

test('TRI-07/13: copied inspector accepts bound v2 and rejects changed issue, source, config, instruction hashes and extra files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'triage-caller-')); t.after(() => rm(root, { recursive: true, force: true }));
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  await mkdir(join(root, 'automation')); await cp(join(repository, 'scripts'), join(root, 'automation/scripts'), { recursive: true });
  const consumer = join(root, 'consumer'); await cp(join(repository, 'examples/callers/triage/.github'), join(consumer, '.github'), { recursive: true });
  git(consumer, 'init', '-q'); git(consumer, 'config', 'user.name', 'Fixture'); git(consumer, 'config', 'user.email', 'fixture@example.test');
  git(consumer, 'add', '.'); git(consumer, 'commit', '-qm', 'consumer'); const configSha = git(consumer, 'rev-parse', 'HEAD');
  const source = join(root, 'consumer-source'); await mkdir(source); git(source, 'init', '-q'); git(source, 'config', 'user.name', 'Fixture'); git(source, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(source, 'main.go'), 'old\n'); git(source, 'add', '.'); git(source, 'commit', '-qm', 'source'); const sourceSha = git(source, 'rev-parse', 'HEAD');
  const context = { issue: { number: 7 }, source_sha: sourceSha, config_source_sha: configSha }; const fingerprint = digest(JSON.stringify(context));
  await mkdir(join(root, 'triage-input')); await writeFile(join(root, 'triage-input/snapshot.json'), JSON.stringify({ repository: 'owner/app', issue: { number: 7 },
    source_sha: sourceSha, config_source_sha: configSha, fingerprint, context_json: JSON.stringify(context), route: { route: 'propose-patch' } }));
  const configBytes = await readFile(join(consumer, '.github/llm/triage-patch.json'));
  const expected = { repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'triage-7', source_sha: sourceSha, config_source_sha: configSha,
    automation_sha: pin, config_sha256: digest(configBytes), instructions_sha256: (await prepareInstructions(consumer)).sha256 };
  const artifacts = join(root, 'artifacts'); await mkdir(artifacts);
  const result = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'valid', patch: 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n' }, expected, artifacts);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_WORKSPACE: root, GITHUB_REPOSITORY: 'owner/app', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
    EXPECTED_ISSUE_NUMBER: '7', EXPECTED_SOURCE_SHA: sourceSha, EXPECTED_CONFIG_SOURCE_SHA: configSha, EXPECTED_AUTOMATION_SHA: pin,
    EXPECTED_FINGERPRINT: fingerprint, RESULT_DIRECTORY: result.directory };
  const run = overrides => spawnSync(process.execPath, [join(consumer, '.github/triage/inspect-result.mjs')], { encoding: 'utf8', env: { ...env, ...overrides } });
  const valid = run(); assert.equal(valid.status, 0, valid.stderr); assert.equal(valid.stdout, 'Verified triage result: succeeded\n');
  for (const override of [{ EXPECTED_ISSUE_NUMBER: '8' }, { EXPECTED_SOURCE_SHA: 'f'.repeat(40) }, { EXPECTED_CONFIG_SOURCE_SHA: 'f'.repeat(40) }, { EXPECTED_FINGERPRINT: 'f'.repeat(64) }]) {
    const failed = run(override); assert.equal(failed.status, 1); assert.equal(failed.stderr, 'INVALID_RESULT\n');
  }
  await writeFile(join(consumer, 'AGENTS.md'), 'modified directives'); assert.equal(run().status, 1); await rm(join(consumer, 'AGENTS.md'));
  await writeFile(join(result.directory, 'unexpected'), 'not permitted'); assert.equal(run().status, 1);
});
