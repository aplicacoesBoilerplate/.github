import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureGitInputs,verifyGitInputs} from '../../scripts/versioning/git-inputs.mjs';
const repo=mkdtempSync(join(tmpdir(),'git-inputs-'));
const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
try{
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  git('commit','--allow-empty','-qm','chore: bootstrap');
  const sha=git('rev-parse','HEAD'),snap=captureGitInputs(repo,'jgitver');
  assert.equal(verifyGitInputs(repo,snap,sha,'v0.0.1','jgitver'),true);
  git('tag','1.0.0');
  assert.throws(()=>verifyGitInputs(repo,snap,sha,'v0.0.1','jgitver'),/referências Git mudaram/);
  git('tag','-d','1.0.0');
  git('tag','-a','v0.0.1','-m','release');
  assert.equal(verifyGitInputs(repo,snap,sha,'v0.0.1','jgitver'),true,'own tag on expected SHA permits partial retry');
  const existing=captureGitInputs(repo,'jgitver');
  git('tag','-f','v0.0.1');
  assert.throws(()=>verifyGitInputs(repo,existing,sha,'v0.0.1','jgitver'),/referências Git mudaram/,'existing reference cannot be replaced');
  const go=captureGitInputs(repo,'go-gitsemver');
  git('branch','release/v1.0.0');
  assert.throws(()=>verifyGitInputs(repo,go,sha,'v9.0.0','go-gitsemver'),/referências Git mudaram/);
  assert.throws(()=>verifyGitInputs(repo,snap,'b'.repeat(40),'v0.0.1','jgitver'),/SHA/);
  console.log('Git input snapshot and recovery contract passed');
}finally{rmSync(repo,{recursive:true,force:true});}
