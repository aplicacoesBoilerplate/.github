import assert from 'node:assert/strict';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
import { publishReleasePlan } from '../../scripts/versioning/dist/services/publication.js';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const descriptor = (id, tagKind, reportKind = 'single') => validateDescriptor({ id,
  runtime: id === 'jgitver' ? 'java' : id === 'go-gitsemver' ? 'go' : 'node',
  reportKind, needsVersionPr: id === 'changesets', tagKind,
  collect() {}, ...(id === 'changesets' ? { prepare() {} } : {}) });
const single = (id = 'go-gitsemver', tagKind = 'lightweight') => planFromReport({ schemaVersion: 1,
  adapter: id, sha, branch: 'master', status: 'release', baseVersion: '0.0.0',
  candidateVersion: '0.0.1', bump: 'patch', tag: 'v0.0.1', native: { explanation: 'fix: release' } },
descriptor(id, tagKind), '.');
const batch = () => planFromReport({ schemaVersion: 1, adapter: 'changesets', sha,
  branch: 'master', status: 'release', native: { explanation: 'native changelog' }, releases: [
    { name: '@lab/core', oldVersion: '1.0.0', version: '1.0.1', bump: 'patch', tag: '@lab/core@1.0.1' },
    { name: '@lab/cli', oldVersion: '1.0.0', version: '1.1.0', bump: 'minor', tag: '@lab/cli@1.1.0' },
  ] }, descriptor('changesets', 'lightweight', 'batch'), '.');

function fixture(plan) {
  const tags = new Map();
  const annotated = new Map();
  const releases = new Map();
  const writes = [];
  const state = { branch: sha, fail: '', outage: false, race: '', raceRelease: false, ready: true,
    advanceAfterRelease: false, outageAfterRelease: false };
  const read = {
    async get(endpoint) {
      if (state.outage) throw Error('API indisponível');
      if (endpoint.endsWith('/git/ref/heads/master')) return { object: { type: 'commit', sha: state.branch } };
      const key = decodeURIComponent(endpoint.split('/').at(-1));
      if (endpoint.includes('/git/tags/')) return annotated.get(key);
      throw Error(`GET inesperado: ${endpoint}`);
    },
    async getOptional(endpoint) {
      if (state.outage) throw Error('API indisponível');
      const key = decodeURIComponent(endpoint.split('/').at(-1));
      if (endpoint.includes('/git/ref/tags/')) return tags.get(key) ?? null;
      if (endpoint.includes('/releases/tags/')) return releases.get(key) ?? null;
      throw Error(`GET optional inesperado: ${endpoint}`);
    },
    async list() { throw Error('list inesperado'); },
    async listField() { throw Error('listField inesperado'); },
  };
  const write = {
    async post(endpoint, body) {
      writes.push({ endpoint, body });
      if (state.fail && endpoint.endsWith(state.fail)) throw Error(`falha ${state.fail}`);
      if (endpoint.endsWith('/git/tags')) {
        const objectSha = 'c'.repeat(39) + String(annotated.size);
        annotated.set(objectSha, { object: { type: 'commit', sha: body.object } });
        return { sha: objectSha };
      }
      if (endpoint.endsWith('/git/refs')) {
        const tag = body.ref.slice('refs/tags/'.length);
        if (state.race === tag) {
          tags.set(tag, { object: { type: 'commit', sha } });
          throw Error('race on tag');
        }
        tags.set(tag, { object: { type: annotated.has(body.sha) ? 'tag' : 'commit', sha: body.sha } });
        return { ref: body.ref, object: { sha: body.sha } };
      }
      if (endpoint.endsWith('/releases')) {
        const release = { tag_name: body.tag_name, target_commitish: body.target_commitish,
          html_url: `https://github.com/acme/app/releases/tag/${encodeURIComponent(body.tag_name)}` };
        releases.set(body.tag_name, release);
        if (state.raceRelease) throw Error('another execution created the release');
        if (state.advanceAfterRelease) state.branch = other;
        if (state.outageAfterRelease) state.outage = true;
        return release;
      }
      throw Error(`POST inesperado: ${endpoint}`);
    },
    async patch() { throw Error('patch inesperado'); },
    async put() { throw Error('put inesperado'); },
    async delete() { throw Error('delete inesperado'); },
  };
  const request = { owner: 'acme', repo: 'app', plan, publishedSha: sha, read, write,
    verify: async () => { if (!state.ready) throw Error('aprovação revogada'); return { publishedSha: sha }; } };
  return { tags, annotated, releases, writes, state, request };
}

