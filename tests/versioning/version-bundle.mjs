import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureVersionBundle,applyVersionBundle} from '../../scripts/versioning/version-bundle.mjs';
const repository=mkdtempSync(join(tmpdir(),'version-bundle-'));
const git=(...args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
try{
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  const old='{"version":"1.0.0"}\n',next='{"version":"1.0.1"}\n';
  writeFileSync(join(repository,'package.json'),old);writeFileSync(join(repository,'package-lock.json'),old);
  git('add','.');git('commit','-qm','fix: change');const sha=git('rev-parse','HEAD');
  const report={schemaVersion:1,adapter:'standard-version',sha,branch:'master',tagPrefix:'v',baseVersion:'1.0.0',
    candidateVersion:'1.0.1',tag:'v1.0.1',bump:'patch',native:{format:'text',result:{version:'1.0.1'},explanation:'native'}};
  writeFileSync(join(repository,'package.json'),next);writeFileSync(join(repository,'package-lock.json'),next);
  writeFileSync(join(repository,'CHANGELOG.md'),'## 1.0.1\n');
  const bundle=captureVersionBundle({repository,projectPath:'.',report});
  assert.deepEqual({schema:bundle.schemaVersion,adapter:bundle.adapter,sha:bundle.sha,version:bundle.version,
    prefix:bundle.tagPrefix,project:bundle.projectPath},{schema:1,adapter:'standard-version',sha,version:'1.0.1',prefix:'v',project:'.'});
  const packageEntry=bundle.files.find(f=>f.path==='package.json');
  assert.equal(Buffer.from(packageEntry.content,'base64').toString(),next);
  assert.equal(packageEntry.hash,createHash('sha256').update(next).digest('hex'));
  assert.equal(packageEntry.before,createHash('sha256').update(old).digest('hex'));
  assert.equal(bundle.files.find(f=>f.path==='CHANGELOG.md').before,null);
  assert.deepEqual([bundle.sha,bundle.version,bundle.tagPrefix,bundle.files.map(f=>f.path).sort()],
    [sha,'1.0.1','v',['CHANGELOG.md','package-lock.json','package.json']]);
  const reset=()=>{writeFileSync(join(repository,'package.json'),old);writeFileSync(join(repository,'package-lock.json'),old);rmSync(join(repository,'CHANGELOG.md'),{force:true});};
  reset();
  assert.throws(()=>applyVersionBundle({repository,bundle:{...bundle,sha:'b'.repeat(40)},report,projectPath:'.'}),/SHA/);
  assert.throws(()=>applyVersionBundle({repository,bundle:{...bundle,version:'9.0.0'},report,projectPath:'.'}),/identidade/);
  assert.throws(()=>applyVersionBundle({repository,bundle:{...bundle,tagPrefix:'infra/v'},report,projectPath:'.'}),/identidade/);
  assert.throws(()=>applyVersionBundle({repository,bundle:{...bundle,files:[...bundle.files,{...bundle.files[0],path:'../escape'}]},report,projectPath:'.'}),/path|arquivo/);
  const corrupted={...bundle,files:bundle.files.map((f,i)=>i?f:{...f,content:Buffer.from('tampered').toString('base64')})};
  assert.throws(()=>applyVersionBundle({repository,bundle:corrupted,report,projectPath:'.'}),/hash/);
  const wrongVersion=Buffer.from('{"version":"9.0.0"}\n');
  const semantic={...bundle,files:bundle.files.map(f=>f.path==='package.json'?{...f,content:wrongVersion.toString('base64'),
    hash:createHash('sha256').update(wrongVersion).digest('hex')}:f)};
  assert.throws(()=>applyVersionBundle({repository,bundle:semantic,report,projectPath:'.'}),/package.json diverge/);
  const oversized=Buffer.from('x'.repeat(10*1024*1024+1));
  const large={...bundle,files:[{...packageEntry,content:oversized.toString('base64'),hash:createHash('sha256').update(oversized).digest('hex')}]};
  assert.throws(()=>applyVersionBundle({repository,bundle:large,report,projectPath:'.'}),/limite de10MiB/);
  assert.equal(readFileSync(join(repository,'package.json'),'utf8'),old,'invalid bundle must not partially write');
  symlinkSync(join(repository,'missing-directory'),join(repository,'linked'),'junction');
  const linked={...bundle,projectPath:'linked',files:bundle.files.map(f=>({...f,path:'linked/'+f.path,before:null}))};
  assert.throws(()=>applyVersionBundle({repository,bundle:linked,report,projectPath:'linked'}),/symlink/,
    'dangling directory links must fail before any write, not by following their target');
  writeFileSync(join(repository,'package.json'),'dirty');
  assert.throws(()=>applyVersionBundle({repository,bundle,report,projectPath:'.'}),/base/);reset();
  applyVersionBundle({repository,bundle,report,projectPath:'.'});
  assert.equal(readFileSync(join(repository,'package.json'),'utf8'),next);
  assert.equal(readFileSync(join(repository,'package-lock.json'),'utf8'),next);
  assert.equal(readFileSync(join(repository,'CHANGELOG.md'),'utf8'),'## 1.0.1\n');
  assert.equal(git('rev-parse','HEAD'),sha);assert.equal(git('tag','--list'),'');
  console.log('Version bundle: bounded materialization, identity, hashes and no-write negatives passed');
}finally{rmSync(repository,{recursive:true,force:true});}
