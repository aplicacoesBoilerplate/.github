import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { normalizeChangesetsReport } from '../../scripts/versioning/version-report.mjs';
import { technicalFlowFixture } from './technical-flow-fixture.mjs';
import { technicalBranchName } from '../../scripts/versioning/dist/services/technical-release.js';

const temp = mkdtempSync(join(tmpdir(), 'changesets-flow-'));
const workspace = join(temp, 'consumer');
const bare = join(temp, 'origin.git');
const bin = join(temp, 'bin');
const reportPath = join(temp, 'report.json');
const policyPath = join(temp, 'policy.json');
const outputPath = join(temp, 'output.txt');
const statePath = join(temp, 'state.json');
const root = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

try {
  mkdirSync(workspace); mkdirSync(bin);
  mkdirSync(join(workspace, '.changeset'));
  for (const name of ['core', 'cli']) mkdirSync(join(workspace, 'packages', name), { recursive: true });
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(workspace, '.gitignore'), 'node_modules/\n');
  writeJson(join(workspace, 'package.json'), { name: 'fixture', private: true, workspaces: ['packages/*'] });
  writeJson(join(workspace, 'packages/core/package.json'), { name: '@lab/core', version: '2.0.0', private: true });
  writeJson(join(workspace, 'packages/cli/package.json'), { name: '@lab/cli', version: '1.0.0', private: true,
    dependencies: { '@lab/core': '^2.0.0' } });
  writeJson(join(workspace, 'package-lock.json'), { name: 'fixture', lockfileVersion: 3, requires: true,
    packages: { '': { name: 'fixture', workspaces: ['packages/*'] },
      'packages/core': { name: '@lab/core', version: '2.0.0' },
      'packages/cli': { name: '@lab/cli', version: '1.0.0', dependencies: { '@lab/core': '^2.0.0' } },
      'node_modules/@lab/core': { resolved: 'packages/core', link: true },
      'node_modules/@lab/cli': { resolved: 'packages/cli', link: true } } });
  writeJson(join(workspace, '.changeset/config.json'), { changelog: '@changesets/changelog-git',
    commit: false, fixed: [], linked: [], access: 'restricted', baseBranch: 'master',
    updateInternalDependencies: 'patch', ignore: [] });
  writeFileSync(join(workspace, '.changeset/one.md'), '---\n"@lab/core": major\n---\n\nBreaking core change.\n');
  git('add', '.'); git('commit', '-qm', 'feat!: original');
  const originSha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);
  mkdirSync(join(workspace, 'node_modules/.bin'), { recursive: true });
  const adapter = join(workspace, 'node_modules/.bin/changeset');
  writeFileSync(adapter, `#!/usr/bin/env node
const fs=require('node:fs');
if(process.argv[2]==='status'){
 const file=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
 fs.writeFileSync(file,JSON.stringify({changesets:[{id:'one',releases:[{name:'@lab/core',type:'major'}]}],
 releases:[{name:'@lab/core',oldVersion:'2.0.0',newVersion:'3.0.0',type:'major'},
 {name:'@lab/cli',oldVersion:'1.0.0',newVersion:'1.0.1',type:'patch'}]}));
 process.exit(0);
}
if(process.argv[2]!=='version')process.exit(1);
for(const [name,version] of [['core','3.0.0'],['cli','1.0.1']]){
 const path='packages/'+name+'/package.json',pkg=JSON.parse(fs.readFileSync(path,'utf8'));
 pkg.version=version;if(name==='cli')pkg.dependencies['@lab/core']='^3.0.0';
 fs.writeFileSync(path,JSON.stringify(pkg)+'\\n');
 fs.writeFileSync('packages/'+name+'/CHANGELOG.md','## '+version+'\\n');
}
fs.unlinkSync('.changeset/one.md');
`);
  chmodSync(adapter, 0o755);
  const native = { changesets: [{ id: 'one', releases: [{ name: '@lab/core', type: 'major' }] }],
    releases: [{ name: '@lab/core', oldVersion: '2.0.0', newVersion: '3.0.0', type: 'major' },
      { name: '@lab/cli', oldVersion: '1.0.0', newVersion: '1.0.1', type: 'patch' }] };
  const report = normalizeChangesetsReport({ nativeJson: JSON.stringify(native),
    explanation: '', branch: 'master', sha: originSha });
  writeJson(reportPath, report); writeJson(policyPath, { number: 12 });
  writeJson(statePath, { originSha });
  const run=technicalFlowFixture({workspace,bare,temp,adapter:'changesets',binary:adapter,statePath,outputPath});
  let result=await run();
  assert.equal(result.status,0,result.stderr);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(state.pr.branch, technicalBranchName('acme','consumer','master','changesets','.'));
  assert.match(state.pr.body, new RegExp(`Plan-SHA256: ${result.artifact.plan.planDigest}`));
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=pending-version-pr/);
  const outputs = Object.fromEntries(readFileSync(outputPath, 'utf8').trim().split(/\r?\n/)
    .map(line => line.split(/=(.*)/s).slice(0, 2)));
  assert.equal(outputs.version, '');
  assert.equal(outputs.tag, '');
  assert.deepEqual(JSON.parse(outputs.releases_json).map(item => item.tag),
    ['@lab/cli@1.0.1', '@lab/core@3.0.0']);
  assert.equal(git('rev-parse', 'master'), originSha);
  assert.equal(git('tag', '--list'), '');
  git('switch',state.pr.branch);
  assert.equal(JSON.parse(readFileSync(join(workspace, 'packages/core/package.json'))).version, '3.0.0');
  assert.equal(JSON.parse(readFileSync(join(workspace, 'packages/cli/package.json'))).version, '1.0.1');
  const lock = JSON.parse(readFileSync(join(workspace, 'package-lock.json')));
  assert.equal(lock.packages['packages/core'].version, '3.0.0');
  assert.equal(lock.packages['packages/cli'].dependencies['@lab/core'], '^3.0.0');
  const branch = technicalBranchName('acme','consumer','master','changesets','.');
  const versionHeadSha = git('rev-parse', branch);
  git('switch', 'master');
  git('merge', '--no-ff', branch, '-m', 'Merge coordinated Changesets version PR');
  const versionMergeSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  writeJson(statePath, { ...state, versionHeadSha, versionMergeSha, reviewMode: 'bot' });
  const publish=()=>run('publish',{GITHUB_SHA:versionMergeSha});
  result = await publish();
  assert.notEqual(result.status, 0, 'bot approval cannot publish the batch');
  assert.equal(Object.keys(JSON.parse(readFileSync(statePath)).tags ?? {}).length, 0);
  const botState = JSON.parse(readFileSync(statePath));
  writeJson(statePath, { ...botState, reviewMode: 'human',
    pr: { ...botState.pr, body: botState.pr.body.replaceAll(/Plan-SHA256: ([0-9a-f]{64})/.exec(botState.pr.body)[1], 'f'.repeat(64)) } });
  result = await publish();
  assert.notEqual(result.status, 0, 'changed native plan must fail before publication');
  assert.equal(Object.keys(JSON.parse(readFileSync(statePath)).tags ?? {}).length, 0);
  writeJson(statePath, { ...botState, reviewMode: 'human' });
  result = await publish();
  assert.equal(result.status, 0, result.stderr);
  const published = JSON.parse(readFileSync(statePath));
  assert.deepEqual(Object.keys(published.tags).sort(), ['@lab/cli@1.0.1', '@lab/core@3.0.0']);
  assert.equal(published.tags['@lab/core@3.0.0'], versionMergeSha);
  assert.equal(published.releases['@lab/cli@1.0.1'].target_commitish, versionMergeSha);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.match(readFileSync(outputPath, 'utf8'), new RegExp(`published_sha=${versionMergeSha}`));
  const beforeRerun = readFileSync(statePath, 'utf8');
  result = await publish();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(readFileSync(statePath, 'utf8'), beforeRerun, 'rerun must make no API writes');
  const partial = JSON.parse(readFileSync(statePath));
  delete partial.releases['@lab/cli@1.0.1'];
  writeJson(statePath, partial);
  result = await publish();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.equal(JSON.parse(readFileSync(statePath)).tags['@lab/cli@1.0.1'], versionMergeSha);
  const conflict = JSON.parse(readFileSync(statePath));
  conflict.tags['@lab/core@3.0.0'] = 'f'.repeat(40);
  writeJson(statePath, conflict);
  result = await publish();
  assert.notEqual(result.status, 0, 'conflicting package tag must block the complete batch');
  assert.match(result.stderr, /conflit|conflict|outro commit/i);
  assert.deepEqual(JSON.parse(readFileSync(statePath)).tags, conflict.tags,
    'a conflict must not move any package tag');
  console.log('Changesets: one technical PR contains both packages, dependent range and npm lockfile');
} finally { rmSync(temp, { recursive: true, force: true }); }
