import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectJgitver } from '../../scripts/versioning/adapters/jgitver.mjs';
const repo=mkdtempSync(join(tmpdir(),'jgitver-contract-'));
try {
  mkdirSync(join(repo,'.mvn')); writeFileSync(join(repo,'pom.xml'),'<project/>');
  writeFileSync(join(repo,'.mvn/extensions.xml'),'<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>');
  const context={workspace:repo,projectDirectory:repo,targetBranch:'master',sha:'a'.repeat(40),adapterBin:'mvn'};
  let request, exported;
  const execute = additions => r=>{
    request=r; exported=r.args.find(a=>a.startsWith('-Djgitver.export-properties-path=')).split('=')[1];
    writeFileSync(exported, 'jgitver.used_version=0.0.1\njgitver.calculated_version=0.0.1\njgitver.git_sha1_full='+context.sha+
      '\njgitver.plugin-version=1.9.0\njgitver.head_committer_name=private\n'+additions);
    return {stdout:'ANSI/noisy output ignored',stderr:''};
  };
  const result=collectJgitver(context,{run:execute('')});
  assert.equal(result.version,'0.0.1'); assert.equal(result.sha,context.sha);
  assert.equal(result.properties['jgitver.head_committer_name'],undefined);
  assert.equal(request.args.includes('-Djgitver.branch=master'),true);
  assert.equal(request.args.includes('-N'),true);
  assert.equal(existsSync(exported),false,'temporary export removed');
  assert.throws(()=>collectJgitver(context,{run:r=>{
    const file=r.args.find(a=>a.startsWith('-Djgitver.export-properties-path=')).split('=')[1];
    writeFileSync(file,'jgitver.used_version=9.0.0\njgitver.calculated_version=0.0.1\n');
    return {stdout:'',stderr:''};
  }}),/diverge|ausente/);
  assert.throws(()=>collectJgitver(context,{run:()=>({stdout:'',stderr:''})}),/exportar/);
  assert.throws(()=>collectJgitver(context,{run:r=>{
    const file=r.args.find(a=>a.startsWith('-Djgitver.export-properties-path=')).split('=')[1];
    writeFileSync(file,'jgitver.used_version=9.0.0\njgitver.calculated_version=0.0.1\n'+
      'jgitver.git_sha1_full='+context.sha+'\njgitver.plugin-version=1.9.0\n');
    return {stdout:'',stderr:''};
  }}),/Versão aplicada diverge do cálculo jgitver/,'complete native properties must still reject version divergence');
  writeFileSync(join(repo,'.mvn/maven.config'),'-Djgitver.use-version=9.0.0');
  assert.throws(()=>collectJgitver(context,{run:()=>{throw Error('should not execute');}}),/use-version/);
  writeFileSync(join(repo,'.mvn/maven.config'),'-Djgitver.skip=true');
  assert.throws(()=>collectJgitver(context,{run:()=>{throw Error('should not execute');}}),/skip/);
  console.log('Jgitver adapter contract passed');
} finally {rmSync(repo,{recursive:true,force:true});}
