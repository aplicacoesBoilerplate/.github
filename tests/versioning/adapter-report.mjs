import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'adapter-report-'));
const shared = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
try {
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
  mkdirSync(join(root, '.mvn'));
  writeFileSync(join(root, 'package.json'), '{"version":"1.0.0"}\n');
  writeFileSync(join(root, 'pom.xml'), '<project/>\n');
  writeFileSync(join(root, '.mvn', 'extensions.xml'), '<extensions><extension><groupId>fr.brouillard.oss</groupId><artifactId>jgitver-maven-plugin</artifactId><version>1.9.0</version></extension></extensions>\n');
  const standard = join(root, 'node_modules', '.bin', 'standard-version');
  writeFileSync(standard, `#!/usr/bin/env node
if(!process.argv.includes('--dry-run')||!process.argv.includes('infra/v'))process.exit(9);
console.log('bumping version in package.json from 1.0.0 to 1.1.0');
`);
  chmodSync(standard, 0o755);
  const maven = join(root, 'mvnw');
  writeFileSync(maven, `#!/usr/bin/env node
if(process.env.JGITVER_BRANCH!=='master')process.exit(8);
const path=process.argv.find(arg=>arg.startsWith('-Djgitver.export-properties-path=')).split('=').slice(1).join('=');
require('node:fs').writeFileSync(path,['jgitver.used_version=1.0.1','jgitver.calculated_version=1.0.1',
  'jgitver.git_sha1_full='+process.env.GITHUB_SHA,'jgitver.plugin-version=1.9.0'].join('\\n')+'\\n');
`);
  chmodSync(maven, 0o755);
  if (process.platform !== 'win32') assert.equal(statSync(maven).mode & 0o111, 0o111,
    'the native Maven fixture must be executable on POSIX runners');
  git('add', 'package.json', 'pom.xml', '.mvn', 'mvnw'); git('commit', '-qm', 'feat: fixture');
  const sha = git('rev-parse', 'HEAD'); git('tag', 'infra/v1.0.0'); git('tag', 'v1.0.0');
  for (const [adapter, prefix, expected] of [
    ['standard-version', 'infra/v', '1.1.0'], ['jgitver', 'v', '1.0.1'],
  ]) {
    const output = join(root, `${adapter}.json`);
    const result = spawnSync(process.execPath, [join(shared, 'scripts/versioning/collect-version-report.mjs'),
      adapter, root, 'master', sha, root, adapter === 'jgitver' ? maven : standard, output, prefix], {
      cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_WORKSPACE: root,
        GITHUB_SHA: sha, ADAPTER: adapter, TARGET_BRANCH: 'master', PROJECT_PATH: '.', TAG_PREFIX: prefix },
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(report.candidateVersion, expected);
    assert.equal(report.tag, `${prefix}${expected}`);
    assert.equal(report.sha, sha);
  }
  console.log('Collector: native standard-version and jgitver normalized');
} finally { rmSync(root, { recursive: true, force: true }); }
