import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';
import { publishMain, runPublish } from '../../scripts/versioning/dist/entrypoints/publish.js';
import { publicationPayloadDigest } from '../../scripts/versioning/dist/services/publication-payload.js';

const sha = 'a'.repeat(40);
const centralSha = 'c'.repeat(40);
const producer = { repository: 'acme/app', runId: 77, runAttempt: 1,
  job: 'validate-publication', centralSha };
const report = { schemaVersion: 1, adapter: 'go-gitsemver', sha, branch: 'master',
  baseVersion: '0.0.0', candidateVersion: '0.0.1', bump: 'patch', tag: 'v0.0.1',
  native: { explanation: 'native fix' } };
const descriptor = validateDescriptor({ id: 'go-gitsemver', runtime: 'go', reportKind: 'single',
  needsVersionPr: false, tagKind: 'lightweight', collect() {} });
const plan = planFromReport(report, descriptor, '.');
const trust = { owner: 'acme', repo: 'app', adapter: 'go-gitsemver', projectPath: '.',
  targetBranch: 'master', tagPrefix: 'v', publishedSha: sha, centralSha,
  runId: 77, runAttempt: 1, artifactId: 500, expectedProducerJob: 'validate-publication',
  planDigest: plan.planDigest, payloadDigest: '' };
const state = { milestone: null, artifactExpired: false, artifactRun: 77,
  artifactSha: sha, jobName: 'validate-publication', jobConclusion: 'success',
  runSha: sha, runAttempt: 1, checksSha: sha };
const pr = () => ({ number: 7, head: { sha: 'd'.repeat(40), ref: 'develop' },
  base: { ref: 'master' }, user: { login: 'developer', type: 'User' },
  milestone: state.milestone ? { title: state.milestone } : null,
  merged_at: '2026-10-21T10:00:00Z', merge_commit_sha: sha });
const read = { async get(endpoint) {
  if (endpoint === 'repos/acme/app/actions/artifacts/500') return { id: 500,
    name: 'publication-77-1', expired: state.artifactExpired, size_in_bytes: 123,
    workflow_run: { id: state.artifactRun, head_sha: state.artifactSha } };
  if (endpoint === 'repos/acme/app/actions/runs/77/attempts/1') return { id: 77,
    run_attempt: state.runAttempt, head_sha: state.runSha,
    head_branch: 'master', event: 'push' };
  if (endpoint === 'repos/acme/app/pulls/7') return pr();
  if (endpoint === 'repos/acme/app/git/ref/heads/master') return { object: { sha } };
  throw Error(`Unexpected GET ${endpoint}`);
}, async list(endpoint) {
  if (endpoint === `repos/acme/app/commits/${sha}/pulls?per_page=100`) return [pr()];
  if (endpoint.endsWith('/issues/7/timeline?per_page=100') ||
      endpoint.endsWith('/pulls/7/reviews?per_page=100')) return [];
  throw Error(`Unexpected list ${endpoint}`);
}, async listField(endpoint, field) {
  if (endpoint === 'repos/acme/app/actions/runs/77/attempts/1/jobs?per_page=100' && field === 'jobs') {
    return [{ id: 50, run_id: 77, head_sha: sha, name: state.jobName,
      status: 'completed', conclusion: state.jobConclusion }];
  }
  if (endpoint.endsWith('/check-runs?per_page=100') && field === 'check_runs') {
    return [{ id: 1, head_sha: state.checksSha, name: 'build',
      status: 'completed', conclusion: 'success' }];
  }
  throw Error(`Unexpected field ${endpoint}`);
} };
const snapshot = await collectPrEvidence(read, { repository: 'acme/app',
  targetBranch: 'master', commitSha: sha, requiredChecks: ['build'] });
const evidence = { phase: 'functional', producer, functionalSha: sha, publishedSha: sha,
  originPrNumber: 7, technicalPrNumber: null, planDigest: plan.planDigest,
  technicalMerge: null };
const artifact = { report, plan, snapshot, gitInputs: { schemaVersion: 1,
  adapter: 'go-gitsemver', sha, refs: {} }, publicationEvidence: evidence, bundle: null };
trust.payloadDigest = publicationPayloadDigest(artifact);
const git = { headSha: () => sha, verifyInputs(input, current) {
  assert.equal(input.sha, current); return true;
} };
const write = { post() { throw Error('Unexpected write'); }, patch() { throw Error('Unexpected write'); },
  put() { throw Error('Unexpected write'); }, delete() { throw Error('Unexpected write'); } };
