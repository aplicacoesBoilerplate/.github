import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parse } from 'yaml';
import { CGhAwPilot } from '../scripts/agentic/CGhAwPilot.js';

test('ARP-02/03: programa compilado não publica, não eleva permissões e exclui credenciais do agente', () => {
  for (const NAME of ['triage', 'review']) {
    const TEXT = fs.readFileSync(`../.github/workflows/agentic-${NAME}.lock.yml`, 'utf8');
    const WORKFLOW = parse(TEXT);
    assert.deepEqual(Object.keys(WORKFLOW.on), ['workflow_call']);
    assert.equal(WORKFLOW.on.workflow_call.secrets.OPENAI_API_KEY.required, true);
    assert.notEqual(WORKFLOW.on.workflow_call.secrets.COPILOT_GITHUB_TOKEN?.required, true);
    assert.equal(WORKFLOW.jobs.safe_outputs, undefined);
    assert.equal(WORKFLOW.jobs.detection, undefined);
    for (const JOB of Object.values(WORKFLOW.jobs) as { permissions?: Record<string, string> }[]) {
      assert.ok(Object.values(JOB.permissions ?? {}).every(VALUE => VALUE === 'read' || VALUE === 'none'));
    }
    const EXECUTE = WORKFLOW.jobs.agent.steps.find((STEP: { name: string }) => STEP.name === 'Execute OpenCode CLI');
    assert.equal(EXECUTE.env.AWF_REFLECT_ENABLED, 1);
    assert.equal(EXECUTE.env.OPENAI_BASE_URL, 'https://openrouter.ai/api/v1');
    assert.equal(EXECUTE.env.OPENCODE_MODEL, 'openai/${{ inputs.model }}');
    assert.equal(EXECUTE.env.GH_AW_MAX_TURNS, 4);
    assert.match(EXECUTE.run, /awf --config/);
    assert.match(EXECUTE.run, /--openai-api-base-path \/api\/v1/);
    for (const KEY of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'GITHUB_MCP_SERVER_TOKEN']) assert.ok(EXECUTE.run.includes(`--exclude-env ${KEY}`));
    const MANIFEST = JSON.parse(TEXT.split('\n')[1].replace('# gh-aw-manifest: ', ''));
    assert.deepEqual(MANIFEST.mcp_servers, [{ name: 'github', tools: ['get_file_contents'] }]);
    assert.ok(MANIFEST.actions.every((ACTION: { sha: string }) => /^[a-f0-9]{40}$/.test(ACTION.sha)));
  }
});

test('ARP-01/02: callers preservam processo/modelo/secret e geram somente acionamento manual sem escrita', () => {
  const ROOT = path.resolve('..');
  const OUTPUT = CGhAwPilot.render(ROOT, 'examples/agentic/self-pilot/config.json');
  for (const NAME of ['triage', 'review']) {
    const CONTENT = OUTPUT[`.github/workflows/agentic-${NAME}.md`];
    const HEADER = parse(CONTENT.split(/^---\s*$/m)[1]);
    const CALLER = parse(OUTPUT[`.github/workflows/agentic-${NAME}-pilot.yml`]);
    assert.deepEqual(CALLER.on, { workflow_dispatch: {} });
    assert.deepEqual(CALLER.permissions, { contents: 'read', actions: 'read' });
    assert.equal(CALLER.jobs.pilot.uses, `./.github/workflows/agentic-${NAME}.lock.yml`);
    assert.deepEqual(CALLER.jobs.pilot.with, { model: 'liquid/lfm-2.5-2.6b:free' });
    assert.deepEqual(CALLER.jobs.pilot.secrets, { OPENAI_API_KEY: '${{ secrets.API_KEY_OPENROUTER }}' });
    assert.deepEqual(HEADER.on, { workflow_call: { inputs: { model: { type: 'string', required: true } }, secrets: { OPENAI_API_KEY: { required: true } } } });
    assert.deepEqual(HEADER.permissions, { contents: 'read' });
    assert.equal(HEADER.model, 'openai/${{ inputs.model }}');
    assert.equal(HEADER.engine.env.OPENAI_BASE_URL, 'https://openrouter.ai/api/v1');
    assert.equal(HEADER.engine.env.OPENAI_API_KEY, undefined);
    assert.equal(HEADER.engine.env.CODEX_API_KEY, undefined);
    assert.deepEqual(HEADER['safe-outputs'], { 'create-issue': false, noop: false, 'report-missing-data': false, 'report-missing-tool': false, 'report-incomplete': false, 'report-failure-as-issue': false, 'report-failed-jobs': false, 'threat-detection': false });
    assert.deepEqual(HEADER.tools.github, { mode: 'local', 'read-only': true, 'min-integrity': 'merged', 'allowed-repos': '${{ github.repository }}', toolsets: ['repos'], allowed: ['get_file_contents'] });
    assert.equal(HEADER.sandbox?.agent, undefined); // O default seguro não foi substituído por false.
    assert.ok(CONTENT.includes('Diretrizes Globais para Agentes de IA'));
    assert.ok(CONTENT.includes(NAME === 'triage' ? 'metadados do issue' : 'DIRECTORY.split'));
  }
  const MANIFEST = JSON.parse(OUTPUT['.github/agentic-pilot/inputs.json']);
  assert.equal(MANIFEST.normalization, 'LF');
  assert.equal(MANIFEST.processes.triage.model, 'liquid/lfm-2.5-2.6b:free');
  assert.equal(MANIFEST.files['AGENTS.md'].length, 64);
});

test('ARP-01: alteração do modelo do consumidor propaga sem alterar o gerador', () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-generator-'));
  try {
    fs.cpSync('../examples', path.join(ROOT, 'examples'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'ci-scripts/scripts'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'ci-scripts/instructions'), { recursive: true });
    fs.copyFileSync('scripts/CReleaseProjectConfig.ts', path.join(ROOT, 'ci-scripts/scripts/CReleaseProjectConfig.ts'));
    fs.copyFileSync('instructions/AGENTS.md', path.join(ROOT, 'ci-scripts/instructions/AGENTS.md'));
    fs.writeFileSync(path.join(ROOT, 'AGENTS.md'), 'Diretrizes do consumidor');
    const FILE = path.join(ROOT, 'examples/agentic/self-pilot/config.json');
    const CONFIG = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    CONFIG.processes.review.model = 'provider/another-model';
    CONFIG.processes.review.credentialEnv = 'REVIEW_KEY';
    fs.writeFileSync(FILE, JSON.stringify(CONFIG));
    const OUTPUT = CGhAwPilot.render(ROOT, 'examples/agentic/self-pilot/config.json');
    const REVIEW = parse(OUTPUT['.github/workflows/agentic-review-pilot.yml']);
    assert.equal(REVIEW.jobs.pilot.with.model, 'provider/another-model');
    assert.equal(REVIEW.jobs.pilot.secrets.OPENAI_API_KEY, '${{ secrets.REVIEW_KEY }}');
    fs.writeFileSync(path.join(ROOT, 'examples/agentic/self-pilot/issue.md'), '${{ secrets.DO_NOT_EXPAND }}');
    assert.throws(() => CGhAwPilot.render(ROOT, 'examples/agentic/self-pilot/config.json'), /interpolação/i);
  } finally { fs.rmSync(ROOT, { recursive: true, force: true }); }
});
