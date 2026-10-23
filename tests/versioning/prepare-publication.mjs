import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedVersionWrites, preparePublication, preparePublicationMain } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const sha = 'a'.repeat(40);
const technicalSha = 'b'.repeat(40);
const centralSha = 'c'.repeat(40);
const context = { repository: '/fixture', workspace: '/fixture', projectPath: '.',
  targetBranch: 'master', sha, tagPrefix: 'v', configuration: {} };
const producer = { repository: 'acme/app', runId: 77, runAttempt: 1,
  job: 'validate-publication', centralSha };
const report = { schemaVersion: 1, adapter: 'go-gitsemver', sha, branch: 'master',
  baseVersion: '0.0.0', candidateVersion: '0.0.1', bump: 'patch', tag: 'v0.0.1',
  native: { explanation: 'fix: native result' } };
const planReport = { ...report, adapter: 'release-please' };
const technicalPlan = planFromReport(planReport, validateDescriptor({ id: 'release-please', runtime: 'node',
  reportKind: 'single', needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} }), '.');
const checks = currentSha => [{ id: 1, name: 'build', head_sha: currentSha,
  status: 'completed', conclusion: 'success' }];
const functionalPr = mergeSha => ({ number: 7, head: { sha: 'd'.repeat(40), ref: 'develop' },
  base: { ref: 'master' }, user: { login: 'developer', type: 'User' },
  merged_at: '2026-10-21T10:00:00Z', merge_commit_sha: mergeSha, milestone: null });
let ciSha = sha;
let pr = functionalPr(sha);
let associated = [pr];
const read = {
  async get(endpoint) {
    if (endpoint.endsWith('/pulls/7')) return pr;
    if (endpoint.endsWith('/pulls/9')) return { number: 9, head: { ref: 'versioning/release-please/abc', sha: 'e'.repeat(40) },
      base: { ref: 'master' }, merged_at: '2026-10-21T11:00:00Z', merge_commit_sha: technicalSha };
    if (endpoint === 'repos/acme/app') return { default_branch: 'master' };
    if (endpoint === 'repos/acme/app/git/ref/heads/master') return { object: { sha: context.sha } };
    throw Error(`Unexpected GET ${endpoint}`);
  },
  async list(endpoint) {
    if (endpoint.includes('/commits/') && endpoint.includes('/pulls?')) return associated;
    if (endpoint.includes('/timeline?') || endpoint.includes('/reviews?')) return [];
    throw Error(`Unexpected list ${endpoint}`);
  },
  async listField(endpoint) {
    const requested = endpoint.match(/commits\/([0-9a-f]{40})\/check-runs/)?.[1];
    if (!requested) throw Error(`Unexpected checks ${endpoint}`);
    return checks(ciSha);
  },
};
const git = { headSha: () => context.sha, captureInputs: adapter => ({ schemaVersion: 1, adapter,
  sha: context.sha, refs: {} }), verifyInputs(snapshot, currentSha) {
  assert.equal(snapshot.sha, currentSha); return true;
} };
const implementations = { 'go-gitsemver': { collect: () => report },
  'release-please': { collect: () => { throw Error('native must not run after technical merge'); },
    prepare: () => { throw Error('prepare must not run after technical merge'); } } };
const request = () => ({ owner: 'acme', repo: 'app', adapter: 'go-gitsemver', context,
  producer, read, git, implementations, requiredChecks: ['build'] });

const direct = await preparePublication(request());
assert.equal(direct.phase, 'functional');
assert.equal(direct.plan.entries[0].version, '0.0.1');
assert.equal(direct.functionalSha, sha);
assert.equal(direct.publishedSha, sha);
assert.equal(direct.bundle, null);
assert.equal(direct.producer.centralSha, centralSha);
assert.equal(direct.producer.runId, 77);
assert.equal(direct.producer.job, 'validate-publication');
assert.equal(direct.policy.outcome, 'adapter-authoritative');
assert.equal(direct.snapshot.mergeCommitSha, sha);
assert.equal(direct.gitInputs.sha, sha);

