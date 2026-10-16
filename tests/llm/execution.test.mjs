import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { restoreAuth, cleanupAuth } from '../../scripts/llm/auth.mjs';
import { executeRequest } from '../../scripts/llm/execute.mjs';

async function fixture(t, scenario, mode = 'single') {
  const root = await mkdtemp(join(tmpdir(), 'llm-execution-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'); await mkdir(source);
  await writeFile(join(source, 'main.go'), 'package main\nfunc main() {}\n');
  await mkdir(join(source, '.codex')); await writeFile(join(source, '.codex', 'config.toml'), 'model_provider="hostile"');
  await writeFile(join(source, '.env'), 'secret-sentinel');
  const auth = await restoreAuth('api-key', { OPENAI_API_KEY: 'test-api-key' });
  t.after(() => cleanupAuth(auth));
  const request = { config: { invocation_mode: mode, execution: { model: 'execution-model', effort: 'medium', template: 'analyze' }, ...(mode === 'decision-then-prompt' ? { decision: { model: 'decision-model', effort: 'low', template: 'decision' } } : {}) }, context: { scenario } };
  const calls = [];
  const options = { cliPath: fileURLToPath(new URL('./fixtures/codex.mjs', import.meta.url)), onInvocation: data => calls.push(data) };
  return { source, auth, request, calls, options };
}
test('LLM-03/14/19: single invokes the chosen model with stdin data and leaves original source untouched', async t => {
  const f = await fixture(t, 'single');
  f.request.context.text = '$(not-a-command); ordinary data';
  const result = await executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: 'trusted guidance' }, f.options);
  assert.deepEqual(result, { status: 'succeeded', decision: 'none', summary: 'fixture result', patch: null });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].stage.model, 'execution-model');
  assert.equal(f.calls[0].args.includes('model_reasoning_effort="medium"'), true);
  assert.equal(await readFile(join(f.source, 'main.go'), 'utf8'), 'package main\nfunc main() {}\n');
  assert.equal(f.calls[0].prompt.context.text, f.request.context.text);
  assert.deepEqual(f.calls[0].prompt.source_files.map(x => x.path), ['main.go']);
  assert.equal(f.calls[0].args.includes('--ignore-user-config'), true);
  assert.equal(f.calls[0].args.includes('--ignore-rules'), true);
  assert.equal(f.calls[0].args[f.calls[0].args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(f.calls[0].args.includes('features.shell_tool=false'), true);
  assert.equal(f.calls[0].args.includes('features.unified_exec=false'), true);
  assert.equal(f.calls[0].env.GITHUB_TOKEN, undefined);
  assert.equal(f.calls[0].prompt.source_files.some(x => x.content.includes('secret-sentinel')), false);
});
test('LLM-04/05: decision controls whether the configured execution stage runs', async t => {
  for (const decision of ['proceed', 'skip', 'needs-human']) {
    const f = await fixture(t, decision, 'decision-then-prompt');
    const result = await executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: 'guidance' }, f.options);
    assert.equal(result.decision, decision);
    assert.equal(result.status, decision === 'proceed' ? 'succeeded' : decision === 'skip' ? 'skipped' : 'needs-human');
    assert.deepEqual(f.calls.map(c => c.stage.model), decision === 'proceed' ? ['decision-model', 'execution-model'] : ['decision-model']);
  }
});
test('LLM-20: provider failure is sanitized and never retried', async t => {
  const f = await fixture(t, 'error');
  await assert.rejects(executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: '' }, f.options), { code: 'PROVIDER_ERROR', message: 'PROVIDER_ERROR' });
  assert.equal(f.calls.length, 1);
});
test('LLM-04: malformed decision cannot start the execution stage', async t => {
  const f = await fixture(t, 'invalid', 'decision-then-prompt');
  await assert.rejects(executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: '' }, f.options), { code: 'INVALID_RESULT' });
  assert.equal(f.calls.length, 1);
});
test('LLM-20: timeout kills the invocation and returns without a retry', async t => {
  const f = await fixture(t, 'hang');
  const start = Date.now();
  await assert.rejects(executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: '' }, { ...f.options, timeoutMs: 300 }), { code: 'TIMEOUT' });
  assert.equal(f.calls.length, 1);
  assert.equal(Date.now() - start < 5000, true);
});
test('LLM-01/03: consumer prompt replaces the central template and reaches the model as literal text', async t => {
  const f = await fixture(t, 'single');
  delete f.request.config.execution.template;
  f.request.config.execution.template_path = '.github/llm/custom.md';
  f.request.prompts = { execution: 'Prompt escolhido pelo caller: $(não executar)' };
  const result = await executeRequest(f.request, { sourceRoot: f.source, auth: f.auth, instructions: '' }, f.options);
  assert.equal(result.status, 'succeeded');
  assert.equal(f.calls[0].prompt.task, f.request.prompts.execution);
  assert.equal(f.calls[0].stage.model, 'execution-model');
});
