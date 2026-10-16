import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAdapter } from '../../scripts/versioning/adapter-registry.mjs';
const repo=mkdtempSync(join(tmpdir(),'registry-'));
try {
  execFileSync('git',['init','-q'],{cwd:repo}); execFileSync('git',['config','user.name','Fixture'],{cwd:repo});
  execFileSync('git',['config','user.email','fixture@example.test'],{cwd:repo});
  execFileSync('git',['commit','--allow-empty','-qm','chore: bootstrap'],{cwd:repo});
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const props={'jgitver.used_version':'0.0.1','jgitver.calculated_version':'0.0.1','jgitver.git_sha1_full':sha,'jgitver.plugin-version':'1.9.0'};
  const adapter=resolveAdapter('jgitver',{maven:()=>({version:'0.0.1',sha,properties:props,explanation:'native'})});
  assert.equal(adapter.runtime,'java'); assert.equal(adapter.tagKind,'annotated');
  assert.equal(adapter.calculate({workspace:repo,projectDirectory:repo,targetBranch:'master',sha}).candidateVersion,'0.0.1');
  const go=resolveAdapter('go-gitsemver',{go:()=>({candidateVersion:'0.0.1'})});
  assert.equal(go.runtime,'go'); assert.equal(go.tagKind,'lightweight'); assert.deepEqual(go.calculate({}),{candidateVersion:'0.0.1'});
  assert.throws(()=>resolveAdapter('unknown'),/não suportado/);
  assert.throws(()=>resolveAdapter('__proto__'),/não suportado/);
  console.log('Adapter registry contract passed');
} finally {rmSync(repo,{recursive:true,force:true});}