const published = { outcome: 'published', publishedSha: sha,
  entries: [{ package: null, tag: 'v0.0.1', status: 'created', releaseUrl: 'https://example.test/release' }] };
const services = { async publishPlan(input) { await input.verify(); return published; },
  allowedWrites() { return []; },
  async prepareTechnical() { throw Error('Technical PR not expected'); } };
const request = () => ({ repository: process.cwd(), trust, artifact, read, write, git,
  requiredChecks: ['build'], services });

const single = await runPublish(request());
assert.equal(single.outcome, 'published');
assert.equal(single.outputs.version, '0.0.1');
assert.equal(single.outputs.tag, 'v0.0.1');
assert.equal(single.outputs.published_sha, sha);
assert.equal(single.outputs.release_url, 'https://example.test/release');
assert.equal(JSON.parse(single.outputs.releases_json)[0].tag, 'v0.0.1');
assert.equal(JSON.parse(single.outputs.releases_json)[0].version, '0.0.1');
assert.equal(JSON.parse(single.outputs.releases_json)[0].release_url, 'https://example.test/release');

const batchReport = { schemaVersion: 1, adapter: 'changesets', sha: 'e'.repeat(40), branch: 'master',
  tagPrefix: 'v', baseVersion: '1.0.0', candidateVersion: '1.0.1', bump: 'patch',
  tag: '@lab/core@1.0.1', releases: [
    { name: '@lab/cli', oldVersion: '1.0.0', version: '1.0.1', bump: 'patch', tag: '@lab/cli@1.0.1' },
    { name: '@lab/core', oldVersion: '1.0.0', version: '1.0.1', bump: 'patch', tag: '@lab/core@1.0.1' },
  ], native: { explanation: 'native changes' } };
const batchPlan = planFromReport(batchReport, validateDescriptor({ id: 'changesets', runtime: 'node',
  reportKind: 'batch', needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} }), '.');
const batchArtifact = { ...artifact, report: batchReport, plan: batchPlan,
  gitInputs: { ...artifact.gitInputs, adapter: 'changesets' },
  publicationEvidence: { ...evidence, planDigest: batchPlan.planDigest, phase: 'technical',
    functionalSha: 'e'.repeat(40), originPrNumber: 7, technicalPrNumber: 9 }, bundle: { schemaVersion: 2 } };
const batchPublished = { outcome: 'published', publishedSha: sha, entries: [
  { package: '@lab/cli', tag: '@lab/cli@1.0.1', status: 'created', releaseUrl: 'https://example.test/cli' },
  { package: '@lab/core', tag: '@lab/core@1.0.1', status: 'created', releaseUrl: 'https://example.test/core' },
] };
const batch = await runPublish({ ...request(), trust: { ...trust, adapter: 'changesets',
  planDigest: batchPlan.planDigest, payloadDigest: publicationPayloadDigest(batchArtifact) },
  artifact: batchArtifact, services: { ...services, async publishPlan(input) {
    await input.verify(); return batchPublished;
  }, async verifyTechnical() { return { functionalSha: 'e'.repeat(40),
    reviewedHeadSha: 'f'.repeat(40), publishedSha: sha,
    planDigest: batchPlan.planDigest, method: 'merge', approvalBy: 'maintainer' }; } },
  validateBundle: () => true });
assert.equal(batch.outputs.version, '');
assert.equal(batch.outputs.tag, '');
assert.equal(batch.outputs.published_sha, sha);
assert.equal(JSON.parse(batch.outputs.releases_json).length, 2);
assert.deepEqual(JSON.parse(batch.outputs.releases_json).map(item =>
  [item.package, item.version, item.tag, item.release_url]), [
  ['@lab/cli', '1.0.1', '@lab/cli@1.0.1', 'https://example.test/cli'],
  ['@lab/core', '1.0.1', '@lab/core@1.0.1', 'https://example.test/core'],
]);

const prReport = { ...report, adapter: 'release-please' };
const prPlan = planFromReport(prReport, validateDescriptor({ id: 'release-please', runtime: 'node',
  reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} }), '.');
const prArtifact = { ...artifact, report: prReport, plan: prPlan, bundle: { schemaVersion: 2 },
  gitInputs: { ...artifact.gitInputs, adapter: 'release-please' },
  publicationEvidence: { ...evidence, planDigest: prPlan.planDigest } };
