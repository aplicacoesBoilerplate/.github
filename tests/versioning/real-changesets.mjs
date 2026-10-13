import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyChangesetsFiles } from '../../scripts/versioning/changesets-version-pr.mjs';

const cwd = mkdtempSync(join(tmpdir(), 'real-changesets-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
try {
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
  }) + '\n');
  writeFileSync(join(cwd, '.changeset', 'two-features.md'), '---\n"@lab/core": major\n---\n\nHomologação de mudança incompatível.\n');
  git('add', '.gitignore', 'package.json', 'package-lock.json', '.changeset', 'packages');
  git('commit', '-m', 'feat: combine two features');
  const sha = git('rev-parse', 'HEAD');

  execFileSync('bash', ['-c', 'npm install --no-save --ignore-scripts --no-audit @changesets/cli@2.29.5'],
    { cwd, stdio: 'pipe', timeout: 120000 });
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
  console.log('Changesets real: @lab/core 3.0.0, @lab/cli dependente 1.0.1, sem commit/tag');
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
