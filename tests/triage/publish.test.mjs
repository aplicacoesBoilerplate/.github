import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publishTriage } from '../../scripts/triage/publish.mjs';
import { preparePatch, cleanupPreparedPatch } from '../../scripts/triage/prepare-patch.mjs';
import { validateAndPackage } from '../../scripts/llm/result.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
function git(root, ...args) {
  const value = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(value.status, 0, value.stderr); return value.stdout.trim();
}
async function fixture(t, route = 'plan') {
  const root = await mkdtemp(join(tmpdir(), 'triage-publish-')); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, 'source'); await mkdir(sourceRoot); git(sourceRoot, 'init', '-q');
  git(sourceRoot, 'config', 'user.name', 'Fixture'); git(sourceRoot, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(sourceRoot, 'main.go'), 'old\n'); git(sourceRoot, 'add', '.'); git(sourceRoot, 'commit', '-qm', 'base');
  const source_sha = git(sourceRoot, 'rev-parse', 'HEAD');
  const config = { schema_version: 1, project: { owner: 'owner', number: 12 }, fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
    llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' }, reviewer: 'reviewer', allowed_paths: ['main.go'],
    checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {} };
  const snapshot = { repository: 'owner/app', issue: { number: 7, title: 'Fix issue', node_id: 'I7', state: 'open', updated_at: '2026-10-14T10:00:00Z' },
    metadata: { milestone: { number: 1, title: 'v1.0.0' } }, base_ref: 'release/v1.0.0', source_sha, config_source_sha: 'a'.repeat(40),
    fingerprint: 'b'.repeat(64), route: { route, reasons: [route === 'needs-human' ? 'METADATA_INCOMPLETE' : 'SDD_REQUIRED'] } };
  const expected = { repository: snapshot.repository, source_sha, config_source_sha: snapshot.config_source_sha, run_id: '42', run_attempt: '1',
    invocation_id: 'triage-7', automation_sha: 'c'.repeat(40), config_sha256: 'd'.repeat(64), instructions_sha256: 'e'.repeat(64) };
  const patch = route === 'propose-patch' ? 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n' : null;
  const output = join(root, 'output'); await mkdir(output);
  const packaged = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'Proposta do consumidor. Revisar os riscos antes de implementar.', patch }, expected, output);
  const result = { envelope: packaged.envelope, expected, patch };
  const prepared = patch ? await preparePatch({ envelope: result.envelope, expected, patch, sourceRoot, config }) : null;
  if (prepared) t.after(() => cleanupPreparedPatch(prepared));
  const verification = patch ? { status: 'passed', source_sha, config_source_sha: snapshot.config_source_sha, patch_sha256: digest(patch) } : null;
  const state = { comments: [], pulls: [], refs: new Map(), commits: new Map(), writes: [], current: snapshot, failAfter: null, failBefore: null, reads: 0 };
  const identity = { id: 10, login: 'automation[bot]' };
  const write = (kind, change) => {
    state.writes.push(kind); if (state.failBefore === kind) throw new Error('private transport secret');
    const value = change(); if (state.failAfter === kind) { state.failAfter = null; throw new Error('timeout after creation'); } return structuredClone(value);
  };
  const api = {
    recollect: async () => { state.reads++; return structuredClone(state.current); }, getIdentity: async () => identity,
    listComments: async () => structuredClone(state.comments), getComment: async (_repo, id) => structuredClone(state.comments.find(c => c.id === id)),
    createComment: async (_repo, _issue, body) => write('comment', () => { const c = { id: state.comments.length + 1, body, user: identity }; state.comments.push(c); return c; }),
    updateComment: async (_repo, id, body) => write('update-comment', () => Object.assign(state.comments.find(c => c.id === id), { body })),
    getRef: async (_repo, ref) => structuredClone(state.refs.get(ref) ?? null),
    getCommit: async (_repo, sha) => structuredClone(state.commits.get(sha)),
    createCommit: async (_repo, payload) => write('commit', () => { const sha = digest(JSON.stringify(payload)).slice(0, 40);
      const commit = { sha, message: payload.message, tree: { sha: payload.tree_sha }, parents: [{ sha: payload.base_sha }] }; state.commits.set(sha, commit); return commit; }),
    createRef: async (_repo, ref, sha) => write('ref', () => { const value = { ref: `refs/heads/${ref}`, object: { sha } }; state.refs.set(ref, value); return value; }),
    listPulls: async () => structuredClone(state.pulls), getPull: async (_repo, n) => structuredClone(state.pulls.find(p => p.number === n)),
    createPull: async (_repo, payload) => write('pull', () => { const p = { ...payload, number: state.pulls.length + 20, state: 'open', user: identity,
      head: { ref: payload.head, sha: state.refs.get(payload.head).object.sha, repo: { full_name: 'owner/app' } }, base: { ref: payload.base, sha: source_sha, repo: { full_name: 'owner/app' } },
      milestone: null, requested_reviewers: [], html_url: 'https://github.com/owner/app/pull/20' }; state.pulls.push(p); return p; }),
    setMilestone: async (_repo, n, milestone) => write('milestone', () => Object.assign(state.pulls.find(p => p.number === n), { milestone: { number: milestone } })),
    requestReview: async (_repo, n, reviewer) => write('review', () => { const p = state.pulls.find(p => p.number === n); p.requested_reviewers.push({ login: reviewer }); return p; }),
    listReviews: async () => [],
  };
  return { snapshot, config, result, prepared, verification, state, api };
}

