import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
import { verifyLegacyTechnicalMerge } from '../../scripts/versioning/dist/services/legacy-technical-merge.js';
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';

const root = mkdtempSync(join(tmpdir(), 'legacy-technical-'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const put = (path, value) => writeFileSync(join(root, path), value);
const json = (path, value) => put(path, `${JSON.stringify(value)}\n`);
const hash = value => createHash('sha256').update(value).digest('hex');
const now = '2026-10-21T10:00:00Z';
try {
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  put('CHANGELOG.md', '# 1.0.0\n');
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  git('switch', '-qc', 'develop'); put('feature.txt', 'fix\n'); git('add', '.');
  git('commit', '-qm', 'fix: issue'); const headSha = git('rev-parse', 'HEAD');
  git('switch', 'master'); git('merge', '--no-ff', 'develop', '-m', 'Merge develop');
  const functionalSha = git('rev-parse', 'HEAD');
  const report = { schemaVersion: 1, adapter: 'standard-version', sha: functionalSha,
    branch: 'master', tagPrefix: 'v', baseVersion: '1.0.0', candidateVersion: '1.0.1',
    bump: 'patch', tag: 'v1.0.1', native: { explanation: 'fix: issue' } };
  const descriptor = validateDescriptor({ id: 'standard-version', runtime: 'node',
    reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
  const plan = planFromReport(report, descriptor, '.');
  const changes = {
    'package.json': `${JSON.stringify({ name: 'app', version: '1.0.1' })}\n`,
    'package-lock.json': `${JSON.stringify({ name: 'app', version: '1.0.1',
      packages: { '': { version: '1.0.1' } } })}\n`,
    'CHANGELOG.md': '# 1.0.1\n\nfix: issue\n',
  };
  const files = Object.entries(changes).map(([path, content]) => ({ path,
    before: hash(execFileSync('git', ['show', `${functionalSha}:${path}`], { cwd: root })),
    hash: hash(Buffer.from(content)), content: Buffer.from(content).toString('base64') }));
  const bundle = { schemaVersion: 1, adapter: 'standard-version', sha: functionalSha,
    version: '1.0.1', tagPrefix: 'v', projectPath: '.', files };
  const branch = `versioning/standard-version/${functionalSha.slice(0, 12)}`;
  git('switch', '-qc', branch);
  for (const [path, content] of Object.entries(changes)) put(path, content);
  git('add', '.'); git('commit', '-qm', 'chore(release): 1.0.1');
  const reviewedHeadSha = git('rev-parse', 'HEAD');
  git('switch', 'master'); git('merge', '--no-ff', branch, '-m', 'Merge release PR');
  const publishedSha = git('rev-parse', 'HEAD');
  const state = { milestone: 'v1.0.1', approvalState: 'APPROVED', approvalSha: reviewedHeadSha,
    ciSha: publishedSha, bodyVersion: '1.0.1', bundle };
  const functional = () => ({ number: 7, head: { sha: headSha, ref: 'develop' },
    base: { ref: 'master' }, merged_at: now, merge_commit_sha: functionalSha,
    user: { login: 'developer', type: 'User' }, milestone: { title: state.milestone } });
  const technical = () => ({ number: 9, head: { ref: branch, sha: reviewedHeadSha },
    base: { ref: 'master' }, merged_at: now, merge_commit_sha: publishedSha, commits: 1,
    user: { login: 'version-bot[bot]', type: 'Bot' }, body:
      `Origin-PR: #7\nOrigin-SHA: ${functionalSha}\nAdapter: standard-version\n` +
      `Project: .\nTag-Prefix: v\nVersion: ${state.bodyVersion}\n` });
  const read = { async get(endpoint) {
    if (endpoint.endsWith('/pulls/7')) return functional();
    if (endpoint.endsWith('/pulls/9')) return technical();
    throw Error(`unexpected GET ${endpoint}`);
  }, async list(endpoint) {
    if (endpoint.endsWith('/pulls/9/reviews?per_page=100')) return [{ id: 1,
      state: state.approvalState, commit_id: state.approvalSha, submitted_at: now,
      user: { login: 'maintainer', type: 'User' } }];
    if (endpoint.endsWith('/pulls/7/reviews?per_page=100') ||
      endpoint.endsWith('/issues/7/timeline?per_page=100')) return [];
    throw Error(`unexpected list ${endpoint}`);
  }, async listField(endpoint) {
    const sha = endpoint.match(/commits\/([0-9a-f]{40})\/check-runs/)?.[1];
    if (!sha) throw Error(`unexpected checks ${endpoint}`);
    return [{ id: 1, name: 'build', head_sha: sha === publishedSha ? state.ciSha : sha,
      status: 'completed', conclusion: 'success' }];
  } };
  const origin = await collectPrEvidence(read, { repository: 'acme/app',
    targetBranch: 'master', prNumber: 7, requiredChecks: ['build'] });
  const request = () => ({ repository: root, owner: 'acme', repo: 'app', plan,
    bundle: state.bundle, origin, technicalPrNumber: 9, publishedSha,
    requiredChecks: ['build'], read });
  const verified = await verifyLegacyTechnicalMerge(request());
  assert.equal(verified.functionalSha, functionalSha);
  assert.equal(verified.reviewedHeadSha, reviewedHeadSha);
  assert.equal(verified.publishedSha, publishedSha);
  assert.equal(verified.method, 'merge');
  assert.equal(verified.approvalBy, 'maintainer');
  state.approvalState = 'DISMISSED';
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /aprovação/i);
  state.approvalState = 'APPROVED'; state.approvalSha = 'f'.repeat(40);
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /aprovação/i);
  state.approvalSha = reviewedHeadSha; state.ciSha = 'f'.repeat(40);
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /CI|SHA/i);
  state.ciSha = publishedSha; state.bodyVersion = '9.9.9';
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /proveniência/i);
  state.bodyVersion = '1.0.1'; state.milestone = 'v2.0.0';
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /origem|milestone/i);
  state.milestone = 'v1.0.1'; state.bundle = { ...bundle,
    files: bundle.files.map((file, index) => index ? file : { ...file, content: 'ZmFsc2U=' }) };
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /adulterado|bundle/i);
  const wrongManifest = Buffer.from('{"name":"app","version":"9.9.9"}\n');
  state.bundle = { ...bundle, files: bundle.files.map(file => file.path === 'package.json' ?
    { ...file, content: wrongManifest.toString('base64'), hash: hash(wrongManifest) } : file) };
  await assert.rejects(verifyLegacyTechnicalMerge(request()), /manifest|versão/i);
  console.log('Legacy technical merge: real Git tree, bundle, origin, review and published CI');
} finally { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
