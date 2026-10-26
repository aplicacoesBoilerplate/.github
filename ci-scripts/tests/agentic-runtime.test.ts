import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { COpenCodePilot } from '../scripts/agentic/COpenCodePilot.js';
import type { IAgenticProcess } from '../scripts/agentic/CAgenticConfiguration.js';

const PROCESS: IAgenticProcess = { engine: 'opencode', provider: 'openrouter', model: 'test/model:free', credentialEnv: 'CALLER_KEY', promptFile: 'prompt.md', inputFile: 'issue.md', contextFiles: ['src/config.ts'] };
const BUNDLE = { 'AGENTS.md': 'Regras completas', 'input.md': 'Caso de teste', 'src/config.ts': 'export const VALUE = 1;' };

test('AGP-02: credencial ausente falha antes de criar perfil ou executar', async () => {
  await assert.rejects(() => new COpenCodePilot('inexistente').run(PROCESS, BUNDLE, 'prompt', 1000, {}), /Credencial ausente/);
});

test('AGP-03/04: processo recebe só a chave escolhida, arquivos selecionados e modelo do caller', async () => {
  const HARNESS = `
    const fs = require('node:fs');
    const config = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
    const answer = { cwd: process.cwd(), home: process.env.USERPROFILE,
      projectDisabled: process.env.OPENCODE_DISABLE_PROJECT_CONFIG, configFile: process.env.OPENCODE_CONFIG,
      configDir: process.env.OPENCODE_CONFIG_DIR, testHome: process.env.OPENCODE_TEST_HOME,
      key: process.env.OPENROUTER_API_KEY === 'sentinel', pat: process.env.PAT_MCP_TEST,
      other: process.env.OPENAI_API_KEY, args: process.argv.slice(1),
      agents: fs.readFileSync('AGENTS.md', 'utf8'), config };
    console.log(JSON.stringify({type:'text',part:{text:JSON.stringify(answer)}}));`;
  const RESULT = await new COpenCodePilot(process.execPath, ['-e', HARNESS, '--']).run(PROCESS, BUNDLE, 'prompt', 1000, { CALLER_KEY: 'sentinel', PAT_MCP_TEST: 'not-for-agent', OPENAI_API_KEY: 'not-for-agent' });
  const OBSERVED = JSON.parse(RESULT.text);
  assert.equal(OBSERVED.key, true);
  assert.equal(OBSERVED.pat, undefined);
  assert.equal(OBSERVED.other, undefined);
  assert.equal(OBSERVED.projectDisabled, '1');
  assert.equal(OBSERVED.configFile, path.join(OBSERVED.cwd, 'opencode.json'));
  assert.equal(OBSERVED.configDir, path.join(OBSERVED.home, '.config', 'opencode'));
  assert.equal(OBSERVED.testHome, OBSERVED.home);
  assert.ok(OBSERVED.args.includes('openrouter/test/model:free'));
  assert.equal(OBSERVED.agents, 'Regras completas');
  assert.deepEqual(OBSERVED.config.agents.pilot.permissions[0], { action: '*', resource: '*', effect: 'deny' });
  assert.deepEqual(OBSERVED.config.mcp, { servers: {} });
  assert.equal(fs.existsSync(OBSERVED.cwd), false);
  assert.equal(fs.existsSync(OBSERVED.home), false);
});

test('AGP-05: erro do processo e timeout limpam o perfil sem resultado', async () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-test-'));
  const MARKER = path.join(ROOT, 'cwd.txt');
  const PREAMBLE = `require('node:fs').writeFileSync(${JSON.stringify(MARKER)}, process.cwd());`;
  try {
    for (const SCRIPT of [`${PREAMBLE}process.exit(7)`, `${PREAMBLE}setInterval(()=>{},1000)`]) {
      await assert.rejects(() => new COpenCodePilot(process.execPath, ['-e', SCRIPT, '--']).run(PROCESS, BUNDLE, 'prompt', 250, { CALLER_KEY: 'sentinel' }), /OpenCode falhou|timeout/i);
      assert.equal(fs.existsSync(fs.readFileSync(MARKER, 'utf8')), false);
    }
  } finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});

