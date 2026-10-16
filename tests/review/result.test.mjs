import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateReviewResult, validateReviewEnvelope, packageReviewResult, readReviewPackage } from '../../scripts/review/result.mjs';
import { validateEnvelope, validateAndPackage } from '../../scripts/llm/result.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const diff = 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n';
const patch = 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-new\n+fixed\n';
const response = () => ({ status: 'succeeded', decision: 'none', summary: 'Correction proposed.',
  findings: [{ severity: 'critical', path: 'main.go', line: 1, message: 'The new code breaks this case.' }], patch });
const provenance = () => ({ repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'review-9',
  source_sha: 'a'.repeat(40), config_source_sha: 'b'.repeat(40), automation_sha: 'c'.repeat(40), config_sha256: 'd'.repeat(64), instructions_sha256: 'e'.repeat(64) });
const snapshot = () => ({ repository: 'owner/app', pull: { number: 9, head: { sha: 'a'.repeat(40) }, base: { sha: 'f'.repeat(40) } },
  source_sha: 'a'.repeat(40), base_sha: 'f'.repeat(40), config_source_sha: 'b'.repeat(40), merge_base_sha: '0'.repeat(40),
  fingerprint: '1'.repeat(64), route: 'correction', error_code: '', diff,
  diff_index: { files: [{ path: 'main.go', old_path: 'main.go', added_lines: [1] }] } });
