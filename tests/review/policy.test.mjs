import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewConfig, classifyPull } from '../../scripts/review/policy.mjs';
import { buildDiffIndex } from '../../scripts/review/diff.mjs';

const config = () => ({ schema_version: 1, reviewer: 'reviewer', automation_actors: [{ id: 42, login: 'service-bot' }],
  llm_configs: { review: '.github/llm/review.json', correction: '.github/llm/correction.json' },
  protected_branches: ['master', 'develop'], correctable_prefixes: ['feature/', 'codex/'],
  allowed_paths: ['src', 'go.mod'], checks: [{ command: 'go', args: ['test', './...'] }] });

test('REV-11/16: caller policy is isolated and invalid configuration cannot authorize correction', () => {
  const original = config(); const policy = validateReviewConfig(original);
  assert.deepEqual(policy, original); policy.allowed_paths.push('other'); assert.deepEqual(original.allowed_paths, ['src', 'go.mod']);
  const changes = [{ extra: true }, { allowed_paths: ['../escape'] }, { allowed_paths: ['src/**'] },
    { llm_configs: { review: 'C:/auth.json', correction: 'ok.json' } }, { correctable_prefixes: ['release/'] },
    { protected_branches: ['../master'] }, { automation_actors: [{ id: 0, login: 'bot' }] },
    { checks: [{ command: 'sh -c', args: [] }] }, { reviewer: 'x'.repeat(32769) }];
  for (const change of changes) assert.throws(() => validateReviewConfig({ ...config(), ...change }), { code: 'INVALID_REVIEW_CONFIG', message: 'INVALID_REVIEW_CONFIG' });
});

test('REV-16/19: integration and verified review corrections cannot enter the correction route', () => {
  const pull = head => ({ head: { ref: head }, base: { ref: 'release/v1.0.0' }, automation_origin: null });
  assert.equal(classifyPull(pull('feature/example'), config()), 'correction');
  assert.equal(classifyPull({ ...pull('feature/triage-issue-7'), automation_origin: 'triage', draft: true }, config()), 'correction');
  for (const head of ['master', 'develop', 'release/v1.0.0', 'unknown/topic', 'feature/../master', 'feature/topic.lock'])
    assert.equal(classifyPull(pull(head), config()), 'review-only');
  assert.equal(classifyPull({ ...pull('feature/example'), automation_origin: 'review' }, config()), 'skip-correction');
  assert.equal(classifyPull({ ...pull('feature/example'), body: '<!-- review correction -->', user: { login: 'some[bot]' } }, config()), 'correction');
  assert.equal(classifyPull(pull('feature/example'), { ...config(), protected_branches: ['master', 'develop', 'feature/example'] }), 'review-only');
});

const diff = 'diff --git a/src/main.go b/src/main.go\nindex 1111111..2222222 100644\n--- a/src/main.go\n+++ b/src/main.go\n@@ -1,3 +1,4 @@\n keep\n-old\n+new\n+++ literal content\n tail\n@@ -8 +9 @@\n-before\n+after\n';

test('REV-07: only added RIGHT lines are indexed across hunks, not context or header-like content', () => {
  assert.deepEqual(buildDiffIndex(diff).files, [{ path: 'src/main.go', old_path: 'src/main.go', added_lines: [2, 3, 9] }]);
  assert.deepEqual(buildDiffIndex('').files, []);
  assert.deepEqual(buildDiffIndex('diff --git a/new.go b/new.go\nnew file mode 100644\n--- /dev/null\n+++ b/new.go\n@@ -0,0 +1,2 @@\n+one\n+two\n').files,
    [{ path: 'new.go', old_path: null, added_lines: [1, 2] }]);
  assert.deepEqual(buildDiffIndex('diff --git a/old.go b/old.go\ndeleted file mode 100644\n--- a/old.go\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n').files,
    [{ path: 'old.go', old_path: 'old.go', added_lines: [] }]);
});

test('REV-05/07: malformed or truncated diffs never look like complete empty reviews', () => {
  for (const value of [diff.replace('+after\n', ''), diff.replace('@@ -8 +9 @@', '@@ -8 +3 @@'),
    diff.replace('+++ b/src/main.go', '+++ b/other.go'), diff.split('@@')[0], diff + diff, 'not a diff',
    'diff --git a/a b/a\nBinary files a/a and b/a differ\n',
    'diff --git a/../escape b/../escape\n--- a/../escape\n+++ b/../escape\n@@ -1 +1 @@\n-a\n+b\n'])
    assert.throws(() => buildDiffIndex(value), { code: 'REVIEW_INCONCLUSIVE', message: 'REVIEW_INCONCLUSIVE' });
});

test('REV-05: byte and file limits reject complete but oversized diffs', () => {
  const file = n => `diff --git a/f${n} b/f${n}\n--- a/f${n}\n+++ b/f${n}\n@@ -1 +1 @@\n-a\n+b\n`;
  assert.equal(buildDiffIndex(Array.from({ length: 100 }, (_, i) => file(i)).join('')).files.length, 100);
  assert.throws(() => buildDiffIndex(Array.from({ length: 101 }, (_, i) => file(i)).join('')), { code: 'REVIEW_INCONCLUSIVE' });
  assert.throws(() => buildDiffIndex(file(1).replace('+b\n', `+${'á'.repeat(8200)}\n`)), { code: 'REVIEW_INCONCLUSIVE' });
});