const go = fixture(single());
let result = await publishReleasePlan({...go.request,additionalNotes:'## Homologação\nTeste manual aprovado'});
assert.equal(result.outcome, 'published'); assert.equal(result.publishedSha, sha);
assert.deepEqual(result.entries.map(item => item.status), ['created']);
assert.equal(go.writes.length, 2);
assert.match(go.writes.find(item=>item.endpoint.endsWith('/releases')).body.body,
  /fix: release[\s\S]*## Homologação\nTeste manual aprovado/);
result = await publishReleasePlan(go.request);
assert.equal(result.outcome, 'already-published'); assert.equal(go.writes.length, 2);
go.state.branch = other;
result = await publishReleasePlan(go.request);
assert.equal(result.outcome, 'already-published'); assert.equal(go.writes.length, 2);
go.state.ready = false;
result = await publishReleasePlan(go.request);
assert.equal(result.outcome, 'blocked'); assert.equal(result.publishedSha, '');
go.state.ready = true;

const java = fixture(single('jgitver', 'annotated'));
result = await publishReleasePlan(java.request);
assert.equal(result.outcome, 'published'); assert.equal(java.writes.length, 3);
assert.equal(java.tags.get('v0.0.1').object.type, 'tag');
assert.equal((await publishReleasePlan(java.request)).outcome, 'already-published');
assert.equal(java.writes.length, 3);
const wrongKind = fixture(single('jgitver', 'annotated'));
wrongKind.tags.set('v0.0.1', { object: { type: 'commit', sha } });
result = await publishReleasePlan(wrongKind.request);
assert.equal(result.outcome, 'conflict'); assert.equal(wrongKind.writes.length, 0);

const multi = fixture(batch());
result = await publishReleasePlan(multi.request);
assert.equal(result.publishedSha, sha);
assert.equal(multi.writes.length, 4);
assert.deepEqual(result.entries.map(item => item.status), ['created', 'created']);
const conflicted = fixture(batch());
conflicted.tags.set('@lab/core@1.0.1', { object: { type: 'commit', sha: other } });
result = await publishReleasePlan(conflicted.request);
assert.equal(result.outcome, 'conflict'); assert.equal(result.publishedSha, '');
assert.equal(conflicted.writes.length, 0);
const orphanRelease = fixture(single());
orphanRelease.releases.set('v0.0.1', { tag_name: 'v0.0.1', target_commitish: sha,
  html_url: 'https://github.com/acme/app/releases/tag/v0.0.1' });
result = await publishReleasePlan(orphanRelease.request);
assert.equal(result.outcome, 'conflict'); assert.equal(orphanRelease.writes.length, 0);

for (const fail of ['/git/refs', '/releases']) {
  const partial = fixture(batch());
  partial.state.fail = fail;
  result = await publishReleasePlan(partial.request);
  assert.equal(result.outcome, 'partial'); assert.equal(result.publishedSha, '');
  assert.ok(result.entries.some(item => item.status === 'pending'));
  partial.state.fail = '';
  result = await publishReleasePlan(partial.request);
  assert.equal(result.outcome, 'published'); assert.equal(result.publishedSha, sha);
  assert.equal(partial.releases.size, 2);
}
const race = fixture(single()); race.state.race = 'v0.0.1';
result = await publishReleasePlan(race.request);
assert.equal(result.outcome, 'published'); assert.equal(result.publishedSha, sha);
const advancedMidBatch = fixture(batch()); advancedMidBatch.state.advanceAfterRelease = true;
const releaseRace = fixture(single()); releaseRace.state.raceRelease = true;
releaseRace.tags.set('v0.0.1', { object: { type: 'commit', sha } });
const racedRelease = await publishReleasePlan(releaseRace.request);
assert.equal(racedRelease.outcome, 'already-published', 'a competing publisher owns the successful creation');
assert.equal(racedRelease.entries[0].status, 'existing');
assert.equal(racedRelease.publishedSha, sha);
result = await publishReleasePlan(advancedMidBatch.request);
assert.equal(result.outcome, 'partial'); assert.equal(result.publishedSha, '');
assert.deepEqual(result.entries.map(item => item.status), ['created', 'pending']);
assert.equal(advancedMidBatch.writes.length, 2);
advancedMidBatch.state.branch = sha; advancedMidBatch.state.advanceAfterRelease = false;
result = await publishReleasePlan(advancedMidBatch.request);
assert.equal(result.outcome, 'published'); assert.equal(result.publishedSha, sha);
const outageMidBatch = fixture(batch()); outageMidBatch.state.outageAfterRelease = true;
result = await publishReleasePlan(outageMidBatch.request);
assert.equal(result.outcome, 'partial'); assert.equal(result.publishedSha, '');
assert.deepEqual(result.entries.map(item => item.status), ['created', 'pending']);
outageMidBatch.state.outage = false; outageMidBatch.state.outageAfterRelease = false;
result = await publishReleasePlan(outageMidBatch.request);
assert.equal(result.outcome, 'published'); assert.equal(result.publishedSha, sha);
assert.deepEqual(result.entries.map(item => item.status), ['existing', 'created']);

const unavailable = fixture(single()); unavailable.state.outage = true;
result = await publishReleasePlan(unavailable.request);
assert.equal(result.publishedSha, ''); assert.equal(unavailable.writes.length, 0);
const revoked = fixture(single()); revoked.state.ready = false;
result = await publishReleasePlan(revoked.request);
assert.equal(result.publishedSha, ''); assert.equal(revoked.writes.length, 0);
const advanced = fixture(single()); advanced.state.branch = other;
result = await publishReleasePlan(advanced.request);
assert.equal(result.publishedSha, ''); assert.equal(advanced.writes.length, 0);
console.log('Publication: lightweight/annotated, batch preflight, retry, partial, race and readiness gates');
