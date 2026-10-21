import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runPreview, previewMain } from '../../scripts/versioning/dist/entrypoints/preview.js';

const headSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const context = { repository: '/fixture', workspace: '/fixture', projectPath: '.',
  targetBranch: 'master', sha: headSha, tagPrefix: 'v', configuration: {} };
const calls = [];
const git = { headSha: () => headSha, subjectsBetween: (base, head) => {
  assert.equal(base, baseSha); assert.equal(head, headSha);
  return ['fix: native behavior'];
} };
const implementations = Object.fromEntries(['go-gitsemver', 'jgitver', 'standard-version',
  'changesets', 'release-please'].map(id => [id, { collect: ctx => {
    calls.push(id); assert.equal(ctx.sha, headSha);
    if (id === 'changesets') return { schemaVersion: 1, adapter: id, sha: headSha,
      branch: 'master', baseVersion: '0.0.0', candidateVersion: '0.0.1', bump: 'patch',
      tag: '@lab/core@0.0.1', releases: [
        { name: '@lab/cli', oldVersion: '0.0.0', version: '0.0.1', bump: 'patch', tag: '@lab/cli@0.0.1' },
        { name: '@lab/core', oldVersion: '0.0.0', version: '0.0.1', bump: 'patch', tag: '@lab/core@0.0.1' },
      ], native: { explanation: 'native changelog' } };
    return { schemaVersion: 1, adapter: id, sha: headSha, branch: 'master',
      baseVersion: '0.0.0', candidateVersion: '0.0.1', bump: 'patch', tag: 'v0.0.1',
      native: { explanation: `${id} native release notes` } };
  }, ...(['standard-version', 'changesets', 'release-please'].includes(id) ?
    { prepare: () => { throw Error('prepare called in preview'); } } : {}) }]));
function read(headRef, baseRef, milestone = null) {
  return { async get(endpoint) {
    if (endpoint.endsWith('/pulls/7')) return { number: 7,
      head: { sha: headSha, ref: headRef }, base: { ref: baseRef },
      user: { login: 'developer', type: 'User' }, milestone,
      merged_at: null, merge_commit_sha: null };
    throw Error(`GET inesperado ${endpoint}`);
  }, async list(endpoint) {
    if (endpoint.includes('/timeline?') || endpoint.includes('/reviews?')) return [];
    throw Error(`list inesperado ${endpoint}`);
  }, async listField(endpoint) {
    assert.match(endpoint, /commits\/a{40}\/check-runs/);
    return [{ id: 1, name: 'build', head_sha: headSha, status: 'completed', conclusion: 'success' }];
  } };
}
const request = (adapter, headRef, baseRef = 'develop', milestone = null) => ({
  owner: 'acme', repo: 'app', prNumber: 7, context, adapter, implementations,
  read: read(headRef, baseRef, milestone), git, baseSha, requiredChecks: ['build'],
});

for (const adapter of Object.keys(implementations)) {
  const value = await runPreview(request(adapter, 'feature/new'));
  assert.equal(value.outputs.phase, 'release-to-develop', adapter);
  assert.equal(value.outputs.policyOutcome, 'not-applicable', adapter);
  assert.equal(value.plan.adapter, adapter);
  assert.match(value.guide.markdown, /native/i);
  assert.match(value.guide.markdown, /fix: native behavior/);
  if (adapter === 'changesets') {
    assert.equal(value.outputs.version, '');
    assert.equal(JSON.parse(value.outputs.releasesJson).length, 2);
  } else assert.equal(value.outputs.version, '0.0.1');
}
assert.deepEqual(calls, Object.keys(implementations));
const master = await runPreview(request('go-gitsemver', 'develop', 'master', { title: 'v0.0.1' }));
assert.equal(master.outputs.phase, 'develop-to-main');
assert.equal(master.outputs.policyOutcome, 'matched');
assert.equal(master.guide, null);
const hotfix = await runPreview(request('go-gitsemver', 'hotfix/critical', 'master'));
assert.equal(hotfix.outputs.phase, 'hotfix-to-main');
assert.equal(hotfix.outputs.policyOutcome, 'adapter-authoritative');
await assert.rejects(runPreview(request('go-gitsemver', 'develop', 'master',
  { title: 'not-semver' })), /Política|milestone/i);
