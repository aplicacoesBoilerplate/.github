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
      key: process.env.OPENROUTER_API_KEY === 'sentinel', pat: process.env.PAT_MCP_TEST,
      other: process.env.OPENAI_API_KEY, args: process.argv.slice(1),
      agents: fs.readFileSync('AGENTS.md', 'utf8'), config };
    console.log(JSON.stringify({type:'text',part:{text:JSON.stringify(answer)}}));`;
  const RESULT = await new COpenCodePilot(process.execPath, ['-e', HARNESS, '--']).run(PROCESS, BUNDLE, 'prompt', 1000, { CALLER_KEY: 'sentinel', PAT_MCP_TEST: 'not-for-agent', OPENAI_API_KEY: 'not-for-agent' });
  const OBSERVED = JSON.parse(RESULT.text);
  assert.equal(OBSERVED.key, true);
  assert.equal(OBSERVED.pat, undefined);
  assert.equal(OBSERVED.other, undefined);
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