const noRelease = await preparePublication({ ...request(), implementations: {
  'go-gitsemver': { collect: () => ({ schemaVersion: 1, adapter: 'go-gitsemver',
    sha, branch: 'master', status: 'no-release', native: { explanation: 'none' } }) },
} });
assert.equal(noRelease.plan.status, 'no-release');
assert.equal(noRelease.bundle, null);
assert.equal(noRelease.policy, null);

const technicalSource = { report: planReport, plan: null, bundle: { schemaVersion: 2 },
  snapshot: null, producer: { ...producer, runId: 55 } };
associated = [{ number: 9, merged_at: '2026-10-21T11:00:00Z', merge_commit_sha: technicalSha,
  head: { ref: 'versioning/release-please/abc' }, base: { ref: 'master' } }];
// The real plan and bundle validators run in their own integration fixtures; this fixture
// proves that the entrypoint delegates to them and preserves their returned identities.
const technical = await preparePublication({ ...request(), adapter: 'release-please',
  context: { ...context, sha: technicalSha }, git: { ...git,
    headSha: () => technicalSha, captureInputs: adapter => ({ schemaVersion: 1, adapter,
      sha: technicalSha, refs: {} }) },
  origin: { ...technicalSource, plan: technicalPlan,
    snapshot: { ...direct.snapshot, mergeCommitSha: sha } },
  validateOrigin: () => ({ plan: technicalPlan, bundle: technicalSource.bundle }),
  verifyTechnical: async () => ({ functionalSha: sha, reviewedHeadSha: 'e'.repeat(40),
    publishedSha: technicalSha, method: 'merge', approvalBy: 'maintainer', planDigest: technicalPlan.planDigest }),
  requiredChecks: ['build'], read: { ...read, async get(endpoint) {
    if (endpoint === 'repos/acme/app/git/ref/heads/master') return { object: { sha: technicalSha } };
    return read.get(endpoint);
  } },
});
assert.equal(technical.phase, 'technical');
assert.equal(technical.functionalSha, sha);
assert.equal(technical.publishedSha, technicalSha);
assert.equal(technical.technicalPrNumber, 9);
assert.equal(technical.originPrNumber, 7);
assert.equal(technical.bundle.schemaVersion, 2);

const monorepo = mkdtempSync(join(tmpdir(), 'allowed-version-writes-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: monorepo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(monorepo, 'package-lock.json'), JSON.stringify({ packages: {
    '': { name: 'root', version: '1.0.0' },
    'packages/core': { name: '@lab/core', version: '1.0.0' },
    'node_modules/@lab/core': { name: '@lab/core', link: true },
  } }));
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  const changesetsReport = { schemaVersion: 1, adapter: 'changesets', sha: git('rev-parse', 'HEAD'),
    branch: 'master', tagPrefix: 'v', baseVersion: '1.0.0', candidateVersion: '1.0.1',
    bump: 'patch', tag: '@lab/core@1.0.1', releases: [{ name: '@lab/core',
      oldVersion: '1.0.0', version: '1.0.1', bump: 'patch', tag: '@lab/core@1.0.1' }],
    native: { explanation: 'native changeset' } };
  const changesetsPlan = planFromReport(changesetsReport, validateDescriptor({ id: 'changesets',
    runtime: 'node', reportKind: 'batch', needsVersionPr: true,
    tagKind: 'lightweight', collect() {}, prepare() {} }), '.');
  assert.deepEqual(allowedVersionWrites(changesetsPlan, monorepo), [
    'package-lock.json', 'packages/core/package.json', 'packages/core/CHANGELOG.md']);
  await assert.rejects(async () => allowedVersionWrites({ ...changesetsPlan,
    entries: [{ ...changesetsPlan.entries[0], package: '@lab/unknown' }] }, monorepo),
  /não identifica/i);
} finally { rmSync(monorepo, { recursive: true, force: true }); }

pr = functionalPr('f'.repeat(40)); associated = [pr];
await assert.rejects(preparePublication(request()), /associação|origem|integrado/i);
pr = functionalPr(sha); associated = [pr];
await assert.rejects(preparePublication({ ...request(), origin: { report: planReport } }),
  /artifact|incomplet/i);
