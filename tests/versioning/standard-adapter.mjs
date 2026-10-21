import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {calculateStandardVersion} from '../../scripts/versioning/adapters/standard-version.mjs';
import {collectStandardVersion} from '../../scripts/versioning/dist/adapters/standard-version.js';
const repo=mkdtempSync(join(tmpdir(),'standard-adapter-'));
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
try{
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  git('commit','--allow-empty','-qm','fix: change');git('tag','infra/v1.0.0');
  const sha=git('rev-parse','HEAD'),context={workspace:repo,projectDirectory:repo,sha,targetBranch:'master',tagPrefix:'infra/v',adapterBin:'native-standard'};
  let request;
  const report=calculateStandardVersion(context,{run:r=>{request=r;return {stdout:'bumping version in package.json from 1.0.0 to 1.0.1',stderr:''};}});
  assert.deepEqual(request.args,['--dry-run','--skip.commit','--skip.tag','--tag-prefix','infra/v']);
  assert.equal(request.command,'native-standard');assert.equal(request.cwd,repo);
  assert.deepEqual([report.adapter,report.candidateVersion,report.sha,report.tag],['standard-version','1.0.1',sha,'infra/v1.0.1']);
  assert.throws(()=>calculateStandardVersion(context,{run:()=>{throw Error('runtime failed');}}),/runtime failed/);
  const typedContext={repository:repo,workspace:repo,projectPath:'.',targetBranch:'master',sha,
    tagPrefix:'infra/v',configuration:{adapterBin:'native-standard'}};
  const typed=collectStandardVersion(typedContext,{run:r=>{request=r;return {
    stdout:'bumping version in package.json from 1.0.0 to 1.0.1',stderr:''};}});
  assert.equal(typed.candidateVersion,'1.0.1');
  assert.equal(typed.tag,'infra/v1.0.1');
  assert.deepEqual(request.args,['--dry-run','--skip.commit','--skip.tag','--tag-prefix','infra/v']);
  assert.throws(()=>collectStandardVersion(typedContext,{run:()=>({stdout:'no version',stderr:''})}),/não informou/);
  assert.throws(()=>collectStandardVersion({...typedContext,tagPrefix:'../escape'},
    {run:()=>{throw Error('should not execute')}}),/Prefixo/);
  assert.throws(()=>collectStandardVersion({...typedContext,configuration:{releaseAs:'9.0.0'}},
    {run:()=>{throw Error('should not execute')}}),/Configuração/);
  console.log('Standard adapter contract passed');
}finally{rmSync(repo,{recursive:true,force:true});}
