import assert from 'node:assert/strict';
import { createReadApi, GitHubHttpError } from '../../scripts/versioning/dist/ports/github.js';
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';
import { evaluateReleasePolicy } from '../../scripts/versioning/dist/services/release-policy.js';

const headSha = 'a'.repeat(40);
const mergeSha = 'c'.repeat(40);
const anotherSha = 'b'.repeat(40);
const repository = 'owner/repo';
const time = value => `2026-10-01T10:${value}:00Z`;

function scenario(mode = 'success') {
  let milestoneTitle = 'v1.0.0';
  const calls = [];
  const pr = () => ({ number: 42, user: { login: mode === 'author' ? 'bob' : 'developer' },
    head: { ref: 'develop', sha: headSha }, base: { ref: 'master' },
    merged_at: time('04'), merge_commit_sha: mergeSha,
    milestone: milestoneTitle ? { title: milestoneTitle } : null });
  const transport = async request => {
    calls.push(request);
    const url = new URL(request.url);
    const path = url.pathname;
    if (mode === 'api-error' && path.endsWith('/timeline')) {
      return { status: 403, headers: {}, body: { message: 'denied' } };
    }
    let body;
    let link;
    if (path.endsWith(`/commits/${mergeSha}/pulls`)) {
      body = mode === 'ambiguous' ? [pr(), { ...pr(), number: 43 }] : [pr()];
    }
    else if (path.endsWith('/pulls/42')) body = pr();
    else if (path.endsWith('/issues/42/timeline')) {
      const events = [{ event: 'labeled', label: { name: 'versioning:override' },
        actor: { login: mode === 'bot-label' ? 'actor[bot]' : 'alice',
          type: mode === 'bot-label' ? 'Bot' : 'User' },
        created_at: mode === 'relabel' ? time('03') : time('00') }];
      if (mode === 'removed-label') events.push({ event: 'unlabeled',
        label: { name: 'versioning:override' }, actor: { login: 'alice' }, created_at: time('02') });
      body = url.searchParams.get('page') === '2' ? events : [];
      if (!url.searchParams.has('page')) link = `<${request.url}&page=2>; rel="next"`;
    } else if (path.endsWith('/pulls/42/reviews')) {
      body = [{ state: 'APPROVED', user: { login: mode === 'bot' ? 'reviewer[bot]' : 'bob',
        type: mode === 'bot' ? 'Bot' : 'User' }, submitted_at: time('01'),
        commit_id: mode === 'stale' ? anotherSha : headSha }];
      if (mode === 'dismissed' || mode === 'changes-requested') {
        body.push({ state: mode === 'dismissed' ? 'DISMISSED' : 'CHANGES_REQUESTED',
          user: { login: 'bob', type: 'User' }, submitted_at: time('02'), commit_id: headSha });
      }
      if (mode === 'pending-review') body.push({ state: 'PENDING', user: { login: 'eve', type: 'User' },
        submitted_at: null, commit_id: headSha });
    } else if (path.includes('/collaborators/')) {
      if (mode === 'role-error') return { status: 403, headers: {}, body: { message: 'denied' } };
      body = { role_name: path.includes('/alice/') ?
        mode === 'unauthorized-label' ? 'write' : 'maintain' : 'admin' };
    } else if (path.endsWith(`/commits/${headSha}/check-runs`) ||
      path.endsWith(`/commits/${mergeSha}/check-runs`)) {
      const requestedSha = path.includes(mergeSha) ? mergeSha : headSha;
      body = { total_count: 1, check_runs: [{ name: 'go-ci', status: 'completed', conclusion: 'success',
        head_sha: mode === 'wrong-ci-sha' ? anotherSha : requestedSha, id: 99 }] };
      if (mode === 'duplicate-ci') body.check_runs.push({ name: 'go-ci', status: 'completed',
        conclusion: 'failure', head_sha: requestedSha, id: 100 });
    } else throw new Error(`Unexpected GET ${path}`);
    return { status: 200, headers: link ? { link } : {}, body };
  };
  const readApi = createReadApi(transport);
  const collect = (options = {}) => collectPrEvidence(readApi, {
    repository, targetBranch: 'master', prNumber: 42, requiredChecks: ['go-ci'], ...options,
  });
  return { collect, calls, setMilestone: title => { milestoneTitle = title; } };
}

const valid = scenario();
const snapshot = await valid.collect();
assert.equal(snapshot.headSha, headSha);
assert.equal(snapshot.override.labeledBy, 'alice');
assert.equal(snapshot.override.labelerRole, 'maintain');
assert.equal(snapshot.override.approvalBy, 'bob');
assert.equal(snapshot.override.approverRole, 'admin');
assert.equal(snapshot.override.reviewedCommitSha, headSha);
assert.equal(snapshot.ciSatisfied, true);
assert.equal(snapshot.checks[0].name, 'go-ci');
assert.equal(valid.calls.every(call => call.method === 'GET'), true);
assert.equal(JSON.stringify(snapshot).includes('TOKEN'), false);
const policy = evaluateReleasePolicy({ report: { sha: headSha, baseVersion: '0.0.0',
  candidateVersion: '0.0.1', bump: 'patch' }, snapshot });
assert.equal(policy.outcome, 'overridden');

for (const mode of ['dismissed', 'changes-requested', 'bot', 'bot-label', 'author', 'stale', 'relabel',
  'removed-label', 'unauthorized-label']) {
  const candidate = await scenario(mode).collect();
  assert.equal(evaluateReleasePolicy({ report: { sha: headSha, baseVersion: '0.0.0',
    candidateVersion: '0.0.1', bump: 'patch' }, snapshot: candidate }).outcome, 'blocked', mode);
}
const changedMilestone = scenario();
assert.equal((await changedMilestone.collect()).milestone.title, 'v1.0.0');
changedMilestone.setMilestone(null);
assert.equal((await changedMilestone.collect()).milestone, null, 'Milestone removal must be re-read');
changedMilestone.setMilestone('v2.0.0');
assert.equal((await changedMilestone.collect()).milestone.title, 'v2.0.0');
await assert.rejects(() => scenario('wrong-ci-sha').collect(), /CI.*SHA/i);
await assert.rejects(() => scenario('duplicate-ci').collect(), /CI obrigatória/);
assert.equal((await scenario('pending-review').collect()).override.approvalBy, 'bob');
await assert.rejects(() => scenario('api-error').collect(), error =>
  error instanceof GitHubHttpError && error.status === 403);
await assert.rejects(() => scenario('role-error').collect(), error =>
  error instanceof GitHubHttpError && error.status === 403);
const merged = await scenario().collect({ prNumber: undefined, commitSha: mergeSha });
assert.equal(merged.mergeCommitSha, mergeSha);
assert.equal(merged.checks[0].headSha, mergeSha, 'Publication CI belongs to the integrated SHA');
await assert.rejects(() => scenario('ambiguous').collect({ prNumber: undefined, commitSha: mergeSha }),
  /Associação ambígua/);
console.log('PR evidence: timeline, effective reviews, roles, SHA, CI and fresh milestones passed');
