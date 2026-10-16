import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { collectJgitver } from '../../scripts/versioning/adapters/jgitver.mjs';
import { normalizeJgitverReport } from '../../scripts/versioning/version-report.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'real-jgitver-'));
const repo = join(scratch, 'repository');
mkdirSync(repo);
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key)));
const mavenBin = process.env.MAVEN_BIN || 'mvn';
function maven(args) {
  const binary = process.platform === 'win32' ? 'cmd.exe' : mavenBin;
  const argv = process.platform === 'win32' ? ['/d', '/s', '/c', mavenBin, ...args] : args;
  const run = spawnSync(binary, argv, { cwd: repo, env, encoding: 'utf8', timeout: 180000 });
  if (run.error || run.status !== 0) throw new Error(
    'Maven failed: ' + (run.error?.message ?? run.status) + '\n' + run.stdout + '\n' + run.stderr);
  return run.stdout;
}
const plugin = 'org.apache.maven.plugins:maven-help-plugin:3.5.1:effective-pom';
const propertiesPath = join(scratch, 'native.properties');
const pomPath = join(scratch, 'effective.xml');
const xmlHeader = '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion>';
const parent = '<parent><groupId>fixture</groupId><artifactId>packages-java-parent</artifactId><version>0.0.0</version></parent>';
let assertions = 0;
const equal = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
function calculate(expectedVersion, stage, expectedPorcelain = '') {
  const sha = git('rev-parse', 'HEAD');
  maven(['-B', '-ntp', '-Djgitver.branch=master', '-Djgitver.resolve-project-version=true',
    '-Djgitver.export-properties-path=' + propertiesPath, plugin, '-Doutput=' + pomPath]);
  const raw = readFileSync(propertiesPath, 'latin1');
  const props = Object.fromEntries(raw.split(/\r?\n/).filter(line => /^jgitver\./.test(line))
    .map(line => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)]; }));
  equal(props['jgitver.used_version'], expectedVersion, stage + ' native version');
  equal(props['jgitver.calculated_version'], expectedVersion, stage + ' calculated version');
  equal(props['jgitver.git_sha1_full'], sha, stage + ' full SHA');
  equal(props['jgitver.plugin-version'], '1.9.0', stage + ' pinned plugin');
  const python = [
    'import json,sys,xml.etree.ElementTree as ET',
    'root=ET.parse(sys.argv[1]).getroot()',
    'ns={"m":"http://maven.apache.org/POM/4.0.0"}',
    'projects=[root] if root.tag.endswith("project") else list(root)',
    'result=[]',
    'for p in projects:',
    '    aid=p.findtext("m:artifactId",namespaces=ns)',
    '    version=p.findtext("m:version",namespaces=ns)',
    '    refs=[{"artifact":d.findtext("m:artifactId",namespaces=ns),"version":d.findtext("m:version",namespaces=ns)} for d in p.findall(".//m:dependency",ns) if d.findtext("m:groupId",namespaces=ns)=="fixture"]',
    '    result.append({"artifact":aid,"version":version,"references":refs})',
    'print(json.dumps(result))',
  ].join('\n');
  const projects = JSON.parse(execFileSync('python', ['-c', python, pomPath], { encoding: 'utf8' }));
  equal(projects.map(p => p.artifact).sort(),
    ['packages-java-parent', 'boilerplate-bom', 'boilerplate-core', 'boilerplate-starter'].sort(),
    stage + ' four reactor artifacts');
  for (const project of projects) {
    equal(project.version, expectedVersion, stage + ' version of ' + project.artifact);
    for (const dependency of project.references) {
      equal(dependency.version, expectedVersion, stage + ' internal reference ' + dependency.artifact);
    }
  }
  equal(git('status', '--porcelain'), expectedPorcelain, stage + ' preserves tracked workspace');
  const collected = collectJgitver({ workspace: repo, projectDirectory: repo, targetBranch: 'master', sha, env });
  equal(collected.version, expectedVersion, stage + ' adapter uses native version');
  equal(collected.sha, sha, stage + ' adapter full SHA');
  if (stage === 'bootstrap') {
    const reportPath = join(scratch, 'version-report.json');
    execFileSync(process.execPath, [resolve(import.meta.dirname, '../../scripts/versioning/collect-version-report.mjs'),
      'jgitver', repo, 'master', sha, repo, process.platform === 'win32' ? 'mvn.cmd' : 'mvn', reportPath],
    { cwd: repo, env, encoding: 'utf8' });
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    equal({adapter:report.adapter,version:report.candidateVersion,sha:report.sha,tag:report.tag,format:report.native.format},
      {adapter:'jgitver',version:'0.0.1',sha,tag:'v0.0.1',format:'java-properties'}, 'CLI normalized native result');
  }
  return { stage, version: props['jgitver.used_version'], sha, nativeBase: props['jgitver.base_tag'], projects };
}
const results = [];
try {
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(join(repo, '.mvn'));
  writeFileSync(join(repo, '.mvn/extensions.xml'),
    '<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>');
  writeFileSync(join(repo, '.mvn/jgitver.config.xml'), '<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">' +
    '<strategy>PATTERN</strategy><versionPattern>0.0.1</versionPattern>' +
    '<tagVersionPattern>${v}</tagVersionPattern><nonQualifierBranches>master</nonQualifierBranches></configuration>');
  writeFileSync(join(repo, '.gitignore'), 'target/\n**/target/\n');
  writeFileSync(join(repo, 'pom.xml'), xmlHeader + '<groupId>fixture</groupId>' +
    '<artifactId>packages-java-parent</artifactId><version>0.0.0</version><packaging>pom</packaging>' +
    '<modules><module>boilerplate-bom</module><module>boilerplate-core</module><module>boilerplate-starter</module></modules></project>');
  for (const artifact of ['boilerplate-bom', 'boilerplate-core', 'boilerplate-starter']) {
    mkdirSync(join(repo, artifact));
    const refs = artifact === 'boilerplate-bom'
      ? '<dependencyManagement><dependencies><dependency><groupId>fixture</groupId><artifactId>boilerplate-core</artifactId><version>${project.version}</version></dependency></dependencies></dependencyManagement>'
      : artifact === 'boilerplate-starter'
        ? '<dependencies><dependency><groupId>fixture</groupId><artifactId>boilerplate-core</artifactId><version>${project.version}</version></dependency></dependencies>'
        : '';
    writeFileSync(join(repo, artifact, 'pom.xml'), xmlHeader + parent + '<artifactId>' + artifact +
      '</artifactId>' + (artifact === 'boilerplate-bom' ? '<packaging>pom</packaging>' : '') + refs + '</project>');
  }
  git('add', '.'); git('commit', '-qm', 'chore: bootstrap Maven fixture');
  equal(git('tag', '--list'), '', 'bootstrap has no manufactured tag');
  results.push(calculate('0.0.1', 'bootstrap'));
  const corePomPath = join(repo, 'boilerplate-core/pom.xml');
  const cleanCorePom = readFileSync(corePomPath, 'utf8');
  const dirtyCorePom = cleanCorePom + '\n<!-- deliberate preexisting dirty change -->\n';
  writeFileSync(corePomPath, dirtyCorePom);
  equal(git('status', '--porcelain'), 'M boilerplate-core/pom.xml', 'dirty fixture changes only tracked core POM');
  results.push(calculate('0.0.1', 'dirty-bootstrap', 'M boilerplate-core/pom.xml'));
  equal(readFileSync(corePomPath, 'utf8'), dirtyCorePom, 'native calculation preserves dirty bytes');
  writeFileSync(corePomPath, cleanCorePom);
  const sha = git('rev-parse', 'HEAD');
  git('tag', '-a', 'v0.0.1', '-m', 'Fixture release');
  git('checkout', '-q', '--detach', sha);
  results.push(calculate('0.0.1', 'tagged-rebuild'));
  git('checkout', '-q', 'master');
  writeFileSync(join(repo, '.mvn/jgitver.config.xml'), '<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">' +
    '<strategy>CONFIGURABLE</strategy><autoIncrementPatch>true</autoIncrementPatch>' +
    '<useCommitDistance>false</useCommitDistance><useSnapshot>false</useSnapshot>' +
    '<nonQualifierBranches>master</nonQualifierBranches></configuration>');
  writeFileSync(join(repo, 'payload.txt'), 'next change\n');
  git('add', '.'); git('commit', '-qm', 'fix: next delivery');
  results.push(calculate('0.0.2', 'next-patch'));
  git('tag', '-a', 'v0.0.2', '-m', 'Fixture next release');
  git('checkout', '-q', '--detach', git('rev-parse', 'HEAD'));
  results.push(calculate('0.0.2', 'stable-profile-tagged-rebuild'));
  git('checkout', '-q', 'master');
  git('tag', '1.0.0');
  writeFileSync(join(repo, 'payload.txt'), 'major change\n');
  git('add', '.'); git('commit', '-qm', 'feat!: major delivery');
  results.push(calculate('1.0.0', 'native-major-checkpoint'));
  const majorSha = git('rev-parse', 'HEAD');
  const majorNative = collectJgitver({ workspace: repo, projectDirectory: repo, targetBranch: 'master', sha: majorSha, env });
  const majorReport = normalizeJgitverReport({ native: majorNative, branch: 'master', sha: majorSha, repository: repo });
  equal({version:majorReport.candidateVersion,base:majorReport.baseVersion,bump:majorReport.bump},
    {version:'1.0.0',base:'0.0.2',bump:'major'}, 'native checkpoint keeps previous published base');
  git('tag', '-a', 'v1.0.0', '-m', 'Fixture major release');
  git('checkout', '-q', '--detach', majorSha);
  results.push(calculate('1.0.0', 'major-tagged-rebuild'));
  git('checkout', '-q', 'master');
  const coreSource = join(repo, 'boilerplate-core/src/main/java/fixture');
  mkdirSync(coreSource, { recursive: true });
  writeFileSync(join(coreSource, 'Core.java'), 'package fixture; public class Core {}\n');
  git('add', '.'); git('commit', '-qm', 'fix: change only core');
  equal(git('diff', '--name-only', 'HEAD^', 'HEAD'), 'boilerplate-core/src/main/java/fixture/Core.java',
    'delivery changes only core, without root/BOM/starter edits');
  results.push(calculate('1.0.1', 'core-only-change'));
  const report = { plugin: '1.9.0', toolchain: maven(['--version']).trim(), assertions, results };
  if (process.env.JGITVER_EVIDENCE_PATH) writeFileSync(resolve(process.env.JGITVER_EVIDENCE_PATH),
    JSON.stringify(report, null, 2) + '\n');
  console.log('Real jgitver: ' + assertions + ' assertions passed; bootstrap/tag/rebuild/reactor validated');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
