import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRequest, loadRequest } from '../../scripts/llm/validate-request.mjs';

const config = () => ({ schema_version: 1, invocation_mode: 'single', execution: { model: 'caller-model', effort: 'medium', template: 'analyze' } });
const inputs = () => ({ invocation_id: 'analyze-main', config_path: '.github/llm/analyze.json', source_ref: 'master', context_json: '{}', auth_mode: 'api-key', session_secret_name: '' });
const invalid = fn => assert.throws(fn, { code: 'INVALID_CONFIG', message: 'INVALID_CONFIG' });

test('LLM-01: returns caller configuration and decoded context without modifying inputs', () => {
  const source = config();
  const request = validateRequest(source, { ...inputs(), context_json: '{"issue":9}' });
  assert.deepEqual(request.config, source);
  assert.deepEqual(request.context, { issue: 9 });
  assert.equal(request.invocation_id, 'analyze-main');
  request.config.execution.model = 'other';
  assert.equal(source.execution.model, 'caller-model');
});
test('LLM-01: two consumers retain independent model and template selections', () => {
  const a = validateRequest(config(), inputs());
  const b = config(); b.execution = { model: 'second-model', effort: 'high', template: 'propose-patch' };
  assert.deepEqual(validateRequest(b, inputs()).config.execution, b.execution);
  assert.equal(a.config.execution.model, 'caller-model');
});
test('LLM-02: decision mode requires a configured decision stage', () => {
  const c = config(); c.invocation_mode = 'decision-then-prompt';
  invalid(() => validateRequest(c, inputs()));
  c.decision = { model: 'decision-model', effort: 'low', template: 'decision' };
  assert.deepEqual(validateRequest(c, inputs()).config.decision, c.decision);
});
test('LLM-02: single mode rejects a decision stage', () => {
  invalid(() => validateRequest({ ...config(), decision: { model: 'm', effort: 'low', template: 'decision' } }, inputs()));
});
for (const [name, change] of [
  ['schema version', c => { c.schema_version = 2; }],
  ['mode', c => { c.invocation_mode = 'free-command'; }],
  ['effort', c => { c.execution.effort = 'unbounded'; }],
  ['template', c => { c.execution.template = 'decision'; }],
  ['unknown root field', c => { c.endpoint = 'https://other'; }],
  ['unknown stage field', c => { c.execution.command = 'run'; }],
  ['missing model', c => { delete c.execution.model; }],
  ['model shell syntax', c => { c.execution.model = 'm; command'; }],
  ['model option', c => { c.execution.model = '--help'; }],
  ['model length', c => { c.execution.model = 'm'.repeat(129); }],
]) test(`LLM-02: rejects ${name}`, () => { const c = config(); change(c); invalid(() => validateRequest(c, inputs())); });
test('LLM-02: accepts maximum model identifier length without choosing a fallback', () => {
  const c = config(); c.execution.model = 'm'.repeat(128);
  assert.equal(validateRequest(c, inputs()).config.execution.model, c.execution.model);
});
for (const value of ['../config.json', '/config.json', 'C:/config.json', 'a\\config.json', 'a/../config.json', 'a//config.json', 'a'.repeat(241)]) {
  test(`LLM-02: rejects unsafe config path ${JSON.stringify(value)}`, () => invalid(() => validateRequest(config(), { ...inputs(), config_path: value })));
}
test('LLM-02: invocation identity is bounded and cannot inject output lines', () => {
  for (const id of ['', 'Upper', 'a\nother', 'a'.repeat(49)]) invalid(() => validateRequest(config(), { ...inputs(), invocation_id: id }));
  assert.equal(validateRequest(config(), { ...inputs(), invocation_id: 'a'.repeat(48) }).invocation_id.length, 48);
});
test('LLM-02: source_ref is a branch name and cannot inject git options', () => {
  for (const value of ['', '--help', 'refs/heads/master', 'main\nother', 'x..y', 'x@{y', 'x.lock']) invalid(() => validateRequest(config(), { ...inputs(), source_ref: value }));
  assert.equal(validateRequest(config(), { ...inputs(), source_ref: 'release/v1.0.0' }).source_ref, 'release/v1.0.0');
});
test('LLM-02: context is a JSON object and byte limit is exact', () => {
  for (const value of ['[]', 'null', '42', '{bad']) invalid(() => validateRequest(config(), { ...inputs(), context_json: value }));
  const exact = JSON.stringify({ v: 'x'.repeat(32760) });
  assert.equal(Buffer.byteLength(exact), 32768);
  assert.equal(validateRequest(config(), { ...inputs(), context_json: exact }).context.v.length, 32760);
  invalid(() => validateRequest(config(), { ...inputs(), context_json: JSON.stringify({ v: 'é'.repeat(16381) }) }));
});
test('LLM-02: session mode requires a valid consumer secret name; API rejects it', () => {
  assert.equal(validateRequest(config(), { ...inputs(), auth_mode: 'chatgpt-session', session_secret_name: 'MY_CODEX_AUTH' }).session_secret_name, 'MY_CODEX_AUTH');
  for (const name of ['', 'lower', 'GITHUB_TOKEN', 'A'.repeat(101)]) invalid(() => validateRequest(config(), { ...inputs(), auth_mode: 'chatgpt-session', session_secret_name: name }));
  invalid(() => validateRequest(config(), { ...inputs(), session_secret_name: 'MY_AUTH' }));
  invalid(() => validateRequest(config(), { ...inputs(), auth_mode: 'automatic' }));
});
test('LLM-02: inputs have a closed schema and diagnostics never echo submitted data', () => {
  invalid(() => validateRequest(config(), { ...inputs(), credentials: 'sentinel' }));
  invalid(() => validateRequest({ ...config(), secret: 'sentinel' }, inputs()));
});
test('LLM-01/02: loads only a regular JSON file inside the trusted checkout', async t => {
  const root = await mkdtemp(join(tmpdir(), 'llm-request-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.github', 'llm'), { recursive: true });
  const file = join(root, '.github', 'llm', 'analyze.json');
  await writeFile(file, JSON.stringify(config()));
  assert.deepEqual((await loadRequest(root, inputs())).config, config());
  await writeFile(file, 'invalid-json');
  await assert.rejects(loadRequest(root, inputs()), { code: 'INVALID_CONFIG' });
  await rm(file);
  await assert.rejects(loadRequest(root, inputs()), { code: 'INVALID_CONFIG' });
  await symlink(root, join(root, 'alias'), 'junction');
  await assert.rejects(loadRequest(root, { ...inputs(), config_path: 'alias/config.json' }), { code: 'INVALID_CONFIG' });
});
test('LLM-01/02: consumer template is loaded as text and rejects ambiguous/outside/missing paths', async t => {
  const root = await mkdtemp(join(tmpdir(), 'llm-prompt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.github', 'llm'), { recursive: true });
  const c = config(); delete c.execution.template; c.execution.template_path = '.github/llm/custom.md';
  const text = 'Meu prompt para a LLM: $(isso é texto)';
  await writeFile(join(root, '.github', 'llm', 'custom.md'), text);
  await writeFile(join(root, '.github', 'llm', 'analyze.json'), JSON.stringify(c));
  assert.equal((await loadRequest(root, inputs())).prompts.execution, text);
  await writeFile(join(root, '.github', 'llm', 'custom.md'), 'x'.repeat(32769));
  await assert.rejects(loadRequest(root, inputs()), { code: 'INVALID_CONFIG' });
  invalid(() => validateRequest({ ...c, execution: { ...c.execution, template: 'analyze' } }, inputs()));
  invalid(() => validateRequest({ ...c, execution: { ...c.execution, template_path: '../prompt.md' } }, inputs()));
  await rm(join(root, '.github', 'llm', 'custom.md'));
  await assert.rejects(loadRequest(root, inputs()), { code: 'INVALID_CONFIG' });
});
