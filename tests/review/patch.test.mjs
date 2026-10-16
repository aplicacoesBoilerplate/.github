import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { packageReviewResult } from '../../scripts/review/result.mjs';
import { buildDiffIndex } from '../../scripts/review/diff.mjs';
import { prepareReviewPatch, cleanupPreparedPatch, readPreparedProposal } from '../../scripts/review/prepare-patch.mjs';
import { patchGitEnvironment } from '../../scripts/shared/prepare-patch.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const patchFor = (path = 'main.go', before = 'new', after = 'fixed') => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-${before}\n+${after}\n`;
function git(root, ...args) {
  const result = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=', ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'review-patch-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, 'source'); await mkdir(sourceRoot); git(sourceRoot, 'init', '-q');
  git(sourceRoot, 'config', 'user.name', 'Fixture'); git(sourceRoot, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(sourceRoot, 'main.go'), 'old\n'); await writeFile(join(sourceRoot, 'other.go'), 'new\n');
  git(sourceRoot, 'add', '.'); git(sourceRoot, 'commit', '-qm', 'base'); const base = git(sourceRoot, 'rev-parse', 'HEAD');
  await writeFile(join(sourceRoot, 'main.go'), 'new\n'); git(sourceRoot, 'commit', '-qam', 'feature'); const head = git(sourceRoot, 'rev-parse', 'HEAD');
  const diff = patchFor('main.go', 'old', 'new');
  const snapshot = { repository: 'owner/app', pull: { number: 9, head: { sha: head, ref: 'feature/test' }, base: { sha: base, ref: 'release/v1.0.0' } },
    source_sha: head, base_sha: base, merge_base_sha: base, config_source_sha: 'b'.repeat(40), fingerprint: '1'.repeat(64),
    route: 'correction', error_code: '', diff, diff_index: buildDiffIndex(diff) };
  const provenance = { repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'review-9', source_sha: head,
    config_source_sha: snapshot.config_source_sha, automation_sha: 'c'.repeat(40), config_sha256: 'd'.repeat(64), instructions_sha256: 'e'.repeat(64) };
  const expected = { ...provenance, pull_number: 9, base_sha: base, merge_base_sha: base, review_fingerprint: snapshot.fingerprint };
  const config = { schema_version: 1, reviewer: 'reviewer', automation_actors: [], llm_configs: { review: '.github/llm/review.json', correction: '.github/llm/correction.json' },
    protected_branches: ['master', 'develop'], correctable_prefixes: ['feature/'], allowed_paths: ['main.go', 'other.go'], checks: [{ command: 'go', args: ['test', './...'] }] };
  const { envelope } = await packageReviewResult({ status: 'succeeded', decision: 'none', summary: 'Correction.', findings: [], patch: patchFor() }, provenance, snapshot, root);
  return { root, sourceRoot, snapshot, expected, config, envelope, patch: patchFor() };
}
const changedPatch = (f, patch) => ({ ...f, patch, envelope: { ...f.envelope, patch_sha256: digest(patch) } });

test('REV-12/14: correction is a child of the exact head and preserves source, proposal ownership and cleanup', async t => {
  const f = await fixture(t); const prepared = await prepareReviewPatch(f); t.after(() => cleanupPreparedPatch(prepared));
  assert.equal(git(prepared.sourceRoot, 'rev-parse', 'HEAD^'), f.snapshot.source_sha);
  assert.equal(await readFile(join(prepared.sourceRoot, 'main.go'), 'utf8'), 'fixed\n');
  assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'new\n');
  assert.equal(git(f.sourceRoot, 'rev-parse', 'HEAD'), f.snapshot.source_sha); assert.equal(git(f.sourceRoot, 'status', '--porcelain'), '');
  const proposal = await readPreparedProposal(prepared);
  assert.equal(proposal.base_sha, f.snapshot.source_sha); assert.equal(proposal.patch_sha256, digest(f.patch));
  assert.equal(proposal.tree_sha, git(prepared.sourceRoot, 'rev-parse', 'HEAD^{tree}'));
  assert.deepEqual(proposal.changes, [{ path: 'main.go', mode: '100644', type: 'blob', content: Buffer.from('fixed\n').toString('base64') }]);
  git(prepared.sourceRoot, 'bundle', 'verify', prepared.bundle_file);
  await assert.rejects(readPreparedProposal({ ...prepared }), { code: 'INVALID_REVIEW_PATCH' });
  const ownedDirectory = prepared.directory; prepared.directory = f.sourceRoot; prepared.source_sha = 'f'.repeat(40);
  assert.equal((await readPreparedProposal(prepared)).base_sha, f.snapshot.source_sha);
  await cleanupPreparedPatch(prepared); await assert.rejects(access(ownedDirectory), { code: 'ENOENT' }); await access(f.sourceRoot);
  await assert.rejects(readPreparedProposal(prepared), { code: 'INVALID_REVIEW_PATCH' }); await cleanupPreparedPatch(prepared);
});

