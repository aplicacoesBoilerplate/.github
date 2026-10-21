import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureVersionFiles, validateVersionFiles, applyVersionFiles, withinVersionFileLimits }
  from '../../scripts/versioning/dist/services/version-files.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const cwd = mkdtempSync(join(tmpdir(), 'multi-version-bundle-'));
const batchRoot = mkdtempSync(join(tmpdir(), 'multi-version-batch-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = (path, value) => writeFileSync(join(cwd, path), `${JSON.stringify(value)}\n`);
const descriptor = validateDescriptor({ id: 'release-please', runtime: 'node', reportKind: 'single',
  needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
try {
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  json('.release-please-manifest.json', { '.': '1.0.0' });
  json('release-please-config.json', { packages: { '.': { 'release-type': 'node' } } });
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  const sha = git('rev-parse', 'HEAD');
  const report = { schemaVersion: 1, adapter: 'release-please', sha, branch: 'master',
    status: 'release', baseVersion: '1.0.0', candidateVersion: '1.0.1', bump: 'patch',
    tag: 'v1.0.1', native: { explanation: 'Fix output' } };
  const plan = planFromReport(report, descriptor, '.');
  const next = { 'package.json': `${JSON.stringify({ name: 'app', version: '1.0.1' })}\n`,
    'package-lock.json': `${JSON.stringify({ name: 'app', version: '1.0.1',
      packages: { '': { version: '1.0.1' } } })}\n`,
    '.release-please-manifest.json': `${JSON.stringify({ '.': '1.0.1' })}\n`,
    'CHANGELOG.md': '## 1.0.1\n\nFix output\n' };
  const operations = Object.entries(next).map(([path, value]) => ({ op: 'write', path,
    content: Buffer.from(value).toString('base64') }));
  const bundle = captureVersionFiles({ repository: cwd, plan, operations });
  assert.equal(bundle.schemaVersion, 2);
  assert.equal(bundle.planDigest, plan.planDigest);
  assert.equal(bundle.operations.length, 4);
  assert.ok(validateVersionFiles({ repository: cwd, plan, bundle }));
  const snapshot = () => ['package.json', 'package-lock.json', '.release-please-manifest.json']
    .map(path => readFileSync(join(cwd, path), 'utf8')).join('|');
  const before = snapshot();
  const bad = (patch, pattern) => {
    assert.throws(() => validateVersionFiles({ repository: cwd, plan,
      bundle: { ...bundle, ...patch } }), pattern);
    assert.equal(snapshot(), before, 'negative validation cannot write');
  };
  bad({ planDigest: '0'.repeat(64) }, /digest|identidade/i);
  bad({ operations: bundle.operations.map((entry, index) => index ? entry :
    { ...entry, after: '0'.repeat(64) }) }, /hash/i);
  const wrong = Buffer.from('{"version":"9.0.0"}\n');
  bad({ operations: bundle.operations.map(entry => entry.path === 'package.json' ?
    { ...entry, content: wrong.toString('base64'), after: sha256(wrong) } : entry) }, /versão|package.json/i);
  bad({ operations: bundle.operations.map(entry => entry.path === 'package.json' ?
    { ...entry, before: '0'.repeat(64) } : entry) }, /base/i);
  for (const path of ['../outside', '/outside', 'C:/outside']) {
    bad({ operations: [{ ...bundle.operations[0], path }] }, /path|arquivo/i);
  }
  bad({ operations: [...bundle.operations, bundle.operations[0]] }, /duplicad/i);
  bad({ operations: [{ op: 'delete', path: 'package.json', before: sha256(readFileSync(join(cwd,
    'package.json'))) }] }, /delete|exclusão/i);
  symlinkSync(join(cwd, 'missing'), join(cwd, 'linked'), 'junction');
  bad({ operations: [{ ...bundle.operations[0], path: 'linked/package.json' }] }, /symlink|path/i);
  assert.equal(withinVersionFileLimits({ bytes: 10 * 1024 * 1024, serialized: 16 * 1024 * 1024,
    releases: 100, operations: 1000 }), true);
  for (const key of ['bytes', 'serialized', 'releases', 'operations']) {
    const limits = { bytes: 10 * 1024 * 1024, serialized: 16 * 1024 * 1024,
      releases: 100, operations: 1000 };
    limits[key]++;
    assert.equal(withinVersionFileLimits(limits), false, key);
  }
  const minimum = Buffer.byteLength(next['package.json']) + Buffer.byteLength(next['package-lock.json']) +
    Buffer.byteLength(next['.release-please-manifest.json']);
  const fullChangelog = `## 1.0.1\n${'x'.repeat(10 * 1024 * 1024 - minimum - 9)}`;
  assert.equal(minimum + Buffer.byteLength(fullChangelog), 10 * 1024 * 1024);
  const fullOperations = operations.map(item => item.path === 'CHANGELOG.md' ?
    { ...item, content: Buffer.from(fullChangelog).toString('base64') } : item);
  assert.equal(captureVersionFiles({ repository: cwd, plan, operations: fullOperations })
    .operations.length, 4, '10MiB de bytes é aceito');
  assert.throws(() => captureVersionFiles({ repository: cwd, plan, operations: fullOperations.map(item =>
    item.path === 'CHANGELOG.md' ? { ...item, content: Buffer.from(fullChangelog + 'x').toString('base64') } : item) }),
  /10MiB|limite/i);
  const changed = applyVersionFiles({ repository: cwd, plan, bundle });
  assert.equal(changed.length, 4);
  assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.1');
  assert.equal(git('rev-parse', 'HEAD'), sha);

  const batchGit = (...args) => execFileSync('git', args, { cwd: batchRoot, encoding: 'utf8' }).trim();
  mkdirSync(join(batchRoot, '.changeset'));
  mkdirSync(join(batchRoot, 'packages', 'core'), { recursive: true });
  batchGit('init', '-q', '-b', 'master'); batchGit('config', 'user.name', 'Fixture');
  batchGit('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(batchRoot, '.changeset', 'config.json'), '{}\n');
  writeFileSync(join(batchRoot, '.changeset', 'one.md'), '---\n"@lab/core": patch\n---\n');
  writeFileSync(join(batchRoot, 'packages', 'core', 'package.json'),
    '{"name":"@lab/core","version":"1.0.0"}\n');
  writeFileSync(join(batchRoot, 'packages', 'core', 'CHANGELOG.md'), '## 1.0.0\n');
  writeFileSync(join(batchRoot, 'package-lock.json'), JSON.stringify({ version: '1.0.0',
    packages: { 'packages/core': { name: '@lab/core', version: '1.0.0' } } }) + '\n');
  batchGit('add', '.'); batchGit('commit', '-qm', 'chore: baseline');
  const batchSha = batchGit('rev-parse', 'HEAD');
  const batchDescriptor = validateDescriptor({ id: 'changesets', runtime: 'node', reportKind: 'batch',
    needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
  const batchPlan = planFromReport({ schemaVersion: 1, adapter: 'changesets', sha: batchSha,
    branch: 'master', status: 'release', releases: [{ name: '@lab/core', oldVersion: '1.0.0',
      version: '1.0.1', tag: '@lab/core@1.0.1', bump: 'patch' }],
    native: { explanation: 'fix core', result: { changesets: [{ id: 'one' }] } } }, batchDescriptor, '.');
  const allowed = ['packages/core/package.json', 'packages/core/CHANGELOG.md', 'package-lock.json'];
  const batchOps = [
    { op: 'write', path: allowed[0], content: Buffer.from('{"name":"@lab/core","version":"1.0.1"}\n').toString('base64') },
    { op: 'write', path: allowed[1], content: Buffer.from('## 1.0.1\n').toString('base64') },
    { op: 'write', path: allowed[2], content: Buffer.from(JSON.stringify({ version: '1.0.1',
      packages: { 'packages/core': { name: '@lab/core', version: '1.0.1' } } }) + '\n').toString('base64') },
    { op: 'delete', path: '.changeset/one.md' },
  ];
  const batchBundle = captureVersionFiles({ repository: batchRoot, plan: batchPlan,
    trustedAllowedWrites: allowed, operations: batchOps });
  assert.equal(validateVersionFiles({ repository: batchRoot, plan: batchPlan,
    trustedAllowedWrites: allowed, bundle: batchBundle }), true);
  assert.throws(() => validateVersionFiles({ repository: batchRoot, plan: batchPlan,
    trustedAllowedWrites: allowed, bundle: { ...batchBundle,
      operations: [{ ...batchBundle.operations[3], path: '.changeset/unplanned.md' }] } }),
  /exclusão|changeset/i);
  assert.equal(applyVersionFiles({ repository: batchRoot, plan: batchPlan,
    trustedAllowedWrites: allowed, bundle: batchBundle }).length, 4);
  assert.equal(existsSync(join(batchRoot, '.changeset', 'one.md')), false);
  console.log('Multi-version bundle: identity, hashes, semantics, paths, limits, no-write negatives');
} finally {
  rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  rmSync(batchRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
