import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tool = process.env.GO_GITSEMVER_BIN || 'go-gitsemver';
const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const bash = process.env.BASH_BIN || (process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash');
const repo = mkdtempSync(join(tmpdir(), 'real-go-gitsemver-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const calculate = () => {
  const sha = git('rev-parse', 'HEAD');
  const raw = execFileSync(tool, ['--branch', 'master', '--commit', sha, '-o', 'json', '--explain'],
    { cwd: repo, encoding: 'utf8' });
  const result = JSON.parse(raw);
  assert.equal(result.Sha, sha);
  assert.match(result.SemVer, /^\d+\.\d+\.\d+$/);
  return result.SemVer;
};
let count = 0;
const commit = message => {
  writeFileSync(join(repo, 'payload.txt'), String(++count));
  git('add', '.');
  git('commit', '-m', message);
};

try {
  git('init', '-b', 'master');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(join(repo, '.github'));
  writeFileSync(join(repo, '.github', 'GitVersion.yml'), `mode: Mainline
base-version: 0.0.0
next-version: 0.0.1
commit-message-incrementing: Disabled
branches:
  main:
    regex: ^master$
    is-mainline: true
    increment: Patch
    tag: ''
  release:
    regex: ^release[/-]
    is-release-branch: false
`);
  commit('feat: bootstrap');
  assert.equal(calculate(), '0.0.1', 'native bootstrap version');
  git('tag', 'v0.0.1');
  const publishedSha = git('rev-parse', 'HEAD');
  cpSync(resolve(import.meta.dirname, '../../scripts/versioning'), join(repo, 'scripts/versioning'),
    { recursive: true });
  for (const file of readdirSync(join(repo, 'scripts/versioning')).filter(name => name.endsWith('.sh'))) {
    const path = join(repo, 'scripts/versioning', file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\r\n', '\n'));
  }
  const rerun = execFileSync(bash, ['scripts/versioning/prepare-release.sh'],
    { cwd: repo, encoding: 'utf8', env: { ...process.env,
      RELEASE_GATES_VALIDATED: '1', ADAPTER: 'go-gitsemver', PROJECT_PATH: '.',
      GITHUB_WORKSPACE: repo, TARGET_BRANCH: 'master', GITHUB_SHA: publishedSha } });
  assert.equal(rerun.trim(), '0.0.1', 'an existing release tag must remain publishable on rerun');
  rmSync(join(repo, 'scripts'), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  git('switch', '-c', 'release/v9.9.9');
  commit('fix: sprint payload');
  const releaseSha = git('rev-parse', 'HEAD');
  const releaseResult = JSON.parse(execFileSync(tool,
    ['--branch', 'release/v9.9.9', '--commit', releaseSha, '-o', 'json'],
    { cwd: repo, encoding: 'utf8' }));
  assert.equal(releaseResult.Sha, releaseSha);
  assert.ok(!releaseResult.SemVer.startsWith('9.9.9'),
    'the sprint branch name must not become the application version');
  git('switch', 'master');

  writeFileSync(join(repo, '.github', 'GitVersion.yml'), `mode: Mainline
base-version: 0.0.0
branches:
  main:
    regex: ^master$
    is-mainline: true
    increment: Patch
    tag: ''
  release:
    regex: ^release[/-]
    is-release-branch: false
`);
  git('add', '.github/GitVersion.yml');
  git('commit', '-m', 'chore: remove bootstrap overrides');
  commit('fix: correct behavior');
  const fix = calculate();
  assert.equal(fix, '0.0.2');
  git('tag', `v${fix}`);
  commit('feat: add feature');
  const feature = calculate();
  assert.equal(feature, '0.1.0');
  git('tag', 'v1.0.0');
  commit('feat!: change contract');
  const breaking = calculate();
  assert.equal(breaking, '2.0.0');
  git('tag', `v${breaking}`);
  commit('fix: first delivery');
  commit('feat: second delivery');
  const multiple = calculate();
  assert.equal(multiple, '2.1.0', 'the highest increment across one sprint is applied once');
  assert.notEqual(multiple, '9.9.9', 'milestone label must not drive application version');
  writeFileSync(join(repo, '.github', 'GitVersion.yml'), 'mode: InvalidMode\n');
  git('add', '.github/GitVersion.yml');
  git('commit', '-m', 'test: invalid native configuration');
  assert.throws(calculate, 'invalid native configuration must fail before publication');
  console.log('Real go-gitsemver: bootstrap, fix, feat, breaking change and combined sprint passed');
} finally {
  rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