test('REV-11/16/24: paths, identities, routes and application base cannot be widened by the proposed patch', async t => {
  const f = await fixture(t);
  for (const changed of [changedPatch(f, patchFor('other.go')), { ...f, config: { ...f.config, allowed_paths: ['other.go'] } },
    changedPatch(f, patchFor('main.go', 'old')), { ...f, envelope: { ...f.envelope, schema_version: 2 } },
    { ...f, patch: patchFor('main.go', 'new', 'tampered') }, { ...f, expected: { ...f.expected, source_sha: 'f'.repeat(40) } },
    { ...f, snapshot: { ...f.snapshot, fingerprint: 'f'.repeat(64) } },
    ...['review-only', 'skip-correction'].map(route => ({ ...f, snapshot: { ...f.snapshot, route } })),
    { ...f, snapshot: { ...f.snapshot, pull: { ...f.snapshot.pull, head: { ...f.snapshot.pull.head, ref: 'develop' } } } }])
    await assert.rejects(prepareReviewPatch(changed), error => ['INVALID_RESULT', 'INVALID_REVIEW_PATCH'].includes(error.code) && error.message === error.code);
  for (const path of ['AGENTS.md', '.env', '.github/workflows/ci.yml', '.github/llm/config.json', '.github/triage/config.json', '.github/review/config.json']) {
    const diff = patchFor(path, 'old', 'new');
    const snapshot = { ...f.snapshot, diff, diff_index: buildDiffIndex(diff) };
    await assert.rejects(prepareReviewPatch({ ...changedPatch(f, patchFor(path)), snapshot, config: { ...f.config, allowed_paths: [path] } }), { code: 'INVALID_RESULT' });
  }
  git(f.sourceRoot, 'checkout', '--quiet', '--detach', f.snapshot.base_sha);
  await assert.rejects(prepareReviewPatch(f), { code: 'STALE_REVIEW_INPUT' });
});

test('REV-12/13: hooks, credentials and patch text cannot execute in preparation', async t => {
  const f = await fixture(t); const marker = join(f.root, 'hook-ran');
  await writeFile(join(f.sourceRoot, '.git/hooks/pre-commit'), `#!/bin/sh\nprintf ran > '${marker.replaceAll('\\', '/')}'\nexit 99\n`, { mode: 0o755 });
  git(f.sourceRoot, 'config', 'core.hooksPath', '.git/hooks');
  assert.deepEqual(Object.keys(patchGitEnvironment()).sort(), ['PATH', 'SystemRoot', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_NO_REPLACE_OBJECTS',
    'GIT_TERMINAL_PROMPT', 'GIT_ALLOW_PROTOCOL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'].sort());
  const prepared = await prepareReviewPatch(changedPatch(f, patchFor('main.go', 'new', '$(echo forbidden)'))); t.after(() => cleanupPreparedPatch(prepared));
  assert.equal(await readFile(join(prepared.sourceRoot, 'main.go'), 'utf8'), '$(echo forbidden)\n');
  await assert.rejects(access(marker), { code: 'ENOENT' });
  git(prepared.sourceRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'unexpected commit');
  await assert.rejects(readPreparedProposal(prepared), { code: 'INVALID_REVIEW_PATCH' });
});

test('REV-11/12: symlink and submodule trees are refused without changing the source', async t => {
  for (const mode of ['120000', '160000']) {
    const f = await fixture(t); const sha = mode === '120000' ? git(f.sourceRoot, 'hash-object', 'main.go') : f.snapshot.source_sha;
    git(f.sourceRoot, 'update-index', '--add', '--cacheinfo', `${mode},${sha},unsafe`); git(f.sourceRoot, 'commit', '-qm', 'unsafe head');
    const head = git(f.sourceRoot, 'rev-parse', 'HEAD');
    const snapshot = { ...f.snapshot, source_sha: head, pull: { ...f.snapshot.pull, head: { ...f.snapshot.pull.head, sha: head } } };
    await assert.rejects(prepareReviewPatch({ ...f, snapshot, expected: { ...f.expected, source_sha: head }, envelope: { ...f.envelope, source_sha: head,
      request_id: digest(JSON.stringify([f.expected.repository, '42', '1', 'review-9', head])) } }), { code: 'INVALID_REVIEW_PATCH' });
    assert.equal(git(f.sourceRoot, 'rev-parse', 'HEAD'), head); assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'new\n');
  }
});