test('TRI-12/19: planning produces a draft SDD comment and reuses its own unchanged resource', async t => {
  const f = await fixture(t); const first = await publishTriage(f, f.api); const second = await publishTriage(f, f.api);
  assert.equal(first.status, 'planned'); assert.equal(second.comment_id, first.comment_id); assert.equal(f.state.comments.length, 1);
  for (const heading of ['Contexto', 'Necessidade de SDD', 'Proposta', 'Riscos', 'Próximos passos', 'rascunho não aprovado']) assert.ok(f.state.comments[0].body.includes(heading));
  assert.ok(f.state.comments[0].body.includes(f.result.envelope.summary)); assert.ok(f.state.comments[0].body.includes(f.snapshot.source_sha));
  assert.deepEqual(f.state.writes, ['comment']); assert.equal(f.state.pulls.length, 0);
});

test('TRI-11/16: insufficient metadata and missing patches publish only explicit intervention guidance', async t => {
  const f = await fixture(t, 'needs-human'); f.result = null;
  assert.equal((await publishTriage(f, f.api)).status, 'needs-human'); assert.ok(f.state.comments[0].body.includes('METADATA_INCOMPLETE'));
  const p = await fixture(t, 'propose-patch'); p.prepared = null;
  assert.equal((await publishTriage(p, p.api)).status, 'needs-human'); assert.equal(p.state.pulls.length, 0);
});

test('TRI-15/18/19: validated patch creates one draft PR with correct base, milestone, reviewer and failed checks', async t => {
  const f = await fixture(t, 'propose-patch'); f.verification.status = 'failed';
  const first = await publishTriage(f, f.api); const writes = [...f.state.writes]; const second = await publishTriage(f, f.api);
  const p = f.state.pulls[0]; assert.equal(first.status, 'draft-checks-failed'); assert.equal(second.pr_number, first.pr_number);
  assert.equal(f.state.pulls.length, 1); assert.equal(f.state.refs.size, 1); assert.deepEqual(f.state.writes, writes);
  assert.equal(p.draft, true); assert.equal(p.base.ref, 'release/v1.0.0'); assert.equal(p.base.sha, f.snapshot.source_sha);
  assert.equal(p.head.ref, 'feature/triage-issue-7'); assert.equal(p.milestone.number, 1); assert.deepEqual(p.requested_reviewers, [{ login: 'reviewer' }]);
  assert.ok(p.body.includes('Refs #7')); assert.ok(p.body.includes('failed')); assert.equal(/closes|fixes|resolves/i.test(p.body), false);
  assert.ok(f.state.comments[0].body.includes(p.html_url));
  const commit = f.state.commits.get(p.head.sha); assert.equal(commit.parents[0].sha, f.snapshot.source_sha);
  assert.ok(commit.message.includes(f.snapshot.fingerprint));
});

test('TRI-20/22: changed input/base/config and forged envelope or verification fail before any publication', async t => {
  const f = await fixture(t, 'propose-patch');
  for (const key of ['fingerprint', 'source_sha', 'config_source_sha']) {
    f.state.current = { ...f.snapshot, [key]: 'f'.repeat(key === 'fingerprint' ? 64 : 40) };
    await assert.rejects(publishTriage(f, f.api), { code: 'STALE_TRIAGE_INPUT' }); assert.deepEqual(f.state.writes, []);
  }
  f.state.current = f.snapshot;
  await assert.rejects(publishTriage({ ...f, result: { ...f.result, envelope: { ...f.result.envelope, source_sha: 'f'.repeat(40) } } }, f.api), { code: 'INVALID_RESULT' });
  await assert.rejects(publishTriage({ ...f, verification: { ...f.verification, patch_sha256: 'f'.repeat(64) } }, f.api), { code: 'INVALID_TRIAGE_VERIFICATION' });
  assert.deepEqual(f.state.writes, []);
});

