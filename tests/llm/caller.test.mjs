import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAndPackage } from '../../scripts/llm/result.mjs';
import { prepareInstructions } from '../../scripts/llm/instructions.mjs';
const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url));
const { parse } = require('yaml');
const base = new URL('../../examples/callers/llm/', import.meta.url);

test('T11: caller variants use the same pinned central revision and explicit consumer credentials', async () => {
  const central = parse(await readFile(new URL('../../.github/workflows/llm-execute.yml', import.meta.url), 'utf8'));
  let reference;
  for (const [file, mode, names] of [['.github/workflows/llm.yml', 'chatgpt-session', ['CODEX_AUTH_JSON', 'CODEX_AUTH_WRITE_PAT']], ['variants/llm-api-key.yml', 'api-key', ['OPENAI_API_KEY']]]) {
    const caller = parse(await readFile(new URL(file, base), 'utf8'));
    assert.equal(Object.hasOwn(caller.on, 'workflow_dispatch'), true);
    const job = caller.jobs.llm;
    assert.match(job.uses, /^aplicacoesBoilerplate\/\.github\/\.github\/workflows\/llm-execute.yml@[a-f0-9]{40}$/);
    if (!reference) reference = job.uses;
    assert.equal(job.uses, reference);
    assert.equal(job.with.auth_mode, mode);
    assert.deepEqual(Object.keys(job.secrets).sort(), names.sort());
    assert.equal(Object.keys(job.with).every(name => Object.hasOwn(central.on.workflow_call.inputs, name)), true);
    assert.equal(job.with.config_path, '.github/llm/analyze.json');
    assert.equal(caller.jobs.inspect.if, "needs.llm.result == 'success' && needs.llm.outputs.status == 'succeeded'");
    assert.equal(caller.jobs.inspect.steps.find(step => step.with?.repository === 'aplicacoesBoilerplate/.github').with.ref, reference.split('@')[1]);
    assert.equal(caller.jobs.inspect.steps.find(step => step.run?.includes('inspect-result.mjs')).env.EXPECTED_INVOCATION_ID, 'analyze-main');
  }
});
test('T11: actual consumer inspector accepts the expected envelope and refuses a wrong source SHA', async t => {
  const root = await mkdtemp(join(tmpdir(), 'llm-inspect-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const consumer = join(root, 'consumer'); await mkdir(join(consumer, '.github', 'llm'), { recursive: true });
  await symlink(fileURLToPath(new URL('../../', import.meta.url)), join(root, 'automation'), 'junction');
  const inspector = join(consumer, '.github', 'llm', 'inspect-result.mjs');
  await copyFile(new URL('.github/llm/inspect-result.mjs', base), inspector);
  const config = '{"schema_version":1,"invocation_mode":"single","execution":{"model":"consumer-model","effort":"low","template":"analyze"}}';
  await writeFile(join(consumer, '.github', 'llm', 'analyze.json'), config);
  const provenance = { repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'analyze-main', source_sha: 'a'.repeat(40), automation_sha: 'b'.repeat(40), config_sha256: createHash('sha256').update(config).digest('hex'), instructions_sha256: (await prepareInstructions(consumer)).sha256 };
  const packet = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'valid caller result', patch: null }, provenance, root);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GITHUB_WORKSPACE: root, GITHUB_REPOSITORY: provenance.repository, GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', EXPECTED_INVOCATION_ID: 'analyze-main', EXPECTED_SOURCE_SHA: provenance.source_sha, EXPECTED_AUTOMATION_SHA: provenance.automation_sha, EXPECTED_CONFIG_PATH: '.github/llm/analyze.json', RESULT_DIRECTORY: packet.directory };
  const valid = spawnSync(process.execPath, [inspector], { env, encoding: 'utf8' });
  assert.equal(valid.status, 0);
  assert.equal(valid.stdout, 'Verified result: succeeded\n');
  const invalid = spawnSync(process.execPath, [inspector], { env: { ...env, EXPECTED_SOURCE_SHA: 'c'.repeat(40) }, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stderr, 'INVALID_RESULT\n');
});
