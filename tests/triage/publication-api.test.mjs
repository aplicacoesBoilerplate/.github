import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicationApi } from '../../scripts/triage/publication-api.mjs';

const response = (data, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

test('TRI-13/15: Git API uploads exact blobs/tree and one-parent commit before creating a draft PR', async () => {
  const calls = []; const base = 'a'.repeat(40), tree = 'b'.repeat(40), blob = 'c'.repeat(40), commit = 'd'.repeat(40);
  const api = createPublicationApi('fixture-write', { recollect: async () => ({ fingerprint: 'trusted' }), fetchImpl: async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
    if (url.endsWith('/graphql')) return response({ data: { viewer: { databaseId: 10, login: 'automation[bot]' } } });
    if (url.endsWith(`/git/commits/${base}`)) return response({ sha: base, tree: { sha: 'e'.repeat(40) } });
    if (url.endsWith('/git/blobs')) return response({ sha: blob }, 201);
    if (url.endsWith('/git/trees')) return response({ sha: tree }, 201);
    if (url.endsWith('/git/commits')) return response({ sha: commit, tree: { sha: tree }, parents: [{ sha: base }], message: 'safe' }, 201);
    if (url.endsWith('/git/refs')) return response({ ref: 'refs/heads/feature/triage-issue-7', object: { sha: commit } }, 201);
    if (url.endsWith('/pulls')) return response({ number: 20, draft: true }, 201);
    throw new Error('unexpected endpoint');
  } });
  assert.deepEqual(await api.getIdentity(), { id: 10, login: 'automation[bot]' });
  assert.deepEqual(await api.recollect(), { fingerprint: 'trusted' });
  assert.equal((await api.createCommit('owner/app', { base_sha: base, tree_sha: tree, message: 'safe', date: '2026-10-14T10:00:00Z',
    changes: [{ path: 'main.go', mode: '100644', type: 'blob', content: Buffer.from('new\n').toString('base64') }, { path: 'old.go', mode: '100644', type: 'blob', sha: null }] })).sha, commit);
  await api.createRef('owner/app', 'feature/triage-issue-7', commit);
  assert.equal((await api.createPull('owner/app', { head: 'feature/triage-issue-7', base: 'release/v1.0.0', title: 'Proposal', body: 'Refs #7', draft: true })).draft, true);
  assert.deepEqual(calls.find(c => c.url.endsWith('/git/blobs')).body, { content: Buffer.from('new\n').toString('base64'), encoding: 'base64' });
  assert.deepEqual(calls.find(c => c.url.endsWith('/git/trees')).body, { base_tree: 'e'.repeat(40), tree: [
    { path: 'main.go', mode: '100644', type: 'blob', sha: blob }, { path: 'old.go', mode: '100644', type: 'blob', sha: null }] });
  const payload = calls.find(c => c.url.endsWith('/git/commits')).body;
  assert.deepEqual(payload.parents, [base]); assert.equal(payload.tree, tree); assert.equal(payload.message, 'safe');
  assert.equal(payload.author.date, '2026-10-14T10:00:00Z'); assert.deepEqual(payload.author, payload.committer);
  assert.deepEqual(calls.find(c => c.url.endsWith('/git/refs')).body, { ref: 'refs/heads/feature/triage-issue-7', sha: commit });
  for (const call of calls) { assert.ok(call.url.startsWith('https://api.github.com/')); assert.equal(call.options.redirect, 'error'); assert.equal(call.options.headers.Authorization, 'Bearer fixture-write'); }
});

test('TRI-19/21/22: adapter paginates reads, treats absent refs separately and never retries ambiguous writes', async () => {
  const calls = []; const api = createPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.includes('/git/ref/')) return response({}, 404);
    if (options.method === 'POST') throw new Error('secret transport error');
    if (url.includes('page=2')) return response([{ id: 101, body: 'second page' }]);
    return response(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })));
  } });
  const comments = await api.listComments('owner/app', 7); assert.equal(comments.at(-1).body, 'second page');
  await api.listPulls('owner/app', 'feature/triage-issue-7');
  assert.ok(calls.some(c => c.url.includes('/pulls?state=all&per_page=')));
  assert.equal(calls.some(c => c.url.includes('head=')), false);
  assert.equal(await api.getRef('owner/app', 'feature/triage-issue-7'), null);
  await assert.rejects(api.createComment('owner/app', 7, 'safe'), { code: 'TRIAGE_PUBLISH_FAILED', message: 'TRIAGE_PUBLISH_FAILED' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  await assert.rejects(api.createComment('owner/app', 7, 'fixture-write'), { code: 'TRIAGE_PUBLISH_FAILED' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
});

test('TRI-13/22: mismatched uploaded trees cannot create commits and forbidden transport responses are sanitized', async () => {
  const calls = []; const api = createPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async (url, options) => {
    calls.push(url); return response(url.endsWith('/git/trees') ? { sha: 'f'.repeat(40) } : { tree: { sha: 'e'.repeat(40) } });
  } });
  await assert.rejects(api.createCommit('owner/app', { base_sha: 'a'.repeat(40), tree_sha: 'b'.repeat(40), message: 'safe', date: '2026-10-14T10:00:00Z',
    changes: [{ path: 'old.go', mode: '100644', type: 'blob', sha: null }] }), { code: 'INVALID_TRIAGE_PATCH' });
  assert.equal(calls.some(url => url.endsWith('/git/commits')), false);
  const denied = createPublicationApi('fixture-write', { recollect: async () => ({}), fetchImpl: async () => response({ message: 'private data' }, 403) });
  await assert.rejects(denied.listComments('owner/app', 7), { code: 'TRIAGE_PUBLISH_FAILED', message: 'TRIAGE_PUBLISH_FAILED' });
});
