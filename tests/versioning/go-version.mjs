import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'go-version-'));
const bin = join(workspace, 'bin');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

try {
  mkdirSync(bin);
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
  writeFileSync(join(workspace, 'go.mod'), 'module example.test/fixture\n\ngo 1.24\n');
  git('add', 'go.mod'); git('commit', '-qm', 'chore: bootstrap');
  const commit = git('rev-parse', 'HEAD');
  const tool = join(bin, 'go-gitsemver');
  writeFileSync(tool, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (!args.includes('--branch') || !args.includes('master') ||
    !args.includes('--commit') || !args.includes(process.env.GITHUB_SHA) ||
    !args.includes('-o') || !args.includes('json') || !args.includes('--explain')) {
  console.error('Expected native go-gitsemver JSON/explain invocation'); process.exit(2);
}
console.error('native explanation');
if (process.env.EXECUTION_MARKER) require('node:fs').writeFileSync(process.env.EXECUTION_MARKER, 'executed');
console.log(JSON.stringify({SemVer:process.env.TEST_VERSION,Sha:process.env.TEST_SHA}));
`);
  chmodSync(tool, 0o755);

  const run = (version, sha) => spawnSync(bash, [join(root, 'scripts/versioning/prepare-release.sh')], {
    cwd: workspace,
    encoding: 'utf8',
    env: { ...process.env,
      PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      RELEASE_GATES_VALIDATED: '1', ADAPTER: 'go-gitsemver', PROJECT_PATH: '.',
      GITHUB_WORKSPACE: workspace, TARGET_BRANCH: 'master', GITHUB_SHA: commit,
      TEST_VERSION: version, TEST_SHA: sha },
  });

  const valid = run('0.0.1', commit);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stdout.trim(), '0.0.1');
  assert.match(valid.stderr, /native explanation/);

  const wrongCommit = run('0.0.1', 'b'.repeat(40));
  assert.notEqual(wrongCommit.status, 0, 'must reject a version calculated for another commit');

  const emptyCommitWithoutTag = run('0.0.1', '');
  assert.notEqual(emptyCommitWithoutTag.status, 0,
    'an empty native SHA is only valid when the matching tag points at the integrated commit');

  const prerelease = run('0.0.2-beta.1', commit);
  assert.notEqual(prerelease.status, 0, 'must reject prereleases');

  const malformed = run('invalid', commit);
  assert.notEqual(malformed.status, 0, 'must reject malformed native output');

  const artifactDirectory = mkdtempSync(join(tmpdir(), 'version-report-output-'));
  const reportPath = join(artifactDirectory, 'version-report.json');
  const marker = join(bin, 'adapter-executed');
  const runCollector = (extraEnv = {}, projectPath = '.') => spawnSync(bash,
    [join(root, 'scripts/versioning/collect-version-report.sh'), reportPath], {
      cwd: workspace,
      encoding: 'utf8',
      env: { ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        ADAPTER: 'go-gitsemver', PROJECT_PATH: projectPath, GITHUB_WORKSPACE: workspace,
        TARGET_BRANCH: 'master', GITHUB_SHA: commit, TEST_VERSION: '0.0.1', TEST_SHA: commit,
        EXECUTION_MARKER: marker, ...extraEnv },
    });
  const before = git('status', '--porcelain');
  const collected = runCollector();
  assert.equal(collected.status, 0, collected.stderr);
  const normalized = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(normalized.candidateVersion, '0.0.1');
  assert.equal(normalized.sha, commit);
  assert.equal(normalized.native.result.SemVer, '0.0.1');
  assert.equal(normalized.native.explanation.trim(), 'native explanation');
  assert.equal(git('status', '--porcelain'), before, 'collector must not mutate tracked consumer files');

  rmSync(marker, { force: true });
  const unknown = runCollector({ ADAPTER: 'shell-from-pr' });
  assert.notEqual(unknown.status, 0, 'unknown adapter must fail');
  assert.equal(existsSync(marker), false, 'unknown adapter must fail before command execution');
  const unsafe = runCollector({}, '../outside');
  assert.notEqual(unsafe.status, 0, 'unsafe project path must fail');
  assert.equal(existsSync(marker), false, 'unsafe path must fail before adapter execution');
  rmSync(artifactDirectory, { recursive: true, force: true });
  console.log('Go version: native JSON, commit identity and stable version validated');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
