import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CAgenticConfiguration } from '../scripts/agentic/CAgenticConfiguration.js';

const CONFIG = {
  schemaVersion: 1, timeoutMs: 120000,
  instructionsFile: 'instructions/AGENTS.md',
  sonar: { enabled: false, hostUrl: '', projectKey: '', mainBranch: 'develop', scanner: 'cli', qualityGateRequired: true },
  processes: {
    triage: { engine: 'opencode', provider: 'openrouter', model: 'a/model:free', credentialEnv: 'CALLER_KEY', promptFile: 'triage.md', inputFile: 'issue.md', contextFiles: ['src/config.ts'] },
    review: { engine: 'opencode', provider: 'openrouter', model: 'b/model:free', credentialEnv: 'OTHER_KEY', promptFile: 'review.md', inputFile: 'change.patch', contextFiles: ['src/config.ts'] },
  },
};

test('AGP-01: conserva modelo, prompt e credencial independentes por processo', () => {
  const RESULT = CAgenticConfiguration.parse(CONFIG);
  assert.equal(RESULT.processes.triage.model, 'a/model:free');
  assert.equal(RESULT.processes.review.model, 'b/model:free');
  assert.equal(RESULT.processes.review.promptFile, 'review.md');
  assert.equal(RESULT.processes.review.credentialEnv, 'OTHER_KEY');
  assert.deepEqual(RESULT.sonar, CONFIG.sonar);
});

test('AGP-02: recusa engine não implementada e configuração desconhecida', () => {
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, unknown: true }), /campo.*unknown/i);
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, processes: { ...CONFIG.processes, triage: { ...CONFIG.processes.triage, engine: 'codex' } } }), /engine.*implementada/i);
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, timeoutMs: 120001 }), /timeout/i);
});

test('AGP-02: rejeita traversal, caminho absoluto e metacaracteres nas entradas', () => {
  for (const BAD of ['../secret', '/etc/passwd', 'C:/secret', 'src\\secret', 'a/../../secret']) {
    assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, instructionsFile: BAD }), /caminho/i);
  }
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, processes: { ...CONFIG.processes, review: { ...CONFIG.processes.review, model: '--shell evil' } } }), /modelo/i);
});

test('AGP-08: configuração Sonar não permite gate opcional quando habilitado', () => {
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, sonar: { ...CONFIG.sonar, enabled: true } }), /SonarQube/i);
  assert.throws(() => CAgenticConfiguration.parse({ ...CONFIG, sonar: { ...CONFIG.sonar, qualityGateRequired: false } }), /Quality Gate/i);
});

test('ARP-07: preserva preços por processo e rejeita tarifas inválidas sem inferir gratuidade', () => {
  const withPricing = (PRICE: unknown): unknown => ({ ...CONFIG, processes: { ...CONFIG.processes, triage: { ...CONFIG.processes.triage, pricing: PRICE } } });
  const RESULT = CAgenticConfiguration.parse(withPricing({ input: 0, output: 0 }));
  assert.deepEqual(RESULT.processes.triage.pricing, { input: 0, output: 0 });
  assert.equal(RESULT.processes.review.pricing, undefined);
  for (const PRICE of [{ input: -1, output: 0 }, { input: NaN, output: 0 }, { input: 0, output: Infinity }, { input: '0', output: 0 }, { input: 0 }]) {
    assert.throws(() => CAgenticConfiguration.parse(withPricing(PRICE)), /tarifa|pricing|obrigatório/i);
  }
});
