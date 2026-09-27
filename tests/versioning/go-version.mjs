import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'go-version-'));
const bin = join(workspace, 'bin');
const commit = 'a'.repeat(40);

try {
  mkdirSync(bin);
  const tool = join(bin, 'go-gitsemver');
  writeFileSync(tool, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (!args.includes('--branch') || !args.includes('master') ||
    !args.includes('--commit') || !args.includes(process.env.GITHUB_SHA) ||
    !args.includes('-o') || !args.includes('json') || !args.includes('--explain')) {
  console.error('Expected native go-gitsemver JSON/explain invocation'); process.exit(2);
}
console.error('native explanation');
console.log(JSON.stringify({SemVer:process.env.TEST_VERSION,Sha:process.env.TEST_SHA}));
`);
  chmodSync(tool, 0o755);

  const run = (version, sha) => spawnSync('bash', [join(root, 'scripts/versioning/prepare-release.sh')], {
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
  console.log('Go version: native JSON, commit identity and stable version validated');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
