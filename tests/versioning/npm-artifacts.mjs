import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {packNpmArtifacts,resolveNpmTargets,validateNpmArtifacts} from '../../scripts/versioning/dist/distribution/npm-artifacts.js';
import {runProcess} from '../../scripts/versioning/dist/ports/process.js';
const require=createRequire(resolve(import.meta.dirname,'../../scripts/versioning/package.json'));
const {Header}=require('tar');
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest(algorithm==='sha512'?'base64':'hex');
const root=mkdtempSync(join(tmpdir(),'npm-distribution-')),repository=join(root,'git'),stagingRoot=join(root,'staging');
mkdirSync(repository);mkdirSync(stagingRoot);
const git=(...args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
const json=(path,value)=>{mkdirSync(join(repository,path,'..'),{recursive:true});writeFileSync(join(repository,path),JSON.stringify(value,null,2)+'\n');};
let assertions=0;
const equal=(a,b)=>{assertions++;assert.deepEqual(a,b);};
try {
  git('init','-q','-b','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');git('config','core.autocrlf','false');
  const packages=[['library','@fixture/core','1.2.3',false],['components','@fixture/ui','2.0.1',false],['internal','@fixture/internal','5.0.0',true]];
  json('package.json',{name:'@fixture/root',version:'0.0.0',private:true,workspaces:['packages/*']});
  const locked={'':{name:'@fixture/root',version:'0.0.0'}};
  for(const [folder,name,version,isPrivate] of packages) {
    const path='packages/'+folder;
    json(path+'/package.json',{name,version,private:isPrivate,type:'module',main:'dist/index.js',types:'dist/index.d.ts',
      exports:{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}},files:['dist'],
      scripts:{prepack:'node -e "require(\'fs\').writeFileSync(\'prepack-ran\',\'bad\')"'},
      ...(folder==='components'?{dependencies:{'@fixture/core':'^1.2.0'},peerDependencies:{'@fixture/core':'>=1 || ^2'},devDependencies:{'@fixture/core':'^0.1.0'}}:{})});
    mkdirSync(join(repository,path,'dist'));writeFileSync(join(repository,path,'dist/index.js'),'export const value = 42;\n');
    writeFileSync(join(repository,path,'dist/index.d.ts'),'export declare const value: number;\n');
    locked[path]={name,version};
  }
  locked['node_modules/@fixture/core']={link:true,resolved:'packages/library'};
  json('package-lock.json',{name:'@fixture/root',version:'0.0.0',lockfileVersion:3,packages:locked});
  json('.changeset/config.json',{ignore:[],privatePackages:{version:true,tag:true}});
  git('add','.');git('commit','-qm','feat: package release fixture');
  const publishedSha=git('rev-parse','HEAD');
  const releases=packages.map(([,name,version])=>({package:name,version,tag:name+'@'+version,status:'created',release_url:'https://github.com/fixture/packages/releases/tag/'+encodeURIComponent(name+'@'+version)}));
  for(const release of releases)git('tag',release.tag);
  const input={repository,stagingRoot,publishedSha,expectedTags:releases.map(r=>r.tag),
    build:{sha:publishedSha,runId:201,runAttempt:1},adapter:'changesets',projectPath:'.',publicationOutcome:'published',releasesJson:JSON.stringify(releases)};
  const env={...process.env,NPM_TOKEN:'publisher-must-not-cross',GH_TOKEN:'writer-must-not-cross',
    npm_config_userconfig:join(root,'user.npmrc'),npm_config_globalconfig:join(root,'global.npmrc'),npm_config_cache:join(root,'cache')};
  writeFileSync(env.npm_config_userconfig,'');writeFileSync(env.npm_config_globalconfig,'');
  const targets=resolveNpmTargets(input);
  equal(targets.map(t=>[t.name,t.projectPath,t.eligible]),[
    ['@fixture/core','packages/library',true],['@fixture/internal','packages/internal',false],['@fixture/ui','packages/components',true]]);
  let packs=0;
  const artifacts=await packNpmArtifacts(input,{env,run:request=>{
    packs++;assertions++;assert.equal(Object.keys(request.env).some(key=>/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key)),false);
    equal(request.args,['pack','--json','--ignore-scripts','--pack-destination',stagingRoot]);
    return runProcess(request);
  }});
  equal(packs,2);equal(artifacts.map(a=>a.name),['@fixture/core','@fixture/ui']);
  for(const [folder] of packages)equal(existsSync(join(repository,'packages',folder,'prepack-ran')),false);
  const request={...input,artifacts};
  const ready=await validateNpmArtifacts(request,{lookup:async()=>null});
  equal(ready.status,'ready');equal(ready.entries.length,2);equal(ready.packages.map(p=>p.files.length),[3,3]);
  equal((await validateNpmArtifacts(request,{lookup:async a=>readFileSync(join(stagingRoot,a.path))})).status,'already-distributed');
  const partial=await validateNpmArtifacts(request,{lookup:async a=>a.name==='@fixture/core'?readFileSync(join(stagingRoot,a.path)):null});
  equal(partial.status,'partial-reconciliation-required');equal(partial.distributionAllowed,false);
  equal((await validateNpmArtifacts(request,{lookup:async()=>Buffer.from('foreign')})).status,'blocked');
  equal((await validateNpmArtifacts(request,{lookup:async()=>undefined})).status,'blocked');
  const reject=async(change,pattern)=>{const value=structuredClone(request);let calls=0;change(value);
    assertions++;await assert.rejects(()=>validateNpmArtifacts(value,{lookup:async()=>{calls++;return null;}}),pattern);equal(calls,0);};
  await reject(v=>v.build.sha='0'.repeat(40),/SHA/);
  await reject(v=>v.artifacts[0].sha256='0'.repeat(64),/digest/);
  await reject(v=>v.artifacts[0].integrity='sha512-'+Buffer.alloc(64).toString('base64'),/integrity/);
  await reject(v=>v.artifacts[0].name='@fixture/other',/eleg|nome|package/i);
  await reject(v=>v.artifacts[0].version='1.2.2',/versão|version/i);
  await reject(v=>v.artifacts[0].files.pop(),/inventário|arquiv/i);
  await reject(v=>v.artifacts.push({...v.artifacts[0],name:'@fixture/root'}),/privad|eleg|package/i);
  await reject(v=>v.artifacts.pop(),/ausente|incomplet/i);
  await reject(v=>v.publicationOutcome='partial',/publicação|conclu/i);
  await reject(v=>{const parsed=JSON.parse(v.releasesJson);parsed[0].status='pending';v.releasesJson=JSON.stringify(parsed);},/conclu|status/i);
  await reject(v=>v.expectedTags=[releases[0].tag],/tag/i);
  await reject(v=>v.projectPath='../escape',/path|caminho/i);
  const repack=async(mutator,pattern)=>{
    const path=join(repository,'packages/components/package.json'),before=readFileSync(path);
    const manifest=JSON.parse(before);mutator(manifest);writeFileSync(path,JSON.stringify(manifest));
    let packed;
    try {const output=runProcess({command:process.platform==='win32'?'npm.cmd':'npm',args:['pack','--json','--ignore-scripts','--pack-destination',stagingRoot],cwd:join(repository,'packages/components'),workspace:repository,env});
      const result=JSON.parse(output.stdout)[0],bytes=readFileSync(join(stagingRoot,result.filename));
      packed={name:'@fixture/ui',version:'2.0.1',path:result.filename,sha256:hash(bytes),integrity:result.integrity,files:result.files};
    }finally{writeFileSync(path,before);}
    assertions++;await assert.rejects(()=>validateNpmArtifacts({...request,artifacts:[artifacts[0],packed]},{lookup:async()=>null}),pattern);
  };
  await repack(m=>m.name='@fixture/forged',/nome|manifest/i);
  await repack(m=>m.version='2.0.0',/versão|manifest/i);
  await repack(m=>m.dependencies['@fixture/core']='1.2.2',/depend|manifest/i);
  await repack(m=>m.main='dist/missing.js',/manifest|entrada|arquivo/i);
  // Return the original tarballs after the deliberate repacks.
  const fresh=await packNpmArtifacts(input,{env});
  const malformed=Buffer.from('not a gzip archive');writeFileSync(join(stagingRoot,'malformed.tgz'),malformed);
  await reject(v=>v.artifacts[0]={...fresh[0],path:'malformed.tgz',sha256:hash(malformed),integrity:'sha512-'+hash(malformed,'sha512')},/gzip|tarball/i);
  const header=new Header({path:'../escape',size:1,type:'File'});header.encode();
  const traversal=gzipSync(Buffer.concat([header.block,Buffer.from('x'),Buffer.alloc(511+1024)]));writeFileSync(join(stagingRoot,'traversal.tgz'),traversal);
  await reject(v=>v.artifacts[0]={...fresh[0],path:'traversal.tgz',sha256:hash(traversal),integrity:'sha512-'+hash(traversal,'sha512')},/path|tarball|caminho/i);
  const privateRelease=releases.find(r=>r.package==='@fixture/internal');
  const skipped=await validateNpmArtifacts({...input,releasesJson:JSON.stringify([privateRelease]),expectedTags:[privateRelease.tag],artifacts:[]},{lookup:async()=>{throw Error('must not query');}});
  equal(skipped.status,'no-distribution');equal(skipped.distributionAllowed,false);equal(skipped.entries,[]);
  git('tag','v1.2.3');
  for(const adapter of ['standard-version','release-please']) {
    const single={...input,adapter,projectPath:'packages/library',expectedTags:['v1.2.3'],
      releasesJson:JSON.stringify([{...releases[0],package:null,tag:'v1.2.3'}]),artifacts:[fresh[0]]};
    equal((await validateNpmArtifacts(single,{lookup:async()=>null})).status,'ready');
  }
  equal(git('status','--porcelain'),'');
  // Native Git manifests themselves must be distributable, not only equal to the archive.
  const variants=[
    {core:'2.0.0',ui:'3.0.0',range:'^1.2.0',error:/dependência.*incompatível/i},
    {core:'0.3.0',ui:'3.0.1',range:'^0.2.0',error:/dependência.*incompatível/i},
    {core:'2.0.1',ui:'3.0.2',range:'workspace:*',error:/protocolo|range/i},
    {core:'2.0.2',ui:'3.0.3',range:'^2',main:'dist/missing.js',error:/entrada.*ausente/i},
    {core:'2.0.3',ui:'3.0.4',range:'~2.0.0',privateDependency:true,error:/dependência.*publicável/i},
    {core:'2.0.4',ui:'3.0.5',range:'^2 || ^3',ignore:['@fixture/u*'],ignored:true},
    {core:'2.0.5',ui:'3.0.6',range:'^2.0.0',ok:true},
  ];
  for(const variant of variants) {
    const core=JSON.parse(readFileSync(join(repository,'packages/library/package.json')));
    const ui=JSON.parse(readFileSync(join(repository,'packages/components/package.json')));
    core.version=variant.core;ui.version=variant.ui;ui.main=variant.main??'dist/index.js';
    ui.dependencies={'@fixture/core':variant.range,...(variant.privateDependency?{'@fixture/internal':'5.0.0'}:{})};
    json('packages/library/package.json',core);json('packages/components/package.json',ui);
    locked['packages/library'].version=core.version;locked['packages/components'].version=ui.version;
    json('package-lock.json',{name:'@fixture/root',version:'0.0.0',lockfileVersion:3,packages:locked});
    json('.changeset/config.json',{ignore:variant.ignore??[]});git('add','.');git('commit','-qm','test: native distribution variant');
    const sha=git('rev-parse','HEAD'),items=[{...releases[0],version:core.version,tag:'@fixture/core@'+core.version},
      {...releases[1],package:'@fixture/ui',version:ui.version,tag:'@fixture/ui@'+ui.version}];
    // The private dependency is not itself a release in this delivery; discover it from the full committed workspace inventory.
    for(const item of items)git('tag',item.tag);
    const next={...input,publishedSha:sha,build:{...input.build,sha},expectedTags:items.map(i=>i.tag),releasesJson:JSON.stringify(items)};
    if(variant.error) {
      assertions++;await assert.rejects(async()=>{const packed=await packNpmArtifacts(next,{env});await validateNpmArtifacts({...next,artifacts:packed},{lookup:async()=>null});},variant.error);
    } else {
      const packed=await packNpmArtifacts(next,{env});equal(packed.length,variant.ignored?1:2);
      equal((await validateNpmArtifacts({...next,artifacts:packed},{lookup:async()=>null})).status,'ready');
    }
  }
  equal(git('status','--porcelain'),'');
  console.log('Npm artifacts: '+assertions+' assertions; real pack, native eligibility, Git manifests, files/ranges/provenance and partial reconciliation; no publish');
}finally{rmSync(root,{recursive:true,force:true});}
