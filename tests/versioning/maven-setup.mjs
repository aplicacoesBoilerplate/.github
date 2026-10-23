import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runProcess} from '../../scripts/versioning/process-runner.mjs';
import {installPinnedMaven} from '../../scripts/versioning/dist/adapters/maven-installer.js';
const scratch=mkdtempSync(join(tmpdir(),'maven-setup-'));
const typedInstaller=resolve(import.meta.dirname,'../../scripts/versioning/install-maven.mjs');
const env={...process.env,RUNNER_TEMP:scratch.replaceAll('\\','/'),GITHUB_PATH:join(scratch,'path.txt').replaceAll('\\','/')};
try {
  const installed=spawnSync(process.execPath,[typedInstaller],{env,encoding:'utf8',timeout:180000});
  assert.equal(installed.status,0,installed.stderr);
  const bin=readFileSync(join(scratch,'path.txt'),'utf8').trim();
  const command=join(bin,process.platform==='win32'?'mvn.cmd':'mvn');
  const version=runProcess({command,args:['--version'],cwd:scratch,workspace:scratch}).stdout;
  assert.match(version,/Apache Maven 3\.9\.9/);
  const calls=[];
  assert.throws(()=>installPinnedMaven({runnerTemp:scratch,githubPath:join(scratch,'path.txt')},{
    run:request=>{calls.push(request.command);assert.equal(request.command,'curl');
      const target=request.args[request.args.indexOf('-o')+1];
      writeFileSync(target,'corrupt downloaded archive');return {stdout:'',stderr:''};}
  }),/checksum SHA-512 divergente/,'invalid checksum must fail before extracting');
  assert.deepEqual(calls,['curl'],'no extraction after a checksum failure');
  assert.equal(readFileSync(join(scratch,'path.txt'),'utf8').trim(),bin,'failed checksum cannot change runtime path');
  console.log('Pinned Maven installer and checksum gate passed');
}finally{rmSync(scratch,{recursive:true,force:true});}
