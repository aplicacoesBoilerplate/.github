import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculateGo } from '../../scripts/versioning/adapters/go-gitsemver.mjs';
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
  console.log('Go adapter composition contract passed');
} finally {rmSync(repo,{recursive:true,force:true});}
