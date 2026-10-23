import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { preparePublicationMain } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
import { runPublish } from '../../scripts/versioning/dist/entrypoints/publish.js';
import { createReadApi, createWriteApi } from '../../scripts/versioning/dist/ports/github.js';
import { createGitPort } from '../../scripts/versioning/dist/ports/git.js';
import { loadArtifact } from '../../scripts/versioning/dist/services/publication-artifact.js';
import { producerTransport, writerTrust } from './publication-fixture.mjs';

/** Git-backed REST fixture: blobs/trees/commits are real, not invented SHA placeholders. */
export function technicalFlowFixture({ workspace, bare, temp, adapter, binary, statePath, outputPath }) {
  const centralSha = 'c'.repeat(40), repository = 'acme/consumer';
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
  const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
  const save = value => writeFileSync(statePath, JSON.stringify(value));
  let functionalDirectory, cachedPublication;
  const functional = () => ({ number:12, head:{ref:'develop',sha:state().originSha}, base:{ref:'master'},
    user:{login:'developer',type:'User'}, milestone:null, merged_at:'2026-10-09T11:00:00Z', merge_commit_sha:state().originSha });
  const technical = () => {
    const s=state();if(!s.pr)return null;
    return { number:13, title:s.pr.title, body:s.pr.body, html_url:'https://example.test/pull/13',
      state:s.versionMergeSha?'closed':'open', merged_at:s.versionMergeSha?'2026-10-09T12:00:00Z':null,
      merge_commit_sha:s.versionMergeSha??null, commits:1, head:{ref:s.pr.branch,sha:s.versionHeadSha??git('rev-parse',s.pr.branch)},
      base:{ref:'master',sha:s.originSha},user:{login:'test-app[bot]',type:'Bot'} };
  };
  const apiFor=env=>{
    const s=state();
    const native=async request=>{
      const url=new URL(request.url),path=decodeURIComponent(url.pathname.replace('/repos/'+repository+'/', ''));
      const current=state();let body,status=200;
      if(request.method==='GET'){
        if(url.pathname==='/repos/'+repository)body={default_branch:'master'};
        else if(path.startsWith('git/ref/heads/')){
          const branch=path.slice('git/ref/heads/'.length);
          try { body={object:{sha:branch==='master'?(env.MOCK_REMOTE_SHA??execFileSync('git',
            ['--git-dir='+bare,'rev-parse','refs/heads/master'],{encoding:'utf8'}).trim()):git('rev-parse','refs/heads/'+branch)}}; }
          catch { status=404;body={}; }
        } else if(path.startsWith('git/commits/')){
          const sha=path.slice('git/commits/'.length);
          body={sha,tree:{sha:git('rev-parse',sha+'^{tree}')},message:git('log','-1','--format=%B',sha),
            parents:git('rev-list','--parents','-n','1',sha).split(' ').slice(1).map(sha=>({sha}))};
        } else if(path==='pulls')body=technical()?[technical()]:[];
        else if(path==='pulls/12')body=functional();
        else if(path==='pulls/13')body=technical();
        else if(/^commits\/[0-9a-f]{40}\/pulls$/.test(path)){
          const sha=path.split('/')[1];body=sha===current.originSha?[functional()]:sha===current.versionMergeSha?[technical()]:[];
        } else if(path==='pulls/13/reviews')body=[{id:1,state:'APPROVED',commit_id:technical().head.sha,
          submitted_at:'2026-10-09T12:01:00Z',user:current.reviewMode==='bot'?{login:'other[bot]',type:'Bot'}:{login:'maintainer',type:'User'}}];
        else if(path.endsWith('/timeline')||path.endsWith('/reviews'))body=[];
        else if(path.endsWith('/check-runs'))body={check_runs:[{id:1,head_sha:path.split('/')[1],name:'build',status:'completed',conclusion:'success'}]};
        else if(path.startsWith('git/ref/tags/')){
          const tag=path.slice('git/ref/tags/'.length),sha=adapter==='standard-version'?current.tagSha:current.tags?.[tag];
          if(!sha){status=404;body={};}else body={object:{type:'commit',sha}};
        } else if(path.startsWith('releases/tags/')){
          body=adapter==='standard-version'?current.release:current.releases?.[path.slice('releases/tags/'.length)];if(!body){status=404;body={};}
        } else throw Error('Unexpected GET '+path);
      } else if(request.method==='POST'){
        const value=request.body;
        if(path==='git/blobs')body={sha:execFileSync('git',['hash-object','-w','--stdin'],{cwd:workspace,
          input:Buffer.from(value.content,'base64'),encoding:'utf8'}).trim()};
        else if(path==='git/trees'){
          const index=join(temp,'api-index'),options={cwd:workspace,env:{...process.env,GIT_INDEX_FILE:index},encoding:'utf8'};
          try {
            execFileSync('git',['read-tree',value.base_tree],options);
            for(const item of value.tree)execFileSync('git',item.sha===null?['update-index','--force-remove','--',item.path]:
              ['update-index','--add','--cacheinfo',item.mode+','+item.sha+','+item.path],options);
            body={sha:execFileSync('git',['write-tree'],options).trim()};
          } finally {rmSync(index,{force:true});}
        } else if(path==='git/commits'){
          const sha=execFileSync('git',['commit-tree',value.tree,...value.parents.flatMap(parent=>['-p',parent])],
            {cwd:workspace,input:value.message,encoding:'utf8',env:{...process.env,
              GIT_AUTHOR_NAME:'Versioning',GIT_AUTHOR_EMAIL:'versioning@example.test',
              GIT_COMMITTER_NAME:'Versioning',GIT_COMMITTER_EMAIL:'versioning@example.test'}}).trim();body={sha};
        } else if(path==='git/refs'){
          if(value.ref.startsWith('refs/heads/'))git('update-ref',value.ref,value.sha,'0'.repeat(40));
          else if(adapter==='standard-version')current.tagSha=value.sha;
          else {current.tags??={};current.tags[value.ref.slice('refs/tags/'.length)]=value.sha;}
          save(current);body={object:{sha:value.sha}};
        } else if(path==='pulls'){
          current.pr={branch:value.head,body:value.body,title:value.title};save(current);body=technical();
        } else if(path==='releases'){
          body={...value,html_url:'https://example.test/releases/'+encodeURIComponent(value.tag_name)};
          if(adapter==='standard-version')current.release=body;
          else {current.releases??={};current.releases[value.tag_name]=body;}
          save(current);
        } else throw Error('Unexpected POST '+path);
      } else if(request.method==='PATCH'){
        if(path.startsWith('git/refs/heads/')){
          const branch=path.slice('git/refs/heads/'.length),old=git('rev-parse','refs/heads/'+branch);
          assert.equal(request.body.force,false);git('merge-base','--is-ancestor',old,request.body.sha);
          git('update-ref','refs/heads/'+branch,request.body.sha,old);body={object:{sha:request.body.sha}};
        } else if(path==='pulls/13'){current.pr={...current.pr,...request.body};save(current);body=technical();}
        else throw Error('Unexpected PATCH '+path);
      } else throw Error('Unexpected method '+request.method);
      return {status,headers:{},body};
    };
    return producerTransport({repository,sha:s.originSha,centralSha,runId:77,artifactId:500},
      producerTransport({repository,sha:s.versionMergeSha??env.GITHUB_SHA,centralSha,runId:78,artifactId:501},native));
  };
  function restoreFunctional(artifact){
    const operations=artifact.bundle.schemaVersion===1?artifact.bundle.files:artifact.bundle.operations;
    for(const item of operations){
      if(!git('ls-tree',artifact.plan.sha,'--',item.path)){rmSync(join(workspace,item.path),{force:true});continue;}
      writeFileSync(join(workspace,item.path),execFileSync('git',['show',artifact.plan.sha+':'+item.path],{cwd:workspace}));
    }
  }
  return async function run(phase='prepare',overrides={}){
    const s=state(),sha=overrides.GITHUB_SHA??s.originSha,isTechnical=sha!==s.originSha;
    const env={...process.env,GITHUB_REPOSITORY:repository,GITHUB_WORKSPACE:workspace,GITHUB_SHA:sha,
      GITHUB_EVENT_NAME:'push',GITHUB_REF_NAME:'master',TARGET_BRANCH:'master',ADAPTER:adapter,ADAPTER_BIN:binary,
      PROJECT_PATH:'.',TAG_PREFIX:'v',GH_TOKEN:'fixture',GITHUB_RUN_ID:isTechnical?'78':'77',GITHUB_RUN_ATTEMPT:'1',
      GITHUB_JOB:'validate-publication',CENTRAL_SHA:centralSha,CENTRAL_REPOSITORY:'aplicacoesBoilerplate/.github',
      VERSIONING_BOT_LOGIN:'test-app[bot]',REQUIRED_CHECKS:'build',...overrides};
    const api=apiFor(env),read=createReadApi(api);let artifact,trust;
    const nativeSource=readFileSync(binary);
    try {
      const remote=env.MOCK_REMOTE_SHA??execFileSync('git',['--git-dir='+bare,'rev-parse','refs/heads/master'],{encoding:'utf8'}).trim();
      if(isTechnical&&remote!==sha&&cachedPublication?.trust.publishedSha===sha){({artifact,trust}=cachedPublication);}
      else {
        const directory=mkdtempSync(join(temp,'artifact-'));env.VERSIONING_OUTPUT_DIR=directory;
        if(isTechnical)env.VERSIONING_ORIGIN_DIR=functionalDirectory;
        const errors=[],status=await preparePublicationMain(env,{read,error:message=>errors.push(message)});
        if(status!==0)return {status,stderr:errors.join('\n'),stdout:''};
        artifact=loadArtifact(directory);trust=writerTrust(artifact,repository,{artifactId:isTechnical?501:500,botLogin:'test-app[bot]'});
        if(!isTechnical){functionalDirectory=directory;restoreFunctional(artifact);}
        else cachedPublication={artifact,trust};
      }
      if(process.env.TEST_PRECOMPUTED_MODE==='1')writeFileSync(binary,'#!/usr/bin/env node\nprocess.exit(97);\n');
      // This negative is now a poisoned artifact: the writer must never recalculate a native version.
      if(overrides.MOCK_BAD_NATIVE)artifact={...artifact,report:{...artifact.report,native:{...artifact.report.native,result:{version:'1.0.2'}}}};
      const result=await runPublish({repository:workspace,trust,artifact,read,write:createWriteApi(api),
        git:createGitPort(workspace),requiredChecks:['build'],technicalTransport:api});
      writeFileSync(outputPath,Object.entries(result.outputs).map(([key,value])=>key+'='+value).join('\n')+'\n');
      return {status:['pending-version-pr','published','already-published'].includes(result.outcome)?0:1,
        stdout:result.technicalPr?.outcome??result.outcome,stderr:result.publication?.error??result.outcome,artifact,...result};
    } catch(error){return {status:1,stderr:error.message,stdout:''};}
    finally {if(existsSync(binary))writeFileSync(binary,nativeSource);}
  };
}