const none = { collect: () => ({ schemaVersion: 1, adapter: 'go-gitsemver', sha: headSha,
  branch: 'master', status: 'no-release', native: { explanation: 'no native release' } }) };
const noRelease = await runPreview({ ...request('go-gitsemver', 'feature/no-release'),
  implementations: { 'go-gitsemver': none } });
assert.equal(noRelease.outputs.version, '');
assert.equal(noRelease.outputs.policyOutcome, 'not-applicable');
assert.equal(noRelease.plan.status, 'no-release');
await assert.rejects(runPreview({ ...request('go-gitsemver', 'feature/fail'),
  implementations: { 'go-gitsemver': { collect: () => { throw Error('native failure'); } } } }),
  /native failure/);
await assert.rejects(runPreview(request('go-gitsemver', 'versioning/release-please/abc', 'master')),
  /transição|suportada|técnico/i);
let escapedCollector = false;
await assert.rejects(runPreview({ ...request('go-gitsemver', 'feature/escape'),
  context: { ...context, projectPath: '../outside' },
  implementations: { 'go-gitsemver': { collect: () => { escapedCollector = true; return null; } } },
}), /projectPath|projeto|workspace/i);
assert.equal(escapedCollector, false);
const directory = mkdtempSync(join(tmpdir(), 'typed-preview-cli-'));
try {
  const entry = pathToFileURL(fileURLToPath(new URL('../../scripts/versioning/dist/entrypoints/preview.js',
    import.meta.url))).href;
  const importSentinel = join(directory, 'import-output.txt');
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(entry)})`], { encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: importSentinel, GITHUB_EVENT_PATH: 'missing-event.json' } });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(existsSync(importSentinel), false);
  const eventPath = join(directory, 'event.json');
  const outputPath = join(directory, 'outputs.txt');
  const summaryPath = join(directory, 'summary.md');
  const artifactPath = join(directory, 'artifacts');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 7,
    head: { sha: headSha }, base: { sha: baseSha } } }));
  const env = { GITHUB_WORKSPACE: directory, GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: 'acme/app', TARGET_BRANCH: 'master', ADAPTER: 'go-gitsemver',
    REQUIRED_CHECKS: 'build', VERSIONING_OUTPUT_DIR: artifactPath,
    GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath };
  let error = '';
  assert.equal(await previewMain(env, { read: read('feature/new', 'develop'), git,
    implementations, error: value => { error = value; } }), 0);
  assert.equal(error, '');
  assert.match(readFileSync(outputPath, 'utf8'), /phase=release-to-develop/);
  assert.match(readFileSync(outputPath, 'utf8'), /version=0\.0\.1/);
  assert.match(readFileSync(join(artifactPath, 'homologation.md'), 'utf8'), /fix: native behavior/);
  assert.match(readFileSync(join(artifactPath, 'release-plan.json'), 'utf8'), /go-gitsemver/);
  assert.match(readFileSync(summaryPath, 'utf8'), /Homologation guide/);
  const failedOutput = join(directory, 'failed-output.txt');
  assert.equal(await previewMain({ ...env, GITHUB_OUTPUT: failedOutput }, {
    read: read('feature/new', 'develop'), git,
    implementations: { 'go-gitsemver': { collect: () => { throw Error('native failure'); } } },
    error: value => { error = value; },
  }), 1);
  assert.match(error, /native failure/);
  assert.equal(existsSync(failedOutput), false);
  const limitedOutput = join(directory, 'limited-output.txt');
  assert.equal(await previewMain({ ...env, GITHUB_OUTPUT: limitedOutput,
    VERSIONING_ARTIFACT_MAX_BYTES: '1' }, { read: read('feature/new', 'develop'), git,
    implementations, error: value => { error = value; } }), 1);
  assert.match(error, /Artifacts de homologação/);
  assert.equal(existsSync(limitedOutput), false);
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log('Preview entrypoint: five profiles, routes, no-release, error and read-only composition');