test('AGP-05/06: texto parcial com erro, saída vazia e eco da chave não viram sucesso', async () => {
  for (const EVENTS of [
    [{ type: 'text', part: { text: 'parcial' } }, { type: 'error', error: { message: 'falhou' } }],
    [{ type: 'step_start' }],
    [{ type: 'text', part: { text: 'sentinel' } }],
  ]) {
    const SCRIPT = `console.log(${JSON.stringify(EVENTS.map(EVENT => JSON.stringify(EVENT)).join('\n'))})`;
    await assert.rejects(() => new COpenCodePilot(process.execPath, ['-e', SCRIPT, '--']).run(PROCESS, BUNDLE, 'prompt', 1000, { CALLER_KEY: 'sentinel' }), /resposta|credencial|erro/i);
  }
});

test('AGP-05: diagnóstico de falha preserva a causa e remove a credencial', async () => {
  const SCRIPT = `process.stderr.write('falha controlada na provedora sentinel'); process.exit(1)`;
  await assert.rejects(() => new COpenCodePilot(process.execPath, ['-e', SCRIPT, '--']).run(PROCESS, BUNDLE, 'prompt', 1000, { CALLER_KEY: 'sentinel' }), ERROR => {
    assert.ok(ERROR instanceof Error);
    assert.match(ERROR.message, /falha controlada na provedora/);
    assert.equal(ERROR.message.includes('sentinel'), false);
    return true;
  });
});

test('AGP-03: limite agregado distingue diretrizes e contexto de 64 KiB', async () => {
  const ADAPTER = new COpenCodePilot('não-deve-executar');
  await assert.rejects(() => ADAPTER.run(PROCESS, { ...BUNDLE, 'AGENTS.md': 'a'.repeat(65537) }, 'prompt', 1000, { CALLER_KEY: 'sentinel' }), /Diretrizes.*limite/);
  await assert.rejects(() => ADAPTER.run(PROCESS, { ...BUNDLE, 'input.md': 'a'.repeat(40000), 'src/config.ts': 'b'.repeat(40000) }, 'prompt', 1000, { CALLER_KEY: 'sentinel' }), /Contexto.*limite/);
});

test('AGP-05: diagnóstico em stdout também preserva a causa sem expor a chave', async () => {
  const SCRIPT = `console.log('erro de conexão controlado sentinel');process.exit(1)`;
  await assert.rejects(() => new COpenCodePilot(process.execPath, ['-e', SCRIPT, '--']).run(PROCESS, BUNDLE, 'prompt', 1000, { CALLER_KEY: 'sentinel' }), ERROR => {
    assert.ok(ERROR instanceof Error);
    assert.match(ERROR.message, /erro de conexão controlado/);
    assert.equal(ERROR.message.includes('sentinel'), false);
    return true;
  });
});

test('AGP-05: timeout encerra também subprocessos do harness', async () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-tree-test-'));
  const PID_FILE = path.join(ROOT, 'child.pid');
  const MARKER = path.join(ROOT, 'orphan.txt');
  const GRANDCHILD = `setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(MARKER)}, 'orphan'),800);setInterval(()=>{},1000)`;
  const SCRIPT = `const c=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(GRANDCHILD)}],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(PID_FILE)},String(c.pid));setInterval(()=>{},1000)`;
  try {
    await assert.rejects(() => new COpenCodePilot(process.execPath, ['-e', SCRIPT, '--']).run(PROCESS, BUNDLE, 'prompt', 500, { CALLER_KEY: 'sentinel' }), /timeout/i);
    await new Promise(RESOLVE => setTimeout(RESOLVE, 650));
    assert.equal(fs.existsSync(MARKER), false);
  } finally {
    if (fs.existsSync(PID_FILE)) { try { process.kill(Number(fs.readFileSync(PID_FILE, 'utf8'))); } catch { /* Já encerrado pelo adapter. */ } }
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});
