import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash,modules,header} from './maven-artifacts.mjs';
import {assertDistributionContext} from '../../scripts/versioning/dist/distribution/artifact-safety.js';
import {validateMavenArtifacts} from '../../scripts/versioning/dist/distribution/maven-artifacts.js';

const root=mkdtempSync(join(tmpdir(),'real-maven-distribution-')),repository=join(root,'git'),stagingRoot=join(root,'staging');
mkdirSync(repository);mkdirSync(stagingRoot);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|MAVEN_ARGS|MAVEN_OPTS|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS)/i.test(key)));
const git=(...args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
try {
  git('init','-q','-b','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');git('config','core.autocrlf','false');
  mkdirSync(join(repository,'.mvn'));
  writeFileSync(join(repository,'.mvn/extensions.xml'),'<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>');
  writeFileSync(join(repository,'.mvn/jgitver.config.xml'),'<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0"><strategy>PATTERN</strategy><versionPattern>1.2.3</versionPattern><tagVersionPattern>${v}</tagVersionPattern><nonQualifierBranches>master</nonQualifierBranches></configuration>');
  writeFileSync(join(repository,'.gitignore'),'**/target/\n');
  const plugins=[['resources','3.3.1'],['compiler','3.13.0'],['surefire','3.5.4'],['jar','3.4.2'],['install','3.1.3']]
    .map(([name,version])=>'<plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-'+name+'-plugin</artifactId><version>'+version+'</version></plugin>').join('');
  writeFileSync(join(repository,'pom.xml'),header+'<groupId>fixture</groupId><artifactId>parent</artifactId><version>0.0.0</version><packaging>pom</packaging>'+
    '<modules><module>bom</module><module>core</module><module>starter</module></modules><properties><maven.compiler.release>21</maven.compiler.release></properties>'+
    '<build><pluginManagement><plugins>'+plugins+'</plugins></pluginManagement></build></project>');
  const parent='<parent><groupId>fixture</groupId><artifactId>parent</artifactId><version>0.0.0</version></parent>';
  for(const module of modules.slice(1)) {
    mkdirSync(join(repository,module.artifactId));
    const dep='<dependency><groupId>fixture</groupId><artifactId>core</artifactId><version>${project.version}</version></dependency>';
    const refs=module.artifactId==='bom'?'<dependencyManagement><dependencies>'+dep+'</dependencies></dependencyManagement>':
      module.artifactId==='starter'?'<dependencies>'+dep+'</dependencies>':'';
    writeFileSync(join(repository,module.artifactId,'pom.xml'),header+parent+'<artifactId>'+module.artifactId+'</artifactId><packaging>'+module.packaging+'</packaging>'+refs+'</project>');
    if(module.packaging==='jar') {
      const dir=join(repository,module.artifactId,'src/main/java/fixture');mkdirSync(dir,{recursive:true});
      writeFileSync(join(dir,module.artifactId==='core'?'Core.java':'Starter.java'),module.artifactId==='core'?
        'package fixture; public class Core { public static String value() { return "ok"; } }':'package fixture; public class Starter { public String value() { return Core.value(); } }');
    }
  }
  git('add','.');git('commit','-qm','feat: native Maven package fixture');
  const publishedSha=git('rev-parse','HEAD');git('tag','-a','v1.2.3','-m','approved');git('checkout','-q','--detach',publishedSha);
  const context={repository,publishedSha,expectedTags:['v1.2.3'],build:{sha:publishedSha,runId:102,runAttempt:1}};
  assertDistributionContext(context);
  for(const name of ['settings.xml','global-settings.xml'])writeFileSync(join(root,name),'<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"/>');
  const effectivePath=join(stagingRoot,'effective.xml'),nativePath=join(root,'native.properties');
  const args=['-B','-ntp','-s',join(root,'settings.xml'),'-gs',join(root,'global-settings.xml'),'-Dmaven.repo.local='+stagingRoot,
    '-Djgitver.branch=master','-Djgitver.resolve-project-version=true','-Djgitver.export-properties-path='+nativePath,
    '-Doutput='+effectivePath,'install','org.apache.maven.plugins:maven-help-plugin:3.5.1:effective-pom'];
  const binary=process.env.MAVEN_BIN||(process.platform==='win32'?'mvn.cmd':'mvn');
  const result=spawnSync(process.platform==='win32'?'cmd.exe':binary,process.platform==='win32'?['/d','/s','/c',binary,...args]:args,
    {cwd:repository,env,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);
  assertDistributionContext(context);
  const native=readFileSync(nativePath,'latin1');
  assert.match(native,/jgitver.used_version=1\.2\.3/);assert.ok(native.includes('jgitver.git_sha1_full='+publishedSha));
  const artifacts=[];
  for(const module of modules)for(const extension of module.packaging==='jar'?['pom','jar']:['pom']) {
    const path=`fixture/${module.artifactId}/1.2.3/${module.artifactId}-1.2.3.${extension}`;
    artifacts.push({...module,version:'1.2.3',extension,path,sha256:hash(readFileSync(join(stagingRoot,path)))});
  }
  for(const artifact of artifacts.filter(a=>a.extension==='jar')) {
    const javaSettings=spawnSync('java',['-XshowSettings:properties','-version'],{encoding:'utf8'});
    const javaHome=process.env.JAVA_HOME??javaSettings.stderr?.match(/^\s*java.home\s*=\s*(.+)$/m)?.[1]?.trim();
    assert.ok(javaHome,'A real JDK with jar is required, not only the Windows java launcher');
    const jarBin=join(javaHome,'bin',process.platform==='win32'?'jar.exe':'jar');
    const entries=execFileSync(jarBin,['tf',join(stagingRoot,artifact.path)],{encoding:'utf8'});
    assert.ok(entries.includes(artifact.artifactId==='core'?'fixture/Core.class':'fixture/Starter.class'));
  }
  const input={...context,stagingRoot,approvedVersion:'1.2.3',modules,artifacts,
    effectivePom:{path:'effective.xml',sha256:hash(readFileSync(effectivePath))}};
  const ready=await validateMavenArtifacts(input,{lookup:async()=>null});
  assert.equal(ready.status,'ready');assert.equal(ready.entries.length,6);
  const identical=await validateMavenArtifacts(input,{lookup:async a=>readFileSync(join(stagingRoot,a.path))});
  assert.equal(identical.status,'already-distributed');
  // Mutate the actual installed, distributable POM (not an effective-POM-only surrogate).
  const starter=artifacts.find(a=>a.artifactId==='starter'&&a.extension==='pom');
  const bytes=readFileSync(join(stagingRoot,starter.path),'utf8');
  const stale=bytes.replace(/(<artifactId>core<\/artifactId>\s*<version>)1\.2\.3/,(_m,prefix)=>prefix+'${revision}');
  assert.notEqual(stale,bytes);writeFileSync(join(stagingRoot,starter.path),stale);starter.sha256=hash(stale);
  await assert.rejects(()=>validateMavenArtifacts(input,{lookup:async()=>null}),/revision|resol/);
  assert.equal(git('status','--porcelain'),'');
  console.log('Native Maven distribution: actual installed POMs and compiled JARs, four modules, digest/refs/retry and stale revision rejected; no deploy');
} finally {rmSync(root,{recursive:true,force:true});}
