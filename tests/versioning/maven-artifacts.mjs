import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateMavenArtifacts} from '../../scripts/versioning/dist/distribution/maven-artifacts.js';

export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const modules=['parent','bom','core','starter'].map(artifactId=>({groupId:'fixture',artifactId,
  packaging:['parent','bom'].includes(artifactId)?'pom':'jar'}));
export const header='<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion>';
export const parent='<parent><groupId>fixture</groupId><artifactId>parent</artifactId><version>1.2.3</version></parent>';
export const coreRef='<dependency><groupId>fixture</groupId><artifactId>core</artifactId><version>1.2.3</version></dependency>';
export function fixture() {
  const root=mkdtempSync(join(tmpdir(),'maven-artifacts-')),repository=join(root,'git'),stagingRoot=join(root,'staging');
  mkdirSync(repository);mkdirSync(stagingRoot);
  const git=(...args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
  git('init','-q','-b','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');git('config','core.autocrlf','false');
  writeFileSync(join(repository,'source.txt'),'approved\n');git('add','.');git('commit','-qm','feat: release');
  const publishedSha=git('rev-parse','HEAD');git('tag','-a','v1.2.3','-m','release');
  const artifacts=[];
  const write=(path,bytes)=>{mkdirSync(join(stagingRoot,path,'..'),{recursive:true});writeFileSync(join(stagingRoot,path),bytes);return {path,sha256:hash(bytes)};};
  for(const module of modules) {
    const identity='<groupId>fixture</groupId><artifactId>'+module.artifactId+'</artifactId><version>1.2.3</version>';
    const refs=module.artifactId==='bom'?'<dependencyManagement><dependencies>'+coreRef+'</dependencies></dependencyManagement>':
      module.artifactId==='starter'?'<dependencies>'+coreRef+'</dependencies>':'';
    const pom=header+(module.artifactId==='parent'?'':parent)+identity+'<packaging>'+module.packaging+'</packaging>'+refs+'</project>';
    for(const extension of module.packaging==='jar'?['pom','jar']:['pom']) {
      const path=`fixture/${module.artifactId}/1.2.3/${module.artifactId}-1.2.3.${extension}`;
      artifacts.push({...module,version:'1.2.3',extension,...write(path,extension==='pom'?pom:Buffer.from('real-byte-placeholder'))});
    }
  }
  const effective=write('effective.xml','<projects>'+modules.map(m=>header+'<groupId>fixture</groupId><artifactId>'+m.artifactId+
    '</artifactId><version>1.2.3</version><packaging>'+m.packaging+'</packaging></project>').join('')+'</projects>');
  const input={repository,stagingRoot,publishedSha,expectedTags:['v1.2.3'],approvedVersion:'1.2.3',
    build:{sha:publishedSha,runId:101,runAttempt:1},modules,artifacts,effectivePom:effective};
  const edit=(id,change)=>{const artifact=artifacts.find(a=>a.artifactId===id&&a.extension==='pom');
    const value=change(readFileSync(join(stagingRoot,artifact.path),'utf8'));
    writeFileSync(join(stagingRoot,artifact.path),value);artifact.sha256=hash(value);};
  return {root,input,git,edit,write,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}

if(process.argv[1]===import.meta.filename) {
  let assertions=0;
  const equal=(a,b)=>{assertions++;assert.deepEqual(a,b);};
  const reject=async(change,pattern)=>{const f=fixture();let lookups=0;try{change(f);
    assertions++;await assert.rejects(()=>validateMavenArtifacts(f.input,{lookup:async()=>{lookups++;return null;}}),pattern);
    equal(lookups,0);
  }finally{f.cleanup();}};
  const f=fixture();
  try {
    const ready=await validateMavenArtifacts(f.input,{lookup:async()=>null});
    equal(ready.status,'ready');equal(ready.distributionAllowed,true);equal(ready.entries.length,6);
    equal(ready.entries.map(e=>e.registryState),Array(6).fill('missing'));
    const same=await validateMavenArtifacts(f.input,{lookup:async a=>readFileSync(join(f.input.stagingRoot,a.path))});
    equal(same.status,'already-distributed');equal(same.distributionAllowed,false);
    const partial=await validateMavenArtifacts(f.input,{lookup:async a=>a.artifactId==='core'?readFileSync(join(f.input.stagingRoot,a.path)):null});
    equal(partial.status,'partial-reconciliation-required');equal(partial.distributionAllowed,false);
    equal(partial.entries.filter(e=>e.registryState==='existing-identical').length,2);
    const conflict=await validateMavenArtifacts(f.input,{lookup:async a=>a.artifactId==='core'?Buffer.from('foreign'):null});
    equal(conflict.status,'blocked');equal(conflict.entries.filter(e=>e.registryState==='conflict').length,2);
    const unavailable=await validateMavenArtifacts(f.input,{lookup:async()=>{throw Error('token-sensitive upstream error');}});
    equal(unavailable.status,'blocked');equal(unavailable.entries.map(e=>e.registryState),Array(6).fill('unverifiable'));
    assert.doesNotMatch(JSON.stringify(unavailable),/sensitive/);assertions++;
    equal(f.git('status','--porcelain'),'');
  } finally {f.cleanup();}
  await reject(f=>f.edit('starter',s=>s.replace('<version>1.2.3</version></dependency>','<version>${revision}</version></dependency>')),/resol|revision/);
  await reject(f=>f.edit('starter',s=>s.replace('<version>1.2.3</version></dependency>','<version>1.2.2</version></dependency>')),/referência|versão/i);
  await reject(f=>f.input.build.sha='a'.repeat(40),/SHA/);
  await reject(f=>{f.git('commit','--allow-empty','-qm','fix: wrong checkout');},/SHA/);
  await reject(f=>{f.git('tag','-d','v1.2.3');f.git('commit','--allow-empty','-qm','fix: wrong tag');f.git('tag','v1.2.3');f.git('checkout','-q','--detach',f.input.publishedSha);},/tag/i);
  await reject(f=>f.input.artifacts[0].sha256='0'.repeat(64),/digest/i);
  await reject(f=>f.input.effectivePom.sha256='0'.repeat(64),/digest/i);
  await reject(f=>f.input.artifacts.pop(),/ausente|incompleto/i);
  await reject(f=>f.input.artifacts.push({...f.input.artifacts[0]}),/duplicad/i);
  await reject(f=>f.input.artifacts[0].path='../outside.pom',/path|caminho|layout/i);
  await reject(f=>{const dir=join(f.input.stagingRoot,'fixture/parent/1.2.3');rmSync(dir,{recursive:true});symlinkSync(f.root,dir,'junction');},/symlink/i);
  await reject(f=>f.edit('parent',s=>s.replace('</project>','<artifactId>duplicate</artifactId></project>')),/POM|campo/i);
  await reject(f=>f.edit('parent',s=>'<!DOCTYPE project [<!ENTITY revision "1.2.3">]>'+s),/DOCTYPE|entidade/i);
  await reject(f=>f.edit('core',s=>s.replace('</project>','</broken>')),/XML/i);
  await reject(f=>f.edit('core',s=>s.replace('<version>1.2.3</version></parent>','<version>1.2.2</version></parent>')),/parent|referência/i);
  await reject(f=>{f.input.effectivePom=f.write('effective.xml','<projects>'+header+'<groupId>fixture</groupId><artifactId>core</artifactId><version>1.2.2</version></project></projects>');},/efetiv|reactor/i);
  await reject(f=>{const bytes=readFileSync(join(f.input.stagingRoot,'effective.xml'),'utf8').replace('</project>',
    '<dependencies>'+coreRef.replace('1.2.3','1.2.2')+'</dependencies></project>');f.input.effectivePom=f.write('effective.xml',bytes);},/efetiv|referência/i);
  const properties=fixture();try{
    properties.edit('parent',s=>s.replace('</project>','<properties><revision>1.2.3</revision><spring-boot.version>3.5.0</spring-boot.version></properties><build><plugins><plugin><artifactId>fixture</artifactId><configuration><items><item>one</item><item>two</item></items></configuration></plugin></plugins></build></project>'));
    properties.edit('starter',s=>s.replace('<version>1.2.3</version></dependency>','<version>${revision}</version></dependency>'));
    equal((await validateMavenArtifacts(properties.input,{lookup:async()=>null})).status,'ready');
    properties.edit('parent',s=>s.replace('<revision>1.2.3</revision>','<revision>${revision}</revision>'));
    assertions++;await assert.rejects(()=>validateMavenArtifacts(properties.input,{lookup:async()=>null}),/ciclo|resol/i);
  }finally{properties.cleanup();}
  const managed=fixture();try{
    managed.edit('starter',s=>s.replace('<dependencies>','<dependencyManagement><dependencies><dependency><groupId>fixture</groupId><artifactId>bom</artifactId><version>1.2.3</version><type>pom</type><scope>import</scope></dependency></dependencies></dependencyManagement><dependencies>')
      .replace(coreRef,coreRef.replace('<version>1.2.3</version>','')));
    equal((await validateMavenArtifacts(managed.input,{lookup:async()=>null})).status,'ready');
  }finally{managed.cleanup();}
  console.log('Maven artifacts: '+assertions+' assertions, actual POM bytes, refs, provenance and registry reconciliation');
}
