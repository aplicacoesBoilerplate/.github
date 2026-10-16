import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAndPackage, validateEnvelope } from '../../scripts/llm/result.mjs';

const provenance = () => ({ repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'review', source_sha: 'a'.repeat(40), automation_sha: 'b'.repeat(40), config_sha256: 'c'.repeat(64), instructions_sha256: 'd'.repeat(64) });
const response = () => ({ status: 'succeeded', decision: 'none', summary: 'A correction is proposed.', patch: 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n' });
async function root(t) { const dir = await mkdtemp(join(tmpdir(), 'llm-result-test-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test('LLM-17/19/21: output package binds patch and summary to authoritative provenance and contains only allowed files', async t => {
  const dir = await root(t); const p = provenance();
  const result = await validateAndPackage(response(), p, dir);
  assert.deepEqual((await readdir(result.directory)).sort(), ['proposal.patch', 'result.json']);
  const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
  assert.equal(envelope.repository, p.repository);
  assert.equal(envelope.source_sha, p.source_sha);
  assert.equal(envelope.automation_sha, p.automation_sha);
  assert.equal(envelope.config_sha256, p.config_sha256);
  assert.equal(envelope.instructions_sha256, p.instructions_sha256);
  assert.equal(envelope.run_id, '42');
  assert.equal(envelope.run_attempt, '1');
  assert.equal(envelope.invocation_id, 'review');
  assert.equal(envelope.patch_file, 'proposal.patch');
  assert.equal(envelope.summary, response().summary);
  assert.equal(await readFile(join(result.directory, envelope.patch_file), 'utf8'), response().patch);
  assert.equal(validateEnvelope(envelope, p).request_id, result.outputs.request_id);
  assert.equal(result.outputs.status, 'succeeded');
  assert.equal(result.outputs.artifact_name, 'llm-42-1-review');
  assert.equal(Buffer.byteLength(JSON.stringify(result.outputs)) < 8192, true);
});
test('LLM-17/21: caller identities and attempts get separate packages; duplicate identity fails without overwrite', async t => {
  const dir = await root(t);
  const a = await validateAndPackage(response(), provenance(), dir);
  const b = await validateAndPackage(response(), { ...provenance(), invocation_id: 'triage' }, dir);
  const c = await validateAndPackage(response(), { ...provenance(), run_attempt: '2' }, dir);
  assert.notEqual(a.outputs.artifact_name, b.outputs.artifact_name);
  assert.notEqual(a.outputs.request_id, c.outputs.request_id);
  await assert.rejects(validateAndPackage(response(), provenance(), dir), { code: 'ARTIFACT_FAILED' });
  assert.equal(JSON.parse(await readFile(join(a.directory, 'result.json'), 'utf8')).summary, response().summary);
});
test('LLM-18/21: forged fields, leaked credentials and oversized payload fail before packaging', async t => {
  const dir = await root(t);
  for (const value of [{ ...response(), repository: 'other/app' }, { ...response(), summary: 'secret-sentinel' }, { ...response(), patch: response().patch + 'x'.repeat(1048576) }]) {
    await assert.rejects(validateAndPackage(value, provenance(), dir, { sensitiveValues: ['secret-sentinel'] }), { code: 'INVALID_RESULT' });
  }
  assert.deepEqual(await readdir(dir), []);
});
test('LLM-19: traversal, workflow, credential, symlink and binary proposals cannot be packaged', async t => {
  const dir = await root(t);
  const patches = [
    response().patch.replaceAll('main.go', '../main.go'),
    response().patch.replaceAll('main.go', '.github/workflows/llm.yml'),
    response().patch.replaceAll('main.go', 'auth.json'),
    response().patch.replaceAll('main.go', '.env.production'),
    response().patch.replaceAll('main.go', 'AGENTS.md'),
    response().patch.replace('--- a/main.go', 'new file mode 120000\n--- a/main.go'),
    'diff --git a/image b/image\nGIT binary patch\n',
  ];
  for (const patch of patches) await assert.rejects(validateAndPackage({ ...response(), patch }, provenance(), dir), { code: 'INVALID_RESULT' });
  assert.deepEqual(await readdir(dir), []);
});
test('LLM-05/17: skipped decision has no executable patch and consumer rejects mismatched source identity', async t => {
  const dir = await root(t);
  const result = await validateAndPackage({ status: 'skipped', decision: 'skip', summary: 'Nothing applicable.', patch: null }, provenance(), dir);
  assert.deepEqual(await readdir(result.directory), ['result.json']);
  const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
  assert.equal(envelope.status, 'skipped');
  assert.equal(envelope.patch_file, null);
  assert.throws(() => validateEnvelope(envelope, { ...provenance(), source_sha: 'e'.repeat(40) }), { code: 'INVALID_RESULT' });
});
