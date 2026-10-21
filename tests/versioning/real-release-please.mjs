import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReleasePlease, prepareReleasePlease } from '../../scripts/versioning/dist/adapters/release-please.js';
import { planFromReport } from '../../scripts/versioning/dist/adapter-contract.js';
import { runProcess } from '../../scripts/versioning/dist/ports/process.js';

const tool = join(import.meta.dirname, '../../scripts/versioning/tools/release-please');
const lock = JSON.parse(readFileSync(join(tool, 'package-lock.json'), 'utf8'));
assert.equal(lock.packages['node_modules/release-please'].version, '17.11.2');
runProcess({ command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd: tool,
  workspace: join(import.meta.dirname, '../..') });
assert.equal(execFileSync('node', ['-p',
  "require('./scripts/versioning/tools/release-please/node_modules/release-please/package.json').version"],
{ cwd: join(import.meta.dirname, '../..'), encoding: 'utf8' }).trim(), '17.11.2');
const root = mkdtempSync(join(tmpdir(), 'release-please-real-'));
const cases = [
  { id: 'patch', commit: 'fix: correct output', version: '1.0.1' },
  { id: 'minor', commit: 'feat: add output', version: '1.1.0' },
  { id: 'major', commit: 'feat!: replace output', version: '2.0.0' },
  { id: 'empty', commit: 'chore: update docs', version: null },
  { id: 'bootstrap', commit: 'fix: initial output', version: '0.0.1', bootstrap: true },
];

function scenario(name, settings = {}) {
  const cwd = join(root, name);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const json = (path, value) => writeFileSync(join(cwd, path), `${JSON.stringify(value, null, 2)}\n`);
  const version = settings.bootstrap ? '0.0.0' : '1.0.0';
  const config = { packages: { '.': { 'release-type': 'node' } },
    'include-component-in-tag': false, 'include-v-in-tag': true,
    ...(!settings.omitInitialVersion && { 'initial-version': settings.initialVersion ?? '0.0.1' }) };
  mkdirSync(cwd);
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version });
  json('package-lock.json', { name: 'app', version, lockfileVersion: 3,
    packages: { '': { name: 'app', version } } });
  json('release-please-config.json', config);
  json('.release-please-manifest.json', { '.': settings.manifestVersion ?? version });
  if (settings.extraFile) json('changelog.json', { entries: [] });
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  const baselineSha = git('rev-parse', 'HEAD');
  if (!settings.bootstrap) git('tag', 'v1.0.0');
  writeFileSync(join(cwd, 'feature.txt'), `${name}\n`);
  git('add', 'feature.txt'); git('commit', '-qm', settings.commit ?? 'fix: change');
  const sha = git('rev-parse', 'HEAD');
  const calls = [];
  const transport = async request => {
    calls.push(request);
    if (request.method !== 'GET') throw Error(`Mutation attempted: ${request.method}`);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/tags')) return { status: 200, headers: {}, body: settings.bootstrap ? [] :
      [{ name: 'v1.0.0', commit: { sha: settings.remoteTagSha ?? baselineSha } }] };
    if (path.endsWith('/releases')) return { status: 200, headers: {}, body: settings.bootstrap ? [] :
      [{ id: 1, name: 'v1.0.0', tag_name: 'v1.0.0', body: 'baseline', html_url: 'https://example.test/r/1',
        draft: false }] };
    throw Error(`Unexpected GitHub endpoint: ${path}`);
  };
  return { cwd, git, json, config, sha, calls, transport,
    context: { repository: cwd, workspace: cwd, projectPath: '.', targetBranch: 'master',
      sha, tagPrefix: 'v', configuration: {} } };
}

try {
  assert.ok(existsSync(join(tool, 'package-lock.json')), 'SDK has its own lockfile');
  for (const item of cases) {
    const fixture = scenario(item.id, item);
    const deps = { owner: 'acme', repo: 'app', transport: fixture.transport };
    const report = await collectReleasePlease(fixture.context, deps);
    assert.equal(report.adapter, 'release-please');
    assert.equal(report.status, item.version ? 'release' : 'no-release', item.id);
    assert.equal(report.candidateVersion ?? null, item.version, item.id);
    if (item.version) {
      const descriptor = { id: 'release-please', runtime: 'node', reportKind: 'single',
        needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} };
      const plan = planFromReport(report, descriptor, '.');
      const prepared = await prepareReleasePlease(fixture.context, plan, deps);
      assert.equal(prepared.version, item.version, item.id);
      assert.deepEqual(prepared.files.map(file => file.path).sort(),
        ['.release-please-manifest.json', 'CHANGELOG.md', 'package-lock.json', 'package.json'], item.id);
      const contents = path => Buffer.from(prepared.files.find(file => file.path === path).content,
        'base64').toString('utf8');
      assert.equal(JSON.parse(contents('package.json')).version, item.version, item.id);
      assert.equal(JSON.parse(contents('package-lock.json')).version, item.version, item.id);
      assert.equal(JSON.parse(contents('package-lock.json')).packages[''].version, item.version, item.id);
      assert.equal(JSON.parse(contents('.release-please-manifest.json'))['.'], item.version, item.id);
      assert.match(contents('CHANGELOG.md'), new RegExp(item.version.replaceAll('.', '\\.') ), item.id);
      assert.ok(prepared.files.every(file => file.baseSha === null || /^[0-9a-f]{40}$/.test(file.baseSha)));
    }
    assert.ok(fixture.calls.every(call => call.method === 'GET'), item.id);
    assert.equal(fixture.git('status', '--porcelain'), '', `reader never writes ${item.id}`);
  }
  const incompatible = scenario('initial-incompatible', { bootstrap: true, initialVersion: '1.0.0' });
  await assert.rejects(collectReleasePlease(incompatible.context,
    { owner: 'acme', repo: 'app', transport: incompatible.transport }), /initial-version|bootstrap/i);
  const missingInitial = scenario('initial-missing', { bootstrap: true, omitInitialVersion: true });
  await assert.rejects(collectReleasePlease(missingInitial.context,
    { owner: 'acme', repo: 'app', transport: missingInitial.transport }), /initial-version|bootstrap/i);
  const extra = scenario('extra-file', { extraFile: true });
  await assert.rejects((async () => {
    const deps = { owner: 'acme', repo: 'app', transport: extra.transport };
    const report = await collectReleasePlease(extra.context, deps);
    const descriptor = { id: 'release-please', runtime: 'node', reportKind: 'single',
      needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} };
    return prepareReleasePlease(extra.context, planFromReport(report, descriptor, '.'), deps);
  })(), /changelog.json|arquivo|unsupported/i);
  const divergent = scenario('history-divergent', { manifestVersion: '2.0.0' });
  await assert.rejects(collectReleasePlease(divergent.context,
    { owner: 'acme', repo: 'app', transport: divergent.transport }), /manifest|histórico|tag/i);
  const remoteDivergent = scenario('remote-tag-divergent', { remoteTagSha: 'a'.repeat(40) });
  await assert.rejects(collectReleasePlease(remoteDivergent.context,
    { owner: 'acme', repo: 'app', transport: remoteDivergent.transport }), /histórico|tag/i);
  console.log('Release Please real 17.11.2: patch, minor, major, bootstrap, empty, invalid config/files/history');
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
