import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyTechnicalMerge } from '../../scripts/versioning/dist/services/technical-merge.js';
import { captureVersionFiles } from '../../scripts/versioning/dist/services/version-files.js';
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const root = mkdtempSync(join(tmpdir(), 'technical-merge-'));
const descriptor = validateDescriptor({ id: 'release-please', runtime: 'node', reportKind: 'single',
  needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
const randomSha = 'f'.repeat(40);
const now = '2026-10-21T10:00:00Z';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function scenario(method) {
  const cwd = join(root, method);
  mkdirSync(cwd);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const json = (path, value) => writeFileSync(join(cwd, path), `${JSON.stringify(value)}\n`);
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  json('.release-please-manifest.json', { '.': '1.0.0' });
  json('release-please-config.json', { packages: { '.': { 'release-type': 'node' } } });
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  git('switch', '-qc', 'develop');
  writeFileSync(join(cwd, 'feature.txt'), 'feature\n'); git('add', '.');
  git('commit', '-qm', 'fix: feature'); const developSha = git('rev-parse', 'HEAD');
  git('switch', 'master'); git('merge', '--no-ff', 'develop', '-m', 'Merge develop');
  const functionalSha = git('rev-parse', 'HEAD');
  const report = { schemaVersion: 1, adapter: 'release-please', sha: functionalSha,
    branch: 'master', status: 'release', baseVersion: '1.0.0', candidateVersion: '1.0.1',
    bump: 'patch', tag: 'v1.0.1', native: { explanation: 'Fix feature' } };
  const plan = planFromReport(report, descriptor, '.');
  const changes = {
    'package.json': '{"name":"app","version":"1.0.1"}\n',
    'package-lock.json': '{"name":"app","version":"1.0.1","packages":{"":{"version":"1.0.1"}}}\n',
    '.release-please-manifest.json': '{".":"1.0.1"}\n',
    'CHANGELOG.md': '## 1.0.1\n\nFix feature\n',
  };
  const bundle = captureVersionFiles({ repository: cwd, plan,
    operations: Object.entries(changes).map(([path, value]) =>
      ({ op: 'write', path, content: Buffer.from(value).toString('base64') })) });
  const branchIdentity = createHash('sha256').update(JSON.stringify(
    'acme/app/master/release-please/.')).digest('hex').slice(0, 16);
  const technicalBranch = `versioning/release-please/${branchIdentity}`;
  git('switch', '-qc', technicalBranch);
  for (const [path, value] of Object.entries(changes)) writeFileSync(join(cwd, path), value);
  git('add', '.'); git('commit', '-qm', `chore(release): release-please\n\nCentral-Versioning-Plan: ${plan.planDigest}\nFunctional-SHA: ${functionalSha}`);
  const reviewedHeadSha = git('rev-parse', 'HEAD');
  const treeSha = git('rev-parse', `${reviewedHeadSha}^{tree}`);
  git('switch', 'master');
  if (method === 'merge') git('merge', '--no-ff', technicalBranch, '-m', 'Merge release PR');
  else if (method === 'squash') { git('merge', '--squash', technicalBranch); git('commit', '-qm', 'Squash release PR'); }
  else { git('cherry-pick', reviewedHeadSha); }
  const publishedSha = git('rev-parse', 'HEAD');
  const provenance = { originPrNumber: 12, functionalSha, planDigest: plan.planDigest,
    bundleDigest: hash(bundle), headSha: reviewedHeadSha, treeSha };
  const state = { milestone: 'v1.0.1', functionalMergeSha: functionalSha,
    technicalHeadSha: reviewedHeadSha, technicalAuthor: 'version-bot[bot]', publishedSha, reviews: [
      { id: 1, state: 'APPROVED', commit_id: reviewedHeadSha, submitted_at: now,
        user: { login: 'maintainer', type: 'User' } } ],
    commits: 1, checkSha: publishedSha, checkConclusion: 'success' };
  const pr = () => ({ number: 99, state: 'closed', merged_at: now, merge_commit_sha: publishedSha,
    commits: state.commits, head: { ref: technicalBranch, sha: state.technicalHeadSha },
    base: { ref: 'master' }, user: { login: state.technicalAuthor, type: 'Bot' },
    body: `Origin-PR: #12\n<!-- central-versioning\n${JSON.stringify(provenance)}\n-->` });
  const functional = () => ({ number: 12, head: { ref: 'develop', sha: developSha },
    base: { ref: 'master' }, user: { login: 'developer', type: 'User' },
    merged_at: now, merge_commit_sha: state.functionalMergeSha,
    milestone: state.milestone === null ? null : { title: state.milestone } });
  const read = {
    async get(endpoint) {
      if (endpoint.endsWith('/pulls/99')) return pr();
      if (endpoint.endsWith('/pulls/12')) return functional();
      throw Error(`unexpected get ${endpoint}`);
    },
    async list(endpoint) {
      if (endpoint.endsWith('/pulls/99/reviews?per_page=100')) return state.reviews;
      if (endpoint.endsWith('/pulls/12/reviews?per_page=100') ||
        endpoint.endsWith('/issues/12/timeline?per_page=100')) return [];
      throw Error(`unexpected list ${endpoint}`);
    },
    async listField(endpoint, field) {
      assert.equal(field, 'check_runs');
      const sha = endpoint.match(/commits\/([0-9a-f]{40})\/check-runs/)?.[1];
      if (!sha) throw Error(`unexpected check ${endpoint}`);
      return [{ id: 1, name: 'build', head_sha: sha === publishedSha ? state.checkSha : sha,
        status: 'completed', conclusion: state.checkConclusion }];
    },
  };
  return { cwd, git, plan, bundle, state, read, publishedSha, reviewedHeadSha,
    functionalSha, developSha, technicalBranch };
}

try {
  for (const method of ['merge', 'squash', 'rebase']) {
    const fixture = scenario(method);
    const expectedFunctionalEvidence = await collectPrEvidence(fixture.read,
      { repository: 'acme/app', targetBranch: 'master', prNumber: 12, requiredChecks: ['build'] });
    const request = { repository: fixture.cwd, owner: 'acme', repo: 'app', botLogin: 'version-bot[bot]', plan: fixture.plan,
      bundle: fixture.bundle, originPrNumber: 12, technicalPrNumber: 99,
      expectedFunctionalEvidence, publishedSha: fixture.publishedSha,
      requiredChecks: ['build'], read: fixture.read };
    const verified = await verifyTechnicalMerge(request);
    assert.equal(verified.publishedSha, fixture.publishedSha, method);
    assert.equal(verified.reviewedHeadSha, fixture.reviewedHeadSha, method);
    assert.equal(verified.functionalSha, fixture.functionalSha, method);
    if (method !== 'merge') {
      fixture.state.commits = 2;
      await assert.rejects(verifyTechnicalMerge(request), /multi-commit|rebase|squash/i);
      fixture.state.commits = 1;
    }
    fixture.state.reviews.push({ id: 2, state: 'DISMISSED', commit_id: fixture.reviewedHeadSha,
      submitted_at: '2026-10-21T10:01:00Z', user: { login: 'maintainer', type: 'User' } });
    await assert.rejects(verifyTechnicalMerge(request), /review|aprovação/i);
    fixture.state.reviews.pop();
    fixture.state.reviews[0].commit_id = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /head|review|aprovação/i);
    fixture.state.reviews[0].commit_id = fixture.reviewedHeadSha;
    fixture.state.technicalHeadSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /head|proveniência|técnico/i);
    fixture.state.technicalHeadSha = fixture.reviewedHeadSha;
    fixture.state.technicalAuthor = 'other-bot[bot]';
    await assert.rejects(verifyTechnicalMerge(request), /bot|autor|identidade/i);
    fixture.state.technicalAuthor = 'version-bot[bot]';
    fixture.state.milestone = 'v2.0.0';
    await assert.rejects(verifyTechnicalMerge(request), /metadado|milestone|origem/i);
    fixture.state.milestone = 'v1.0.1';
    fixture.state.functionalMergeSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /origem|funcional/i);
    fixture.state.functionalMergeSha = fixture.functionalSha;
    fixture.state.checkSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /CI|SHA|check/i);
  }
  console.log('Technical merge: merge/squash/rebase-one, review, origin, milestone, CI and multi-commit gates');
} finally { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
