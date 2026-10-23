import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateDescriptor, validateReleasePlan, planFromReport, parseReleasePlan } from
  '../../scripts/versioning/dist/adapter-contract.js';
import { resolveAdapter } from '../../scripts/versioning/dist/adapter-registry.js';

const expected = [
  ['go-gitsemver', 'go', 'single', false, 'lightweight'],
  ['jgitver', 'java', 'single', false, 'annotated'],
  ['standard-version', 'node', 'single', true, 'lightweight'],
  ['changesets', 'node', 'batch', true, 'lightweight'],
  ['release-please', 'node', 'single', true, 'lightweight'],
];
for (const [id, runtime, reportKind, needsVersionPr, tagKind] of expected) {
  const collect = () => ({ adapter: id });
  const prepare = () => ({ files: [] });
  const selected = resolveAdapter(id, { [id]: needsVersionPr ? { collect, prepare } : { collect } });
  assert.equal(selected.runtime, runtime);
  assert.equal(selected.reportKind, reportKind);
  assert.equal(selected.needsVersionPr, needsVersionPr);
  assert.equal(selected.tagKind, tagKind);
  assert.deepEqual(selected.collect(), { adapter: id });
  assert.equal(Object.isFrozen(selected), true);
}
assert.throws(() => resolveAdapter('unknown', {}), /não suportado/);
assert.throws(() => resolveAdapter('__proto__', {}), /não suportado/);
assert.throws(() => resolveAdapter('go-gitsemver', {}), /não implementado/);
assert.throws(() => validateDescriptor({ id: 'go-gitsemver', runtime: 'node', reportKind: 'single',
  needsVersionPr: false, tagKind: 'lightweight', collect: () => null }), /capacidade/i);
assert.throws(() => validateDescriptor({ id: 'changesets', runtime: 'node', reportKind: 'batch',
  needsVersionPr: true, tagKind: 'lightweight', collect: () => null }), /prepare/i);

const sha = 'a'.repeat(40);
const single = { schemaVersion: 1, adapter: 'go-gitsemver', sha, branch: 'master',
  baseVersion: '0.0.0', candidateVersion: '0.0.1', bump: 'patch', tag: 'v0.0.1',
  native: { format: 'json', result: { SemVer: '0.0.1' }, explanation: 'native' } };
const go = resolveAdapter('go-gitsemver', { 'go-gitsemver': { collect: () => single } });
const singlePlan = planFromReport(single, go, '.');
assert.equal(singlePlan.status, 'release');
assert.equal(singlePlan.entries.length, 1);
assert.equal(singlePlan.entries[0].package, null);
assert.equal(validateReleasePlan(singlePlan).planDigest, singlePlan.planDigest);
assert.equal(parseReleasePlan(JSON.stringify(singlePlan)).planDigest, singlePlan.planDigest);
assert.throws(() => parseReleasePlan('{bad json'), /JSON/i);

const batch = resolveAdapter('changesets', { changesets: { collect: () => null, prepare: () => null } });
const release = (name, version) => ({ name, oldVersion: '0.0.0', version, bump: 'patch', tag: `${name}@${version}` });
const one = planFromReport({ ...single, adapter: 'changesets', releases: [release('a', '0.0.1')] }, batch, '.');
const many = planFromReport({ ...single, adapter: 'changesets', releases: [release('b', '0.0.1'),
  release('a', '0.0.1')] }, batch, '.');
assert.equal(one.entries.length, 1);
assert.deepEqual(many.entries.map(item => item.package), ['a', 'b'], 'Batch ordering must be canonical');
assert.throws(() => planFromReport({ ...single, adapter: 'changesets', releases: [] }, batch, '.'), /vazio/i);
const none = planFromReport({ schemaVersion: 1, adapter: 'changesets', sha, branch: 'master',
  status: 'no-release', native: { explanation: 'no changesets' } }, batch, '.');
assert.equal(none.status, 'no-release');
assert.deepEqual(none.entries, []);
assert.throws(() => validateReleasePlan({ ...singlePlan, planDigest: '0'.repeat(64) }), /digest/i);
assert.throws(() => validateReleasePlan({ ...singlePlan, command: 'unsafe' }), /campo não permitido/);
assert.throws(() => validateReleasePlan({ ...singlePlan, entries: [{ ...singlePlan.entries[0], command: 'unsafe' }] }), /campo não permitido/);
assert.throws(() => planFromReport({ ...single, bump: 'major' }, go, '.'), /Bump diverge/);
const reconciled = planFromReport({ ...single, baseVersion: '0.0.1', bump: 'none' }, go, '.');
assert.equal(reconciled.status, 'release', 'an existing native tag must still reconcile its Release');
assert.equal(reconciled.entries[0].bump, 'none');
assert.throws(() => planFromReport({ ...single, baseVersion: '0.0.2', bump: 'none' }, go, '.'), /Bump diverge/);
const fileAdapter = resolveAdapter('standard-version', {
  'standard-version': { collect() {}, prepare() {} } });
assert.throws(() => planFromReport({ ...single, adapter: 'standard-version',
  baseVersion: '0.0.1', bump: 'none' }, fileAdapter, '.'), /Bump diverge/);
assert.throws(() => planFromReport(single, go, 'C:/outside'), /projectPath/);
assert.throws(() => planFromReport({ ...single, unexpected: () => null }, go, '.'), /não serializável/);

const scratch = mkdtempSync(join(tmpdir(), 'adapter-import-'));
try {
  const before = readdirSync(scratch);
  for (const path of ['adapter-contract.js', 'adapter-registry.js']) {
    const url = pathToFileURL(resolve(import.meta.dirname, '../../scripts/versioning/dist', path)).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`],
      { cwd: scratch, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.deepEqual(readdirSync(scratch), before, 'Import must not write files');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log('Adapter contract: five profiles, capabilities, single/batch/no-release and safe import passed');
