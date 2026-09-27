import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = mkdtempSync(join(tmpdir(), 'real-changesets-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
try {
  mkdirSync(join(cwd, 'packages', 'core'), { recursive: true });
  mkdirSync(join(cwd, '.changeset'));
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'lab', private: true,
    workspaces: ['packages/*'] }) + '\n');
  writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify({ name: 'lab', lockfileVersion: 3,
    requires: true, packages: { '': { name: 'lab', workspaces: ['packages/*'] },
      'packages/core': { name: '@lab/core', version: '2.0.0' } } }) + '\n');
  writeFileSync(join(cwd, 'packages', 'core', 'package.json'), JSON.stringify({
    name: '@lab/core', version: '2.0.0', private: true }) + '\n');
  writeFileSync(join(cwd, '.changeset', 'config.json'), JSON.stringify({
    $schema: 'https://unpkg.com/@changesets/config@2.3.1/schema.json',
    changelog: '@changesets/changelog-git', commit: false, fixed: [], linked: [],
    access: 'restricted', baseBranch: 'main', updateInternalDependencies: 'patch', ignore: [],
  }) + '\n');
  writeFileSync(join(cwd, '.changeset', 'two-features.md'), '---\n"@lab/core": minor\n---\n\nHomologação de duas features.\n');
  git('add', '.gitignore', 'package.json', 'package-lock.json', '.changeset', 'packages');
  git('commit', '-m', 'feat: combine two features');
  const sha = git('rev-parse', 'HEAD');

  execFileSync('bash', ['-c', 'npm install --no-save --ignore-scripts --no-audit @changesets/cli@2.29.5'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync('bash', ['-c', './node_modules/.bin/changeset version'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync('bash', ['-c', 'npm install --package-lock-only --ignore-scripts --no-audit --no-fund'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/versioning/sync-npm-lock.mjs', import.meta.url)),
    join(cwd, 'package-lock.json'), 'packages/core', join(cwd, 'packages', 'core', 'package.json')],
  { cwd, stdio: 'pipe', timeout: 120000 });

  const pkg = JSON.parse(readFileSync(join(cwd, 'packages', 'core', 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.1.0');
  const lock = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['packages/core'].version, '2.1.0');
  assert.match(readFileSync(join(cwd, 'packages', 'core', 'CHANGELOG.md'), 'utf8'), /2\.1\.0/);
  assert.equal(existsSync(join(cwd, '.changeset', 'two-features.md')), false);
  assert.equal(git('rev-parse', 'HEAD'), sha);
  assert.equal(git('tag', '--list'), '');
  console.log('Changesets real: pacote @lab/core 2.1.0, changelog/changeset sem commit/tag');
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
