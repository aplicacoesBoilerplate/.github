import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { normalizeChangesetsReport } from '../../scripts/versioning/version-report.mjs';
import { planDigest } from '../../scripts/versioning/changesets-version-pr.mjs';

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
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'),cp=require('node:child_process'),a=process.argv.slice(2),p=process.env.MOCK_STATE;
const s=JSON.parse(fs.readFileSync(p,'utf8'));const save=()=>fs.writeFileSync(p,JSON.stringify(s));
const git=(...args)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...args],{encoding:'utf8'}).trim();
if(a[0]==='auth')process.exit(0);
if(a[0]==='pr'&&a[1]==='list'){console.log(JSON.stringify(s.pr?[s.pr]:[]));process.exit(0)}
if(a[0]==='pr'&&a[1]==='create'){
 s.pr={number:13,state:'OPEN',url:'https://example.test/pull/13',body:a[a.indexOf('--body')+1],
 branch:a[a.indexOf('--head')+1]};save();console.log(s.pr.url);process.exit(0);
}
if(a[0]==='api'&&a[1].endsWith('/git/ref/heads/master')){console.log(git('rev-parse','refs/heads/master'));process.exit(0)}
if(a[0]==='api'&&a[1]==='users/test-app[bot]'){console.log('12345');process.exit(0)}
console.error('unexpected gh '+a.join(' '));process.exit(1);
`);
  chmodSync(gh, 0o755);
  const env = { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    MOCK_STATE: statePath, MOCK_BARE: bare, GITHUB_WORKSPACE: workspace, GITHUB_REPOSITORY: 'acme/consumer',
    GITHUB_SHA: originSha, TARGET_BRANCH: 'master', ADAPTER: 'changesets', GH_TOKEN: 'mock-read',
    PROJECT_PATH: '.', TAG_PREFIX: 'v', ORIGIN_SHA: originSha, PUBLISH_PHASE: 'functional',
    RELEASE_GATES_VALIDATED: '1', VERSIONING_TOKEN: 'mock', VERSIONING_BOT_SLUG: 'test-app',
    VERSION_REPORT_PATH: reportPath, PR_POLICY_PATH: policyPath, GITHUB_OUTPUT: outputPath };
  let result = spawnSync('bash', [join(root, 'scripts/versioning/prepare-version-pr.sh')],
    { cwd: workspace, encoding: 'utf8', env, timeout: 120000 });
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(state.pr.branch, `versioning/changesets/${originSha.slice(0, 12)}`);
  assert.match(state.pr.body, new RegExp(`Plan-SHA256: ${planDigest(report)}`));
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=pending-version-pr/);
  const outputs = Object.fromEntries(readFileSync(outputPath, 'utf8').trim().split(/\r?\n/)
    .map(line => line.split(/=(.*)/s).slice(0, 2)));
  assert.equal(outputs.version, '');
  assert.equal(outputs.tag, '');
  assert.deepEqual(JSON.parse(outputs.releases_json).map(item => item.tag),
    ['@lab/cli@1.0.1', '@lab/core@3.0.0']);
  assert.equal(git('rev-parse', 'master'), originSha);
  assert.equal(git('tag', '--list'), '');
  assert.equal(JSON.parse(readFileSync(join(workspace, 'packages/core/package.json'))).version, '3.0.0');
  assert.equal(JSON.parse(readFileSync(join(workspace, 'packages/cli/package.json'))).version, '1.0.1');
  const lock = JSON.parse(readFileSync(join(workspace, 'package-lock.json')));
  assert.equal(lock.packages['packages/core'].version, '3.0.0');
  assert.equal(lock.packages['packages/cli'].dependencies['@lab/core'], '^3.0.0');
  console.log('Changesets: one technical PR contains both packages, dependent range and npm lockfile');
} finally { rmSync(temp, { recursive: true, force: true }); }
