import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cwd = mkdtempSync(join(tmpdir(), 'real-standard-version-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
try {
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(cwd, 'package.json'), '{"name":"sample","version":"1.0.0","private":true}\n');
  writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify({ name: 'sample', version: '1.0.0',
    lockfileVersion: 3, requires: true, packages: { '': { name: 'sample', version: '1.0.0' } } }) + '\n');
  git('add', '.gitignore', 'package.json', 'package-lock.json');
  git('commit', '-m', 'chore: base');
  git('tag', 'v1.0.0');
  writeFileSync(join(cwd, 'fix.txt'), 'first PR\n');
  git('add', 'fix.txt');
  git('commit', '-m', 'fix: correct first feature');
  writeFileSync(join(cwd, 'feature.txt'), 'second PR\n');
  git('add', 'feature.txt');
  git('commit', '-m', 'feat: add second feature');
  const sha = git('rev-parse', 'HEAD');

  execFileSync('bash', ['-c', 'npm install --no-save --ignore-scripts --no-audit standard-version@9.5.0'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  execFileSync('bash', ['-c', './node_modules/.bin/standard-version --skip.commit --skip.tag'],
    { cwd, stdio: 'pipe', timeout: 120000 });
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.1.0');
  const lock = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, '1.1.0');
  assert.equal(lock.packages[''].version, '1.1.0');
  assert.match(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), /1\.1\.0/);
  assert.equal(git('rev-parse', 'HEAD'), sha, 'O adaptador não deve commitar');
  assert.equal(git('tag', '--list'), 'v1.0.0', 'O adaptador não deve criar tag');
  console.log('standard-version real: dois PRs, um bump 1.1.0, changelog sem commit/tag');
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
