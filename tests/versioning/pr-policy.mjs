import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'pr-policy-'));
const bin = join(workspace, 'bin');
const output = join(workspace, 'snapshot.json');
const calls = join(workspace, 'calls.log');
const sha = 'a'.repeat(40);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

try {
  mkdirSync(bin);
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'); const a=process.argv.slice(2); const path=a[a.indexOf('api')+1];
fs.appendFileSync(process.env.CALLS_FILE, a.join(' ')+'\\n');
const mode=process.env.FIXTURE_MODE;
if(mode==='api-error'||mode==='incomplete'){console.error('simulated API failure');process.exit(1)}
const sha=process.env.TEST_SHA;
const pr={number:42,head:{ref:process.env.TEST_HEAD??'develop',sha},base:{ref:'master'},merged_at:'2026-10-01T10:02:00Z',merge_commit_sha:sha,milestone:{title:'v2.0.0'}};
if(mode==='timeline-error'&&path.includes('/timeline')){console.error('simulated timeline failure');process.exit(1)}
if(mode==='reviews-error'&&path.includes('/reviews')){console.error('simulated reviews failure');process.exit(1)}
if(mode==='role-error'&&path.includes('/collaborators/')){console.error('simulated role failure');process.exit(1)}
if(path.includes('/commits/')) { const values=mode==='zero'?[]:mode==='ambiguous'?[pr,{...pr,number:43}]:[pr]; console.log(JSON.stringify([values])); }
else if(path.endsWith('/pulls/42')) console.log(JSON.stringify(pr));
else if(path.includes('/timeline')) console.log(JSON.stringify([[
  {event:'labeled',label:{name:'versioning:override'},actor:{login:'old'},created_at:'2026-10-01T09:00:00Z'},
  {event:'unlabeled',label:{name:'versioning:override'},actor:{login:'old'},created_at:'2026-10-01T09:10:00Z'}],
  [{event:'labeled',label:{name:'versioning:override'},actor:{login:'alice'},created_at:mode==='relabel'?'2026-10-01T10:02:00Z':'2026-10-01T10:00:00Z'}]]));
else if(path.includes('/reviews')) { const later=mode==='dismissed'?'DISMISSED':mode==='changes-requested'?'CHANGES_REQUESTED':'APPROVED', laterAt=mode==='relabel'?'2026-10-01T10:01:00Z':'2026-10-01T10:03:00Z'; console.log(JSON.stringify([[
  {state:'APPROVED',user:{login:'early'},submitted_at:'2026-10-01T09:59:00Z',commit_id:sha}],
  [{state:'APPROVED',user:{login:'bob'},submitted_at:'2026-10-01T10:01:00Z',commit_id:mode==='stale'?'b'.repeat(40):sha},
   {state:later,user:{login:'bob'},submitted_at:laterAt,commit_id:mode==='stale'?'b'.repeat(40):sha}]])); }
else if(path.includes('/collaborators/')) { const u=path.split('/collaborators/')[1].split('/')[0];
  console.log(JSON.stringify({role_name:u==='old'?'triage':u==='early'?'write':u==='alice'?'maintain':'admin'})); }
else { console.error('unexpected '+path); process.exit(2); }
`);
  chmodSync(gh, 0o755);
  const run = (mode = 'success', args = ['42', output], overrides = {}) => spawnSync(bash,
    [join(root, 'scripts/versioning/collect-pr-policy.sh'), ...args], {
      cwd: workspace, encoding: 'utf8', env: { ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'owner/repo', TARGET_BRANCH: 'master',
        FIXTURE_MODE: mode, TEST_SHA: sha, CALLS_FILE: calls, ...overrides },
    });

  const success = run();
  assert.equal(success.status, 0, success.stderr);
  const snapshot = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(snapshot.number, 42);
  assert.equal(snapshot.headSha, sha);
  assert.equal(snapshot.milestone.title, 'v2.0.0');
  assert.equal(snapshot.override.labelPresent, true);
  assert.equal(snapshot.override.labeledBy, 'alice');
  assert.equal(snapshot.override.labelerRole, 'maintain');
  assert.equal(snapshot.override.approvalBy, 'bob', JSON.stringify(snapshot));
  assert.equal(snapshot.override.approverRole, 'admin', readFileSync(calls, 'utf8'));
  assert.equal(snapshot.override.reviewedCommitSha, sha);
  const callLog = readFileSync(calls, 'utf8');
  assert.match(callLog, /timeline.*--paginate.*--slurp/);
  assert.match(callLog, /reviews.*--paginate.*--slurp/);

  for (const mode of ['dismissed', 'changes-requested', 'relabel', 'stale']) {
    const invalidated = run(mode);
    assert.equal(invalidated.status, 0, invalidated.stderr);
    const invalidatedSnapshot = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(invalidatedSnapshot.override.approvalBy, null,
      `${mode} must invalidate the historical approval`);
    assert.equal(invalidatedSnapshot.override.reviewedCommitSha, null,
      `${mode} must not retain an invalidated review SHA`);
  }

  const byCommit = run('success', ['--commit', sha, output]);
  assert.equal(byCommit.status, 0, byCommit.stderr);
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).number, 42);
  const hotfixCommit = run('success', ['--commit', sha, output], { TEST_HEAD: 'hotfix/correct-production' });
  assert.equal(hotfixCommit.status, 0, hotfixCommit.stderr);
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).headBranch, 'hotfix/correct-production');
  for (const [mode, head] of [['zero', 'hotfix/fix'], ['ambiguous', 'hotfix/fix'],
    ['success', 'hotfix'], ['success', 'hotfix/'], ['success', 'feature/fix']]) {
    rmSync(output, { force: true });
    const invalid = run(mode, ['--commit', sha, output], { TEST_HEAD: head });
    assert.notEqual(invalid.status, 0, `${mode}/${head} cannot authorize publication`);
    assert.equal(existsSync(output), false);
  }

  const expectFailure = (mode, args, diagnostic, priorCalls = []) => {
    rmSync(output, { force: true });
    writeFileSync(calls, '');
    const failed = run(mode, args);
    assert.notEqual(failed.status, 0, `${mode} must fail closed`);
    assert.match(failed.stderr, diagnostic);
    assert.equal(existsSync(output), false, `${mode} must not create a policy snapshot`);
    const failedCalls = readFileSync(calls, 'utf8');
    for (const expectedCall of priorCalls) assert.match(failedCalls, expectedCall);
  };
  expectFailure('zero', ['--commit', sha, output],
    /Associação ambígua: 0 PRs integrados \(develop ou hotfix\/<nome>\) -> master/);
  expectFailure('ambiguous', ['--commit', sha, output],
    /Associação ambígua: 2 PRs integrados \(develop ou hotfix\/<nome>\) -> master/);
  expectFailure('timeline-error', ['42', output], /simulated timeline failure/,
    [/pulls\/42/, /timeline/]);
  expectFailure('reviews-error', ['42', output], /simulated reviews failure/,
    [/pulls\/42/, /timeline/, /reviews/]);
  expectFailure('role-error', ['42', output], /simulated role failure/,
    [/pulls\/42/, /timeline/, /reviews/, /collaborators\/alice\/permission/]);
  assert.notEqual(run('api-error').status, 0, 'API errors must fail closed');
  assert.notEqual(run('incomplete').status, 0, 'incomplete pagination must fail closed');
  console.log('PR policy: current review state and invalidation rules passed');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