const expected = () => ({ ...provenance(), pull_number: 9, base_sha: 'f'.repeat(40), merge_base_sha: '0'.repeat(40), review_fingerprint: '1'.repeat(64) });
async function root(t) { const dir = await mkdtemp(join(tmpdir(), 'review-result-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test('REV-06/07/09: review package binds findings and correction to independent PR/run identities', async t => {
  const dir = await root(t); const result = await packageReviewResult(response(), provenance(), snapshot(), dir);
  assert.deepEqual((await readdir(result.directory)).sort(), ['proposal.patch', 'result.json', 'review.json']);
  const sidecar = await readFile(join(result.directory, 'review.json')); const envelope = JSON.parse(await readFile(join(result.directory, 'result.json'), 'utf8'));
  assert.equal(envelope.schema_version, 3); assert.equal(envelope.repository, 'owner/app'); assert.equal(envelope.pull_number, 9);
  assert.equal(envelope.run_id, '42'); assert.equal(envelope.run_attempt, '1'); assert.equal(envelope.invocation_id, 'review-9');
  assert.equal(envelope.source_sha, 'a'.repeat(40)); assert.equal(envelope.config_source_sha, 'b'.repeat(40));
  assert.equal(envelope.automation_sha, 'c'.repeat(40)); assert.equal(envelope.config_sha256, 'd'.repeat(64)); assert.equal(envelope.instructions_sha256, 'e'.repeat(64));
  assert.equal(envelope.base_sha, 'f'.repeat(40)); assert.equal(envelope.merge_base_sha, '0'.repeat(40)); assert.equal(envelope.review_fingerprint, '1'.repeat(64));
  assert.equal(envelope.review_file, 'review.json'); assert.equal(envelope.review_sha256, digest(sidecar)); assert.equal(envelope.patch_sha256, digest(patch));
  assert.equal(envelope.summary, 'Correction proposed.'); assert.equal(result.outputs.artifact_name, 'llm-42-1-review-9');
  assert.equal(Buffer.byteLength(JSON.stringify(result.outputs)) <= 8192, true);
  assert.deepEqual(JSON.parse(sidecar).findings, [{ severity: 'critical', path: 'main.go', line: 1, message: 'The new code breaks this case.' }]);
  const consumed = await readReviewPackage(result.directory, expected(), snapshot());
  assert.equal(consumed.patch, patch); assert.equal(consumed.envelope.request_id, envelope.request_id);
  assert.equal(validateReviewEnvelope(envelope, expected()).pull_number, 9);
  assert.throws(() => validateEnvelope(envelope, expected()), { code: 'INVALID_RESULT' });
});

test('REV-07/08: invented references, malformed findings and unsafe proposals invalidate the whole response', () => {
  const finding = response().findings[0];
  for (const f of [{ ...finding, line: 2 }, { ...finding, path: 'other.go' }, { ...finding, severity: 'approve' },
    { ...finding, message: ' ' }, { ...finding, line: 0 }, { ...finding, extra: true }])
    assert.throws(() => validateReviewResult({ ...response(), findings: [f] }, snapshot()), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult({ ...response(), findings: Array(21).fill(finding) }, snapshot()), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult({ ...response(), repository: 'other/app' }, snapshot()), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult(response(), { ...snapshot(), diff_index: { files: [{ path: 'other.go', added_lines: [1] }] } }), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult({ ...response(), patch: patch.replaceAll('main.go', 'other.go') }, snapshot()), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult(response(), { ...snapshot(), route: 'review-only' }), { code: 'INVALID_RESULT' });
  assert.throws(() => validateReviewResult(response(), { ...snapshot(), error_code: 'REVIEW_INCONCLUSIVE' }), { code: 'INVALID_RESULT' });
});

test('REV-06/08: changed identities, sidecar, patch and extra files are rejected by the consumer', async t => {
  const dir = await root(t); const result = await packageReviewResult(response(), provenance(), snapshot(), dir);
  for (const changed of [{ run_id: '43' }, { run_attempt: '2' }, { invocation_id: 'review-10' }, { repository: 'other/app' },
    { pull_number: 10 }, { base_sha: '2'.repeat(40) }, { merge_base_sha: '3'.repeat(40) }, { config_source_sha: '4'.repeat(40) },
    { review_fingerprint: '5'.repeat(64) }, { automation_sha: '6'.repeat(40) }, { config_sha256: '7'.repeat(64) }, { instructions_sha256: '8'.repeat(64) }])
    await assert.rejects(readReviewPackage(result.directory, { ...expected(), ...changed }, snapshot()), { code: 'INVALID_RESULT' });
  const reviewPath = join(result.directory, 'review.json'); const original = await readFile(reviewPath);
  await writeFile(reviewPath, '{}'); await assert.rejects(readReviewPackage(result.directory, expected(), snapshot()), { code: 'INVALID_RESULT' }); await writeFile(reviewPath, original);
  const patchPath = join(result.directory, 'proposal.patch'); await writeFile(patchPath, patch.replace('fixed', 'malicious'));
  await assert.rejects(readReviewPackage(result.directory, expected(), snapshot()), { code: 'INVALID_RESULT' }); await writeFile(patchPath, patch);
  await writeFile(join(result.directory, 'extra.json'), '{}'); await assert.rejects(readReviewPackage(result.directory, expected(), snapshot()), { code: 'INVALID_RESULT' });
});

test('REV-08/26: sensitive or oversized data leave no artifact and duplicate publication never overwrites', async t => {
  const dir = await root(t);
  for (const value of [{ ...response(), summary: 'fixture"private' },
    { ...response(), findings: [{ ...response().findings[0], message: 'fixture"private' }] }, { ...response(), patch: patch + 'x'.repeat(1048576) }])
    await assert.rejects(packageReviewResult(value, provenance(), snapshot(), dir, { sensitiveValues: ['fixture"private'] }), { code: 'INVALID_RESULT' });
  assert.deepEqual(await readdir(dir), []);
  const result = await packageReviewResult(response(), provenance(), snapshot(), dir);
  await assert.rejects(packageReviewResult(response(), provenance(), snapshot(), dir), { code: 'ARTIFACT_FAILED' });
  assert.equal((await readReviewPackage(result.directory, expected(), snapshot())).envelope.summary, 'Correction proposed.');
});

test('REV-09: zero findings and skipped decisions stay explicit without patches or native approval', async t => {
  const dir = await root(t);
  const clean = await packageReviewResult({ ...response(), findings: [], patch: null }, provenance(), snapshot(), dir);
  assert.equal(clean.envelope.patch_file, null); assert.equal(clean.envelope.patch_sha256, null);
  assert.deepEqual((await readReviewPackage(clean.directory, expected(), snapshot())).findings, []);
  const skipped = await packageReviewResult({ status: 'skipped', decision: 'skip', summary: 'No applicable work.', findings: [], patch: null },
    { ...provenance(), invocation_id: 'review-skip' }, snapshot(), dir);
  assert.equal(skipped.envelope.status, 'skipped'); assert.deepEqual((await readdir(skipped.directory)).sort(), ['result.json', 'review.json']);
});

test('REV-06/08: legacy result formats remain opt-in and cannot impersonate a review', async t => {
  const dir = await root(t); const p = provenance(); delete p.config_source_sha;
  const value = { status: 'succeeded', decision: 'none', summary: 'Legacy analysis.', patch: null };
  const v1 = await validateAndPackage(value, p, dir);
  const v2 = await validateAndPackage(value, { ...provenance(), invocation_id: 'triage' }, dir);
  assert.equal(v1.envelope.schema_version, 1); assert.equal(v2.envelope.schema_version, 2);
  assert.equal(Object.hasOwn(v1.envelope, 'review_file'), false); assert.equal(Object.hasOwn(v2.envelope, 'review_file'), false);
  assert.equal(validateEnvelope(v1.envelope, p).summary, 'Legacy analysis.');
  assert.equal(validateEnvelope(v2.envelope, { ...provenance(), invocation_id: 'triage' }).summary, 'Legacy analysis.');
  assert.throws(() => validateReviewEnvelope(v2.envelope, expected()), { code: 'INVALID_RESULT' });
});
