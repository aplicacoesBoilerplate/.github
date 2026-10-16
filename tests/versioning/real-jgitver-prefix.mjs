import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectJgitver} from '../../scripts/versioning/adapters/jgitver.mjs';
import {normalizeJgitverReport} from '../../scripts/versioning/version-report.mjs';
const repository=mkdtempSync(join(tmpdir(),'jgitver-prefix-'));
const git=(...args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
const calculate=()=>{const sha=git('rev-parse','HEAD');return normalizeJgitverReport({
  native:collectJgitver({workspace:repository,projectDirectory:repository,targetBranch:'master',sha,env:process.env}),
  repository,branch:'master',sha,tagPrefix:'infra/v'});};
try{
  git('init','-q','-b','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
  mkdirSync(join(repository,'.mvn'));
  writeFileSync(join(repository,'pom.xml'),'<project><modelVersion>4.0.0</modelVersion><groupId>fixture</groupId><artifactId>prefix</artifactId><version>0.0.0</version></project>');
  writeFileSync(join(repository,'.mvn/extensions.xml'),'<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>');
  writeFileSync(join(repository,'.mvn/jgitver.config.xml'),'<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">'+
    '<strategy>CONFIGURABLE</strategy><autoIncrementPatch>true</autoIncrementPatch><useCommitDistance>false</useCommitDistance>'+
    '<useSnapshot>false</useSnapshot><nonQualifierBranches>master</nonQualifierBranches>'+
    '<regexVersionTag>^infra/(?:v)?([0-9]+\\.[0-9]+\\.[0-9]+)$</regexVersionTag></configuration>');
  git('add','.');git('commit','-qm','chore: base');git('tag','-a','infra/v1.0.0','-m','release');git('tag','-a','v9.0.0','-m','foreign');
  git('commit','--allow-empty','-qm','fix: patch');
  const patch=calculate();assert.deepEqual([patch.baseVersion,patch.candidateVersion,patch.tag,patch.bump],['1.0.0','1.0.1','infra/v1.0.1','patch']);
  git('tag','-a',patch.tag,'-m','release');git('checkout','-q','--detach',patch.sha);
  assert.equal(calculate().candidateVersion,'1.0.1');
  git('checkout','-q','master');git('tag','infra/1.1.0');git('commit','--allow-empty','-qm','feat: minor');
  const minor=calculate();assert.deepEqual([minor.baseVersion,minor.candidateVersion,minor.bump],['1.0.1','1.1.0','minor']);
  assert.equal(git('status','--porcelain'),'');
  console.log('Native Maven prefix: isolated scope, patch, rebuild and minor checkpoint passed');
}finally{rmSync(repository,{recursive:true,force:true});}
