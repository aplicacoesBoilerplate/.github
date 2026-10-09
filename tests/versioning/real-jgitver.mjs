import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeJgitverReport } from '../../scripts/versioning/version-report.mjs';

const cwd = mkdtempSync(join(tmpdir(), 'real-jgitver-'));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
try {
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  mkdirSync(join(cwd, '.mvn'));
  writeFileSync(join(cwd, 'pom.xml'), `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion><groupId>example.test</groupId>
  <artifactId>jgitver-fixture</artifactId><version>0.1.0</version></project>\n`);
  writeFileSync(join(cwd, '.mvn', 'extensions.xml'), `<extensions>
  <extension><groupId>fr.brouillard.oss</groupId>
  <artifactId>jgitver-maven-plugin</artifactId><version>1.8.0</version></extension>
</extensions>\n`);
  writeFileSync(join(cwd, '.mvn', 'jgitver.config.xml'), `<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">
  <strategy>CONFIGURABLE</strategy><useSnapshot>false</useSnapshot>
  <nonQualifierBranches>master</nonQualifierBranches>
</configuration>\n`);
  git('add', '.'); git('commit', '-qm', 'chore: base'); git('tag', 'v0.1.0');
  writeFileSync(join(cwd, 'feature.txt'), 'feature\n');
  git('add', '.'); git('commit', '-qm', 'fix: change');
  const sha = git('rev-parse', 'HEAD');
  const output = execFileSync('mvn', ['-q', '-Dstyle.color=never', '-DforceStdout',
    'help:evaluate', '-Dexpression=project.version'], {
    cwd, encoding: 'utf8', timeout: 180000,
    env: { ...process.env, JGITVER_BRANCH: 'master' },
  });
  const report = normalizeJgitverReport({ nativeOutput: output, branch: 'master', sha, repository: cwd });
  assert.equal(report.adapter, 'jgitver');
  assert.equal(report.sha, sha);
  assert.equal(report.baseVersion, '0.1.0');
  assert.match(report.candidateVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(git('rev-parse', 'HEAD'), sha);
  console.log(`jgitver real: project.version=${report.candidateVersion} no SHA ${sha}`);
} finally { rmSync(cwd, { recursive: true, force: true }); }
