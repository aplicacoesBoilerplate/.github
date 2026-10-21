import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyChangesetsFiles } from '../../scripts/versioning/changesets-version-pr.mjs';
import { collectChangesets, prepareChangesets, verifyPreparedChangesets } from '../../scripts/versioning/dist/adapters/changesets.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
import { runProcess } from '../../scripts/versioning/dist/ports/process.js';

const cwd = mkdtempSync(join(tmpdir(), 'real-changesets-'));
const cwd3 = join(tmpdir(), `real-changesets-3-${randomUUID()}`);
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const descriptor = validateDescriptor({ id: 'changesets', runtime: 'node', reportKind: 'batch',
  needsVersionPr: true, tagKind: 'lightweight', collect: collectChangesets, prepare: prepareChangesets });
const toolPath = major => join(import.meta.dirname, 'fixtures', `changesets-cli-${major}`);
const binaryPath = major => join(toolPath(major), 'node_modules', '.bin',
  process.platform === 'win32' ? 'changeset.cmd' : 'changeset');
const contextFor = (workspace, sha, major) => ({ repository: workspace, workspace, projectPath: '.',
  targetBranch: 'main', sha, tagPrefix: 'v', configuration: { adapterBin: binaryPath(major) } });
try {
for (const [major, version] of [[2, '2.29.5'], [3, '3.0.3']]) {
  const directory = toolPath(major);
  const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/@changesets/cli'].version, version);
  runProcess({ command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    cwd: directory, workspace: join(import.meta.dirname, '../..') });
}
  mkdirSync(join(cwd, 'packages', 'core'), { recursive: true });
  mkdirSync(join(cwd, 'packages', 'cli'), { recursive: true });
  mkdirSync(join(cwd, '.changeset'));
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules/\nreport.json\n');
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'lab', private: true,
    workspaces: ['packages/*'] }) + '\n');
  writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify({ name: 'lab', lockfileVersion: 3,
    requires: true, packages: { '': { name: 'lab', workspaces: ['packages/*'] },
      'packages/core': { name: '@lab/core', version: '2.0.0' },
      'packages/cli': { name: '@lab/cli', version: '1.0.0', dependencies: { '@lab/core': '^2.0.0' } },
      'node_modules/@lab/core': { resolved: 'packages/core', link: true },
      'node_modules/@lab/cli': { resolved: 'packages/cli', link: true } } }) + '\n');
  writeFileSync(join(cwd, 'packages', 'core', 'package.json'), JSON.stringify({
    name: '@lab/core', version: '2.0.0', private: true }) + '\n');
  writeFileSync(join(cwd, 'packages', 'cli', 'package.json'), JSON.stringify({
    name: '@lab/cli', version: '1.0.0', private: true,
    dependencies: { '@lab/core': '^2.0.0' } }) + '\n');
  writeFileSync(join(cwd, '.changeset', 'config.json'), JSON.stringify({
    $schema: 'https://unpkg.com/@changesets/config@2.3.1/schema.json',
    changelog: '@changesets/changelog-git', commit: false, fixed: [], linked: [],
    access: 'restricted', baseBranch: 'main', updateInternalDependencies: 'patch', ignore: [],
    privatePackages: { version: true, tag: true },
  }) + '\n');
  writeFileSync(join(cwd, '.changeset', 'two-features.md'), '---\n"@lab/core": major\n---\n\nHomologação de mudança incompatível.\n');
  git('add', '.gitignore', 'package.json', 'package-lock.json', '.changeset', 'packages');
  git('commit', '-m', 'feat: combine two features');
  const sha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--local', cwd, cwd3], { stdio: 'pipe' });

  execFileSync('bash', ['-c', 'npm install --no-save --ignore-scripts --no-audit @changesets/cli@2.29.5'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  const typed2 = collectChangesets(contextFor(cwd, sha, 2));
  assert.deepEqual(typed2.releases.map(({ name, version }) => [name, version]),
    [['@lab/cli', '1.0.1'], ['@lab/core', '3.0.0']]);
  assert.equal(planFromReport(typed2, descriptor, '.').entries.length, 2);
  const reportPath = join(cwd, 'report.json');
  execFileSync('bash', [fileURLToPath(new URL('../../scripts/versioning/collect-version-report.sh', import.meta.url)), reportPath], {
    cwd, env: { ...process.env, GITHUB_WORKSPACE: cwd, GITHUB_SHA: sha, ADAPTER: 'changesets',
      TARGET_BRANCH: 'main', PROJECT_PATH: '.' }, stdio: 'pipe', timeout: 120000,
  });
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.adapter, 'changesets');
  assert.equal(report.sha, sha);
  assert.deepEqual(report.releases.map(({ name, version }) => [name, version]),
    [['@lab/cli', '1.0.1'], ['@lab/core', '3.0.0']]);
  execFileSync('bash', ['-c', './node_modules/.bin/changeset version'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync('bash', ['-c', 'npm install --package-lock-only --ignore-scripts --no-audit --no-fund'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/versioning/sync-npm-lock.mjs', import.meta.url)),
    join(cwd, 'package-lock.json'), 'packages/core', join(cwd, 'packages', 'core', 'package.json')],
  { cwd, stdio: 'pipe', timeout: 120000 });

  const pkg = JSON.parse(readFileSync(join(cwd, 'packages', 'core', 'package.json'), 'utf8'));
  assert.equal(pkg.version, '3.0.0');
  const cli = JSON.parse(readFileSync(join(cwd, 'packages', 'cli', 'package.json'), 'utf8'));
  assert.equal(cli.version, '1.0.1');
  assert.equal(cli.dependencies['@lab/core'], '^3.0.0');
  const lock = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['packages/core'].version, '3.0.0');
  assert.equal(lock.packages['packages/cli'].version, '1.0.1');
  assert.equal(lock.packages['packages/cli'].dependencies['@lab/core'], '^3.0.0');
  assert.match(readFileSync(join(cwd, 'packages', 'core', 'CHANGELOG.md'), 'utf8'), /3\.0\.0/);
  assert.match(readFileSync(join(cwd, 'packages', 'cli', 'CHANGELOG.md'), 'utf8'), /1\.0\.1/);
  assert.equal(existsSync(join(cwd, '.changeset', 'two-features.md')), false);
  verifyChangesetsFiles({ repository: cwd, report, working: true });
  writeFileSync(join(cwd, 'unrelated.txt'), 'must fail\n');
  assert.throws(() => verifyChangesetsFiles({ repository: cwd, report, working: true }), /não permitido/);
  rmSync(join(cwd, 'unrelated.txt'));
  const savedLock = readFileSync(join(cwd, 'package-lock.json'), 'utf8');
  lock.packages['packages/cli'].version = '1.0.0';
  writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify(lock));
  assert.throws(() => verifyChangesetsFiles({ repository: cwd, report, working: true }), /lockfile/);
  writeFileSync(join(cwd, 'package-lock.json'), savedLock);
  assert.equal(git('rev-parse', 'HEAD'), sha);
  assert.equal(git('tag', '--list'), '');
  const context3 = contextFor(cwd3, sha, 3);
  const configPath = join(cwd3, '.changeset', 'config.json');
  const configOriginal = readFileSync(configPath, 'utf8');
  const ignoredConfig = JSON.parse(configOriginal);
  ignoredConfig.ignore = ['@lab/cli'];
  writeFileSync(configPath, JSON.stringify(ignoredConfig));
  assert.throws(() => collectChangesets(context3),
    /increment|ignored|ignore|depend/i, 'dependente ignorado não pode ser publicado por inferência');
  writeFileSync(configPath, configOriginal);
  const typed3 = collectChangesets(context3);
  assert.deepEqual(typed3.releases.map(({ name, version }) => [name, version]),
    [['@lab/cli', '1.0.1'], ['@lab/core', '3.0.0']]);
  const plan3 = planFromReport(typed3, descriptor, '.');
  const changed3 = prepareChangesets(context3, plan3);
  assert.ok(changed3.includes('packages/core/package.json'));
  assert.ok(changed3.includes('packages/cli/package.json'));
  assert.ok(changed3.includes('package-lock.json'));
  assert.ok(changed3.includes('.changeset/two-features.md'));
  assert.equal(JSON.parse(readFileSync(join(cwd3, 'packages/core/package.json'))).version, '3.0.0');
  assert.equal(JSON.parse(readFileSync(join(cwd3, 'packages/cli/package.json'))).dependencies['@lab/core'], '^3.0.0');
  assert.equal(JSON.parse(readFileSync(join(cwd3, 'package-lock.json'))).packages['packages/cli']
    .dependencies['@lab/core'], '^3.0.0');
  const lock3Path = join(cwd3, 'package-lock.json');
  const lock3Original = readFileSync(lock3Path, 'utf8');
  const lock3Broken = JSON.parse(lock3Original);
  lock3Broken.packages['packages/cli'].dependencies['@lab/core'] = '^2.0.0';
  writeFileSync(lock3Path, JSON.stringify(lock3Broken));
  assert.throws(() => verifyPreparedChangesets(context3, plan3), /Lockfile diverge/);
  writeFileSync(lock3Path, lock3Original);
  assert.equal(existsSync(join(cwd3, '.changeset/two-features.md')), false);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cwd3, encoding: 'utf8' }).trim(), sha);
  assert.equal(execFileSync('git', ['tag', '--list'], { cwd: cwd3, encoding: 'utf8' }).trim(), '');
  execFileSync('git', ['config', 'user.email', 'fixture@example.test'], { cwd: cwd3 });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: cwd3 });
  execFileSync('git', ['add', '.'], { cwd: cwd3 });
  execFileSync('git', ['commit', '-m', 'chore: version packages'], { cwd: cwd3, stdio: 'pipe' });
  const emptySha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cwd3, encoding: 'utf8' }).trim();
  const emptyPlan = collectChangesets(contextFor(cwd3, emptySha, 3));
  assert.equal(emptyPlan.status, 'no-release');
  assert.equal(planFromReport(emptyPlan, descriptor, '.').entries.length, 0);
  assert.deepEqual(prepareChangesets(contextFor(cwd3, emptySha, 3),
    planFromReport(emptyPlan, descriptor, '.')), []);
  assert.equal(typed3.releases.some(item => item.name === 'lab'), false,
    'a raiz privada não pode entrar no plano de packages');
  console.log('Changesets 2.29.5/3.0.3 reais: core 3.0.0, cli dependente 1.0.1, sem commit/tag');
} finally {
  for (const directory of [cwd, cwd3]) {
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }); }
    catch (error) { console.warn(`Fixture temporária não removida: ${directory}: ${error.message}`); }
  }
}
