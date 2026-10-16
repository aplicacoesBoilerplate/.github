import assert from 'node:assert/strict';
import { spawnSync,execFileSync } from 'node:child_process';
import { mkdtempSync,rmSync,existsSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
const workspace=mkdtempSync(join(tmpdir(),'collect-cli-'));
const outside=mkdtempSync(join(tmpdir(),'collect-outside-'));
const cli=resolve(import.meta.dirname,'../../scripts/versioning/collect-version-report.mjs');
try {
  const sha='a'.repeat(40), output=join(workspace,'report.json');
  const unknown=spawnSync(process.execPath,[cli,'unknown',workspace,'master',sha,workspace,'never-run',output],{encoding:'utf8'});
  assert.equal(unknown.status,1); assert.match(unknown.stderr,/Adaptador não suportado/);
  const escaped=spawnSync(process.execPath,[cli,'go-gitsemver',outside,'master',sha,workspace,'never-run',output],{encoding:'utf8'});
  assert.equal(escaped.status,1); assert.match(escaped.stderr,/fora do workspace/);
  assert.equal(existsSync(output),false,'invalid context cannot produce report');
  console.log('Collector entrypoint boundaries passed');
}finally{rmSync(workspace,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
