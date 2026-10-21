import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildHomologationGuide } from '../../scripts/versioning/homologation-guide.mjs';
import { normalizeChangesetsReport } from '../../scripts/versioning/version-report.mjs';
import { buildHomologationGuide as buildCompiledGuide } from '../../scripts/versioning/dist/services/homologation-guide.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'homologation-guide-'));
const output = mkdtempSync(join(tmpdir(), 'homologation-output-'));
const reportPath = join(workspace, 'report.json');
const snapshotPath = join(workspace, 'snapshot.json');
const sha = 'a'.repeat(40);

function makeReleasePlan({ adapter, sha: commit, branch, entries }) {
  const capabilities = {
    'go-gitsemver': { runtime: 'go', reportKind: 'single', needsVersionPr: false, tagKind: 'lightweight' },
    changesets: { runtime: 'node', reportKind: 'batch', needsVersionPr: true, tagKind: 'lightweight' },
    'release-please': { runtime: 'node', reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight' },
  };
  const capability = capabilities[adapter];
  const descriptor = validateDescriptor({ id: adapter, ...capability, collect() {},
    ...(capability.needsVersionPr ? { prepare() {} } : {}) });
  const report = { schemaVersion: 1, adapter, sha: commit, branch,
    status: entries.length ? 'release' : 'no-release',
    native: { explanation: entries.map(item => item.notes).join('\n') },
    ...(capability.reportKind === 'batch' ? { releases: entries.map(item => ({
      name: item.package, oldVersion: item.baseVersion, version: item.version,
      bump: item.bump, tag: item.tag,
    })) } : entries.length ? {
      baseVersion: entries[0].baseVersion, candidateVersion: entries[0].version,
      bump: entries[0].bump, tag: entries[0].tag,
    } : {}),
  };
  return planFromReport(report, descriptor, entries[0]?.projectPath ?? '.');
}

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
  assert.match(markdown, /Repository: `owner\/repo`/);
  assert.match(markdown, /Pull request: `42`/);
  assert.ok(markdown.includes(`SHA: \`${sha}\``));
  assert.match(markdown, /Candidate version: `0\.0\.1`/);
  assert.match(markdown, /Increment: `patch`/);
  assert.match(markdown, /feat: safe/);
  assert.match(markdown, /go\\-ci: completed \/ success/);
  assert.match(markdown, /alert\\\(1\\\)/, 'native explanation must remain available as escaped text');
  assert.doesNotMatch(markdown, /<script>|javascript:/, 'untrusted Markdown must be neutralized');
  assert.match(markdown, /Suggested checks \(pending\)/);
  assert.equal(git('status', '--porcelain'), before, 'renderer must not mutate the consumer working tree');
  const batchReport = normalizeChangesetsReport({ branch: 'develop', sha, explanation: '',
    nativeJson: JSON.stringify({ changesets: [{ id: 'batch', releases: [] }], releases: [
      { name: '@lab/core', oldVersion: '2.0.0', newVersion: '3.0.0' },
      { name: '@lab/cli', oldVersion: '1.0.0', newVersion: '1.0.1' }] }) });
  const batch = buildHomologationGuide(batchReport,
    { repository: 'owner/repo', number: 43, headSha: sha });
  assert.equal(batch.guide.facts.candidateVersion, null, 'multi-package batch has no scalar version');
  assert.equal(batch.guide.facts.bump, null);
  assert.deepEqual(batch.guide.facts.releases.map(item => item.tag),
    ['@lab/cli@1.0.1', '@lab/core@3.0.0']);
  assert.match(batch.markdown, /@lab\/cli@1\.0\.1/);
  assert.match(batch.markdown, /@lab\/core@3\.0\.0/);

  const plans = [
    makeReleasePlan({ adapter: 'go-gitsemver', sha, branch: 'develop', entries: [{
      package: null, projectPath: '.', baseVersion: '0.0.0', version: '0.0.1', bump: 'patch',
      tag: 'v0.0.1', tagKind: 'lightweight', notes: 'Native changelog: fix <safe>',
    }] }),
    makeReleasePlan({ adapter: 'changesets', sha, branch: 'develop', entries: [
      { package: '@lab/core', projectPath: '.', baseVersion: '2.0.0', version: '3.0.0', bump: 'major', tag: '@lab/core@3.0.0', tagKind: 'lightweight', notes: 'Core change' },
      { package: '@lab/cli', projectPath: '.', baseVersion: '1.0.0', version: '1.0.1', bump: 'patch', tag: '@lab/cli@1.0.1', tagKind: 'lightweight', notes: 'Dependent change' },
    ] }),
    makeReleasePlan({ adapter: 'release-please', sha, branch: 'develop', entries: [] }),
  ];
  const planSnapshot = { repository: 'owner/repo', number: 44, headSha: sha,
    changes: ['fix: `quoted` <script>'], suggestedChecks: [{ id: 'manual', description: 'Validate package', status: 'done' }] };
  const singleGuide = buildCompiledGuide(plans[0], planSnapshot);
  assert.deepEqual(singleGuide.guide.facts.releases.map(item => item.tag), ['v0.0.1']);
  assert.match(singleGuide.markdown, /Native changelog: fix/);
  assert.doesNotMatch(singleGuide.markdown, /<script>|<safe>/);
  assert.deepEqual(singleGuide.guide.suggestedChecks.map(item => item.status), ['pending']);
  assert.doesNotMatch(singleGuide.markdown, /approved|homologated/i);
  const batchGuide = buildCompiledGuide(plans[1], planSnapshot);
  assert.deepEqual(batchGuide.guide.facts.releases.map(item => item.package), ['@lab/cli', '@lab/core']);
  assert.match(batchGuide.markdown, /Dependent change/);
  const emptyGuide = buildCompiledGuide(plans[2], planSnapshot);
  assert.equal(emptyGuide.guide.facts.status, 'no-release');
  assert.deepEqual(emptyGuide.guide.facts.releases, []);
  assert.match(emptyGuide.markdown, /No release/);
  assert.throws(() => buildCompiledGuide(plans[0], { ...planSnapshot, headSha: 'b'.repeat(40) }), /SHA/);

  const missing = spawnSync(process.execPath,
    [join(root, 'scripts/versioning/homologation-guide.mjs'), join(workspace, 'missing.json'), snapshotPath, output],
    { cwd: workspace, encoding: 'utf8' });
  assert.notEqual(missing.status, 0, 'missing native report must fail');
  console.log('Homologation guide assertions passed');
} finally {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
}
