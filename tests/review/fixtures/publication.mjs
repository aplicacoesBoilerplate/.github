import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { packageReviewResult } from '../../../scripts/review/result.mjs';
import { prepareReviewPatch, cleanupPreparedPatch } from '../../../scripts/review/prepare-patch.mjs';
import { buildDiffIndex } from '../../../scripts/review/diff.mjs';

export const digest = text => createHash('sha256').update(text).digest('hex');
function git(root, ...args) {
  const p = spawnSync('git', ['-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  }); assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}
export async function publicationFixture(t, { correction = false, route = 'correction', findings } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'review-publish-')); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, 'source'); await mkdir(sourceRoot); git(sourceRoot, 'init', '-q');
  git(sourceRoot, 'config', 'user.name', 'Fixture'); git(sourceRoot, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(sourceRoot, 'main.go'), 'old\n'); git(sourceRoot, 'add', '.'); git(sourceRoot, 'commit', '-qm', 'base');
  const base = git(sourceRoot, 'rev-parse', 'HEAD'); await writeFile(join(sourceRoot, 'main.go'), 'new\n'); git(sourceRoot, 'commit', '-qam', 'feature');
  const head = git(sourceRoot, 'rev-parse', 'HEAD');
  const diff = 'diff --git a/main.go b/main.go\n--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-old\n+new\n';
  const patch = correction ? diff.replace('-old\n+new', '-new\n+fixed') : null;
  const identity = { id: 10, login: 'automation[bot]' };
  const config = { schema_version: 1, reviewer: 'reviewer', automation_actors: [identity],
    llm_configs: { review: '.github/llm/review.json', correction: '.github/llm/correction.json' }, protected_branches: ['master', 'develop'],
    correctable_prefixes: ['feature/'], allowed_paths: ['main.go'], checks: [{ command: 'go', args: ['test', './...'] }] };
  const snapshot = { repository: 'owner/app', default_branch: 'master', pull: { number: 9, state: 'open', title: 'Feature', body: '', draft: true,
    user: { id: 20, login: 'human' }, updated_at: '2026-10-15T10:00:00Z', head: { ref: 'feature/test', sha: head }, base: { ref: 'release/v1.0.0', sha: base } },
    source_sha: head, base_sha: base, merge_base_sha: base, config_source_sha: 'b'.repeat(40), fingerprint: '1'.repeat(64), route, error_code: '', diff, diff_index: buildDiffIndex(diff) };
  if (route === 'review-only') snapshot.pull.head.ref = 'release/v1.0.0';
  if (route === 'skip-correction') snapshot.pull.automation_origin = 'review';
  const provenance = { repository: snapshot.repository, source_sha: head, config_source_sha: snapshot.config_source_sha, run_id: '42', run_attempt: '1',
    invocation_id: 'review-9', automation_sha: 'c'.repeat(40), config_sha256: 'd'.repeat(64), instructions_sha256: 'e'.repeat(64) };
  const expected = { ...provenance, pull_number: 9, base_sha: base, merge_base_sha: base, review_fingerprint: snapshot.fingerprint };
  const raw = { status: 'succeeded', decision: 'none', summary: 'Closes #9: validate the proposal.', findings: findings ?? [
    { severity: 'critical', path: 'main.go', line: 1, message: 'Fixes #9: invalid behavior.' },
    { severity: 'warning', path: 'main.go', line: 1, message: 'A warning.' },
    { severity: 'suggestion', path: 'main.go', line: 1, message: 'A suggestion.' }], patch };
  const { envelope } = await packageReviewResult(raw, provenance, snapshot, root);
  const result = { envelope, expected, findings: raw.findings, patch };
  const prepared = correction ? await prepareReviewPatch({ snapshot, envelope, expected, patch, sourceRoot, config }) : null;
  if (prepared) t.after(() => cleanupPreparedPatch(prepared));
  const verification = correction ? { status: 'passed', source_sha: head, config_source_sha: snapshot.config_source_sha, patch_sha256: digest(patch) } : null;
  const state = { comments: [], pulls: [], refs: new Map(), commits: new Map(), writes: [], current: structuredClone(snapshot), failBefore: null, failAfter: null };
  const write = (kind, payload, change) => {
    state.writes.push({ kind, payload: structuredClone(payload) }); if (state.failBefore === kind) throw new Error('private write failure');
    const value = change(); if (state.failAfter === kind) { state.failAfter = null; throw new Error('timeout after write'); } return structuredClone(value);
  };
  const api = {
    recollect: async () => structuredClone(state.current), getIdentity: async () => identity,
    listComments: async () => structuredClone(state.comments), getComment: async (_r, id) => structuredClone(state.comments.find(c => c.id === id)),
    createComment: async (_r, n, body) => write('comment', { n, body }, () => { const c = { id: state.comments.length + 1, body, user: identity }; state.comments.push(c); return c; }),
    updateComment: async (_r, id, body) => write('update-comment', { id, body }, () => Object.assign(state.comments.find(c => c.id === id), { body })),
    getRef: async (_r, ref) => structuredClone(state.refs.get(ref) ?? null), getCommit: async (_r, sha) => structuredClone(state.commits.get(sha)),
    createCommit: async (_r, p) => write('commit', p, () => { const sha = digest(JSON.stringify(p)).slice(0, 40);
      const value = { sha, tree: { sha: p.tree_sha }, parents: [{ sha: p.base_sha }], message: p.message }; state.commits.set(sha, value); return value; }),
    createRef: async (_r, ref, sha) => write('ref', { ref, sha }, () => { const value = { ref: `refs/heads/${ref}`, object: { sha } }; state.refs.set(ref, value); return value; }),
    listPulls: async () => structuredClone(state.pulls), getPull: async (_r, n) => structuredClone(state.pulls.find(p => p.number === n)),
    createPull: async (_r, p) => write('pull', p, () => { const value = { ...p, number: 30, state: 'open', user: identity,
      head: { ref: p.head, sha: state.refs.get(p.head).object.sha, repo: { full_name: snapshot.repository } },
      base: { ref: p.base, sha: head, repo: { full_name: snapshot.repository } }, requested_reviewers: [], html_url: 'https://github.com/owner/app/pull/30' };
      state.pulls.push(value); return value; }),
    requestReview: async (_r, n, reviewer) => write('review', { n, reviewer }, () => { const p = state.pulls.find(p => p.number === n); p.requested_reviewers.push({ login: reviewer }); return p; }),
    listReviews: async () => []
  };
  return { root, sourceRoot, snapshot, config, result, prepared, verification, state, api };
}
