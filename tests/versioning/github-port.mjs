import assert from 'node:assert/strict';
import { createReadApi, createWriteApi, GitHubHttpError } from '../../scripts/versioning/dist/ports/github.js';

const path = 'repos/example/repo/pulls/4/reviews?per_page=100';
const firstUrl = `https://api.github.com/${path}`;
const secondUrl = `${firstUrl}&page=2`;
const observed = [];
const transport = async request => {
  observed.push(request);
  if (request.url === firstUrl) {
    return { status: 200, headers: { link: `<${secondUrl}>; rel="next"` }, body: [{ id: 1 }] };
  }
  if (request.url === secondUrl) return { status: 200, headers: {}, body: [{ id: 2 }] };
  return { status: 404, headers: {}, body: { message: 'Not Found' } };
};
const reader = createReadApi(transport);
assert.deepEqual(await reader.list(path), [{ id: 1 }, { id: 2 }], 'All pages must be read');
assert.equal(observed.length, 2);
assert.deepEqual(observed.map(item => item.method), ['GET', 'GET']);
assert.equal(reader.post, undefined, 'ReadApi must not expose mutations');
assert.equal(await reader.getOptional('repos/example/repo/releases/tags/missing'), null);
await assert.rejects(() => reader.list('repos/example/repo/missing'), error => error instanceof GitHubHttpError && error.status === 404);

for (const status of [401, 403, 429, 503]) {
  const failing = createReadApi(async () => ({ status, headers: {}, body: { secret: 'do-not-log' } }));
  await assert.rejects(() => failing.getOptional(path), error =>
    error instanceof GitHubHttpError && error.status === status && !error.message.includes('do-not-log'));
}

const writes = [];
const writer = createWriteApi(async request => {
  writes.push(request);
  return { status: 201, headers: {}, body: { id: 42 } };
});
assert.deepEqual(await writer.post('repos/example/repo/releases', { tag_name: 'v0.0.1' }), { id: 42 });
assert.deepEqual(writes, [{ method: 'POST', url: 'https://api.github.com/repos/example/repo/releases',
  body: { tag_name: 'v0.0.1' } }]);
assert.equal(JSON.stringify(writes).includes('TOKEN'), false);
await assert.rejects(() => reader.list('https://evil.example/steal'), /endpoint/i);
const badNext = createReadApi(async () => ({ status: 200,
  headers: { link: '<https://evil.example/steal>; rel="next"' }, body: [] }));
await assert.rejects(() => badNext.list(path), /pagination/i);
console.log('GitHub ports: pagination, HTTP errors, read/write boundary and safe payloads passed');
