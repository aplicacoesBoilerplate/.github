import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSnapshotScm, createSnapshotTransport } from '../../scripts/versioning/dist/adapters/release-please/snapshot-scm.js';

const cwd = mkdtempSync(join(tmpdir(), 'release-please-snapshot-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const json = (name, value) => writeFileSync(join(cwd, name), `${JSON.stringify(value)}\n`);
const config = { packages: { '.': { 'release-type': 'node' } },
  'include-component-in-tag': false, 'include-v-in-tag': true,
  'initial-version': '0.0.1' };
let sha = 'a'.repeat(40);
const transportCalls = [];
const transport = async request => {
  transportCalls.push(request);
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/graphql') {
    return { status: 200, headers: {}, body: { data: { repository: { name: 'app' } } } };
  }
  if (url.pathname.endsWith('/tags')) {
    const second = url.searchParams.get('page') === '2';
    return { status: 200, headers: second ? {} : {
      link: '<https://api.github.com/repos/acme/app/tags?per_page=100&page=2>; rel="next"',
    }, body: second ? [{ name: 'v0.9.0', commit: { sha } }] :
      [{ name: 'v1.0.0', commit: { sha } }] };
  }
  if (url.pathname.endsWith('/releases')) return { status: 200, headers: {}, body: [] };
  if (url.pathname.endsWith('/commits')) return { status: 200, headers: {}, body: [] };
  throw Error(`unexpected request ${request.url}`);
};

try {
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', lockfileVersion: 3,
    packages: { '': { name: 'app', version: '1.0.0' } } });
  json('release-please-config.json', config);
  json('.release-please-manifest.json', { '.': '1.0.0' });
  git('add', '.'); git('commit', '-qm', 'feat: baseline'); git('tag', 'v1.0.0');
  const origin = git('rev-parse', 'HEAD');
  sha = origin;
  const context = { repository: cwd, workspace: cwd, projectPath: '.', targetBranch: 'master',
    sha: origin, tagPrefix: 'v', configuration: {} };
  const scm = await createSnapshotScm(context, { owner: 'acme', repo: 'app', transport });
  assert.equal((await scm.getFileJson('package.json', 'master')).version, '1.0.0');
  assert.equal((await scm.getFileContentsOnBranch('package.json', 'master')).parsedContent,
    '{"name":"app","version":"1.0.0"}\n');
  assert.deepEqual((await Array.fromAsync(scm.tagIterator())).map(item => item.name),
    ['v1.0.0', 'v0.9.0']);
  assert.equal(transportCalls.filter(item => item.url.includes('/tags')).length, 2);
  assert.deepEqual(await Array.fromAsync(scm.releaseIterator()), []);
  assert.equal((await scm.queryGraphql('query ReleasePleaseSnapshotHistory { repository { name } }')).data
    .repository.name, 'app');
  await assert.rejects(scm.queryGraphql('mutation Rename { updateRepository { id } }'), /mutation|GraphQL/i);
  await assert.rejects(scm.requestRest('POST', 'repos/acme/app/git/refs', {}), /mutation|somente leitura/i);
  await assert.rejects(createSnapshotTransport(transport).requestRest('DELETE',
    'repos/acme/app/releases/1'), /mutation|somente leitura/i);
  assert.throws(() => scm.createRelease(), /somente leitura/i);
  assert.throws(() => scm.createPullRequest(), /somente leitura/i);
  await assert.rejects(scm.getFileJson('package.json', 'other'), /branch|ref/i);

  json('package.json', { name: 'app', version: '1.0.1' });
  json('package-lock.json', { name: 'app', version: '1.0.1', lockfileVersion: 3,
    packages: { '': { name: 'app', version: '1.0.1' } } });
  git('add', 'package.json', 'package-lock.json'); git('commit', '-qm', 'fix: update');
  assert.equal((await scm.getFileJson('package.json', 'master')).version, '1.0.0',
    'a branch avançada não altera a leitura congelada');
  assert.throws(() => scm.assertTargetRef(), /avançou|diverge/i);

  json('.release-please-manifest.json', { '.': '2.0.0' });
  git('add', '.release-please-manifest.json'); git('commit', '-qm', 'chore: diverge manifest');
  await assert.rejects(createSnapshotScm({ ...context, sha: git('rev-parse', 'HEAD') },
    { owner: 'acme', repo: 'app', transport }), /manifest|baseline|tag/i);
  json('.release-please-manifest.json', { '.': '1.0.0' });
  json('release-please-config.json', { ...config, 'release-as': '2.0.0' });
  git('add', '.'); git('commit', '-qm', 'chore: extra option');
  await assert.rejects(createSnapshotScm({ ...context, sha: git('rev-parse', 'HEAD') },
    { owner: 'acme', repo: 'app', transport }), /release-as|config/i);
  json('release-please-config.json', config);
  json('package.json', { name: 'app', version: '1.0.0', workspaces: ['packages/*'] });
  git('add', '.'); git('commit', '-qm', 'chore: unsupported workspace');
  await assert.rejects(createSnapshotScm({ ...context, sha: git('rev-parse', 'HEAD') },
    { owner: 'acme', repo: 'app', transport }), /workspace/i);
  assert.equal(transportCalls.some(item => item.method !== 'GET' && item.url !== 'https://api.github.com/graphql'), false);
  console.log('Release Please snapshot: SHA, pagination, config, branch advance and read-only transport');
} finally {
  rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
