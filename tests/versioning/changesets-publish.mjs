import assert from 'node:assert/strict';
import { publishChangesets } from '../../scripts/versioning/publish-changesets.mjs';
import { normalizeChangesetsReport } from '../../scripts/versioning/version-report.mjs';

const sha = 'a'.repeat(40);
const report = normalizeChangesetsReport({ branch: 'master', sha, explanation: '',
  nativeJson: JSON.stringify({ changesets: [{ id: 'batch', releases: [{ name: '@lab/core', type: 'major' }] }],
    releases: [{ name: '@lab/core', oldVersion: '2.0.0', newVersion: '3.0.0', type: 'major' },
      { name: '@lab/cli', oldVersion: '1.0.0', newVersion: '1.0.1', type: 'patch' }] }) });

function fakeApi() {
  const tags = new Map();
  const releases = new Map();
  const writes = [];
  return { tags, releases, writes,
    getTag(tag) { return tags.get(tag) ?? null; },
    getRelease(tag) { return releases.get(tag) ?? null; },
    createTag(tag, target) { writes.push(`tag:${tag}`); tags.set(tag, target); },
    createRelease(tag, target, body) {
      writes.push(`release:${tag}`);
      const release = { tag_name: tag, target_commitish: target,
        html_url: `https://example.test/releases/${encodeURIComponent(tag)}`, body };
      releases.set(tag, release);
      return release;
    },
  };
}

const api = fakeApi();
let result = publishChangesets({ report, sha, stale: false, api });
assert.equal(result.outcome, 'published');
assert.equal(result.publishedSha, sha);
assert.equal(result.version, '');
assert.equal(result.tag, '');
assert.equal(result.releaseUrl, '');
assert.deepEqual(result.releases.map(item => [item.name, item.version, item.tag]),
  [['@lab/cli', '1.0.1', '@lab/cli@1.0.1'], ['@lab/core', '3.0.0', '@lab/core@3.0.0']]);
assert.equal(api.tags.get('@lab/cli@1.0.1'), sha);
assert.equal(api.releases.get('@lab/core@3.0.0').target_commitish, sha);
assert.equal(api.writes.length, 4);
for (let attempt = 0; attempt < 10; attempt += 1) {
  result = publishChangesets({ report, sha, stale: false, api });
  assert.equal(result.outcome, 'already-published');
  assert.equal(api.writes.length, 4, 'rerun must not write');
}
result = publishChangesets({ report, sha, stale: true, api });
assert.equal(result.outcome, 'already-published');
assert.equal(api.writes.length, 4, 'stale complete batch must not write');
api.releases.delete('@lab/cli@1.0.1');
result = publishChangesets({ report, sha, stale: false, api });
assert.equal(result.outcome, 'published');
assert.deepEqual(api.writes.slice(4), ['release:@lab/cli@1.0.1']);
api.releases.delete('@lab/cli@1.0.1');
assert.throws(() => publishChangesets({ report, sha, stale: true, api }), /antigo|incompleto/);
assert.equal(api.writes.length, 5, 'stale partial batch must not write');
api.releases.set('@lab/cli@1.0.1', { tag_name: '@lab/cli@1.0.1', target_commitish: sha,
  html_url: 'https://example.test/releases/cli' });
api.tags.set('@lab/core@3.0.0', 'b'.repeat(40));
assert.throws(() => publishChangesets({ report, sha, stale: false, api }), /Conflito/);
assert.equal(api.writes.length, 5, 'preflight conflict must reject whole batch');
api.tags.set('@lab/core@3.0.0', sha);
api.releases.set('@lab/core@3.0.0', { tag_name: 'wrong', target_commitish: sha,
  html_url: 'https://example.test/releases/wrong' });
assert.throws(() => publishChangesets({ report, sha, stale: false, api }), /Conflito/);
assert.equal(api.writes.length, 5);
const brokenApi = { ...api, getRelease() { throw Error('HTTP 403'); } };
assert.throws(() => publishChangesets({ report, sha, stale: false, api: brokenApi }), /403/);
assert.equal(api.writes.length, 5, 'API failure before writes must not publish');

const single = { ...report, releases: [report.releases[0]], baseVersion: report.releases[0].oldVersion,
  candidateVersion: report.releases[0].version, tag: report.releases[0].tag, bump: report.releases[0].bump };
const oneApi = fakeApi();
const one = publishChangesets({ report: single, sha, stale: false, api: oneApi });
assert.equal(one.version, '1.0.1');
assert.equal(one.tag, '@lab/cli@1.0.1');
assert.match(one.releaseUrl, /cli%401\.0\.1/);
console.log('Changesets publisher: package batch, partial recovery, conflict and ten idempotent reruns validated');
