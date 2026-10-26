import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CGhAwPilot, PILOT_CONFIG } from '../scripts/agentic/CGhAwPilot.js';
import { CRemotePilot } from '../scripts/agentic/remote-pilot.js';

function fixture(): { root: string; temp: string; hashes: Record<string, string>; env: NodeJS.ProcessEnv; cleanup: () => void } {
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-guard-'));
  const ROOT = path.join(TEMP, 'repo');
  fs.mkdirSync(ROOT);
  const CONFIG = JSON.parse(fs.readFileSync(`../${PILOT_CONFIG}`, 'utf8'));
  const FILES = new Set<string>([PILOT_CONFIG, 'AGENTS.md', CONFIG.instructionsFile]);
  for (const PROCESS of Object.values(CONFIG.processes) as { promptFile: string; inputFile: string; contextFiles: string[] }[]) {
    [PROCESS.promptFile, PROCESS.inputFile, ...PROCESS.contextFiles].forEach(FILE => FILES.add(FILE));
  }
  for (const FILE of FILES) {
    fs.mkdirSync(path.dirname(path.join(ROOT, FILE)), { recursive: true });
    fs.copyFileSync(path.join('..', FILE), path.join(ROOT, FILE));
  }
  CGhAwPilot.generate(ROOT);
  const HASHES = Object.fromEntries([...FILES].map(FILE => [FILE, createHash('sha256').update(fs.readFileSync(path.join(ROOT, FILE), 'utf8').replace(/\r\n/g, '\n')).digest('hex')]));
  fs.writeFileSync(path.join(ROOT, 'outside-context.txt'), 'Arquivo versionado que não foi anexado ao prompt.');
  const git = (...ARGS: string[]): string => execFileSync('git', ['-c', 'core.hooksPath=', ...ARGS], { cwd: ROOT, encoding: 'utf8' }).trim();
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Pilot test', '-c', 'user.email=pilot@example.invalid', 'commit', '-qm', 'fixture');
  return { root: ROOT, temp: TEMP, hashes: HASHES, env: { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: git('rev-parse', 'HEAD'), GITHUB_REPOSITORY: 'fixture/repo', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', RUNNER_TEMP: TEMP, PILOT_MODEL: CONFIG.processes.triage.model }, cleanup: () => {
    assert.ok(TEMP.startsWith(path.join(os.tmpdir(), 'agentic-guard-')));
    fs.rmSync(TEMP, { recursive: true, force: true });
  } };
}

test('ARP-04: proveniência vincula SHA, configuração e modelo sem transportar credencial', () => {
  const F = fixture();
  try {
    const ENV = { ...F.env, API_KEY_OPENROUTER: 'sentinel-secret-never-record' };
    const START = CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, ENV);
    assert.equal(START.workspaceIntegrity, 'pending');
    const END = CRemotePilot.run(F.root, 'post', 'triage', PILOT_CONFIG, ENV);
    assert.equal(END.workspaceIntegrity, 'verified');
    assert.equal(END.sha, F.env.GITHUB_SHA);
    assert.equal(END.model, F.env.PILOT_MODEL);
    assert.equal(END.inferenceStatus, 'not-assessed');
    assert.equal(END.sonarStatus, 'not-run');
    assert.equal(END.runId, '123');
    assert.match(END.configHash, /^[a-f0-9]{64}$/);
    assert.equal(END.configHash, F.hashes[PILOT_CONFIG]);
    assert.deepEqual(END.files, F.hashes);
    assert.ok(!fs.readFileSync(path.join(F.temp, 'agentic-pilot-triage/evidence.json'), 'utf8').includes(ENV.API_KEY_OPENROUTER));
  } finally { F.cleanup(); }
});

test('ARP-04/05: snapshot, modelo e origem divergentes impedem a inferência', () => {
  const F = fixture();
  try {
    assert.throws(() => CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, { ...F.env, PILOT_MODEL: 'different/model' }), /modelo/i);
    assert.throws(() => CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, { ...F.env, GITHUB_EVENT_NAME: 'pull_request' }), /origem/i);
    assert.throws(() => CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, { ...F.env, GITHUB_SHA: '0'.repeat(40) }), /SHA/);
    fs.appendFileSync(path.join(F.root, 'examples/agentic/self-pilot/issue.md'), '\nadulterado');
    assert.throws(() => CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, F.env), /divergente|alterado/i);
    assert.ok(!fs.existsSync(path.join(F.temp, 'agentic-pilot-triage/evidence.json')));
  } finally { F.cleanup(); }
});

test('ARP-05: alteração versionada oculta do git status também bloqueia integridade aprovada', () => {
  for (const FILE of ['AGENTS.md', 'outside-context.txt']) {
    const F = fixture();
    try {
      CRemotePilot.run(F.root, 'pre', 'triage', PILOT_CONFIG, F.env);
      fs.writeFileSync(path.join(F.root, FILE), 'alterado durante a inferência');
      execFileSync('git', ['update-index', '--assume-unchanged', FILE], { cwd: F.root });
      assert.throws(() => CRemotePilot.run(F.root, 'post', 'triage', PILOT_CONFIG, F.env), /divergente|alterado|integridade/i);
      const RECORD = JSON.parse(fs.readFileSync(path.join(F.temp, 'agentic-pilot-triage/evidence.json'), 'utf8'));
      assert.notEqual(RECORD.workspaceIntegrity, 'verified');
    } finally { F.cleanup(); }
  }
});
