import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewPublicationApi } from '../../scripts/review/publication-api.mjs';

const response = (value, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => value });
test('REV-14/25/26: writer binds Git Data parent/tree and refuses original/protected refs and non-draft PRs', async () => {
  const calls = []; const base = 'a'.repeat(40), tree = 'b'.repeat(40), blob = 'c'.repeat(40), commit = 'd'.repeat(40);
  const ref = `feature/review-pr-9-${base.slice(0, 12)}`;
  const api = createReviewPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async (url, options) => {
    const body = options.body && JSON.parse(options.body); calls.push({ url, options, body });
    if (url.endsWith(`/git/commits/${base}`)) return response({ tree: { sha: 'e'.repeat(40) } });
    if (url.endsWith('/git/blobs')) return response({ sha: blob }, 201);
    if (url.endsWith('/git/trees')) return response({ sha: tree }, 201);
    if (url.endsWith('/git/commits')) return response({ sha: commit }, 201);
    if (url.endsWith('/git/refs')) return response({ ref: `refs/heads/${ref}`, object: { sha: commit } }, 201);
    if (url.endsWith('/pulls')) return response({ number: 30, draft: true }, 201);
    throw new Error('unexpected endpoint');
  } });
  assert.equal((await api.createCommit('owner/app', { base_sha: base, tree_sha: tree, message: 'Review correction', date: '2026-10-15T10:00:00Z',
    changes: [{ path: 'main.go', mode: '100644', type: 'blob', content: Buffer.from('fixed\n').toString('base64') }] })).sha, commit);
  await api.createRef('owner/app', ref, commit); await api.createPull('owner/app', { head: ref, base: 'feature/test', draft: true, body: 'Refs #9', title: 'Correction' });
  const uploaded = calls.find(c => c.url.endsWith('/git/commits')).body;
  assert.deepEqual(uploaded.parents, [base]); assert.equal(uploaded.tree, tree); assert.equal(uploaded.author.name, 'Review proposal');
  assert.deepEqual(uploaded.author, uploaded.committer); assert.equal(uploaded.author.date, '2026-10-15T10:00:00Z');
  assert.deepEqual(calls.find(c => c.url.endsWith('/git/refs')).body, { ref: `refs/heads/${ref}`, sha: commit });
  assert.deepEqual(calls.find(c => c.url.endsWith('/pulls')).body, { head: ref, base: 'feature/test', draft: true, body: 'Refs #9', title: 'Correction' });
  const count = calls.length;
  for (const forbidden of ['feature/test', 'master', 'develop', 'release/v1.0.0', 'feature/triage-issue-9'])
    assert.throws(() => api.createRef('owner/app', forbidden, commit), { code: 'REVIEW_PUBLISH_FAILED' });
  for (const payload of [{ head: ref, base: 'master', draft: true }, { head: ref, base: 'release/v1.0.0', draft: true }, { head: ref, base: 'feature/test', draft: false }])
    assert.throws(() => api.createPull('owner/app', payload), { code: 'REVIEW_PUBLISH_FAILED' });
  assert.equal(calls.length, count);
  assert.equal(api.setMilestone, undefined); assert.equal(api.updateRef, undefined); assert.equal(api.merge, undefined); assert.equal(api.approve, undefined);
  for (const c of calls) { assert.ok(c.url.startsWith('https://api.github.com/')); assert.equal(c.options.redirect, 'error'); assert.equal(c.options.headers.Authorization, 'Bearer fixture-write'); }
});

test('REV-25/26: absence is distinct from outage, ambiguous writes are not retried, and mismatched trees cannot create commits', async () => {
  const calls = []; const ref = `feature/review-pr-9-${'a'.repeat(12)}`;
  const api = createReviewPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.includes('/git/ref/')) return response({}, 404);
    if (url.endsWith('/git/trees')) return response({ sha: 'f'.repeat(40) });
    if (url.endsWith(`/git/commits/${'a'.repeat(40)}`)) return response({ tree: { sha: 'e'.repeat(40) } });
    if (options.method !== 'GET') throw new Error('private write failure');
    if (url.includes('page=2')) return response([{ id: 101 }]);
    return response(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })));
  } });
  assert.equal(await api.getRef('owner/app', ref), null); assert.equal((await api.listComments('owner/app', 9)).at(-1).id, 101);
  await assert.rejects(api.createComment('owner/app', 9, 'safe'), { code: 'REVIEW_PUBLISH_FAILED', message: 'REVIEW_PUBLISH_FAILED' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  await assert.rejects(api.createComment('owner/app', 9, 'fixture-write'), { code: 'REVIEW_PUBLISH_FAILED' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  await assert.rejects(api.createCommit('owner/app', { base_sha: 'a'.repeat(40), tree_sha: 'b'.repeat(40), message: 'Safe', date: '2026-10-15T10:00:00Z',
    changes: [{ path: 'removed.go', mode: '100644', type: 'blob', sha: null }] }), { code: 'INVALID_REVIEW_PATCH' });
  assert.equal(calls.some(c => c.url.endsWith('/git/commits')), false);
  const denied = createReviewPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async () => response({ message: 'private data' }, 403) });
  await assert.rejects(denied.getRef('owner/app', ref), { code: 'REVIEW_PUBLISH_FAILED', message: 'REVIEW_PUBLISH_FAILED' });
});
