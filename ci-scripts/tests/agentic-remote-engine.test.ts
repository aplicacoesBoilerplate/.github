import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as vm from 'node:vm';
import { parse } from 'yaml';

async function executeHarness(pReflect: boolean): Promise<{ code: number; config?: Record<string, any>; env?: Record<string, string>; errors: string }> {
  const SOURCE = fs.readFileSync('../.github/workflows/shared/agentic-opencode.md', 'utf8');
  const SCRIPT = parse(SOURCE.split(/^---\s*$/m)[1]).engine.behaviors['harness-script'];
  let CAPTURED: { config?: Record<string, any>; env?: Record<string, string> } = {};
  let ERRORS = '';
  const PROCESS = { argv: ['node', 'harness', 'opencode', 'run'], exitCode: 0,
    env: { AWF_REFLECT_ENABLED: pReflect ? '1' : '0', OPENCODE_MODEL: 'openai/liquid/test:free', GH_AW_LLM_PROVIDER: 'openai', GH_AW_PROMPT: 'prompt', OPENAI_API_KEY: 'must-not-reach-agent', CODEX_API_KEY: 'must-not-reach-agent' },
    stdout: { write: () => true }, stderr: { write: (TEXT: string) => { ERRORS += TEXT; return true; } } };
  const STEP = { type: 'step_finish', sessionID: 'session', part: { id: 'part', messageID: 'message', reason: 'stop' } };
  const MODULES: Record<string, unknown> = {
    fs: { readFileSync: () => 'prompt controlado' },
    child_process: { execFile: (...ARGS: unknown[]) => (ARGS.at(-1) as (ERR: null, OUT: string) => void)(null, '{}') },
    './process_runner.cjs': { runProcess: async (OPTIONS: { env: Record<string, string>; onStdoutLine: (LINE: string) => void }) => {
      CAPTURED = { config: JSON.parse(OPTIONS.env.OPENCODE_CONFIG_CONTENT), env: OPTIONS.env };
      OPTIONS.onStdoutLine(JSON.stringify(STEP));
      return { exitCode: 0, stderr: '' };
    } },
    './parse_opencode_log.cjs': { isOpenCodeEvent: () => true, getOpenCodeMCPFailures: () => [], getOpenCodeSessionSteps: () => [STEP] },
    './awf_reflect.cjs': { fetchAWFReflect: async () => ({ ok: true, reflectData: { endpoints: [{ configured: true, provider: 'openai', models_url: 'http://awf.test/v1/models' }] } }), deriveBaseUrlFromModelsURL: () => 'http://awf.test/v1', normalizeReflectProviderName: (VALUE: string) => VALUE, REFLECT_PROVIDER_ALIASES: { openai: new Set(['openai']) } },
  };
  await new vm.Script(SCRIPT).runInNewContext({ process: PROCESS, require: (NAME: string) => { if (!(NAME in MODULES)) throw new Error(`Módulo inesperado: ${NAME}`); return MODULES[NAME]; }, console });
  return { code: PROCESS.exitCode, ...CAPTURED, errors: ERRORS };
}

test('ARP-03: harness usa proxy Chat Completions e nega shell, escrita e acesso externo', async () => {
  const RESULT = await executeHarness(true);
  assert.equal(RESULT.code, 0, RESULT.errors);
  assert.equal(RESULT.config!.providers['awf-proxy'].package, '@opencode/ai/providers/openai-compatible');
  assert.equal(RESULT.config!.providers['awf-proxy'].settings.baseURL, 'http://awf.test/v1');
  assert.equal(RESULT.config!.providers['awf-proxy'].settings.apiKey, 'awf-proxy');
  assert.equal(RESULT.env!.OPENAI_API_KEY, undefined);
  assert.equal(RESULT.env!.CODEX_API_KEY, undefined);
  for (const RULES of [RESULT.config!.permissions, RESULT.config!.agents.build.permissions]) {
    const permits = (ACTION: string): string => RULES.filter((RULE: { action: string }) => RULE.action === '*' || RULE.action === ACTION).at(-1).effect;
    assert.equal(permits('shell'), 'deny');
    assert.equal(permits('edit'), 'deny');
    assert.equal(permits('external_directory'), 'deny');
    assert.equal(permits('read'), 'allow');
    assert.equal(permits('safeoutputs_noop'), 'allow');
    assert.equal(permits('safeoutputs_create_issue'), 'deny');
    assert.equal(permits('github_get_file_contents'), 'deny');
  }
});

test('ARP-03: engine recusa operação sem AWF, sem executar o harness nativo', async () => {
  const RESULT = await executeHarness(false);
  assert.equal(RESULT.code, 1);
  assert.equal(RESULT.config, undefined);
  assert.match(RESULT.errors, /AWF.*obrigatório/i);
});
