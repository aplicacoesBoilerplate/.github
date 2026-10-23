import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculateGo } from '../../scripts/versioning/adapters/go-gitsemver.mjs';
import { collectGoVersion } from '../../scripts/versioning/dist/adapters/go-gitsemver.js';
import { adapterCapabilities, planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
const repo=mkdtempSync(join(tmpdir(),'go-adapter-'));
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
try {
  git('init','-q'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.test');
  git('commit','--allow-empty','-qm','chore: bootstrap');
  const sha=git('rev-parse','HEAD');
  const context={workspace:repo,projectDirectory:repo,targetBranch:'master',sha,adapterBin:'go-tool'};
  let invoked;
  const report=calculateGo(context,{run:request=>{
    invoked=request; return {stdout:JSON.stringify({SemVer:'0.0.1',Sha:sha}),stderr:'native evidence'};
  }});
  assert.deepEqual(invoked.args,['--branch','master','--commit',sha,'-o','json','--explain']);
  assert.equal(invoked.command,'go-tool'); assert.equal(invoked.cwd,repo);
  assert.deepEqual({version:report.candidateVersion,sha:report.sha,bump:report.bump,native:report.native},
    {version:'0.0.1',sha,bump:'patch',native:{format:'json',result:{SemVer:'0.0.1',Sha:sha},explanation:'native evidence'}});
  assert.throws(()=>calculateGo(context,{run:()=>({stdout:'not json',stderr:''})}),/JSON nativo inválido/);
  assert.throws(()=>calculateGo(context,{run:()=>({stdout:JSON.stringify({SemVer:'0.0.1',Sha:'a'.repeat(40)}),stderr:''})}),/SHA calculado diverge/);
  assert.throws(()=>calculateGo(context,{run:()=>{throw Error('timeout');}}),/timeout/);
  const typedContext={repository:repo,workspace:repo,projectPath:'.',targetBranch:'master',sha,
    tagPrefix:'v',configuration:{adapterBin:'go-tool'}};
  const typed=collectGoVersion(typedContext,{run:request=>{
    invoked=request;return {stdout:JSON.stringify({SemVer:'0.0.1',Sha:sha}),stderr:'native evidence'};
  }});
  assert.equal(typed.candidateVersion,'0.0.1');
  assert.deepEqual(invoked.args,['--branch','master','--commit',sha,'-o','json','--explain']);
  assert.equal(invoked.cwd,repo);
  assert.throws(()=>collectGoVersion(typedContext,{run:()=>({stdout:'bad json',stderr:''})}),/JSON nativo inválido/);
  assert.throws(()=>collectGoVersion(typedContext,{run:()=>({stdout:JSON.stringify({SemVer:'0.0.1',Sha:'b'.repeat(40)}),stderr:''})}),/SHA calculado diverge/);
  assert.throws(()=>collectGoVersion(typedContext,{run:()=>({stdout:JSON.stringify({SemVer:'0.0.2',Sha:sha}),stderr:''})}),/somente 0.0.1/);
  assert.throws(()=>collectGoVersion({...typedContext,tagPrefix:'release-'},{run:()=>{throw Error('should not run')}}),/prefixo v/);
  assert.throws(()=>collectGoVersion(typedContext,{run:()=>({stdout:JSON.stringify({SemVer:'0.0.1',Sha:''}),stderr:''})}),/SHA nativo vazio/);
  git('tag','v0.0.1',sha);
  const retry=collectGoVersion(typedContext,{run:()=>({stdout:JSON.stringify({SemVer:'0.0.1',Sha:''}),stderr:''})});
  assert.equal(retry.candidateVersion,'0.0.1');
  const retriedPlan=planFromReport(retry,validateDescriptor({id:'go-gitsemver',
    ...adapterCapabilities['go-gitsemver'],collect(){}}),'.');
  assert.equal(retriedPlan.entries[0].bump,'none');
  assert.equal(retriedPlan.status,'release');
  git('commit','--allow-empty','-qm','fix: subsequent');
  const nextSha=git('rev-parse','HEAD');
  const next=collectGoVersion({...typedContext,sha:nextSha},{run:()=>({stdout:JSON.stringify({SemVer:'0.0.2',Sha:nextSha}),stderr:''})});
  assert.equal(next.baseVersion,'0.0.1');
  assert.equal(next.candidateVersion,'0.0.2');
  console.log('Go adapter composition contract passed');
} finally {rmSync(repo,{recursive:true,force:true});}