ciSha = 'f'.repeat(40);
await assert.rejects(preparePublication(request()), /CI|SHA/i);
ciSha = sha;

const directory = mkdtempSync(join(tmpdir(), 'publication-evidence-'));
try {
  const importOutput = join(directory, 'import-output.txt');
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(pathToFileURL(join(process.cwd(),
      'scripts/versioning/dist/entrypoints/prepare-publication.js')).href)})`],
  { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: importOutput } });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(existsSync(importOutput), false);
  const output = join(directory, 'outputs.txt');
  const artifacts = join(directory, 'artifacts');
  let message = '';
  const result = await preparePublicationMain({ GITHUB_WORKSPACE: directory,
    GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'master', GITHUB_SHA: sha,
    GITHUB_REPOSITORY: 'acme/app', GITHUB_RUN_ID: '77', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_JOB: 'validate-publication', CENTRAL_SHA: centralSha, ADAPTER: 'go-gitsemver',
    TARGET_BRANCH: 'master', VERSIONING_OUTPUT_DIR: artifacts, GITHUB_OUTPUT: output,
    VERSIONING_APP_PRIVATE_KEY: 'secret-sentinel' },
  { read, git, implementations, error: value => { message = value; } });
  assert.equal(result, 0, message);
  assert.equal(JSON.parse(readFileSync(join(artifacts, 'publication-evidence.json'))).producer.centralSha,
    centralSha);
  assert.equal(JSON.parse(readFileSync(join(artifacts, 'release-plan.json'))).entries[0].tag, 'v0.0.1');
  assert.equal(JSON.parse(readFileSync(join(artifacts, 'git-inputs.json'))).sha, sha);
  assert.equal(JSON.parse(readFileSync(join(artifacts, 'release-policy.json'))).outcome,
    'adapter-authoritative');
  assert.equal(JSON.parse(readFileSync(join(artifacts, 'version-report.json'))).native.explanation,
    'fix: native result');
  assert.match(readFileSync(output, 'utf8'), /phase=functional/);
  const emitted = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n')
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assert.equal(emitted.plan_digest,
    JSON.parse(readFileSync(join(artifacts, 'release-plan.json'))).planDigest);
  assert.equal(emitted.producer_run_id,'77');
  assert.equal(emitted.producer_run_attempt,'1');
  assert.equal(emitted.needs_version_pr,'false');
  const { publicationPayloadDigest } = await import('../../scripts/versioning/dist/services/publication-payload.js');
  const payloadFile = name => JSON.parse(readFileSync(join(artifacts, name)));
  assert.equal(emitted.payload_digest, publicationPayloadDigest({
    report: payloadFile('version-report.json'), plan: payloadFile('release-plan.json'),
    snapshot: payloadFile('pr-policy.json'), gitInputs: payloadFile('git-inputs.json'),
    bundle: null, publicationEvidence: payloadFile('publication-evidence.json'),
  }));
  for (const name of ['version-report.json', 'release-plan.json', 'pr-policy.json',
    'release-policy.json',
    'git-inputs.json', 'publication-evidence.json']) {
    assert.equal(readFileSync(join(artifacts, name), 'utf8').includes('secret-sentinel'), false);
  }
  const failed = await preparePublicationMain({ GITHUB_WORKSPACE: directory,
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF_NAME: 'master', GITHUB_SHA: sha,
    GITHUB_REPOSITORY: 'acme/app', GITHUB_RUN_ID: '77', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_JOB: 'validate-publication', CENTRAL_SHA: centralSha, ADAPTER: 'go-gitsemver',
    TARGET_BRANCH: 'master', VERSIONING_OUTPUT_DIR: join(directory, 'rejected'),
    GITHUB_OUTPUT: join(directory, 'rejected-output') },
  { read, git, implementations, error: value => { message = value; } });
  assert.equal(failed, 1);
  assert.match(message, /push/i);
  assert.equal(existsSync(join(directory, 'rejected-output')), false);
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log('Post-merge evidence: functional, technical, no-release, invalid origin, incomplete artifact and CI SHA');
