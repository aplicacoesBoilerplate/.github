import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORCHESTRATOR_PATH = path.resolve(SCRIPTS_DIR, 'scripts/release-orchestrator.ts');
const CALLED_WORKFLOW_PATH = path.resolve(SCRIPTS_DIR, '../.github/workflows/version-release-please-called.yml');
const TSX_CLI_PATH = path.resolve(SCRIPTS_DIR, 'node_modules/tsx/dist/cli.mjs');

function runOrchestrator(pEnvVars: Record<string, string | undefined>, pWorkDir: string) {
  execFileSync(process.execPath, [TSX_CLI_PATH, ORCHESTRATOR_PATH], {
    cwd: pWorkDir,
    env: { ...process.env, ...pEnvVars },
    stdio: 'pipe',
  });
  const CONFIG_PATH = path.join(pWorkDir, 'release-please-config.json');
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// 1. ÚNICO TESTE DO FLUXO DO ORQUESTRADOR TS
test('Fluxo do Orquestrador TS: deve fixar versão da Milestone na feature e liberar merge do PR do Release Please', () => {
  const TEMP_DIR = fs.mkdtempSync(path.join(SCRIPTS_DIR, 'tmp-flow-'));

  try {
    // Etapa A: Merge de Feature na master (exige Milestone e remove prefixo 'v')
    const FEATURE_CONFIG = runOrchestrator(
      {
        PROJECT_TYPE: 'node',
        MILESTONE_TITLE: 'v1.4.0',
        PR_HEAD_REF: 'feat/nova-autenticacao',
      },
      TEMP_DIR
    );
    assert.equal(FEATURE_CONFIG.packages['.']['release-type'], 'node');
    assert.equal(FEATURE_CONFIG.packages['.']['release-as'], '1.4.0');

    // Etapa B: Merge do PR do robô Release Please (sem Milestone, não deve fixar release-as)
    const releasePrConfig = runOrchestrator(
      {
        PROJECT_TYPE: 'node',
        MILESTONE_TITLE: '',
        PR_HEAD_REF: 'release-please--branches--master',
      },
      TEMP_DIR
    );
    assert.equal(releasePrConfig.packages['.']['release-type'], 'node');
    assert.equal(releasePrConfig.packages['.']['release-as'], undefined);
  } finally {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

// 2. UM TESTE PARA CADA ADAPTADOR DOS CALLERS
const ADAPTERS = [
  { callerInput: 'node', expectedReleaseType: 'node' },
  { callerInput: 'go', expectedReleaseType: 'go' },
  { callerInput: 'maven', expectedReleaseType: 'maven' },
  { callerInput: 'gradle', expectedReleaseType: 'gradle' },
];

for (const { callerInput, expectedReleaseType } of ADAPTERS) {
  test(`Adaptador Caller [${callerInput}]: deve gerar configuração para ${expectedReleaseType}`, () => {
    const TEMP_DIR = fs.mkdtempSync(path.join(SCRIPTS_DIR, `tmp-${callerInput}-`));
    try {
      const CONFIG = runOrchestrator(
        {
          PROJECT_TYPE: callerInput,
          MILESTONE_TITLE: 'v2.1.0',
          PR_HEAD_REF: 'feat/modulo-base',
        },
        TEMP_DIR
      );
      assert.deepEqual(CONFIG.packages['.'], {
        'release-type': expectedReleaseType,
        'release-as': '2.1.0',
      });
    } finally {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });
}

// 3. ÚNICO TESTE DA PIPELINE CALLED
test('Pipeline Called (version-release-please-called.yml): deve manter o fluxo de passos e adaptadores pós-tag íntegros', () => {
  const workflowContent = fs.readFileSync(CALLED_WORKFLOW_PATH, 'utf-8');

  // Garante o gatilho reutilizável e o input project-type
  assert.match(workflowContent, /workflow_call:/);
  assert.match(workflowContent, /project-type:/);

  // Garante a chamada ao Orquestrador TS e à Action do Release Please
  assert.match(workflowContent, /release-orchestrator\.ts/);
  assert.match(workflowContent, /googleapis\/release-please-action@v4/);

  // Garante os gatilhos pós-tag para publicação dos adaptadores
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'go'/);
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'node'/);
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'maven'/);
});
