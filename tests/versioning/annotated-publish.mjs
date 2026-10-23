import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { preparePublicationMain } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
import { runPublish } from '../../scripts/versioning/dist/entrypoints/publish.js';
import { collectJgitverReport } from '../../scripts/versioning/dist/adapters/jgitver.js';
import { runProcess } from '../../scripts/versioning/dist/ports/process.js';
import { createGitPort } from '../../scripts/versioning/dist/ports/git.js';
import { createReadApi, createWriteApi } from '../../scripts/versioning/dist/ports/github.js';
import { loadArtifact } from '../../scripts/versioning/dist/services/publication-artifact.js';
import { producerTransport, writerTrust } from './publication-fixture.mjs';
const root=resolve(import.meta.dirname,'../..'),temp=mkdtempSync(join(tmpdir(),'annotated-publish-'));
const repo=join(temp,'repo'),bin=join(temp,'bin'),stateFile=join(temp,'state.json'),writesFile=join(temp,'writes.json'),output=join(temp,'output.txt');
mkdirSync(repo);mkdirSync(bin);mkdirSync(join(repo,'.mvn'));
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
try{
  git('init','-q','-b','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  writeFileSync(join(repo,'pom.xml'),'<project/>');
  writeFileSync(join(repo,'.mvn/extensions.xml'),'<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>');
  git('add','.');git('commit','-qm','chore: baseline');git('checkout','-qb','develop');
  writeFileSync(join(repo,'change.txt'),'delivery');git('add','.');git('commit','-qm','feat: package delivery');
  const head=git('rev-parse','HEAD');git('checkout','-q','master');git('merge','-q','--no-ff','develop','-m','Merge develop');
  const sha=git('rev-parse','HEAD');
  const mvn=join(bin,'mvn');
  writeFileSync(mvn,'#!/usr/bin/env node\n'+
    'if(process.env.GH_TOKEN)process.exit(9);\n'+
    'const fs=require("fs"),a=process.argv.slice(2),p=a.find(v=>v.startsWith("-Djgitver.export-properties-path=")).split("=")[1];\n'+
    'fs.writeFileSync(p,"jgitver.used_version=0.0.1\\njgitver.calculated_version=0.0.1\\njgitver.plugin-version=1.9.0\\njgitver.git_sha1_full="+process.env.GITHUB_SHA+"\\n");\n');
  chmodSync(mvn,0o755);
  writeFileSync(stateFile,JSON.stringify({tag:null,object:null,ref:false,release:null}));writeFileSync(writesFile,'[]');
  const centralSha='c'.repeat(40);
  let preparedArtifact=null,preparedTrust=null;
  const run=async(overrides={})=>{
    const env={...process.env,ADAPTER:'jgitver',ADAPTER_BIN:mvn,PROJECT_PATH:'.',TARGET_BRANCH:'master',
      GITHUB_WORKSPACE:repo,GITHUB_REPOSITORY:'acme/java',GITHUB_SHA:sha,GITHUB_REF_NAME:'master',
      GITHUB_EVENT_NAME:'push',GH_TOKEN:'fixture',GITHUB_RUN_ID:'77',GITHUB_RUN_ATTEMPT:'1',
      GITHUB_JOB:'validate-publication',CENTRAL_SHA:centralSha,REQUIRED_CHECKS:'java-ci',...overrides};
    const pr={number:42,head:{ref:'develop',sha:head},base:{ref:'master'},user:{login:'developer',type:'User'},
      milestone:env.TEST_MILESTONE?{title:env.TEST_MILESTONE}:null,merged_at:'2026-10-12T00:00:00Z',merge_commit_sha:sha};
    const api=producerTransport({repository:'acme/java',sha,centralSha},async request=>{
      const path=new URL(request.url).pathname,s=JSON.parse(readFileSync(stateFile));
      const save=()=>writeFileSync(stateFile,JSON.stringify(s));
      let body,status=200;
      if(request.method==='GET'){
        if(path==='/repos/acme/java')body={default_branch:'master'};
        else if(path.endsWith('/git/ref/heads/master'))body={object:{sha}};
        else if(path.includes('/commits/')&&path.endsWith('/pulls'))body=[pr];
        else if(path.endsWith('/pulls/42'))body=pr;
        else if(path.endsWith('/timeline')||path.endsWith('/reviews'))body=[];
        else if(path.endsWith('/check-runs'))body={check_runs:[{id:1,head_sha:sha,name:'java-ci',status:'completed',conclusion:'success'}]};
        else if(path.includes('/git/ref/tags/')){
          body=s.ref?{object:{type:s.object?'tag':'commit',sha:s.object??s.tag}}:null;if(!body)status=404;
        } else if(path.includes('/git/tags/'))body={object:{type:'commit',sha:s.tag}};
        else if(path.includes('/releases/tags/')){body=s.release;if(!body)status=404;}
        else throw Error('Unexpected GET '+path);
      } else if(request.method==='POST'){
        const writes=JSON.parse(readFileSync(writesFile));writes.push({path,body:request.body});
        writeFileSync(writesFile,JSON.stringify(writes));
        if(path.endsWith('/git/tags')){s.object='d'.repeat(40);s.tag=request.body.object;save();body={sha:s.object};}
        else if(path.endsWith('/git/refs')){assert.equal(request.body.sha,s.object);s.ref=true;save();body={};}
        else if(path.endsWith('/releases')){s.release={...request.body,html_url:'https://example.test/release'};save();body=s.release;}
        else throw Error('Unexpected POST '+path);
      } else throw Error('Unexpected method '+request.method);
      return {status,headers:{},body};
    });
    const read=createReadApi(api),errors=[];
    if(!overrides.preparedPath){
      env.VERSIONING_OUTPUT_DIR=mkdtempSync(join(temp,'artifact-'));
      const status=await preparePublicationMain(env,{read,error:message=>errors.push(message),
        implementations:{jgitver:{collect:context=>collectJgitverReport(context,{run:request=>runProcess({...request,env})})}}});
      if(status!==0)return {status,stderr:errors.join('\n')};
      preparedArtifact=loadArtifact(env.VERSIONING_OUTPUT_DIR);preparedTrust=writerTrust(preparedArtifact,'acme/java');
    }
    try {
      const artifact=overrides.preparedPath?JSON.parse(readFileSync(overrides.preparedPath,'utf8')):preparedArtifact;
      const result=await runPublish({repository:repo,trust:preparedTrust,artifact,read,write:createWriteApi(api),
        git:createGitPort(repo),requiredChecks:['java-ci']});
      writeFileSync(output,Object.entries(result.outputs).map(([key,value])=>key+'='+value).join('\n')+'\n');
      return {status:['published','already-published'].includes(result.outcome)?0:1,stderr:result.publication?.error??result.outcome};
    } catch(error){return {status:1,stderr:error.message};}
  };
  const result=await run();assert.equal(result.status,0,result.stderr);
  let state=JSON.parse(readFileSync(stateFile));assert.equal(state.tag,sha);assert.equal(state.object,'d'.repeat(40));
  assert.equal(state.release.tag_name,'v0.0.1');assert.equal(state.release.target_commitish,sha);
  const writes=readFileSync(writesFile,'utf8');assert.equal(JSON.parse(writes).length,3);
  assert.equal((await run()).status,0);assert.equal(readFileSync(writesFile,'utf8'),writes);
  assert.match(readFileSync(output,'utf8'),/outcome=already-published/);
  state={...state,tag:'b'.repeat(40)};writeFileSync(stateFile,JSON.stringify(state));
  assert.notEqual((await run()).status,0);assert.equal(readFileSync(writesFile,'utf8'),writes);
  state.tag=sha;writeFileSync(stateFile,JSON.stringify(state));
  const prepared=join(temp,'validated-artifact.json');
  writeFileSync(prepared,JSON.stringify(preparedArtifact));
  writeFileSync(mvn,'#!/usr/bin/env node\nprocess.exit(99);\n');
  const preparedConfig={preparedPath:prepared};
  assert.equal((await run(preparedConfig)).status,0,'write phase must not execute Maven');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  git('tag','1.0.0');
  assert.notEqual((await run(preparedConfig)).status,0,'refs changed after calculation must block');
  assert.equal(readFileSync(writesFile,'utf8'),writes);git('tag','-d','1.0.0');
  assert.notEqual((await run({...preparedConfig,TEST_MILESTONE:'v1.0.0'})).status,0,'live policy still revalidated');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  writeFileSync(prepared,JSON.stringify({...preparedArtifact,report:{...preparedArtifact.report,sha:'c'.repeat(40)}}));
  assert.notEqual((await run(preparedConfig)).status,0,'tampered SHA rejected');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  console.log('Annotated Maven publication: creation, peeling, retry and conflict passed');
}finally{rmSync(temp,{recursive:true,force:true});}
