import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tool = process.env.GO_GITSEMVER_BIN || 'go-gitsemver';
import { collectGoVersion } from '../../scripts/versioning/dist/adapters/go-gitsemver.js';
import { createGitPort } from '../../scripts/versioning/dist/ports/git.js';
import { preparePublication } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
import { publishReleasePlan } from '../../scripts/versioning/dist/services/publication.js';
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
  const reportPath = join(repo, 'version-report.json');
  execFileSync(process.execPath, [resolve(import.meta.dirname,'../../scripts/versioning/collect-version-report.mjs'),
    'go-gitsemver', repo, 'master', publishedSha, repo, tool, reportPath], {
    cwd: repo, encoding: 'utf8', env: process.env,
  });
  const taggedReport = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(taggedReport.sha, publishedSha, 'collector reconciles the tagged commit SHA');
  assert.equal(taggedReport.tag, 'v0.0.1', 'collector preserves the exact native candidate tag');
  const context={repository:repo,workspace:repo,projectPath:'.',targetBranch:'master',
    sha:publishedSha,tagPrefix:'v',configuration:{adapterBin:tool}};
  const pr={number:7,head:{ref:'develop',sha:publishedSha},base:{ref:'master'},
    user:{login:'developer',type:'User'},merged_at:'2026-10-01T10:00:00Z',merge_commit_sha:publishedSha,milestone:null};
  const read={
    async get(endpoint){
      if(endpoint==='repos/acme/real-go')return {default_branch:'master'};
      if(endpoint.endsWith('/git/ref/heads/master'))return {object:{type:'commit',sha:publishedSha}};
      if(endpoint.endsWith('/pulls/7'))return pr;
      throw Error('unexpected GET '+endpoint);
    },
    async list(endpoint){
      if(endpoint.includes('/commits/')&&endpoint.includes('/pulls'))return [pr];
      if(endpoint.includes('/timeline')||endpoint.includes('/reviews'))return [];
      throw Error('unexpected list '+endpoint);
    },
    async listField(endpoint){assert.ok(endpoint.includes('/check-runs'));
      return [{id:1,head_sha:publishedSha,name:'go-ci',status:'completed',conclusion:'success'}];},
    async getOptional(endpoint){
      if(endpoint.endsWith('/git/ref/tags/v0.0.1'))return {object:{type:'commit',sha:publishedSha}};
      if(endpoint.endsWith('/releases/tags/v0.0.1'))return {tag_name:'v0.0.1',target_commitish:publishedSha,html_url:'https://example.test/v0.0.1'};
      throw Error('unexpected optional GET '+endpoint);
    }
  };
  const gitPort=createGitPort(repo);
  const evidence=await preparePublication({owner:'acme',repo:'real-go',adapter:'go-gitsemver',context,
    producer:{repository:'acme/real-go',runId:1,runAttempt:1,job:'validate-publication',centralSha:'c'.repeat(40)},
    read,git:gitPort,requiredChecks:['go-ci'],implementations:{'go-gitsemver':{collect:collectGoVersion}}});
  assert.equal(evidence.report.candidateVersion,'0.0.1','tagged native candidate remains publishable on rerun');
  assert.equal(evidence.functionalSha,publishedSha);
  let writes=0;
  const rejectWrite=async()=>{writes++;throw Error('an idempotent rerun cannot write');};
  for(let attempt=0;attempt<10;attempt++){
    const result=await publishReleasePlan({owner:'acme',repo:'real-go',plan:evidence.plan,publishedSha,
      read,write:{post:rejectWrite,patch:rejectWrite,put:rejectWrite,delete:rejectWrite},
      verify:async()=>{gitPort.verifyInputs(evidence.gitInputs,publishedSha,['v0.0.1'],'go-gitsemver');return {publishedSha};}});
    assert.equal(result.outcome,'already-published','collector-to-reader-to-publisher reconciles the exact tagged SHA');
    assert.equal(result.publishedSha,publishedSha);
    assert.equal(result.entries[0].releaseUrl,'https://example.test/v0.0.1');
  }
  assert.equal(writes,0);
  rmSync(reportPath);
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
