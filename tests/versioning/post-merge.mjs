import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { preparePublicationMain } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
import { runPublish as publishWriter } from '../../scripts/versioning/dist/entrypoints/publish.js';
import { collectGoVersion } from '../../scripts/versioning/dist/adapters/go-gitsemver.js';
import { runProcess } from '../../scripts/versioning/dist/ports/process.js';
import { createGitPort } from '../../scripts/versioning/dist/ports/git.js';
import { createReadApi, createWriteApi } from '../../scripts/versioning/dist/ports/github.js';
import { loadArtifact } from '../../scripts/versioning/dist/services/publication-artifact.js';
import { producerTransport, writerTrust } from './publication-fixture.mjs';

try {
  mkdirSync(workspace); mkdirSync(bin);
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(workspace, 'go.mod'), 'module example.test/release\n\ngo 1.24\n');
  git('add', 'go.mod'); git('commit', '-m', 'feat: initial release');
  git('checkout', '-b', 'develop');
  writeFileSync(join(workspace, 'README.md'), 'Initial feature\n');
  git('add', 'README.md'); git('commit', '-m', 'feat: application');
  const headSha = git('rev-parse', 'HEAD');
  git('branch', 'hotfix/correct-production', headSha);
  git('checkout', 'master');
  git('merge', '--no-ff', 'develop', '-m', 'Merge develop');
  const sha = git('rev-parse', 'HEAD');
  assert.notEqual(headSha, sha, 'reviewed head and integrated merge are distinct real commits');
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
  const centralSha='c'.repeat(40);
  let latestPrepared=null;
  const environment=overrides=>({...process.env,GH_TOKEN:'fixture',GITHUB_REPOSITORY:'acme/consumer',
    GITHUB_WORKSPACE:workspace,GITHUB_EVENT_NAME:'push',GITHUB_REF_NAME:'master',
    GITHUB_SHA:sha,ADAPTER:'go-gitsemver',ADAPTER_BIN:adapter,TARGET_BRANCH:'master',PROJECT_PATH:'.',
    GITHUB_RUN_ID:'77',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'validate-publication',CENTRAL_SHA:centralSha,
    ADAPTER_CALLS:adapterCalls,REQUIRED_CHECKS:'go-ci',...overrides});
  const transportFor=env=>producerTransport({repository:'acme/consumer',sha:env.GITHUB_SHA,centralSha},async request=>{
    const endpoint=new URL(request.url).pathname,mode=env.FIXTURE_MODE,current=env.GITHUB_SHA;
    const reviewed=env.TEST_PR_HEAD_SHA??headSha;
    const pr={number:42,head:{ref:mode==='wrong-head'?'feature/x':env.TEST_HEAD_BRANCH??'develop',sha:reviewed},
      base:{ref:'master'},user:{login:'developer',type:'User'},merged_at:'2026-10-01T10:02:00Z',merge_commit_sha:current,
      milestone:mode==='no-milestone'?null:{title:mode==='invalid-title'?'invalid':
        ['override','merge-review','bad-milestone','stale-review','dismissed-review','unauthorized'].includes(mode)?'v2.0.0':'v0.0.1'}};
    if(mode==='api-error')return {status:502,headers:{},body:null};
    const state=JSON.parse(readFileSync(stateFile,'utf8'));
    const save=()=>writeFileSync(stateFile,JSON.stringify(state));
    let body,status=200;
    if(request.method==='GET'){
      if(endpoint==='/repos/acme/consumer')body={default_branch:'master'};
      else if(endpoint.endsWith('/git/ref/heads/master'))body={object:{sha:mode==='remote-stale'?'f'.repeat(40):
        execFileSync('git',['--git-dir='+bare,'rev-parse','refs/heads/master'],{encoding:'utf8'}).trim()}};
      else if(endpoint.includes('/commits/')&&endpoint.endsWith('/pulls'))body=mode==='ambiguous'?[pr,{...pr,number:43}]:[pr];
      else if(endpoint.endsWith('/pulls/42'))body=pr;
      else if(endpoint.endsWith('/timeline'))body=mode==='bad-milestone'?[]:[
        {event:'labeled',label:{name:'versioning:override'},actor:{login:'alice',type:'User'},created_at:'2026-10-01T10:00:00Z'}];
      else if(endpoint.endsWith('/reviews')){
        body=[{state:'APPROVED',user:{login:'bob',type:'User'},submitted_at:'2026-10-01T10:01:00Z',
          commit_id:mode==='stale-review'?'e'.repeat(40):mode==='merge-review'?current:reviewed}];
        if(mode==='dismissed-review')body.push({state:'DISMISSED',user:{login:'bob',type:'User'},
          submitted_at:'2026-10-01T10:02:00Z',commit_id:reviewed});
      } else if(endpoint.includes('/collaborators/'))body={role_name:mode==='unauthorized'?'triage':endpoint.includes('/alice/')?'maintain':'admin'};
      else if(endpoint.endsWith('/check-runs'))body={check_runs:[{id:1,head_sha:current,name:'go-ci',status:'completed',conclusion:'success'}]};
      else if(endpoint.includes('/git/ref/tags/')){body=state.tagSha?{object:{type:'commit',sha:state.tagSha}}:null;if(!body)status=404;}
      else if(endpoint.includes('/releases/tags/')){body=state.release;if(!body)status=404;}
      else throw Error('Unexpected GET '+endpoint);
    } else if(request.method==='POST'){
      appendFileSync(apiWrites,JSON.stringify({endpoint,body:request.body})+'\n');
      if(endpoint.endsWith('/git/refs')){
        if(mode==='race-tag'&&!state.tagSha){state.tagSha=request.body.sha;save();status=422;body={};}
        else if(state.tagSha){status=422;body={};}
        else {state.tagSha=request.body.sha;save();body={};}
      } else if(endpoint.endsWith('/releases')){
        const release={...request.body,html_url:'https://example.test/releases/v0.0.1'};
        if(mode==='race-release'&&!state.release){state.release=release;save();status=422;body={};}
        else if(state.release){status=422;body={};}
        else {state.release=release;save();body=release;}
      } else throw Error('Unexpected POST '+endpoint);
    } else throw Error('Unexpected method '+request.method);
    return {status,headers:{},body};
  });
  const runGate=async(overrides={})=>{
    const env=environment(overrides),directory=mkdtempSync(join(temp,'artifact-')),errors=[];
    env.VERSIONING_OUTPUT_DIR=directory;
    const status=await preparePublicationMain(env,{read:createReadApi(transportFor(env)),error:message=>errors.push(message),
      implementations:{'go-gitsemver':{collect:context=>collectGoVersion(context,{run:request=>runProcess({...request,env})})}}});
    if(status===0){
      const artifact=loadArtifact(directory);
      assert.equal(artifact.report.sha,env.GITHUB_SHA);
      const policy=JSON.parse(readFileSync(join(directory,'release-policy.json'),'utf8'));
      assert.ok(['matched','adapter-authoritative','overridden'].includes(policy.outcome));
      latestPrepared={artifact,trust:writerTrust(artifact,'acme/consumer')};
    }
    return {status,stderr:errors.join('\n')};
  };

  const valid = await runGate();
  assert.equal(valid.status, 0, valid.stderr);
  const staleButReconcilable = await runGate({ FIXTURE_MODE: 'remote-stale' });
  assert.notEqual(staleButReconcilable.status, 0, 'an advanced branch cannot produce fresh evidence; retry the existing writer artifact instead');
  assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'gate must not perform API writes');
  const withoutMilestone = await runGate({ FIXTURE_MODE: 'no-milestone' });
  assert.equal(withoutMilestone.status, 0, withoutMilestone.stderr);
  const authorizedOverride = await runGate({ FIXTURE_MODE: 'override' });
  assert.equal(authorizedOverride.status, 0, authorizedOverride.stderr);
  for (const mode of ['no-milestone', '', 'override']) {
    const hotfixGate = await runGate({ TEST_HEAD_BRANCH: 'hotfix/correct-production', FIXTURE_MODE: mode });
    assert.equal(hotfixGate.status, 0, hotfixGate.stderr);
    assert.throws(() => readFileSync(apiWrites), /ENOENT/);
  }
  for (const overrides of [
    ...['invalid-title', 'bad-milestone', 'stale-review', 'merge-review', 'dismissed-review', 'unauthorized', 'ambiguous', 'api-error'].map(FIXTURE_MODE =>
      ({ TEST_HEAD_BRANCH: 'hotfix/correct-production', FIXTURE_MODE })),
    { TEST_HEAD_BRANCH: 'hotfix' }, { TEST_HEAD_BRANCH: 'hotfix/' }, { TEST_HEAD_BRANCH: 'hotfixes/fix' },
  ]) {
    assert.notEqual((await runGate(overrides)).status, 0, `reject hotfix gate ${JSON.stringify(overrides)}`);
    assert.throws(() => readFileSync(apiWrites), /ENOENT/);
  }
  for (const overrides of [
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF_NAME: 'develop' },
    { GITHUB_SHA: 'd'.repeat(40) },
    { FIXTURE_MODE: 'wrong-head' }, { FIXTURE_MODE: 'ambiguous' },
    { FIXTURE_MODE: 'bad-milestone' }, { FIXTURE_MODE: 'stale-review' },
    { FIXTURE_MODE: 'dismissed-review' },
    { FIXTURE_MODE: 'merge-review' },
    { FIXTURE_MODE: 'unauthorized' }, { FIXTURE_MODE: 'api-error' },
  ]) {
    const failed = await runGate(overrides);
    assert.notEqual(failed.status, 0, `gate must fail for ${JSON.stringify(overrides)}`);
    assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'failure must happen before API writes');
  }

  const setState = value => writeFileSync(stateFile, JSON.stringify(value));
  const getState = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const runPublish=async(overrides={})=>{
    writeFileSync(output,'');
    const env=environment(overrides);
    if(env.FIXTURE_MODE!=='remote-stale'){
      const prepared=await runGate(overrides);
      if(prepared.status!==0)return prepared;
    }
    try {
      assert.ok(latestPrepared,'writer retry requires the originally validated artifact');
      const transport=transportFor(env);
      const result=await publishWriter({repository:workspace,...latestPrepared,read:createReadApi(transport),
        write:createWriteApi(transport),git:createGitPort(workspace),requiredChecks:['go-ci']});
      writeFileSync(output,Object.entries(result.outputs).map(([key,value])=>key+'='+value).join('\n')+'\n');
      return {status:['published','already-published'].includes(result.outcome)?0:1,
        stderr:result.publication?.error??result.outcome};
    } catch(error){return {status:1,stderr:error.message};}
  };

  rmSync(adapterCalls, { force: true }); rmSync(apiWrites, { force: true });
  setState({ tagSha: null, release: null });
  let published = await runPublish();
  assert.equal(published.status, 0, published.stderr);
  const firstOutput = readFileSync(output, 'utf8');
  assert.match(firstOutput, /outcome=published/);
  assert.match(firstOutput, /version=0\.0\.1/);
  assert.match(firstOutput, /tag=v0\.0\.1/);
  assert.equal(getState().tagSha, sha);
  assert.equal(getState().release.target_commitish, sha);
  assert.match(getState().release.body, /native release explanation/);
  assert.equal(readFileSync(adapterCalls, 'utf8').trim().split(/\r?\n/).length, 1,
    'one publication recalculates the integrated SHA exactly once');
  const writesAfterFirst = readFileSync(apiWrites, 'utf8');
  for (let index = 0; index < 10; index += 1) {
    published = await runPublish();
    assert.equal(published.status, 0, published.stderr);
    assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  }
  assert.equal(readFileSync(apiWrites, 'utf8'), writesAfterFirst, 'reruns must not duplicate writes');
  published = await runPublish({ FIXTURE_MODE: 'remote-stale' });
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  assert.equal(readFileSync(apiWrites, 'utf8'), writesAfterFirst,
    'old published push may reconcile without writes after main advances');

  setState({ tagSha: sha, release: null });
  assert.notEqual((await runPublish({ FIXTURE_MODE: 'remote-stale' })).status, 0,
    'old push cannot complete a missing release after main advances');
  assert.equal(getState().release, null);
  published = await runPublish();
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=published/);
  assert.equal(getState().tagSha, sha, 'partial recovery preserves the existing tag');

  setState({ tagSha: 'c'.repeat(40), release: null });
  assert.notEqual((await runPublish()).status, 0, 'a conflicting tag must fail');
  assert.equal(getState().tagSha, 'c'.repeat(40), 'a conflicting tag is never moved');
  setState({ tagSha: null, release: { tag_name: 'v0.0.1', target_commitish: sha,
    html_url: 'https://example.test/releases/v0.0.1', body: 'existing' } });
  assert.notEqual((await runPublish()).status, 0, 'a release without a verifiable tag must fail');
  assert.equal(getState().tagSha, null, 'a release conflict must not create a tag');
  setState({ tagSha: sha, release: { tag_name: 'v0.0.1', target_commitish: 'c'.repeat(40),
    html_url: 'https://example.test/releases/v0.0.1', body: 'divergent' } });
  assert.notEqual((await runPublish()).status, 0, 'a release with a divergent target SHA must fail');
  assert.equal(getState().tagSha, sha, 'a divergent release must not move the correct tag');
  const wrongTagState = { tagSha: sha, release: { tag_name: 'v9.9.9', target_commitish: sha,
    html_url: 'https://example.test/releases/v9.9.9', body: 'wrong version' } };
  setState(wrongTagState);
  const stateBeforeWrongTag = readFileSync(stateFile, 'utf8');
  const writesBeforeWrongTag = readFileSync(apiWrites, 'utf8');
  assert.notEqual((await runPublish()).status, 0,
    'a release with the integrated SHA but a different tag_name must fail');
  assert.equal(readFileSync(stateFile, 'utf8'), stateBeforeWrongTag,
    'a release tag identity conflict must leave remote state byte-for-byte unchanged');
  assert.equal(readFileSync(apiWrites, 'utf8'), writesBeforeWrongTag,
    'a release tag identity conflict must not perform writes');

  setState({ tagSha: null, release: null });
  published = await runPublish({ FIXTURE_MODE: 'race-tag' });
  assert.equal(published.status, 0, published.stderr);
  assert.equal(getState().tagSha, sha, 'tag race reconciles to the integrated SHA');
  setState({ tagSha: sha, release: null });
  published = await runPublish({ FIXTURE_MODE: 'race-release' });
  assert.equal(published.status, 0, published.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  git('checkout', '-b', 'hotfix/publish-real', 'master');
  writeFileSync(join(workspace, 'fix.txt'), 'Production correction\n');
  git('add', 'fix.txt'); git('commit', '-m', 'fix: production correction');
  const hotfixHead = git('rev-parse', 'HEAD');
  git('checkout', 'master');
  git('merge', '--no-ff', 'hotfix/publish-real', '-m', 'Merge hotfix');
  const hotfixMerge = git('rev-parse', 'HEAD');
  assert.notEqual(hotfixHead, hotfixMerge);
  git('push', 'origin', 'master');
  for (const FIXTURE_MODE of ['no-milestone', '', 'override']) {
    setState({ tagSha: null, release: null });
    const config = { TEST_HEAD_BRANCH: 'hotfix/publish-real', TEST_PR_HEAD_SHA: hotfixHead,
      GITHUB_SHA: hotfixMerge, FIXTURE_MODE };
    const hotfixPublished = await runPublish(config);
    assert.equal(hotfixPublished.status, 0, hotfixPublished.stderr);
    assert.match(readFileSync(output, 'utf8'), /outcome=published/);
    assert.equal(getState().tagSha, hotfixMerge);
    assert.equal(getState().release.target_commitish, hotfixMerge);
    const beforeRetry = readFileSync(apiWrites, 'utf8');
    assert.equal((await runPublish(config)).status, 0);
    assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
    assert.equal(readFileSync(apiWrites, 'utf8'), beforeRetry);
  }
  console.log('Pós-merge: proveniência, policy e publicação idempotente aprovadas');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
