import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'version-post-merge-'));
const workspace = join(temp, 'consumer');
const bare = join(temp, 'origin.git');
const bin = join(temp, 'bin');
const apiWrites = join(temp, 'api-writes.log');
const stateFile = join(temp, 'state.json');
const adapterCalls = join(temp, 'adapter-calls.log');
const output = join(temp, 'output.txt');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

try {
  mkdirSync(workspace); mkdirSync(bin);
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(workspace, 'go.mod'), 'module example.test/release\n\ngo 1.24\n');
  git('add', 'go.mod'); git('commit', '-m', 'feat: initial release');
  const sha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);
  writeFileSync(stateFile, JSON.stringify({ tagSha: null, release: null }));

  const adapter = join(bin, 'go-gitsemver');
  writeFileSync(adapter, `#!/usr/bin/env node
console.error('native release explanation');
require('node:fs').appendFileSync(process.env.ADAPTER_CALLS,'called\\n');
console.log(JSON.stringify({SemVer:'0.0.1',Sha:process.env.GITHUB_SHA}));
`);
  chmodSync(adapter, 0o755);
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'), cp=require('node:child_process');
const a=process.argv.slice(2), path=a.find(v=>v.startsWith('repos/'))??'';
const mode=process.env.FIXTURE_MODE, sha=process.env.GITHUB_SHA;
const state=JSON.parse(fs.readFileSync(process.env.STATE_FILE,'utf8'));
const save=()=>fs.writeFileSync(process.env.STATE_FILE,JSON.stringify(state));
const git=(...args)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...args],{encoding:'utf8'}).trim();
const pr={number:42,head:{ref:mode==='wrong-head'?'feature/x':'develop',sha},base:{ref:'master'},
  merged_at:'2026-10-01T10:02:00Z',merge_commit_sha:sha,
  milestone:mode==='no-milestone'?null:{title:['bad-milestone','stale-review','unauthorized'].includes(mode)?'v2.0.0':'v0.0.1'}};
