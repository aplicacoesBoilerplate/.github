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
