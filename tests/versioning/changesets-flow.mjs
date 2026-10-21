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
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'),cp=require('node:child_process'),a=process.argv.slice(2),p=process.env.MOCK_STATE;
const s=JSON.parse(fs.readFileSync(p,'utf8'));const save=()=>fs.writeFileSync(p,JSON.stringify(s));
const git=(...args)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...args],{encoding:'utf8'}).trim();
const url=a.find(x=>x.startsWith('repos/'))??'';
const versionPr=()=>({number:13,merged_at:s.versionMergeSha?'2026-10-13T12:00:00Z':null,
 merge_commit_sha:s.versionMergeSha??null,head:{ref:s.pr?.branch,sha:s.versionHeadSha},
 base:{ref:'master',sha:s.originSha},user:{login:'test-app[bot]'},body:s.pr?.body});
const functionalPr=()=>({number:12,head:{ref:'develop',sha:s.originSha},base:{ref:'master'},
 merged_at:'2026-10-13T11:00:00Z',merge_commit_sha:s.originSha,milestone:null});
if(a[0]==='auth')process.exit(0);
if(a[0]==='pr'&&a[1]==='view'){console.log('APPROVED');process.exit(0)}
if(a[0]==='pr'&&a[1]==='list'){console.log(JSON.stringify(s.pr?[s.pr]:[]));process.exit(0)}
if(a[0]==='pr'&&a[1]==='create'){
 s.pr={number:13,state:'OPEN',url:'https://example.test/pull/13',body:a[a.indexOf('--body')+1],
 branch:a[a.indexOf('--head')+1]};save();console.log(s.pr.url);process.exit(0);
}
if(a[0]==='api'&&a[1]==='repos/acme/consumer'){console.log('master');process.exit(0)}
if(a[0]==='api'&&a[1].endsWith('/git/ref/heads/master')){console.log(git('rev-parse','refs/heads/master'));process.exit(0)}
if(a[0]==='api'&&a[1]==='users/test-app[bot]'){console.log('12345');process.exit(0)}
if(a[0]==='api'&&url.includes('/commits/')&&url.endsWith('/pulls?per_page=100')){
 const sha=url.split('/')[4],prs=sha===s.versionMergeSha?[versionPr()]:sha===s.originSha?[functionalPr()]:[];
 console.log(JSON.stringify(a.includes('--slurp')?[prs]:prs));process.exit(0);
}
if(a[0]==='api'&&url==='repos/acme/consumer/pulls/13'){
 console.log(JSON.stringify(versionPr()));process.exit(0);
}
if(a[0]==='api'&&url.includes('/pulls/13/reviews?')){
 const human=s.reviewMode==='human';
 console.log(JSON.stringify([[{state:'APPROVED',commit_id:s.versionHeadSha,
 user:{login:human?'maintainer':'other-app[bot]',type:human?'User':'Bot'}}]]));process.exit(0);
}
if(a[0]==='api'&&url==='repos/acme/consumer/pulls/12'){
 console.log(JSON.stringify(functionalPr()));process.exit(0);
}
if(a[0]==='api'&&url.includes('/issues/12/timeline?')){console.log('[[]]');process.exit(0)}
if(a[0]==='api'&&url.includes('/pulls/12/reviews?')){console.log('[[]]');process.exit(0)}
if(a[0]==='api'&&url.includes('/git/ref/tags/')){
 const tag=url.split('/git/ref/tags/')[1],sha=s.tags?.[tag];
 if(!sha){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
 console.log(JSON.stringify({object:{type:'commit',sha}}));process.exit(0);
}
if(a[0]==='api'&&url.includes('/releases/tags/')){
 const tag=url.split('/releases/tags/')[1],release=s.releases?.[tag];
 if(!release){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
 console.log(JSON.stringify(release));process.exit(0);
}
if(a[0]==='api'&&a.includes('POST')&&url.endsWith('/git/refs')){
 const tag=a.find(x=>x.startsWith('ref=refs/tags/')).slice(14),sha=a.find(x=>x.startsWith('sha=')).slice(4);
 s.tags??={};s.tags[tag]=sha;save();console.log('{}');process.exit(0);
}
if(a[0]==='api'&&a.includes('POST')&&url.endsWith('/releases')){
 const tag=a.find(x=>x.startsWith('tag_name=')).slice(9),sha=a.find(x=>x.startsWith('target_commitish=')).slice(17);
 s.releases??={};s.releases[tag]={tag_name:tag,target_commitish:sha,
 html_url:'https://example.test/releases/'+encodeURIComponent(tag)};
 save();console.log(JSON.stringify(s.releases[tag]));process.exit(0);
}
console.error('unexpected gh '+a.join(' '));process.exit(1);
`);
  chmodSync(gh, 0o755);
  const env = { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    MOCK_STATE: statePath, MOCK_BARE: bare, GITHUB_WORKSPACE: workspace, GITHUB_REPOSITORY: 'acme/consumer',
    GITHUB_SHA: originSha, TARGET_BRANCH: 'master', ADAPTER: 'changesets', GH_TOKEN: 'mock-read',
    PROJECT_PATH: '.', TAG_PREFIX: 'v', ORIGIN_SHA: originSha, PUBLISH_PHASE: 'functional',
    RELEASE_GATES_VALIDATED: '1', VERSIONING_TOKEN: 'mock', VERSIONING_BOT_SLUG: 'test-app',
    VERSION_REPORT_PATH: reportPath, PR_POLICY_PATH: policyPath, GITHUB_OUTPUT: outputPath,
    VERSIONING_GH_BIN: gh };
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
  const branch = `versioning/changesets/${originSha.slice(0, 12)}`;
  const versionHeadSha = git('rev-parse', branch);
  git('switch', 'master');
  git('merge', '--no-ff', branch, '-m', 'Merge coordinated Changesets version PR');
  const versionMergeSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  writeJson(statePath, { ...state, versionHeadSha, versionMergeSha, reviewMode: 'bot' });
  const publish = () => {
    writeFileSync(outputPath, '');
    return spawnSync('bash', [join(root, 'scripts/versioning/publish.sh')], {
      cwd: workspace, encoding: 'utf8', timeout: 120000,
      env: { ...env, GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_NAME: 'master', RELEASE_GATES_VALIDATED: '' },
    });
  };
  result = publish();
  assert.notEqual(result.status, 0, 'bot approval cannot publish the batch');
  assert.equal(Object.keys(JSON.parse(readFileSync(statePath)).tags ?? {}).length, 0);
  const botState = JSON.parse(readFileSync(statePath));
  writeJson(statePath, { ...botState, reviewMode: 'human',
    pr: { ...botState.pr, body: botState.pr.body.replace(planDigest(report), 'f'.repeat(64)) } });
  result = publish();
  assert.notEqual(result.status, 0, 'changed native plan must fail before publication');
  assert.equal(Object.keys(JSON.parse(readFileSync(statePath)).tags ?? {}).length, 0);
  writeJson(statePath, { ...botState, reviewMode: 'human' });
  result = publish();
  assert.equal(result.status, 0, result.stderr);
  const published = JSON.parse(readFileSync(statePath));
  assert.deepEqual(Object.keys(published.tags).sort(), ['@lab/cli@1.0.1', '@lab/core@3.0.0']);
  assert.equal(published.tags['@lab/core@3.0.0'], versionMergeSha);
  assert.equal(published.releases['@lab/cli@1.0.1'].target_commitish, versionMergeSha);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.match(readFileSync(outputPath, 'utf8'), new RegExp(`published_sha=${versionMergeSha}`));
  const beforeRerun = readFileSync(statePath, 'utf8');
  result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(readFileSync(statePath, 'utf8'), beforeRerun, 'rerun must make no API writes');
  const partial = JSON.parse(readFileSync(statePath));
  delete partial.releases['@lab/cli@1.0.1'];
  writeJson(statePath, partial);
  result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.equal(JSON.parse(readFileSync(statePath)).tags['@lab/cli@1.0.1'], versionMergeSha);
  const conflict = JSON.parse(readFileSync(statePath));
  conflict.tags['@lab/core@3.0.0'] = 'f'.repeat(40);
  writeJson(statePath, conflict);
  result = publish();
  assert.notEqual(result.status, 0, 'conflicting package tag must block the complete batch');
  assert.match(result.stderr, /Conflito/);
  assert.deepEqual(JSON.parse(readFileSync(statePath)).tags, conflict.tags,
    'a conflict must not move any package tag');
  console.log('Changesets: one technical PR contains both packages, dependent range and npm lockfile');
} finally { rmSync(temp, { recursive: true, force: true }); }
