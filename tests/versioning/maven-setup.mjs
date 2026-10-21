import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runProcess} from '../../scripts/versioning/process-runner.mjs';
const scratch=mkdtempSync(join(tmpdir(),'maven-setup-'));
const script=resolve(import.meta.dirname,'../../scripts/versioning/install-maven.sh');
const typedInstaller=resolve(import.meta.dirname,'../../scripts/versioning/install-maven.mjs');
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const env={...process.env,RUNNER_TEMP:scratch.replaceAll('\\','/'),GITHUB_PATH:join(scratch,'path.txt').replaceAll('\\','/')};
try {
  const installed=spawnSync(process.execPath,[typedInstaller],{env,encoding:'utf8',timeout:180000});
  assert.equal(installed.status,0,installed.stderr);
  const bin=readFileSync(join(scratch,'path.txt'),'utf8').trim();
  const command=join(bin,process.platform==='win32'?'mvn.cmd':'mvn');
  const version=runProcess({command,args:['--version'],cwd:scratch,workspace:scratch}).stdout;
  assert.match(version,/Apache Maven 3\.9\.9/);
  const bad=join(scratch,'bad-checksum.sh');
  writeFileSync(bad,readFileSync(script,'utf8').replace(/[a-f0-9]{128}/,'0'.repeat(128)));
  const rejected=spawnSync(bash,[bad],{env,encoding:'utf8',timeout:180000});
  assert.notEqual(rejected.status,0,'invalid checksum must fail');
  assert.equal(readFileSync(join(scratch,'path.txt'),'utf8').trim(),bin,'failed checksum cannot change runtime path');
  console.log('Pinned Maven installer and checksum gate passed');
}finally{rmSync(scratch,{recursive:true,force:true});}
