import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeGoReport,normalizeJgitverReport,normalizeStandardVersionReport,validateVersionReport} from '../../scripts/versioning/version-report.mjs';
const repository=mkdtempSync(join(tmpdir(),'reconciled-report-'));
const git=(...a)=>execFileSync('git',a,{cwd:repository,encoding:'utf8'}).trim();
try{
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  git('commit','--allow-empty','-qm','fix: initial');
  const sha=git('rev-parse','HEAD');
  const native=version=>({version,sha,properties:{'jgitver.used_version':version,'jgitver.calculated_version':version,
    'jgitver.git_sha1_full':sha,'jgitver.plugin-version':'1.9.0'},explanation:'Derived Properties evidence'});
  const context={branch:'master',sha,repository};
  const boot=normalizeJgitverReport({...context,native:native('0.0.1')});
  assert.deepEqual([boot.baseVersion,boot.candidateVersion,boot.tag,boot.tagKind,boot.native.format],
    ['0.0.0','0.0.1','v0.0.1','annotated','java-properties']);
  assert.throws(()=>normalizeJgitverReport({...context,native:native('1.0.0')}),/0.0.1/);
  assert.throws(()=>normalizeStandardVersionReport({...context,nativeOutput:'bumping version in package.json from 1.0.0 to 1.0.1'}),/0.0.1/);
  git('tag','-a','infra/v1.0.0','-m','release');git('tag','v9.0.0');git('tag','1.1.0');
  const report=normalizeJgitverReport({...context,tagPrefix:'infra/v',native:native('1.1.0')});
  assert.deepEqual([report.baseVersion,report.tag,report.bump],['1.0.0','infra/v1.1.0','minor']);
  for(const [field,value] of [['jgitver.used_version','9.0.0'],['jgitver.calculated_version','9.0.0'],
    ['jgitver.git_sha1_full','b'.repeat(40)],['jgitver.plugin-version','1.8.0']]){
    assert.throws(()=>validateVersionReport({...report,native:{...report.native,result:{...report.native.result,[field]:value}}}),/native jgitver/);
  }
  assert.throws(()=>normalizeJgitverReport({...context,native:{...native('1.0.0'),sha:'b'.repeat(40)}}),/SHA/);
  assert.throws(()=>normalizeJgitverReport({...context,native:native('1.0.0-SNAPSHOT')}),/SemVer/);
  const node=normalizeStandardVersionReport({...context,tagPrefix:'infra/v',nativeOutput:'bumping version in package.json from 1.0.0 to 1.0.1'});
  assert.throws(()=>validateVersionReport({...node,native:{...node.native,result:{version:'9.0.0'}}}),/native standard/);
  assert.throws(()=>validateVersionReport({...node,bump:'major'}),/incremento/);
  const go=normalizeGoReport({...context,nativeJson:JSON.stringify({SemVer:'9.0.1',Sha:sha}),explanation:'native'});
  assert.throws(()=>validateVersionReport({...go,native:{...go.native,result:{SemVer:'9.0.1',Sha:'b'.repeat(40)}}}),/native Go/);
  console.log('Reconciled report: native identity, bootstrap and prefix scope passed');
}finally{rmSync(repository,{recursive:true,force:true});}
