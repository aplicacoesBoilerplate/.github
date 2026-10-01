import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'homologation-guide-'));
const output = mkdtempSync(join(tmpdir(), 'homologation-output-'));
const reportPath = join(workspace, 'report.json');
const snapshotPath = join(workspace, 'snapshot.json');
const sha = 'a'.repeat(40);

try {
  const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
  writeFileSync(join(workspace, 'tracked.txt'), 'unchanged\n'); git('add', '.'); git('commit', '-qm', 'chore: fixture');
  writeFileSync(reportPath, JSON.stringify({ schemaVersion: 1, adapter: 'go-gitsemver', sha,
    branch: 'feature/demo', baseVersion: '0.0.0', candidateVersion: '0.0.1', tag: 'v0.0.1', bump: 'patch',
    native: { format: 'json', result: { SemVer: '0.0.1', Sha: sha },
      explanation: '<script>alert(1)</script> [click](javascript:alert(1))' } }));
  writeFileSync(snapshotPath, JSON.stringify({ repository: 'owner/repo', number: 42, headSha: sha,
    changes: ['feat: safe', 'fix: </details>'], checks: [{ name: 'go-ci', status: 'completed', conclusion: 'success' }],
    suggestedChecks: [{ id: 'smoke', description: 'Execute `cli --help`', status: 'pending' }] }));
  const before = git('status', '--porcelain');
  const result = spawnSync(process.execPath,
    [join(root, 'scripts/versioning/homologation-guide.mjs'), reportPath, snapshotPath, output],
    { cwd: workspace, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(readFileSync(join(output, 'homologation.json'), 'utf8'));
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.facts.repository, 'owner/repo');
  assert.equal(json.facts.pullRequest, 42);
  assert.equal(json.facts.sha, sha);
  assert.equal(json.facts.candidateVersion, '0.0.1');
  assert.equal(json.facts.bump, 'patch');
  assert.match(json.facts.nativeExplanation, /script/);
  assert.deepEqual(json.facts.changes, ['feat: safe', 'fix: </details>']);
  assert.deepEqual(json.facts.checks, [{ name: 'go-ci', status: 'completed', conclusion: 'success' }]);
  assert.deepEqual(json.suggestedChecks,
    [{ id: 'smoke', description: 'Execute `cli --help`', status: 'pending' }]);
  assert.equal('suggestedChecks' in json.facts, false, 'suggestions must not be reported as collected facts');
  const markdown = readFileSync(join(output, 'homologation.md'), 'utf8');
  assert.match(markdown, /Candidate version: `0\.0\.1`/);
  assert.doesNotMatch(markdown, /<script>|javascript:/, 'untrusted Markdown must be neutralized');
  assert.match(markdown, /Suggested checks \(pending\)/);
  assert.equal(git('status', '--porcelain'), before, 'renderer must not mutate the consumer working tree');

  const missing = spawnSync(process.execPath,
    [join(root, 'scripts/versioning/homologation-guide.mjs'), join(workspace, 'missing.json'), snapshotPath, output],
    { cwd: workspace, encoding: 'utf8' });
  assert.notEqual(missing.status, 0, 'missing native report must fail');
  console.log('Homologation guide: 17 assertions passed');
} finally {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
}