if(mode==='api-error'){console.error('simulated API failure');process.exit(1)}
if(path==='repos/acme/consumer'){console.log('master');process.exit(0)}
if(path.endsWith('/git/ref/heads/master')){console.log(mode==='remote-stale'?'f'.repeat(40):git('rev-parse','refs/heads/master'));process.exit(0)}
if(path.includes('/commits/')&&path.includes('/pulls')){console.log(JSON.stringify([mode==='ambiguous'?[pr,{...pr,number:43}]:[pr]]));process.exit(0)}
if(path.endsWith('/pulls/42')){console.log(JSON.stringify(pr));process.exit(0)}
if(path.includes('/timeline')){console.log(JSON.stringify(mode==='bad-milestone'?[[]]:[[{event:'labeled',label:{name:'versioning:override'},actor:{login:'alice'},created_at:'2026-10-01T10:00:00Z'}]]));process.exit(0)}
if(path.includes('/reviews')){console.log(JSON.stringify([[{state:'APPROVED',user:{login:'bob'},submitted_at:'2026-10-01T10:01:00Z',commit_id:mode==='stale-review'?'e'.repeat(40):sha}]]));process.exit(0)}
if(path.includes('/collaborators/')){console.log(JSON.stringify({role_name:mode==='unauthorized'?'triage':path.includes('/alice/')?'maintain':'admin'}));process.exit(0)}
if(path.includes('/git/ref/tags/')){
  if(!state.tagSha){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
  console.log(JSON.stringify({object:{type:'commit',sha:state.tagSha}}));process.exit(0)}
if(path.includes('/releases/tags/')){
  if(!state.release){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
  console.log(JSON.stringify(state.release));process.exit(0)}
if(a.includes('POST')&&path.endsWith('/git/refs')){
  fs.appendFileSync(process.env.API_WRITES,a.join(' ')+'\\n');
  const value=a.find(v=>v.startsWith('sha=' )).slice(4);
  if(mode==='race-tag'&&!state.tagSha){state.tagSha=value;save();process.exit(1)}
  if(state.tagSha)process.exit(1); state.tagSha=value;save();console.log('{}');process.exit(0)}
if(a.includes('POST')&&path.endsWith('/releases')){
  fs.appendFileSync(process.env.API_WRITES,a.join(' ')+'\\n');
  const release={tag_name:a.find(v=>v.startsWith('tag_name=')).slice(9),
    target_commitish:a.find(v=>v.startsWith('target_commitish=')).slice(17),
    body:a.find(v=>v.startsWith('body=')).slice(5),html_url:'https://example.test/releases/v0.0.1'};
  if(mode==='race-release'&&!state.release){state.release=release;save();process.exit(1)}
  if(state.release)process.exit(1);state.release=release;save();console.log(JSON.stringify(release));process.exit(0)}
console.error('unexpected '+a.join(' '));process.exit(2);
`);
  chmodSync(gh, 0o755);

  const runGate = (overrides = {}) => spawnSync(bash, ['-c',
    `source '${join(root, 'scripts/versioning/release-gates.sh').replaceAll('\\', '/')}' && validate_release_gates && ` +
    `node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(process.env.VERSION_REPORT_PATH));` +
    `const p=JSON.parse(fs.readFileSync(process.env.RELEASE_POLICY_PATH));` +
    `if(r.sha!==process.env.GITHUB_SHA||!['matched','adapter-authoritative','overridden'].includes(p.outcome))process.exit(1)"`], {
    cwd: workspace, encoding: 'utf8', env: { ...process.env,
      PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      MOCK_BARE: bare, API_WRITES: apiWrites, STATE_FILE: stateFile, ADAPTER_CALLS: adapterCalls,
      GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'acme/consumer',
      GITHUB_WORKSPACE: workspace, GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master',
      GITHUB_SHA: sha, ADAPTER: 'go-gitsemver', TARGET_BRANCH: 'master', PROJECT_PATH: '.', ...overrides },
  });

  const valid = runGate();
  assert.equal(valid.status, 0, valid.stderr);
  assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'gate must not perform API writes');
  const withoutMilestone = runGate({ FIXTURE_MODE: 'no-milestone' });
  assert.equal(withoutMilestone.status, 0, withoutMilestone.stderr);
  for (const overrides of [
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF_NAME: 'develop' },
    { GITHUB_SHA: 'd'.repeat(40) }, { FIXTURE_MODE: 'remote-stale' },
    { FIXTURE_MODE: 'wrong-head' }, { FIXTURE_MODE: 'ambiguous' },
    { FIXTURE_MODE: 'bad-milestone' }, { FIXTURE_MODE: 'stale-review' },
    { FIXTURE_MODE: 'unauthorized' }, { FIXTURE_MODE: 'api-error' },
  ]) {
    const failed = runGate(overrides);
    assert.notEqual(failed.status, 0, `gate must fail for ${JSON.stringify(overrides)}`);
    assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'failure must happen before API writes');
  }

  const setState = value => writeFileSync(stateFile, JSON.stringify(value));
  const getState = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const runPublish = (overrides = {}) => {
    writeFileSync(output, '');
    return spawnSync(bash, [join(root, 'scripts/versioning/publish.sh')], {
      cwd: workspace, encoding: 'utf8', env: { ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        MOCK_BARE: bare, API_WRITES: apiWrites, STATE_FILE: stateFile, ADAPTER_CALLS: adapterCalls,
        GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'acme/consumer', GITHUB_WORKSPACE: workspace,
        GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master', GITHUB_SHA: sha,
        ADAPTER: 'go-gitsemver', TARGET_BRANCH: 'master', PROJECT_PATH: '.', GITHUB_OUTPUT: output,
        ...overrides },
    });
  };
  rmSync(adapterCalls, { force: true }); rmSync(apiWrites, { force: true });
  setState({ tagSha: null, release: null });
  let published = runPublish();
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=published/);
  assert.equal(getState().tagSha, sha);
  assert.equal(getState().release.target_commitish, sha);
  assert.match(getState().release.body, /native release explanation/);
  assert.equal(readFileSync(adapterCalls, 'utf8').trim().split(/\r?\n/).length, 1,
    'one publication recalculates the integrated SHA exactly once');
  const writesAfterFirst = readFileSync(apiWrites, 'utf8');
  for (let index = 0; index < 10; index += 1) {
    published = runPublish();
    assert.equal(published.status, 0, published.stderr);
    assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  }
  assert.equal(readFileSync(apiWrites, 'utf8'), writesAfterFirst, 'reruns must not duplicate writes');

  setState({ tagSha: sha, release: null });
  published = runPublish();
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=published/);
  assert.equal(getState().tagSha, sha, 'partial recovery preserves the existing tag');

  setState({ tagSha: 'c'.repeat(40), release: null });
  assert.notEqual(runPublish().status, 0, 'a conflicting tag must fail');
  assert.equal(getState().tagSha, 'c'.repeat(40), 'a conflicting tag is never moved');
  setState({ tagSha: null, release: { tag_name: 'v0.0.1', target_commitish: sha,
    html_url: 'https://example.test/releases/v0.0.1', body: 'existing' } });
  assert.notEqual(runPublish().status, 0, 'a release without a verifiable tag must fail');
  assert.equal(getState().tagSha, null, 'a release conflict must not create a tag');

  setState({ tagSha: null, release: null });
  published = runPublish({ FIXTURE_MODE: 'race-tag' });
  assert.equal(published.status, 0, published.stderr);
  assert.equal(getState().tagSha, sha, 'tag race reconciles to the integrated SHA');
  setState({ tagSha: sha, release: null });
  published = runPublish({ FIXTURE_MODE: 'race-release' });
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  console.log('Pós-merge: proveniência, policy e publicação idempotente aprovadas');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