test('TRI-19/21: timeouts after comment/ref/PR creation recover exact owned resources without duplicates', async t => {
  for (const kind of ['comment', 'ref', 'pull', 'milestone', 'review']) {
    const f = await fixture(t, kind === 'comment' ? 'plan' : 'propose-patch'); f.state.failAfter = kind;
    const value = await publishTriage(f, f.api); assert.ok(['planned', 'draft'].includes(value.status));
    await publishTriage(f, f.api); assert.equal(f.state.comments.length, 1); assert.equal(f.state.pulls.length, kind === 'comment' ? 0 : 1);
    assert.equal(f.state.writes.filter(v => v === kind).length, 1);
  }
});

test('TRI-19/21/22: human edits, changed branch and unrecoverable write failures never overwrite resources', async t => {
  const f = await fixture(t); await publishTriage(f, f.api); f.state.comments[0].body += '\nHuman edit'; const original = f.state.comments[0].body;
  await assert.rejects(publishTriage(f, f.api), { code: 'TRIAGE_RESOURCE_CONFLICT' }); assert.equal(f.state.comments[0].body, original);
  const p = await fixture(t, 'propose-patch'); await publishTriage(p, p.api); p.state.refs.get('feature/triage-issue-7').object.sha = 'f'.repeat(40);
  await assert.rejects(publishTriage(p, p.api), { code: 'TRIAGE_RESOURCE_CONFLICT' }); assert.equal(p.state.refs.get('feature/triage-issue-7').object.sha, 'f'.repeat(40));
  const failed = await fixture(t); failed.state.failBefore = 'comment';
  await assert.rejects(publishTriage(failed, failed.api), { code: 'TRIAGE_PUBLISH_FAILED', message: 'TRIAGE_PUBLISH_FAILED' });
  assert.equal(failed.state.comments.length, 0); assert.deepEqual(failed.state.writes, ['comment']);
});

test('TRI-13/19/22: prepared code must match the verified patch; human resources and transport details stay protected', async t => {
  const f = await fixture(t, 'propose-patch'); const substituted = f.result.patch.replace('+new', '+other');
  await assert.rejects(publishTriage({ ...f, result: { ...f.result, patch: substituted }, verification: { ...f.verification, patch_sha256: digest(substituted) } }, f.api), { code: 'INVALID_TRIAGE_PATCH' });
  assert.deepEqual(f.state.writes, []);
  await publishTriage(f, f.api); const body = f.state.pulls[0].body; f.state.pulls[0].body += '\nHuman edit';
  await assert.rejects(publishTriage(f, f.api), { code: 'TRIAGE_RESOURCE_CONFLICT' }); assert.equal(f.state.pulls[0].body, body + '\nHuman edit');
  const p = await fixture(t); await publishTriage(p, p.api); const copied = { ...p.state.comments[0], id: 55, user: { id: 77, login: 'human' } };
  p.state.comments = [copied]; await publishTriage(p, p.api); assert.equal(p.state.comments.length, 2); assert.equal(p.state.comments[0].body, copied.body);
  const failed = await fixture(t); failed.api.recollect = async () => { throw new Error('private credential in transport'); };
  await assert.rejects(publishTriage(failed, failed.api), { code: 'TRIAGE_PUBLISH_FAILED', message: 'TRIAGE_PUBLISH_FAILED' });
});

test('TRI-15/20: summary cannot request automatic closure and a late base change stops publication', async t => {
  const f = await fixture(t, 'propose-patch'); f.result.envelope.summary = 'Closes #7 and fixes #9';
  await publishTriage(f, f.api); assert.equal(/\b(?:closes|fixes|resolves)\s+#\d/i.test(f.state.pulls[0].body), false);
  const stale = await fixture(t, 'propose-patch'); let reads = 0;
  stale.api.recollect = async () => ++reads === 1 ? stale.snapshot : { ...stale.snapshot, source_sha: 'f'.repeat(40) };
  await assert.rejects(publishTriage(stale, stale.api), { code: 'STALE_TRIAGE_INPUT' }); assert.deepEqual(stale.state.writes, []);
});
