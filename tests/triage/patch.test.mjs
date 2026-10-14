import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { validateAndPackage } from '../../scripts/llm/result.mjs';
import { preparePatch, cleanupPreparedPatch, patchGitEnvironment } from '../../scripts/triage/prepare-patch.mjs';

function git(root, ...args) {
  const result = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=', ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
const patchFor = (path = 'main.go', before = 'old', after = 'new') => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-${before}\n+${after}\n`;
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'triage-patch-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, 'source'); await mkdir(sourceRoot); git(sourceRoot, 'init', '-q');
  git(sourceRoot, 'config', 'user.name', 'Fixture'); git(sourceRoot, 'config', 'user.email', 'fixture@example.test');
  await writeFile(join(sourceRoot, 'main.go'), 'old\n'); git(sourceRoot, 'add', 'main.go'); git(sourceRoot, 'commit', '-qm', 'base');
  const expected = { repository: 'owner/app', run_id: '42', run_attempt: '1', invocation_id: 'triage-7',
    source_sha: git(sourceRoot, 'rev-parse', 'HEAD'), config_source_sha: 'a'.repeat(40), automation_sha: 'b'.repeat(40),
    config_sha256: 'c'.repeat(64), instructions_sha256: 'd'.repeat(64) };
  const output = join(root, 'output'); await mkdir(output);
  const { envelope } = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'fix', patch: patchFor() }, expected, output);
  const config = { schema_version: 1, project: { owner: 'owner', number: 12 }, fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
    llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' }, reviewer: 'reviewer',
    allowed_paths: ['main.go'], checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {} };
  return { sourceRoot, expected, envelope, config, patch: patchFor(), root };
}

test('TRI-13/16: applicable patch creates a single-base proposal without changing the source', async t => {
  const f = await fixture(t); const prepared = await preparePatch(f); t.after(() => cleanupPreparedPatch(prepared));
  assert.equal(await readFile(join(prepared.sourceRoot, 'main.go'), 'utf8'), 'new\n');
  assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'old\n');
  assert.equal(git(f.sourceRoot, 'rev-parse', 'HEAD'), f.expected.source_sha);
  assert.equal(git(prepared.sourceRoot, 'rev-parse', 'HEAD^'), f.expected.source_sha);
  assert.equal(git(prepared.sourceRoot, 'rev-parse', 'HEAD'), prepared.commit_sha);
  assert.deepEqual(prepared.changed_paths, ['main.go']);
  git(prepared.sourceRoot, 'bundle', 'verify', prepared.bundle_file);
  await cleanupPreparedPatch(prepared); await assert.rejects(access(prepared.directory), { code: 'ENOENT' });
  await cleanupPreparedPatch(prepared);
});

test('TRI-13/16: empty, forbidden, out-of-policy, inapplicable and mismatched revisions cannot prepare proposals', async t => {
  const f = await fixture(t);
  for (const change of [ { patch: '' }, { patch: patchFor('other.go') }, { patch: patchFor('.github/triage/config.json'), config: { ...f.config, allowed_paths: ['.github/triage'] } },
    { patch: patchFor('main.go', 'absent') }, { expected: { ...f.expected, source_sha: 'e'.repeat(40) } },
    { envelope: { ...f.envelope, config_source_sha: 'e'.repeat(40) } }, { envelope: { ...f.envelope, patch_file: null } } ]) {
    await assert.rejects(preparePatch({ ...f, ...change }), error => ['INVALID_RESULT', 'INVALID_TRIAGE_PATCH', 'STALE_TRIAGE_INPUT'].includes(error.code) && error.message === error.code);
  }
  assert.equal(await readFile(join(f.sourceRoot, 'main.go'), 'utf8'), 'old\n');
});

test('TRI-17: source hooks and caller secrets are not inherited, and patch text is never executed', async t => {
  const f = await fixture(t); const marker = join(f.root, 'hook-ran');
  await writeFile(join(f.sourceRoot, '.git/hooks/pre-commit'), `#!/bin/sh\nprintf ran > '${marker.replaceAll('\\', '/')}'\nexit 99\n`, { mode: 0o755 });
  git(f.sourceRoot, 'config', 'core.hooksPath', '.git/hooks');
  const previous = process.env.CODEX_AUTH_JSON; process.env.CODEX_AUTH_JSON = 'must-not-reach-git';
  t.after(() => { if (previous === undefined) delete process.env.CODEX_AUTH_JSON; else process.env.CODEX_AUTH_JSON = previous; });
  assert.deepEqual(Object.keys(patchGitEnvironment()).sort(), ['PATH', 'SystemRoot', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL',
    'GIT_NO_REPLACE_OBJECTS', 'GIT_TERMINAL_PROMPT', 'GIT_ALLOW_PROTOCOL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'].sort());
  assert.equal(patchGitEnvironment().CODEX_AUTH_JSON, undefined);
  const prepared = await preparePatch({ ...f, patch: patchFor('main.go', 'old', '$(echo forbidden)') }); t.after(() => cleanupPreparedPatch(prepared));
  assert.equal(await readFile(join(prepared.sourceRoot, 'main.go'), 'utf8'), '$(echo forbidden)\n');
  await assert.rejects(access(marker), { code: 'ENOENT' });
  assert.equal(git(prepared.sourceRoot, 'config', '--get', 'remote.origin.url'), f.sourceRoot.replaceAll('\\', '/'));
});

test('TRI-16/17: tracked symlinks or submodules are refused before source checkout', async t => {
  for (const mode of ['120000', '160000']) {
    const f = await fixture(t); const object = mode === '120000' ? git(f.sourceRoot, 'hash-object', 'main.go') : f.expected.source_sha;
    git(f.sourceRoot, 'update-index', '--add', '--cacheinfo', `${mode},${object},unsafe`); git(f.sourceRoot, 'commit', '-qm', 'unsafe base');
    const expected = { ...f.expected, source_sha: git(f.sourceRoot, 'rev-parse', 'HEAD') };
    const output = join(f.root, 'unsafe-output'); await mkdir(output);
    const { envelope } = await validateAndPackage({ status: 'succeeded', decision: 'none', summary: 'fix', patch: f.patch }, expected, output);
    await assert.rejects(preparePatch({ ...f, expected, envelope }), { code: 'INVALID_TRIAGE_PATCH' });
  }
});