const prepared = await runPublish({ ...request(), trust: { ...trust, adapter: 'release-please',
  planDigest: prPlan.planDigest, payloadDigest: publicationPayloadDigest(prArtifact) },
  artifact: prArtifact, validateBundle: () => true,
  services: { ...services, async prepareTechnical() { return { outcome: 'created', number: 9,
    url: 'https://example.test/pr/9', branch: 'versioning/release-please/abc',
    headSha: 'e'.repeat(40), functionalSha: sha }; } } });
assert.equal(prepared.outcome, 'pending-version-pr');
assert.equal(prepared.outputs.version_pr_url, 'https://example.test/pr/9');
assert.equal(prepared.outputs.published_sha, '');
assert.equal(JSON.parse(prepared.outputs.releases_json)[0].release_url, null);

const standardReport = { ...report, adapter: 'standard-version' };
const standardPlan = planFromReport(standardReport, validateDescriptor({ id: 'standard-version',
  runtime: 'node', reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight',
  collect() {}, prepare() {} }), '.');
const standardArtifact = { ...artifact, report: standardReport, plan: standardPlan,
  bundle: { schemaVersion: 1 }, gitInputs: { ...artifact.gitInputs, adapter: 'standard-version' },
  publicationEvidence: { ...evidence, planDigest: standardPlan.planDigest } };
const standard = await runPublish({ ...request(), trust: { ...trust, adapter: 'standard-version',
  planDigest: standardPlan.planDigest, payloadDigest: publicationPayloadDigest(standardArtifact) },
  artifact: standardArtifact, validateBundle: () => true,
  services: { ...services, async prepareTechnical(input) {
    assert.equal(input.plan.adapter, 'standard-version');
    return { outcome: 'created', number: 10, url: 'https://example.test/pr/10',
      branch: 'versioning/standard-version/abc', headSha: 'f'.repeat(40), functionalSha: sha };
  } } });
assert.equal(standard.outcome, 'pending-version-pr');
assert.equal(standard.outputs.version_pr_url, 'https://example.test/pr/10');

const retry = await runPublish({ ...request(), services: { ...services,
  async publishPlan(input) { await input.verify(); return { ...published, outcome: 'already-published',
    entries: [{ ...published.entries[0], status: 'existing' }] }; } } });
assert.equal(retry.outcome, 'already-published');
assert.equal(retry.outputs.published_sha, sha);

state.artifactExpired = true;
await assert.rejects(runPublish(request()), /expirado|artifact/i);
state.artifactExpired = false;
const forgedReport = { ...report, candidateVersion: '0.0.2', tag: 'v0.0.2' };
const forgedPlan = planFromReport(forgedReport, descriptor, '.');
await assert.rejects(runPublish({ ...request(), artifact: { ...artifact,
  report: forgedReport, plan: forgedPlan,
  publicationEvidence: { ...evidence, planDigest: forgedPlan.planDigest } } }),
  /identidade|confiáve|artifact/i);
await assert.rejects(runPublish({ ...request(), artifact: { ...artifact,
  bundle: { injected: true } } }), /identidade|confiáve|artifact/i);
await assert.rejects(runPublish({ ...request(), trust: { ...trust, tagPrefix: 'release-' } }),
  /prefix|tag|caller/i);
await assert.rejects(runPublish({ ...request(), artifact: { ...artifact,
  publicationEvidence: { ...evidence, producer: { ...producer, job: 'publish' } } } }),
  /produtor|job|artifact/i);
state.milestone = 'v9.9.9';
await assert.rejects(runPublish(request()), /metadado|milestone|origem/i);
state.milestone = null;

const partial = await runPublish({ ...request(), services: { ...services,
  async publishPlan(input) { await input.verify(); return { outcome: 'partial', publishedSha: '',
    entries: [{ package: null, tag: 'v0.0.1', status: 'pending', releaseUrl: null,
      reason: 'API indisponível' }], error: 'API indisponível' }; } } });
assert.equal(partial.outcome, 'partial');
assert.equal(partial.outputs.published_sha, '');
assert.equal(JSON.parse(partial.outputs.releases_json)[0].status, 'pending');

