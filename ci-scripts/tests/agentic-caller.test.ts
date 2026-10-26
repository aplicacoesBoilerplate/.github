import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runPilot, readSnapshot, type IPilotAdapter } from '../scripts/agentic/run-pilot.js';

test('AGP-03/06: caller usa arquivos do SHA versionado e vincula cada resultado ao modelo e às entradas', async () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-caller-'));
  const GIT = (...ARGS: string[]): string => execFileSync('git', ['-C', ROOT, ...ARGS], { encoding: 'utf8' }).trim();
  try {
    GIT('init', '--quiet');
    const ITEM = { engine: 'opencode', provider: 'openrouter', model: 'a/model:free', credentialEnv: 'CALLER_KEY', promptFile: 'prompt.md', inputFile: 'input.md', contextFiles: ['source.ts'] };
    const CONFIG = { schemaVersion: 1, timeoutMs: 1000, instructionsFile: 'global.md', sonar: { enabled: false, hostUrl: '', projectKey: '', mainBranch: 'develop', scanner: 'cli', qualityGateRequired: true }, processes: { triage: ITEM, review: { ...ITEM, model: 'b/model:free' } } };
    for (const [FILE, TEXT] of Object.entries({ 'source.ts': 'original do commit', 'AGENTS.md': 'regra do consumidor', 'global.md': 'regra global integral', 'input.md': 'caso controlado', 'prompt.md': 'analise o caso', 'config.json': JSON.stringify(CONFIG) })) fs.writeFileSync(path.join(ROOT, FILE), TEXT);
    GIT('add', '.');
    GIT('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture');
    const SHA = GIT('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(ROOT, 'source.ts'), 'alteração local que não deve entrar');
    const ADAPTER: IPilotAdapter = { async run(PROCESS, FILES) {
      assert.equal(FILES['source.ts'], 'original do commit');
      assert.ok(FILES['AGENTS.md'].includes('regra global integral'));
      assert.ok(FILES['AGENTS.md'].includes('regra do consumidor'));
      return { text: `resposta ${PROCESS.model}`, model: `${PROCESS.provider}/${PROCESS.model}`, durationMs: 1 };
    } };
    const RESULTS = await runPilot(ROOT, 'config.json', ADAPTER, { CALLER_KEY: 'sentinel' });
    assert.equal(RESULTS.length, 2);
    assert.equal(RESULTS[0].repository, 'local');
    assert.equal(RESULTS[0].revision, SHA);
    assert.equal(RESULTS[0].process, 'triage');
    assert.equal(RESULTS[1].model, 'openrouter/b/model:free');
    assert.equal(RESULTS[1].sonarqube, 'not-run');
    assert.equal(RESULTS[1].ghAw, 'not-run');
    assert.equal(RESULTS[1].inputs['source.ts'].length, 64);
    assert.equal(JSON.stringify(RESULTS).includes('sentinel'), false);
    assert.equal(fs.readFileSync(path.join(ROOT, 'source.ts'), 'utf8'), 'alteração local que não deve entrar');
    assert.throws(() => readSnapshot(ROOT, SHA, 'missing.ts'), /versionado/);
    fs.writeFileSync(path.join(ROOT, 'untracked.ts'), 'não versionado');
    assert.throws(() => readSnapshot(ROOT, SHA, 'untracked.ts'), /versionado/);
  } finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});
