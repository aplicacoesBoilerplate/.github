import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readChangelog} from '../../scripts/versioning/dist/services/release-notes.js';
const temp=mkdtempSync(join(tmpdir(),'release-notes-')),repository=join(temp,'repo');
mkdirSync(repository);mkdirSync(join(repository,'docs'));mkdirSync(join(temp,'outside'));
try {
  writeFileSync(join(repository,'docs/CHANGELOG.md'),'## 1.0.1\nHomologação aprovada');
  assert.equal(readChangelog(repository,''),'');
  assert.equal(readChangelog(repository,'missing.md'),'');
  assert.equal(readChangelog(repository,'docs/CHANGELOG.md'),'## 1.0.1\nHomologação aprovada');
  for(const path of ['./docs/CHANGELOG.md','docs/./CHANGELOG.md','docs//CHANGELOG.md']) {
    assert.equal(readChangelog(repository,path),readChangelog(repository,'docs/CHANGELOG.md'));
  }
  for(const path of ['../outside/secret.md','/etc/passwd','C:/secret.md','docs\\secret.md']) {
    assert.throws(()=>readChangelog(repository,path),/changelog|repositório|relativo/i);
  }
  writeFileSync(join(temp,'outside/secret.md'),'must-not-leak');
  symlinkSync(join(temp,'outside'),join(repository,'link'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>readChangelog(repository,'link/secret.md'),/repositório|changelog/i);
} finally {rmSync(temp,{recursive:true,force:true});}
console.log('Release notes: optional changelog, missing file, traversal and symlink escape');
