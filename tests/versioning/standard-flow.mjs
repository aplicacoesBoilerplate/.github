import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { technicalFlowFixture } from './technical-flow-fixture.mjs';

const temp = mkdtempSync(join(tmpdir(), 'standard-flow-'));
const workspace = join(temp, 'consumer');
const bare = join(temp, 'origin.git');
const bin = join(temp, 'bin');
const root = resolve(import.meta.dirname, '../..');
const statePath = join(temp, 'state.json');
const reportPath = join(temp, 'report.json');
const policyPath = join(temp, 'policy.json');
const outputPath = join(temp, 'output.txt');
const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
try {
  mkdirSync(workspace); mkdirSync(bin);
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('config','core.autocrlf','false');
  writeFileSync(join(workspace, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(workspace, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  writeFileSync(join(workspace, 'package-lock.json'), JSON.stringify({ version: '1.0.0',
    packages: { '': { version: '1.0.0' } } }));
  git('add', '.'); git('commit', '-qm', 'chore: published base');
  git('tag','v1.0.0');
  writeFileSync(join(workspace,'fix.txt'),'functional delivery\n');
  git('add','.');git('commit','-qm','fix: original');
  const originSha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);
  mkdirSync(join(workspace, 'node_modules', '.bin'), { recursive: true });
  const adapter = join(workspace, 'node_modules', '.bin', 'standard-version');
  writeFileSync(adapter, `#!/usr/bin/env node
if(process.env.GH_TOKEN||process.env.VERSIONING_TOKEN)process.exit(98);
if(process.argv.includes('--dry-run')){
 console.log('bumping version in package.json from 1.0.0 to 1.0.1');
 if(process.env.MOCK_BAD_NATIVE)console.log('bumping version in package-lock.json from 1.0.0 to 1.0.2');
 process.exit(0);
}
const fs=require('node:fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version='1.0.1';fs.writeFileSync('package.json',JSON.stringify(pkg)+'\\n');
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
lock.version='1.0.1';lock.packages[''].version='1.0.1';
fs.writeFileSync('package-lock.json',JSON.stringify(lock)+'\\n');
fs.writeFileSync('CHANGELOG.md','## 1.0.1\\n');
`);
  chmodSync(adapter, 0o755);
  writeFileSync(statePath, JSON.stringify({ originSha }));
  writeFileSync(reportPath, JSON.stringify({ candidateVersion: '1.0.1', tag: 'v1.0.1' }));
  writeFileSync(policyPath, JSON.stringify({ number: 12 }));
  const run=technicalFlowFixture({workspace,bare,temp,adapter:'standard-version',binary:adapter,statePath,outputPath});
  let result = await run('publish', { GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=pending-version-pr/);
  git('switch',JSON.parse(readFileSync(statePath,'utf8')).pr.branch);
  assert.equal(JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')).version, '1.0.1');
  assert.equal(git('tag', '--list'), 'v1.0.0', 'technical PR preparation must preserve only the preexisting tag');
  assert.equal(git('rev-parse', 'master'), originSha, 'approved functional SHA remains on main');
  git('switch', 'master');
  result = await run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.technicalPr.outcome, 'existing');
  assert.equal(git('diff','--name-only'),'',git('diff','--','package.json'));
  assert.equal(git('rev-parse', 'master'), originSha);
  const versionHeadSha = git('rev-parse', 'versioning/standard-version/' + originSha.slice(0, 12));
  git('merge', '--no-ff', 'versioning/standard-version/' + originSha.slice(0, 12), '-m', 'Merge version PR');
  const versionMergeSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  const current = JSON.parse(readFileSync(statePath, 'utf8'));
  writeFileSync(statePath, JSON.stringify({ ...current, versionHeadSha, versionMergeSha,
    reviewMode: 'bot' }));
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'bot-only approval cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    reviewMode: 'human' }));
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master', MOCK_BAD_NATIVE: '1' });
  assert.notEqual(result.status, 0, 'a poisoned native report cannot publish and must not trigger recalculation');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  const validPr = JSON.parse(readFileSync(statePath, 'utf8')).pr;
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    pr: { ...validPr, body: validPr.body.replace(originSha, 'f'.repeat(40)) } }));
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'wrong homologated origin cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    pr: validPr }));
  const validLock = readFileSync(join(workspace, 'package-lock.json'), 'utf8');
  writeFileSync(join(workspace, 'package-lock.json'), '{"version":"0.0.0"}');
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'manifest divergent from homologated version cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(join(workspace, 'package-lock.json'), validLock);
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.match(readFileSync(outputPath, 'utf8'), new RegExp(`published_sha=${versionMergeSha}`));
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  git('switch', 'master');
  git('commit', '--allow-empty', '-qm', 'chore: later delivery');
  git('push', 'origin', 'master');
  git('switch', '--detach', versionMergeSha);
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    release: undefined }));
  result = await run('publish', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'stale push may not repair a missing Release');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  git('switch','-c','intervening-delivery',originSha);
  writeFileSync(join(workspace,'extra-feature.txt'),'feat not included in original version calculation\n');
  git('add','.');git('commit','-qm','feat: intervening delivery');
  git('merge','--no-ff','versioning/standard-version/'+originSha.slice(0,12),'-m','Merge outdated version PR');
  const outdatedMerge=git('rev-parse','HEAD');
  writeFileSync(statePath,JSON.stringify({...JSON.parse(readFileSync(statePath,'utf8')),
    versionMergeSha:outdatedMerge,tagSha:undefined,release:undefined}));
  result=await run('publish',{GITHUB_SHA:outdatedMerge,GITHUB_EVENT_NAME:'push',GITHUB_REF_NAME:'master',MOCK_REMOTE_SHA:outdatedMerge});
  assert.notEqual(result.status,0,'technical merge must not version additional functional commits using an older source calculation');
  assert.equal(JSON.parse(readFileSync(statePath,'utf8')).tagSha,undefined);
console.log('standard-version: technical PR, published merge SHA and idempotent rerun validated');
} finally { rmSync(temp, { recursive: true, force: true }); }
