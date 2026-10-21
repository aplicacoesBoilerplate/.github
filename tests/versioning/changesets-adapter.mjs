import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectChangesets, prepareChangesets } from '../../scripts/versioning/dist/adapters/changesets.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';

const workspace = mkdtempSync(join(tmpdir(), 'typed-changesets-'));
const sha = 'a'.repeat(40);
const context = { repository: workspace, workspace, projectPath: '.', targetBranch: 'master',
  sha, tagPrefix: 'v', configuration: {} };
const native = { changesets: [{ id: 'one', releases: [{ name: '@lab/core', type: 'major' }] }],
  releases: [{ name: '@lab/core', oldVersion: '2.0.0', newVersion: '3.0.0', type: 'major' },
    { name: '@lab/cli', oldVersion: '1.0.0', newVersion: '1.0.1', type: 'patch' }] };
const descriptor = validateDescriptor({ id: 'changesets', runtime: 'node', reportKind: 'batch',
  needsVersionPr: true, tagKind: 'lightweight', collect: collectChangesets, prepare: prepareChangesets });

function runner(value, calls) {
  return request => {
    calls.push(request);
    assert.equal(request.cwd, workspace);
    assert.equal(request.args[0], 'status');
    const output = request.args.find(arg => arg.startsWith('--output='));
    assert.ok(output);
    writeFileSync(join(workspace, output.slice('--output='.length)), JSON.stringify(value));
    return { stdout: '', stderr: 'native explanation' };
  };
}

try {
  mkdirSync(join(workspace, '.changeset'));
  writeFileSync(join(workspace, '.changeset', 'config.json'), JSON.stringify({ ignore: [] }));
  const calls = [];
  const report = collectChangesets(context, { run: runner(native, calls) });
  assert.equal(calls.length, 1);
  assert.deepEqual(report.releases.map(item => [item.name, item.version, item.tag]),
    [['@lab/cli', '1.0.1', '@lab/cli@1.0.1'], ['@lab/core', '3.0.0', '@lab/core@3.0.0']]);
  assert.equal(report.native.result.changesets[0].id, 'one');
  assert.equal(report.native.explanation, 'native explanation');
  assert.equal(planFromReport(report, descriptor, '.').entries.length, 2);
  assert.throws(() => prepareChangesets(context, planFromReport(report, descriptor, '.'), {
    run: () => { throw Error('process ran unexpectedly'); },
  }), /package-lock\.json/i);
  assert.equal(readFileSync(join(workspace, '.changeset', 'config.json'), 'utf8'), '{"ignore":[]}');

  const empty = collectChangesets(context, { run: runner({ changesets: [], releases: [] }, calls) });
  assert.equal(empty.status, 'no-release');
  assert.equal(planFromReport(empty, descriptor, '.').status, 'no-release');
  let prepared = false;
  assert.deepEqual(prepareChangesets(context, planFromReport(empty, descriptor, '.'), {
    run: () => { prepared = true; throw Error('native preparer invoked'); },
  }), []);
  assert.equal(prepared, false);

  for (const invalid of [
    { changesets: [], releases: [native.releases[0]] },
    { changesets: native.changesets, releases: [{ ...native.releases[0], newVersion: '3.0.0-next.1' }] },
    { changesets: native.changesets, releases: [{ ...native.releases[0], name: 'other/name' }] },
  ]) assert.throws(() => collectChangesets(context, { run: runner(invalid, calls) }));
  assert.throws(() => collectChangesets({ ...context, tagPrefix: 'pkg-' },
    { run: runner(native, calls) }), /namespace|prefix|tag/i);
  writeFileSync(join(workspace, '.changeset', 'pre.json'), '{}');
  assert.throws(() => collectChangesets(context, { run: runner(native, calls) }), /prerelease/i);
  rmSync(join(workspace, '.changeset', 'pre.json'));
  assert.throws(() => collectChangesets(context, { run: () => { throw Error('native failed'); } }),
    /native failed/);
  console.log('Changesets tipado: lote, no-release, erro, prerelease e namespace');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
