import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  writeFileSync(join(workspace, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(workspace, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  writeFileSync(join(workspace, 'package-lock.json'), JSON.stringify({ version: '1.0.0',
    packages: { '': { version: '1.0.0' } } }));
  git('add', '.'); git('commit', '-qm', 'fix: original');
  const originSha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);
  mkdirSync(join(workspace, 'node_modules', '.bin'), { recursive: true });
  const adapter = join(workspace, 'node_modules', '.bin', 'standard-version');
  writeFileSync(adapter, `#!/usr/bin/env node
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
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'),cp=require('node:child_process');const a=process.argv.slice(2),p=process.env.MOCK_STATE;
const s=JSON.parse(fs.readFileSync(p,'utf8'));
const url=a.find(x=>x.startsWith('repos/'))??'';
const save=()=>fs.writeFileSync(p,JSON.stringify(s));
const git=(...args)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...args],{encoding:'utf8'}).trim();
const versionPr=()=>({number:13,merged_at:s.versionMergeSha?'2026-10-09T12:00:00Z':null,
 merge_commit_sha:s.versionMergeSha??null,head:{ref:s.pr?.branch,sha:s.versionHeadSha},
 base:{ref:'master',sha:s.originSha},user:{login:'test-app[bot]'},body:s.pr?.body});
const functionalPr=()=>({number:12,head:{ref:'develop',sha:s.originSha},base:{ref:'master'},
 merged_at:'2026-10-09T11:00:00Z',merge_commit_sha:s.originSha,milestone:null});
if(a[0]==='auth')process.exit(0);
if(a[0]==='pr'&&a[1]==='view'){console.log('APPROVED');process.exit(0)}
if(a[0]==='pr'&&a[1]==='list'){console.log(JSON.stringify(s.pr?[s.pr]:[]));process.exit(0)}
if(a[0]==='pr'&&a[1]==='create'){
 s.pr={number:13,state:'OPEN',url:'https://example.test/pull/13',
   body:a[a.indexOf('--body')+1],branch:a[a.indexOf('--head')+1]};
 save();console.log(s.pr.url);process.exit(0);
}
if(a[0]==='api'&&a[1]==='repos/acme/consumer'){console.log('master');process.exit(0)}
if(a[0]==='api'&&a[1].endsWith('/git/ref/heads/master')){console.log(git('rev-parse','refs/heads/master'));process.exit(0)}
if(a[0]==='api'&&a[1]==='users/test-app[bot]'){console.log('12345');process.exit(0)}
if(a[0]==='api'&&a[1].includes('/commits/')&&a[1].endsWith('/pulls?per_page=100')){
 const sha=a[1].split('/')[4];console.log(JSON.stringify(sha===s.versionMergeSha?[versionPr()]:
   sha===s.originSha?[functionalPr()]:[]));process.exit(0);
}
if(a[0]==='api'&&a[1]==='repos/acme/consumer/pulls/13'){
 console.log(JSON.stringify(versionPr()));process.exit(0);
}
if(a[0]==='api'&&url.includes('/pulls/13/reviews?')){
 const human=s.reviewMode==='human';
 console.log(JSON.stringify([[{state:'APPROVED',commit_id:s.versionHeadSha,
   user:{login:human?'maintainer':'test-app[bot]',type:human?'User':'Bot'}}]]));process.exit(0);
}
if(a[0]==='api'&&a[1]==='repos/acme/consumer/pulls/12'){
 console.log(JSON.stringify(functionalPr()));process.exit(0);
}
if(a[0]==='api'&&url.includes('/issues/12/timeline?')){console.log('[[]]');process.exit(0)}
if(a[0]==='api'&&url.includes('/pulls/12/reviews?')){console.log('[[]]');process.exit(0)}
if(a[0]==='api'&&a[1].includes('/git/ref/tags/')){
 if(!s.tagSha){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
 console.log(JSON.stringify({object:{type:'commit',sha:s.tagSha}}));process.exit(0);
}
if(a[0]==='api'&&a[1].includes('/releases/tags/')){
 if(!s.release){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
 console.log(JSON.stringify(s.release));process.exit(0);
}
if(a[0]==='api'&&a.includes('POST')&&url.endsWith('/git/refs')){
 s.tagSha=a.find(x=>x.startsWith('sha=')).slice(4);save();console.log('{}');process.exit(0);
}
if(a[0]==='api'&&a.includes('POST')&&url.endsWith('/releases')){
 s.release={tag_name:a.find(x=>x.startsWith('tag_name=')).slice(9),
   target_commitish:a.find(x=>x.startsWith('target_commitish=')).slice(17),
   html_url:'https://example.test/releases/v1.0.1'};save();console.log(JSON.stringify(s.release));process.exit(0);
}
console.error('unexpected gh '+a.join(' '));process.exit(1);
`);
  chmodSync(gh, 0o755);
  const run = (script = 'prepare-version-pr.sh', overrides = {}) => {
    writeFileSync(outputPath, '');
    return spawnSync('bash', [join(root, `scripts/versioning/${script}`)], {
      cwd: workspace, encoding: 'utf8', env: { ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        MOCK_STATE: statePath, MOCK_BARE: bare, GITHUB_WORKSPACE: workspace, GITHUB_REPOSITORY: 'acme/consumer',
        GITHUB_SHA: originSha, TARGET_BRANCH: 'master', ADAPTER: 'standard-version',
        GH_TOKEN: 'mock-read',
        PROJECT_PATH: '.', TAG_PREFIX: 'v', ORIGIN_SHA: originSha, PUBLISH_PHASE: 'functional',
        RELEASE_GATES_VALIDATED: '1', VERSIONING_TOKEN: 'mock', VERSIONING_BOT_SLUG: 'test-app',
        VERSION_REPORT_PATH: reportPath, PR_POLICY_PATH: policyPath, GITHUB_OUTPUT: outputPath,
        ...overrides },
    });
  };
  let result = run('publish.sh', { GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=pending-version-pr/);
  assert.equal(JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')).version, '1.0.1');
  assert.equal(git('tag', '--list'), '', 'technical PR preparation must not tag');
  assert.equal(git('rev-parse', 'master'), originSha, 'approved functional SHA remains on main');
  git('switch', 'master');
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /já aberto/);
  assert.equal(git('rev-parse', 'master'), originSha);
  const versionHeadSha = git('rev-parse', 'versioning/standard-version/' + originSha.slice(0, 12));
  git('merge', '--no-ff', 'versioning/standard-version/' + originSha.slice(0, 12), '-m', 'Merge version PR');
  const versionMergeSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'master');
  const current = JSON.parse(readFileSync(statePath, 'utf8'));
  writeFileSync(statePath, JSON.stringify({ ...current, versionHeadSha, versionMergeSha,
    reviewMode: 'bot' }));
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'bot-only approval cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    reviewMode: 'human' }));
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master', MOCK_BAD_NATIVE: '1' });
  assert.notEqual(result.status, 0, 'ambiguous native version cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  const validPr = JSON.parse(readFileSync(statePath, 'utf8')).pr;
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    pr: { ...validPr, body: validPr.body.replace(originSha, 'f'.repeat(40)) } }));
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'wrong homologated origin cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    pr: validPr }));
  const validLock = readFileSync(join(workspace, 'package-lock.json'), 'utf8');
  writeFileSync(join(workspace, 'package-lock.json'), '{"version":"0.0.0"}');
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'manifest divergent from homologated version cannot publish');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, undefined);
  writeFileSync(join(workspace, 'package-lock.json'), validLock);
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=published/);
  assert.match(readFileSync(outputPath, 'utf8'), new RegExp(`published_sha=${versionMergeSha}`));
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  git('switch', 'master');
  git('commit', '--allow-empty', '-qm', 'chore: later delivery');
  git('push', 'origin', 'master');
  git('switch', '--detach', versionMergeSha);
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, 'utf8'), /outcome=already-published/);
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')),
    release: undefined }));
  result = run('publish.sh', { GITHUB_SHA: versionMergeSha, GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'master' });
  assert.notEqual(result.status, 0, 'stale push may not repair a missing Release');
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).tagSha, versionMergeSha);
console.log('standard-version: technical PR, published merge SHA and idempotent rerun validated');
} finally { rmSync(temp, { recursive: true, force: true }); }
