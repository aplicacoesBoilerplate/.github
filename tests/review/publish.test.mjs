import test from 'node:test';
import assert from 'node:assert/strict';
import { publishReview } from '../../scripts/review/publish.mjs';
import { readPreparedProposal } from '../../scripts/review/prepare-patch.mjs';
import { publicationFixture, digest } from './fixtures/publication.mjs';

test('REV-09/10/18: automatic comment reports severity, exact SHAs and zero findings without native approval', async t => {
  const f = await publicationFixture(t); const first = await publishReview(f, f.api); const second = await publishReview(f, f.api);
  assert.equal(first.status, 'reviewed'); assert.equal(first.pr_number, null); assert.equal(second.comment_id, first.comment_id);
  assert.equal(f.state.comments.length, 1); assert.deepEqual(f.state.writes.map(w => w.kind), ['comment']);
  const body = f.state.comments[0].body;
  for (const text of ['Revisão automática', 'Críticos', 'Avisos', 'Sugestões', 'main.go:1', 'A suggestion.', f.snapshot.source_sha, f.snapshot.base_sha,
    f.snapshot.config_source_sha, f.result.envelope.automation_sha]) assert.ok(body.includes(text), text);
  assert.equal(/\b(?:closes|fixes|resolves)\s+#\d/i.test(body), false);
  const clean = await publicationFixture(t, { findings: [] }); await publishReview(clean, clean.api);
  assert.ok(clean.state.comments[0].body.includes('Nenhum achado')); assert.equal(clean.state.pulls.length, 0);
});

test('REV-14/15/18/19: correction creates one owned complementary draft with exact parent/tree and failed checks', async t => {
  const f = await publicationFixture(t, { correction: true }); f.verification.status = 'failed';
  const first = await publishReview(f, f.api); const writes = structuredClone(f.state.writes); const second = await publishReview(f, f.api);
  assert.equal(first.status, 'draft-checks-failed'); assert.equal(second.pr_number, first.pr_number); assert.deepEqual(f.state.writes, writes);
  assert.equal(f.state.pulls.length, 1); assert.equal(f.state.refs.size, 1);
  const p = f.state.pulls[0]; const c = f.state.commits.get(p.head.sha); const proposal = await readPreparedProposal(f.prepared);
  assert.equal(p.draft, true); assert.equal(p.base.ref, f.snapshot.pull.head.ref); assert.equal(p.base.sha, f.snapshot.source_sha);
  assert.equal(p.head.ref, `feature/review-pr-9-${f.snapshot.source_sha.slice(0, 12)}`);
  assert.deepEqual(c.parents, [{ sha: f.snapshot.source_sha }]); assert.equal(c.tree.sha, proposal.tree_sha);
  assert.equal(c.message, `Review correction for PR #9\n\n<!-- review:v1:owner/app:9 -->\nEntrada: ${f.snapshot.fingerprint}\nHead original: ${f.snapshot.source_sha}\nConfiguração: ${f.snapshot.config_source_sha}\nPatch: ${digest(f.result.patch)}`);
  assert.ok(p.body.includes('draft-checks-failed')); assert.ok(p.body.includes('Refs #9')); assert.ok(p.body.includes(f.snapshot.fingerprint));
  assert.ok(f.state.comments[0].body.includes(p.html_url)); assert.deepEqual(p.requested_reviewers, [{ login: 'reviewer' }]);
  assert.equal(/\b(?:closes|fixes|resolves)\s+#\d/i.test(p.body), false);
  assert.equal(f.state.writes.some(w => w.kind === 'ref' && w.payload.ref === f.snapshot.pull.head.ref), false);
});

test('REV-08/16/19/24: integration and complementary reviews only comment; stale inputs and forged results write nothing', async t => {
  for (const route of ['review-only', 'skip-correction']) {
    const f = await publicationFixture(t, { route }); assert.equal((await publishReview(f, f.api)).status, 'reviewed');
    assert.equal(f.state.pulls.length, 0); assert.deepEqual(f.state.writes.map(w => w.kind), ['comment']);
  }
  const f = await publicationFixture(t, { correction: true });
  for (const key of ['fingerprint', 'source_sha', 'base_sha', 'config_source_sha']) {
    f.state.current = { ...f.snapshot, [key]: 'f'.repeat(key === 'fingerprint' ? 64 : 40) };
    await assert.rejects(publishReview(f, f.api), { code: 'STALE_REVIEW_INPUT' }); assert.deepEqual(f.state.writes, []);
  }
  for (const change of [{ state: 'closed' }, { head: { ...f.snapshot.pull.head, ref: 'feature/other' } }, { base: { ...f.snapshot.pull.base, ref: 'develop' } }]) {
    f.state.current = { ...f.snapshot, pull: { ...f.snapshot.pull, ...change } };
    await assert.rejects(publishReview(f, f.api), { code: 'STALE_REVIEW_INPUT' }); assert.deepEqual(f.state.writes, []);
  }
  f.state.current = structuredClone(f.snapshot);
  for (const change of [{ envelope: { ...f.result.envelope, run_attempt: '2' } }, { patch: f.result.patch.replace('+fixed', '+other') },
    { findings: [{ ...f.result.findings[0], line: 99 }] }, { findings: [{ ...f.result.findings[0], message: 'changed sidecar' }] }]) {
    await assert.rejects(publishReview({ ...f, result: { ...f.result, ...change } }, f.api), { code: 'INVALID_RESULT' }); assert.deepEqual(f.state.writes, []);
  }
  await assert.rejects(publishReview({ ...f, verification: { ...f.verification, patch_sha256: 'f'.repeat(64) } }, f.api), { code: 'INVALID_REVIEW_VERIFICATION' });
  await assert.rejects(publishReview({ ...f, prepared: { ...f.prepared } }, f.api), { code: 'INVALID_REVIEW_PATCH' }); assert.deepEqual(f.state.writes, []);
});

test('REV-18/25: ambiguous comment/ref/PR/reviewer writes recover exact resources and converge without duplicates', async t => {
  for (const kind of ['comment', 'ref', 'pull', 'review']) {
    const f = await publicationFixture(t, { correction: kind !== 'comment' }); f.state.failAfter = kind;
    const first = await publishReview(f, f.api); const second = await publishReview(f, f.api);
    assert.equal(second.comment_id, first.comment_id); assert.equal(second.pr_number, first.pr_number);
    assert.equal(f.state.comments.length, 1); assert.equal(f.state.pulls.length, kind === 'comment' ? 0 : 1);
    assert.equal(f.state.writes.filter(w => w.kind === kind).length, 1);
  }
});

test('REV-18/24/25: human edits, changed branches and divergent proposals cannot be overwritten', async t => {
  const f = await publicationFixture(t, { correction: true }); await publishReview(f, f.api);
  const writes = structuredClone(f.state.writes); f.state.comments[0].body += '\nHuman edit'; const edited = f.state.comments[0].body;
  await assert.rejects(publishReview(f, f.api), { code: 'REVIEW_RESOURCE_CONFLICT' }); assert.equal(f.state.comments[0].body, edited); assert.deepEqual(f.state.writes, writes);
  const p = await publicationFixture(t, { correction: true }); await publishReview(p, p.api); p.state.pulls[0].body += '\nHuman edit';
  const original = structuredClone(p.state.pulls[0]); const before = structuredClone(p.state.writes);
  await assert.rejects(publishReview(p, p.api), { code: 'REVIEW_RESOURCE_CONFLICT' }); assert.deepEqual(p.state.pulls[0], original); assert.deepEqual(p.state.writes, before);
  p.state.refs.get(original.head.ref).object.sha = 'f'.repeat(40);
  await assert.rejects(publishReview(p, p.api), { code: 'REVIEW_RESOURCE_CONFLICT' }); assert.equal(p.state.refs.get(original.head.ref).object.sha, 'f'.repeat(40));
  const remote = await publicationFixture(t, { correction: true }); await publishReview(remote, remote.api);
  const head = remote.state.pulls[0].head.sha; const originalCommit = structuredClone(remote.state.commits.get(head)); const remoteWrites = structuredClone(remote.state.writes);
  for (const change of [{ tree: { sha: 'f'.repeat(40) } }, { parents: [{ sha: 'f'.repeat(40) }] }, { message: 'human commit' }]) {
    remote.state.commits.set(head, { ...originalCommit, ...change });
    await assert.rejects(publishReview(remote, remote.api), { code: 'REVIEW_RESOURCE_CONFLICT' }); assert.deepEqual(remote.state.writes, remoteWrites);
  }
  const human = await publicationFixture(t); await publishReview(human, human.api);
  human.state.comments[0].user = { id: 77, login: 'human' }; const humanBody = human.state.comments[0].body;
  await publishReview(human, human.api); assert.equal(human.state.comments.length, 2); assert.equal(human.state.comments[0].body, humanBody);
  const different = await publicationFixture(t); await publishReview(different, different.api);
  const result = structuredClone(different.result); result.envelope.summary = 'Different proposal under the same identity.';
  await assert.rejects(publishReview({ ...different, result }, different.api), { code: 'REVIEW_RESOURCE_CONFLICT' }); assert.equal(different.state.writes.length, 1);
});

test('REV-24/26: late changes, metadata outages and unrecoverable writes fail explicitly without leaking transport data', async t => {
  const late = await publicationFixture(t, { correction: true }); let reads = 0;
  late.api.recollect = async () => ++reads === 1 ? late.snapshot : { ...late.snapshot, source_sha: 'f'.repeat(40) };
  await assert.rejects(publishReview(late, late.api), { code: 'STALE_REVIEW_INPUT' }); assert.deepEqual(late.state.writes, []);
  const failed = await publicationFixture(t); failed.state.failBefore = 'comment';
  await assert.rejects(publishReview(failed, failed.api), { code: 'REVIEW_PUBLISH_FAILED', message: 'REVIEW_PUBLISH_FAILED' }); assert.equal(failed.state.comments.length, 0);
  failed.api.recollect = async () => { throw new Error('private transport secret'); };
  await assert.rejects(publishReview(failed, failed.api), { code: 'REVIEW_PUBLISH_FAILED', message: 'REVIEW_PUBLISH_FAILED' });
});

test('REV-09/18/25: a new automation revision updates only its intact own comment and recovers an ambiguous update', async t => {
  const f = await publicationFixture(t); const first = await publishReview(f, f.api);
  const result = structuredClone(f.result); result.envelope.automation_sha = 'f'.repeat(40); result.expected.automation_sha = 'f'.repeat(40);
  result.envelope.summary = 'New automation revision.'; f.state.failAfter = 'update-comment';
  const updated = await publishReview({ ...f, result }, f.api); await publishReview({ ...f, result }, f.api);
  assert.equal(updated.comment_id, first.comment_id); assert.equal(f.state.comments.length, 1);
  assert.ok(f.state.comments[0].body.includes('New automation revision.'));
  assert.equal(f.state.writes.filter(w => w.kind === 'update-comment').length, 1);
  const concurrent = await publicationFixture(t); await publishReview(concurrent, concurrent.api);
  concurrent.api.getComment = async () => ({ ...concurrent.state.comments[0], body: concurrent.state.comments[0].body + '\nHuman edit' });
  await assert.rejects(publishReview({ ...concurrent, result: { ...concurrent.result, envelope: { ...concurrent.result.envelope, automation_sha: 'f'.repeat(40) },
    expected: { ...concurrent.result.expected, automation_sha: 'f'.repeat(40) } } }, concurrent.api), { code: 'REVIEW_RESOURCE_CONFLICT' });
  assert.deepEqual(concurrent.state.writes.map(w => w.kind), ['comment']);
});

test('REV-05/09: incomplete diffs produce explicit intervention, never a complete review or a correction', async t => {
  const f = await publicationFixture(t); f.snapshot.route = 'needs-human'; f.snapshot.error_code = 'REVIEW_INCONCLUSIVE';
  f.snapshot.merge_base_sha = null; f.snapshot.diff = ''; f.snapshot.diff_index = { files: [] }; f.state.current = structuredClone(f.snapshot);
  const result = await publishReview({ ...f, result: null }, f.api);
  assert.equal(result.status, 'needs-human'); assert.equal(result.pr_number, null); assert.equal(f.state.pulls.length, 0);
  assert.ok(f.state.comments[0].body.includes('inconclusiva')); assert.ok(f.state.comments[0].body.includes('não foi realizada uma revisão completa'));
  assert.equal(f.state.comments[0].body.includes('Nenhum achado'), false); assert.deepEqual(f.state.writes.map(w => w.kind), ['comment']);
});
