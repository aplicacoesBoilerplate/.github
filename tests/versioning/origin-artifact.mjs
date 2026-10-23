import assert from 'node:assert/strict';
import { resolveOriginArtifact, resolvePushOrigin, resolveOriginMain } from '../../scripts/versioning/dist/entrypoints/resolve-origin.js';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sha='a'.repeat(40), central='c'.repeat(40), head='d'.repeat(40);
const source={repository:'acme/app',artifactId:500,runId:77,runAttempt:1,centralSha:central,
  planDigest:'e'.repeat(64),payloadDigest:'f'.repeat(64)};
const marker={originPrNumber:7,functionalSha:sha,planDigest:source.planDigest,
  bundleDigest:'b'.repeat(64),headSha:head,treeSha:'9'.repeat(40),sourceArtifact:source};
const state={branch:'versioning/release-please/identity',expired:false,job:'versioning / validate-publication',
  centralSha:central,body:marker,associated:1,integratedSha:'9'.repeat(40)};
const read={async get(endpoint){
  if(endpoint.endsWith('/pulls/9'))return {number:9,head:{ref:state.branch,sha:head},base:{ref:'master'},
    user:{login:'release-bot[bot]',type:'Bot'},body:`<!-- central-versioning\n${JSON.stringify(state.body)}\n-->`};
  if(endpoint.endsWith('/actions/artifacts/500'))return {id:500,name:'publication-77-1',expired:state.expired,
    size_in_bytes:400,workflow_run:{id:77,head_sha:sha}};
  if(endpoint.endsWith('/actions/runs/77/attempts/1'))return {id:77,run_attempt:1,head_sha:sha,
    head_branch:'master',event:'push',referenced_workflows:[{
      path:'acme/central/.github/workflows/version-publish.yml@refs/heads/master',sha:state.centralSha}]};
  throw Error(`unexpected GET ${endpoint}`);
},async list(endpoint){assert.match(endpoint,/commits\/9{40}\/pulls/);return Array.from({length:state.associated},
  ()=>({number:9,merged_at:'2026-10-22T00:00:00Z',merge_commit_sha:state.integratedSha,
    base:{ref:'master'},head:{sha:head}}));},
async listField(endpoint,field){assert.equal(field,'jobs');return [{id:10,name:state.job,
  run_id:77,head_sha:sha,status:'completed',conclusion:'success'}];}};
const request=()=>({owner:'acme',repo:'app',targetBranch:'master',adapter:'release-please',
  centralSha:central,centralRepository:'acme/central',prNumber:9,expectedHeadSha:head,read});
const result=await resolveOriginArtifact(request());
assert.deepEqual(result.source,source);
assert.equal(result.originPrNumber,7);assert.equal(result.functionalSha,sha);
assert.equal(result.technicalPrNumber,9);assert.equal(result.botLogin,'release-bot[bot]');
const pushRequest=()=>({...request(),publishedSha:'9'.repeat(40)});
assert.equal((await resolvePushOrigin(pushRequest())).source.artifactId,500);
state.associated=2;await assert.rejects(resolvePushOrigin(pushRequest()),/ambígua|associação/i);
state.associated=0;await assert.rejects(resolvePushOrigin(pushRequest()),/ambígua|associação/i);
state.associated=1;state.integratedSha=sha;
await assert.rejects(resolvePushOrigin(pushRequest()),/ambígua|associação/i);
state.integratedSha='9'.repeat(40);
const directory=mkdtempSync(join(tmpdir(),'resolve-push-'));
try {
  const event=join(directory,'event.json'),output=join(directory,'outputs.txt');let error='';
  writeFileSync(event,'{}');
  assert.equal(await resolveOriginMain({GITHUB_EVENT_NAME:'push',GITHUB_REF_NAME:'master',
    GITHUB_SHA:'9'.repeat(40),GITHUB_EVENT_PATH:event,GITHUB_OUTPUT:output,GITHUB_REPOSITORY:'acme/app',
    TARGET_BRANCH:'master',ADAPTER:'release-please',CENTRAL_SHA:central,CENTRAL_REPOSITORY:'acme/central'},
  {read,error:value=>{error=value;}}),0,error);
  assert.equal(readFileSync(output,'utf8'),'technical=true\nartifact_id=500\nrun_id=77\nbot_login=release-bot[bot]\n');
} finally {rmSync(directory,{recursive:true,force:true});}
state.branch='develop';assert.equal(await resolveOriginArtifact(request()),null);
state.branch='versioning/release-please/identity';
state.expired=true;await assert.rejects(resolveOriginArtifact(request()),/expirado|artifact/i);state.expired=false;
state.centralSha='1'.repeat(40);await assert.rejects(resolveOriginArtifact(request()),/central|produtor/i);
state.centralSha=central;state.job='other';await assert.rejects(resolveOriginArtifact(request()),/job|produtor/i);
state.job='versioning / validate-publication';
state.body={...marker,sourceArtifact:undefined};await assert.rejects(resolveOriginArtifact(request()),/artifact|origem/i);
state.body={...marker,planDigest:'1'.repeat(64)};await assert.rejects(resolveOriginArtifact(request()),/plano|identidade/i);
state.body=marker;
await assert.rejects(resolveOriginArtifact({...request(),expectedHeadSha:'2'.repeat(40)}),/head|SHA/i);
await assert.rejects(resolveOriginArtifact({...request(),adapter:'go-gitsemver'}),/adaptador|técnic/i);
console.log('Origin artifact: functional bypass, technical pointer, producer, central SHA and stale metadata');
