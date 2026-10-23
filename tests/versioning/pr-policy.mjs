import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'pr-policy-'));
const bin = join(workspace, 'bin');
const output = join(workspace, 'snapshot.json');
const calls = join(workspace, 'calls.log');
const sha = 'a'.repeat(40);
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';
import { createReadApi } from '../../scripts/versioning/dist/ports/github.js';

try {
  const run = async (mode = 'success', args = ['42', output], overrides = {}) => {
    const pr={number:42,head:{ref:overrides.TEST_HEAD??'develop',sha},base:{ref:'master'},
      user:{login:'developer',type:'User'},merged_at:'2026-10-01T10:02:00Z',merge_commit_sha:sha,milestone:{title:'v2.0.0'}};
    const timeline=[
      [{event:'labeled',label:{name:'versioning:override'},actor:{login:'old',type:'User'},created_at:'2026-10-01T09:00:00Z'},
       {event:'unlabeled',label:{name:'versioning:override'},actor:{login:'old',type:'User'},created_at:'2026-10-01T09:10:00Z'}],
      [{event:'labeled',label:{name:'versioning:override'},actor:{login:'alice',type:'User'},
        created_at:mode==='relabel'?'2026-10-01T10:02:00Z':'2026-10-01T10:00:00Z'}]];
    const later=mode==='dismissed'?'DISMISSED':mode==='changes-requested'?'CHANGES_REQUESTED':'APPROVED';
    const reviews=[
      [{state:'APPROVED',user:{login:'early',type:'User'},submitted_at:'2026-10-01T09:59:00Z',commit_id:sha}],
      [{state:'APPROVED',user:{login:'bob',type:'User'},submitted_at:'2026-10-01T10:01:00Z',commit_id:mode==='stale'?'b'.repeat(40):sha},
       {state:later,user:{login:'bob',type:'User'},submitted_at:mode==='relabel'?'2026-10-01T10:01:00Z':'2026-10-01T10:03:00Z',
        commit_id:mode==='stale'?'b'.repeat(40):sha}]];
    const transport=async request=>{
      assert.equal(request.method,'GET');
      const url=new URL(request.url), path=url.pathname, page=Number(url.searchParams.get('page')??'1');
      appendFileSync(calls,path+url.search+'\n');
      if(mode==='api-error'||mode==='timeline-error'&&path.endsWith('/timeline')||
        mode==='reviews-error'&&path.endsWith('/reviews')||mode==='role-error'&&path.includes('/collaborators/')) {
        return {status:502,headers:{},body:{message:'controlled API failure'}};
      }
      if(mode==='incomplete'&&path.endsWith('/timeline')&&page===2) return {status:200,headers:{},body:{notAnArray:true}};
      let body,headers={};
      const paginate=pages=>{
        if(page===1&&pages.length>1){const next=new URL(url);next.searchParams.set('page','2');headers.link='<'+next.href+'>; rel="next"';}
        return pages[page-1]??[];
      };
      if(path.includes('/commits/')&&path.endsWith('/pulls')) body=mode==='zero'?[]:mode==='ambiguous'?[pr,{...pr,number:43}]:[pr];
      else if(path.endsWith('/pulls/42')) body=pr;
      else if(path.endsWith('/timeline')) body=paginate(timeline);
      else if(path.endsWith('/reviews')) body=paginate(reviews);
      else if(path.includes('/collaborators/')){
        const user=path.split('/collaborators/')[1].split('/')[0];
        body={role_name:user==='old'?'triage':user==='early'?'write':user==='alice'?'maintain':'admin'};
      } else if(path.endsWith('/check-runs')) body={check_runs:[{id:1,head_sha:sha,name:'build',status:'completed',conclusion:'success'}]};
      else throw Error('unexpected '+path);
      return {status:200,headers,body};
    };
    try {
      const byCommit=args[0]==='--commit';
      const snapshot=await collectPrEvidence(createReadApi(transport),{repository:'owner/repo',targetBranch:'master',
        ...(byCommit?{commitSha:args[1]}:{prNumber:Number(args[0])})});
      writeFileSync(byCommit?args[2]:args[1],JSON.stringify(snapshot,null,2)+'\n');
      return {status:0,stderr:''};
    } catch(error) { return {status:1,stderr:error.message}; }
  };

  const success = await run();
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
  assert.match(callLog, /timeline\?per_page=100&page=2/);
  assert.match(callLog, /reviews\?per_page=100&page=2/);

  for (const mode of ['dismissed', 'changes-requested', 'relabel', 'stale']) {
    const invalidated = await run(mode);
    assert.equal(invalidated.status, 0, invalidated.stderr);
    const invalidatedSnapshot = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(invalidatedSnapshot.override.approvalBy, null,
      `${mode} must invalidate the historical approval`);
    assert.equal(invalidatedSnapshot.override.reviewedCommitSha, null,
      `${mode} must not retain an invalidated review SHA`);
  }

  const byCommit = await run('success', ['--commit', sha, output]);
  assert.equal(byCommit.status, 0, byCommit.stderr);
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).number, 42);
  const hotfixCommit = await run('success', ['--commit', sha, output], { TEST_HEAD: 'hotfix/correct-production' });
  assert.equal(hotfixCommit.status, 0, hotfixCommit.stderr);
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).headBranch, 'hotfix/correct-production');
  for (const [mode, head] of [['zero', 'hotfix/fix'], ['ambiguous', 'hotfix/fix'],
    ['success', 'hotfix'], ['success', 'hotfix/'], ['success', 'feature/fix']]) {
    rmSync(output, { force: true });
    const invalid = await run(mode, ['--commit', sha, output], { TEST_HEAD: head });
    assert.notEqual(invalid.status, 0, `${mode}/${head} cannot authorize publication`);
    assert.equal(existsSync(output), false);
  }

  const expectFailure = async (mode, args, diagnostic, priorCalls = []) => {
    rmSync(output, { force: true });
    writeFileSync(calls, '');
    const failed = await run(mode, args);
    assert.notEqual(failed.status, 0, `${mode} must fail closed`);
    assert.match(failed.stderr, diagnostic);
    assert.equal(existsSync(output), false, `${mode} must not create a policy snapshot`);
    const failedCalls = readFileSync(calls, 'utf8');
    for (const expectedCall of priorCalls) assert.match(failedCalls, expectedCall);
  };
  await expectFailure('zero', ['--commit', sha, output],
    /Associação ambígua: 0 PRs integrados \(develop ou hotfix\/<nome>\) -> master/);
  await expectFailure('ambiguous', ['--commit', sha, output],
    /Associação ambígua: 2 PRs integrados \(develop ou hotfix\/<nome>\) -> master/);
  await expectFailure('timeline-error', ['42', output], /HTTP 502/,
    [/pulls\/42/, /timeline/]);
  await expectFailure('reviews-error', ['42', output], /HTTP 502/,
    [/pulls\/42/, /timeline/, /reviews/]);
  await expectFailure('role-error', ['42', output], /HTTP 502/,
    [/pulls\/42/, /timeline/, /reviews/, /collaborators\/alice\/permission/]);
  assert.notEqual((await run('api-error')).status, 0, 'API errors must fail closed');
  assert.notEqual((await run('incomplete')).status, 0, 'incomplete pagination must fail closed');
  console.log('PR policy: current review state and invalidation rules passed');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