const workspace = mkdtempSync(join(tmpdir(), 'writer-entrypoint-'));
const processMethods = ['exec', 'execFile', 'execFileSync', 'execSync', 'spawn', 'spawnSync', 'fork'];
const originalProcesses = Object.fromEntries(processMethods.map(name => [name, childProcess[name]]));
for (const name of processMethods) childProcess[name] = () => { throw Error(`Native process sentinel: ${name}`); };
syncBuiltinESMExports();
try {
  for (const [name, value] of Object.entries({ 'version-report.json': report,
    'release-plan.json': plan, 'pr-policy.json': snapshot, 'git-inputs.json': artifact.gitInputs,
    'publication-evidence.json': evidence })) {
    writeFileSync(join(workspace, name), JSON.stringify(value));
  }
  const objects = new Map();
  const apiRead = { ...read, async getOptional(endpoint) { return objects.get(endpoint) ?? null; } };
  const apiWrite = { ...write, async post(endpoint, payload) {
    if (endpoint === 'repos/acme/app/git/refs') {
      assert.equal(payload.ref, 'refs/tags/v0.0.1');
      assert.equal(payload.sha, sha);
      const value = { object: { type: 'commit', sha } };
      objects.set('repos/acme/app/git/ref/tags/v0.0.1', value);
      return value;
    }
    if (endpoint === 'repos/acme/app/releases') {
      assert.equal(payload.tag_name, 'v0.0.1');
      assert.equal(payload.target_commitish, sha);
      const value = { ...payload, html_url: 'https://example.test/release' };
      objects.set('repos/acme/app/releases/tags/v0.0.1', value);
      return value;
    }
    throw Error(`Unexpected default writer POST ${endpoint}`);
  } };
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master', TARGET_BRANCH: 'master',
    GITHUB_WORKSPACE: workspace, GITHUB_REPOSITORY: 'acme/app', ADAPTER: 'go-gitsemver',
    GITHUB_SHA: sha, CENTRAL_SHA: centralSha, GITHUB_RUN_ID: '77', GITHUB_RUN_ATTEMPT: '1',
    VERSIONING_ARTIFACT_ID: '500', VERSIONING_ARTIFACT_DIR: workspace,
    VERSIONING_PLAN_DIGEST: trust.planDigest, VERSIONING_PAYLOAD_DIGEST: trust.payloadDigest,
    GITHUB_OUTPUT: join(workspace, 'outputs'), GH_TOKEN: 'secret-sentinel' };
  const dependencies = { read: apiRead, write: apiWrite, git, error(message) { throw Error(message); } };
  assert.equal(await publishMain(env, dependencies), 0);
  const output = Object.fromEntries(readFileSync(env.GITHUB_OUTPUT, 'utf8').trim().split('\n')
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assert.equal(output.outcome, 'published');
  assert.equal(output.published_sha, sha);
  assert.equal(output.version, '0.0.1');
  assert.equal(output.tag, 'v0.0.1');
  assert.equal(output.release_url, 'https://example.test/release');
  assert.equal(output.version_pr_url, '');
  assert.deepEqual(JSON.parse(output.releases_json), [{ package: null, version: '0.0.1',
    tag: 'v0.0.1', release_url: 'https://example.test/release', status: 'created' }]);
  assert.equal(readFileSync(env.GITHUB_OUTPUT, 'utf8').includes('secret-sentinel'), false);
  assert.equal(await publishMain(env, dependencies), 0, 'default publisher retry succeeds');
  assert.match(readFileSync(env.GITHUB_OUTPUT, 'utf8'), /outcome=already-published/);
  state.artifactExpired = true;
  const errors = [];
  assert.equal(await publishMain(env, { ...dependencies, error: message => errors.push(message) }), 1);
  assert.match(errors[0], /expirado|artifact/i);
  state.artifactExpired = false;
} finally {
  Object.assign(childProcess, originalProcesses);
  syncBuiltinESMExports();
  rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/versioning/dist');
const seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\bimport\s*\(/, 'writer graph cannot load a native SDK dynamically');
  for (const [, specifier] of source.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
    else assert.ok(specifier.startsWith('node:'), `writer cannot import external SDK ${specifier}`);
  }
}
visit(join(dist, 'entrypoints', 'publish.js'));
assert.equal([...seen].some(file => /[/\\](adapters|tools)[/\\]|[/\\]ports[/\\]process\.js$/.test(file)), false);
console.log('Writer: single, batch, technical PR, retry, expiry, producer, metadata and partial boundaries');
