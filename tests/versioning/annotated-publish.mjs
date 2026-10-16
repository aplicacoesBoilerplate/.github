import assert from 'node:assert/strict';
import { spawnSync,execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import {captureGitInputs} from '../../scripts/versioning/git-inputs.mjs';
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
  const gh=join(bin,'gh');
  const ghCode=[
    '#!/usr/bin/env node',
    'const fs=require("fs"),a=process.argv.slice(2),p=a.find(v=>v.startsWith("repos/")),s=JSON.parse(fs.readFileSync(process.env.STATE_FILE));',
    'const sha=process.env.GITHUB_SHA,head=process.env.PR_HEAD;',
    'const save=()=>fs.writeFileSync(process.env.STATE_FILE,JSON.stringify(s));',
    'const write=()=>{const w=JSON.parse(fs.readFileSync(process.env.WRITES_FILE));w.push(a);fs.writeFileSync(process.env.WRITES_FILE,JSON.stringify(w));};',
    'const emit=v=>{console.log(typeof v==="string"?v:JSON.stringify(v));process.exit(0)};',
    'const absent=()=>{console.error("gh: Not Found (HTTP 404)");process.exit(1)};',
    'const value=k=>a.find(v=>v.startsWith(k+"="))?.slice(k.length+1);',
    'if(p==="repos/acme/java")emit("master");',
    'if(p.endsWith("/git/ref/heads/master"))emit(sha);',
    'if(p.includes("/commits/")&&p.includes("/pulls"))emit([[{number:42,head:{ref:"develop",sha:head},base:{ref:"master"},merged_at:"2026-10-12T00:00:00Z",merge_commit_sha:sha}]]);',
    'if(p.endsWith("/pulls/42"))emit({number:42,head:{ref:"develop",sha:head},base:{ref:"master"},milestone:process.env.TEST_MILESTONE?{title:process.env.TEST_MILESTONE}:null,merged_at:"2026-10-12T00:00:00Z",merge_commit_sha:sha});',
    'if(p.includes("/timeline")||p.includes("/reviews"))emit([[]]);',
    'if(p.includes("/git/ref/tags/")){if(!s.tag)absent();emit({object:{type:s.object?"tag":"commit",sha:s.object??s.tag}})}',
    'if(p.includes("/git/tags/"))emit({object:{type:"commit",sha:s.tag}});',
    'if(p.includes("/releases/tags/")){if(!s.release)absent();emit(s.release)}',
    'if(a.includes("POST")&&p.endsWith("/git/tags")){write();s.object="d".repeat(40);s.tag=value("object");save();emit({sha:s.object})}',
    'if(a.includes("POST")&&p.endsWith("/git/refs")){write();if(value("sha")!==s.object)process.exit(3);save();emit({})}',
    'if(a.includes("POST")&&p.endsWith("/releases")){write();s.release={tag_name:value("tag_name"),target_commitish:value("target_commitish"),html_url:"https://example.test/release"};save();emit(s.release)}',
    'console.error("unexpected "+a.join(" "));process.exit(2);'
  ].join('\n');
  writeFileSync(gh,ghCode);chmodSync(gh,0o755);
  writeFileSync(stateFile,JSON.stringify({tag:null,object:null,release:null}));writeFileSync(writesFile,'[]');
  const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
  const run=(overrides={})=>spawnSync(shell,[join(root,'scripts/versioning/publish.sh')],{cwd:repo,encoding:'utf8',timeout:180000,
    env:{...process.env,PATH:bin+(process.platform==='win32'?';':':')+process.env.PATH,ADAPTER:'jgitver',
      PROJECT_PATH:'.',TARGET_BRANCH:'master',GITHUB_WORKSPACE:repo,GITHUB_REPOSITORY:'acme/java',
      GITHUB_SHA:sha,GITHUB_REF_NAME:'master',GITHUB_EVENT_NAME:'push',GH_TOKEN:'fixture',
      STATE_FILE:stateFile,WRITES_FILE:writesFile,PR_HEAD:head,GITHUB_OUTPUT:output,...overrides}});
  const result=run();assert.equal(result.status,0,result.stderr);
  let state=JSON.parse(readFileSync(stateFile));assert.equal(state.tag,sha);assert.equal(state.object,'d'.repeat(40));
  assert.equal(state.release.tag_name,'v0.0.1');assert.equal(state.release.target_commitish,sha);
  const writes=readFileSync(writesFile,'utf8');assert.equal(JSON.parse(writes).length,3);
  assert.equal(run().status,0);assert.equal(readFileSync(writesFile,'utf8'),writes);
  assert.match(readFileSync(output,'utf8'),/outcome=already-published/);
  state={...state,tag:'b'.repeat(40)};writeFileSync(stateFile,JSON.stringify(state));
  assert.notEqual(run().status,0);assert.equal(readFileSync(writesFile,'utf8'),writes);
  state.tag=sha;writeFileSync(stateFile,JSON.stringify(state));
  const prepared=join(temp,'validated-report.json');
  const report={schemaVersion:1,adapter:'jgitver',sha,branch:'master',baseVersion:'0.0.0',candidateVersion:'0.0.1',
    tag:'v0.0.1',tagKind:'annotated',bump:'patch',native:{format:'java-properties',explanation:'validated native evidence',
      result:{'jgitver.used_version':'0.0.1','jgitver.calculated_version':'0.0.1','jgitver.git_sha1_full':sha,'jgitver.plugin-version':'1.9.0'}}};
  writeFileSync(prepared,JSON.stringify(report));writeFileSync(mvn,'#!/usr/bin/env node\nprocess.exit(99);\n');
  const snapshot=join(temp,'git-inputs.json');writeFileSync(snapshot,JSON.stringify(captureGitInputs(repo,'jgitver')));
  const preparedConfig={VERSIONING_PRECOMPUTED_REPORT:prepared,VERSIONING_INPUTS_SNAPSHOT:snapshot};
  assert.equal(run(preparedConfig).status,0,'write phase must not execute Maven');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  git('tag','1.0.0');
  assert.notEqual(run(preparedConfig).status,0,'refs changed after calculation must block');
  assert.equal(readFileSync(writesFile,'utf8'),writes);git('tag','-d','1.0.0');
  assert.notEqual(run({...preparedConfig,TEST_MILESTONE:'v1.0.0'}).status,0,'live policy still revalidated');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  writeFileSync(prepared,JSON.stringify({...report,sha:'c'.repeat(40)}));
  assert.notEqual(run({VERSIONING_PRECOMPUTED_REPORT:prepared}).status,0,'tampered SHA rejected');
  assert.equal(readFileSync(writesFile,'utf8'),writes);
  console.log('Annotated Maven publication: creation, peeling, retry and conflict passed');
}finally{rmSync(temp,{recursive:true,force:true});}
