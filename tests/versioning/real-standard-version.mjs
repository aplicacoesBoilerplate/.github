import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { normalizeStandardVersionReport } from '../../scripts/versioning/version-report.mjs';
import {captureVersionBundle,applyVersionBundle} from '../../scripts/versioning/version-bundle.mjs';

import { runProcess } from '../../scripts/versioning/dist/ports/process.js';
import { collectStandardVersion } from '../../scripts/versioning/dist/adapters/standard-version.js';

const cwd = mkdtempSync(join(tmpdir(), 'real-standard-version-'));
const evidence = mkdtempSync(join(tmpdir(),'real-standard-evidence-'));
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

  runProcess({command:process.platform==='win32'?'npm.cmd':'npm',
    args:['install','--no-save','--ignore-scripts','--no-audit','standard-version@9.5.0'],cwd,workspace:cwd});
  const binary=join(cwd,'node_modules','.bin',process.platform==='win32'?'standard-version.cmd':'standard-version');
  const preview = runProcess({command:binary,args:['--dry-run','--skip.commit','--skip.tag'],cwd,workspace:cwd}).stdout;
  const report = normalizeStandardVersionReport({ nativeOutput: preview, branch: 'main', sha, repository: cwd });
  assert.equal(report.candidateVersion, '1.1.0');
  assert.equal(report.baseVersion, '1.0.0');
  assert.equal(git('rev-parse', 'HEAD'), sha, 'Dry-run must preserve the approved SHA');
  runProcess({command:binary,args:['--skip.commit','--skip.tag'],cwd,workspace:cwd});
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.1.0');
  const lock = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, '1.1.0');
  assert.equal(lock.packages[''].version, '1.1.0');
  assert.match(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), /1\.1\.0/);
  assert.equal(git('rev-parse', 'HEAD'), sha, 'O adaptador não deve commitar');
  assert.equal(git('tag', '--list'), 'v1.0.0', 'O adaptador não deve criar tag');
  const nativePackage=readFileSync(join(cwd,'package.json'),'utf8');
  const nativeLock=readFileSync(join(cwd,'package-lock.json'),'utf8');
  const nativeChangelog=readFileSync(join(cwd,'CHANGELOG.md'),'utf8');
  const bundle=captureVersionBundle({repository:cwd,projectPath:'.',report});
  assert.deepEqual(bundle.files.map(f=>f.path).sort(),['CHANGELOG.md','package-lock.json','package.json']);
  writeFileSync(join(cwd,'package.json'),git('show',sha+':package.json')+'\n');
  writeFileSync(join(cwd,'package-lock.json'),git('show',sha+':package-lock.json')+'\n');
  rmSync(join(cwd,'CHANGELOG.md'));
  applyVersionBundle({repository:cwd,projectPath:'.',report,bundle});
  assert.equal(readFileSync(join(cwd,'package.json'),'utf8'),nativePackage);
  assert.equal(readFileSync(join(cwd,'package-lock.json'),'utf8'),nativeLock);
  assert.equal(readFileSync(join(cwd,'CHANGELOG.md'),'utf8'),nativeChangelog);
  git('add','.');git('commit','-qm','chore(release): 1.1.0');git('tag','-a','v1.1.0','-m','release');
  const originReport=join(evidence,'origin.json');
  const origin=join(evidence,'origin');
  execFileSync('git',['clone','--local',cwd,origin],{stdio:'pipe'});
  execFileSync('git',['checkout','--detach',sha],{cwd:origin,stdio:'pipe'});
  const replay=collectStandardVersion({repository:origin,workspace:origin,projectPath:'.',
    targetBranch:'main',sha,tagPrefix:'v',configuration:{adapterBin:binary}});
  writeFileSync(originReport,JSON.stringify(replay));
  assert.equal(JSON.parse(readFileSync(originReport,'utf8')).candidateVersion,'1.1.0',
    'recalculating the functional SHA must not change after its release tag exists on the descendant merge');
  console.log('standard-version real: dois PRs, um bump 1.1.0, changelog sem commit/tag');
} finally {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(evidence,{recursive:true,force:true});
}
