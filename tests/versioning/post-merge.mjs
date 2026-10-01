import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'version-post-merge-'));
const workspace = join(temp, 'consumer');
const bare = join(temp, 'origin.git');
const bin = join(temp, 'bin');
const apiWrites = join(temp, 'api-writes.log');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

try {
  mkdirSync(workspace); mkdirSync(bin);
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init', '-b', 'master');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(workspace, 'go.mod'), 'module example.test/release\n\ngo 1.24\n');
  git('add', 'go.mod'); git('commit', '-m', 'feat: initial release');
  const sha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);

  const adapter = join(bin, 'go-gitsemver');
  writeFileSync(adapter, `#!/usr/bin/env node
console.error('native release explanation');
console.log(JSON.stringify({SemVer:'0.0.1',Sha:process.env.GITHUB_SHA}));
`);
  chmodSync(adapter, 0o755);
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'), cp=require('node:child_process');
const a=process.argv.slice(2), path=a.find(v=>v.startsWith('repos/'))??'';
const mode=process.env.FIXTURE_MODE, sha=process.env.GITHUB_SHA;
const git=(...args)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...args],{encoding:'utf8'}).trim();
const pr={number:42,head:{ref:mode==='wrong-head'?'feature/x':'develop',sha},base:{ref:'master'},
  merged_at:'2026-10-01T10:02:00Z',merge_commit_sha:sha,
  milestone:mode==='no-milestone'?null:{title:['bad-milestone','stale-review','unauthorized'].includes(mode)?'v2.0.0':'v0.0.1'}};
if(mode==='api-error'){console.error('simulated API failure');process.exit(1)}
if(a.includes('POST')){fs.appendFileSync(process.env.API_WRITES,a.join(' ')+'\\n');process.exit(3)}
if(path==='repos/acme/consumer'){console.log('master');process.exit(0)}
if(path.endsWith('/git/ref/heads/master')){console.log(mode==='remote-stale'?'f'.repeat(40):git('rev-parse','refs/heads/master'));process.exit(0)}
if(path.includes('/commits/')&&path.includes('/pulls')){console.log(JSON.stringify([mode==='ambiguous'?[pr,{...pr,number:43}]:[pr]]));process.exit(0)}
if(path.endsWith('/pulls/42')){console.log(JSON.stringify(pr));process.exit(0)}
if(path.includes('/timeline')){console.log(JSON.stringify(mode==='bad-milestone'?[[]]:[[{event:'labeled',label:{name:'versioning:override'},actor:{login:'alice'},created_at:'2026-10-01T10:00:00Z'}]]));process.exit(0)}
if(path.includes('/reviews')){console.log(JSON.stringify([[{state:'APPROVED',user:{login:'bob'},submitted_at:'2026-10-01T10:01:00Z',commit_id:mode==='stale-review'?'e'.repeat(40):sha}]]));process.exit(0)}
if(path.includes('/collaborators/')){console.log(JSON.stringify({role_name:mode==='unauthorized'?'triage':path.includes('/alice/')?'maintain':'admin'}));process.exit(0)}
console.error('unexpected '+a.join(' '));process.exit(2);
`);
  chmodSync(gh, 0o755);

  const runGate = (overrides = {}) => spawnSync(bash, ['-c',
    `source '${join(root, 'scripts/versioning/release-gates.sh').replaceAll('\\', '/')}' && validate_release_gates && ` +
    `node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(process.env.VERSION_REPORT_PATH));` +
    `const p=JSON.parse(fs.readFileSync(process.env.RELEASE_POLICY_PATH));` +
    `if(r.sha!==process.env.GITHUB_SHA||!['matched','adapter-authoritative','overridden'].includes(p.outcome))process.exit(1)"`], {
    cwd: workspace, encoding: 'utf8', env: { ...process.env,
      PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      MOCK_BARE: bare, API_WRITES: apiWrites, GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'acme/consumer',
      GITHUB_WORKSPACE: workspace, GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master',
      GITHUB_SHA: sha, ADAPTER: 'go-gitsemver', TARGET_BRANCH: 'master', PROJECT_PATH: '.', ...overrides },
  });

  const valid = runGate();
  assert.equal(valid.status, 0, valid.stderr);
  assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'gate must not perform API writes');
  const withoutMilestone = runGate({ FIXTURE_MODE: 'no-milestone' });
  assert.equal(withoutMilestone.status, 0, withoutMilestone.stderr);
  for (const overrides of [
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF_NAME: 'develop' },
    { GITHUB_SHA: 'd'.repeat(40) }, { FIXTURE_MODE: 'remote-stale' },
    { FIXTURE_MODE: 'wrong-head' }, { FIXTURE_MODE: 'ambiguous' },
    { FIXTURE_MODE: 'bad-milestone' }, { FIXTURE_MODE: 'stale-review' },
    { FIXTURE_MODE: 'unauthorized' }, { FIXTURE_MODE: 'api-error' },
  ]) {
    const failed = runGate(overrides);
    assert.notEqual(failed.status, 0, `gate must fail for ${JSON.stringify(overrides)}`);
    assert.throws(() => readFileSync(apiWrites), /ENOENT/, 'failure must happen before API writes');
  }
  console.log('Pós-merge: 24 assertions de proveniência e policy aprovadas');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
