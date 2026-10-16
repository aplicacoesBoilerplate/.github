import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyProduct, validateVerificationImage } from '../../scripts/triage/verify-product.mjs';

const image = `docker.io/library/golang@sha256:${'a'.repeat(64)}`;
const config = { schema_version: 1, project: { owner: 'owner', number: 12 }, fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
  llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' }, reviewer: 'reviewer', allowed_paths: ['main.go'],
  checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {} };

test('TRI-17: checks receive only the product mount and explicit non-secret environment, without network or host process access', async t => {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'triage-checks-test-')); t.after(() => rm(sourceRoot, { recursive: true, force: true }));
  const calls = []; const execute = async (command, args, options) => { calls.push({ command, args, options }); return { stdout: 'not released', stderr: '' }; };
  const result = await verifyProduct({ sourceRoot, config, image, source_sha: 'b'.repeat(40), config_source_sha: 'c'.repeat(40), patch_sha256: 'd'.repeat(64) }, { execute });
  assert.equal(result.status, 'passed'); assert.equal(result.source_sha, 'b'.repeat(40)); assert.equal(result.config_source_sha, 'c'.repeat(40)); assert.equal(result.patch_sha256, 'd'.repeat(64));
  assert.deepEqual(result.checks, [{ index: 0, exit_code: 0, error_code: '' }]); assert.equal(JSON.stringify(result).includes('not released'), false);
  const run = calls.find(c => c.args[0] === 'run'); assert.equal(run.command, 'docker');
  for (const flag of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128']) assert.ok(run.args.includes(flag));
  assert.ok(run.args.some(a => a.startsWith('type=bind,source=') && a.endsWith(',target=/workspace')));
  assert.equal(run.args.filter(a => a === '--mount').length, 1);
  assert.equal(run.args.some(a => /docker\.sock|pid=host|privileged|env-file|GITHUB|CODEX|OPENAI/.test(a)), false);
  assert.deepEqual(run.args.slice(-4), [image, 'go', 'test', './...']);
  assert.deepEqual(Object.keys(run.options.env).sort(), ['PATH', 'SystemRoot', 'DOCKER_CONFIG'].sort());
  assert.equal(calls.at(-1).args[0], 'rm'); assert.equal(calls.at(-1).args[2], run.args[run.args.indexOf('--name') + 1]);
});

test('TRI-17/18: product failure or timeout is recorded and only the owned container is removed', async t => {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'triage-checks-error-')); t.after(() => rm(sourceRoot, { recursive: true, force: true }));
  for (const error of [Object.assign(new Error('private output'), { code: 1 }), Object.assign(new Error('private timeout'), { killed: true })]) {
    const calls = []; const execute = async (_command, args) => { calls.push(args); if (args[0] === 'run') throw error; return {}; };
    const report = await verifyProduct({ sourceRoot, config, image, source_sha: 'b'.repeat(40), config_source_sha: 'c'.repeat(40), patch_sha256: 'd'.repeat(64) }, { execute });
    assert.equal(report.status, 'failed'); assert.equal(report.checks[0].error_code, error.killed ? 'CHECK_TIMEOUT' : 'CHECK_FAILED');
    assert.equal(JSON.stringify(report).includes('private'), false); assert.deepEqual(calls.at(-1).slice(0, 2), ['rm', '--force']);
  }
  for (const value of ['golang:latest', 'golang@sha256:bad', '--privileged', image + '\n']) assert.throws(() => validateVerificationImage(value), { code: 'INVALID_TRIAGE_CONFIG' });
  assert.equal(validateVerificationImage(image), image);
  await assert.rejects(verifyProduct({ sourceRoot, config, image, source_sha: 'b'.repeat(40), config_source_sha: 'c'.repeat(40), patch_sha256: 'd'.repeat(64) }, {
    execute: async (_command, args) => { if (args[0] === 'rm') throw new Error('daemon unavailable'); return {}; }
  }), { code: 'CHECK_CLEANUP_FAILED', message: 'CHECK_CLEANUP_FAILED' });
});
