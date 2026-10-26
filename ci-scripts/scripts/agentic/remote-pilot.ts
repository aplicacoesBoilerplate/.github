import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CGhAwPilot, fingerprint, PILOT_MANIFEST, type IRemotePilotManifest } from './CGhAwPilot.js';

export interface IRemotePilotEvidence {
  schemaVersion: 1; process: string; repository: string; sha: string;
  runId: string; runAttempt: string; model: string; configHash: string;
  files: Record<string, string>; workspaceHash: string;
  workspaceIntegrity: 'pending' | 'verified'; inferenceStatus: 'not-assessed'; sonarStatus: 'not-run';
}

/** Verifica dados locais; não lê nem serializa valores de autenticação. */
export class CRemotePilot {
  public static run(pRoot: string, pPhase: string, pProcess: string, pConfigFile: string, pEnv: NodeJS.ProcessEnv): IRemotePilotEvidence {
    if (!['pre', 'post'].includes(pPhase) || !['triage', 'review'].includes(pProcess)) throw new Error('Fase/processo inválido.');
    if (pEnv.GITHUB_EVENT_NAME !== 'workflow_dispatch') throw new Error('Origem do piloto deve ser workflow_dispatch.');
    const git = (...ARGS: string[]): string => execFileSync('git', ARGS, { cwd: pRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const SHA = git('rev-parse', 'HEAD').trim();
    if (!pEnv.GITHUB_SHA || SHA !== pEnv.GITHUB_SHA) throw new Error('SHA divergente da execução.');
    if (!pEnv.RUNNER_TEMP || !path.isAbsolute(pEnv.RUNNER_TEMP) || !pEnv.GITHUB_RUN_ID || !pEnv.GITHUB_REPOSITORY) throw new Error('Metadados do runner ausentes.');
    const MANIFEST: IRemotePilotManifest = JSON.parse(CGhAwPilot.read(pRoot, PILOT_MANIFEST));
    if (MANIFEST.schemaVersion !== 1 || MANIFEST.configFile !== pConfigFile) throw new Error('Manifesto/configuração divergente.');
    const PROCESS = MANIFEST.processes[pProcess];
    if (pEnv.PILOT_MODEL !== PROCESS?.model) throw new Error('Modelo divergente da configuração do consumidor.');
    CGhAwPilot.generate(pRoot, pConfigFile, true);
    for (const [FILE, HASH] of Object.entries(MANIFEST.files)) {
      if (fingerprint(CGhAwPilot.read(pRoot, FILE)) !== HASH) throw new Error(`Snapshot divergente: ${FILE}`);
    }
    if (git('status', '--porcelain', '--untracked-files=all').trim()) throw new Error('Workspace alterado durante o piloto.');
    const HASH = createHash('sha256');
    for (const FILE of git('ls-files', '-z').split('\0').filter(Boolean).sort()) {
      // Caminhos regulares e dentro do repositório; status não basta para assume-unchanged.
      CGhAwPilot.read(pRoot, FILE);
      HASH.update(FILE).update('\0').update(fs.readFileSync(path.join(pRoot, FILE))).update('\0');
    }
    const RECORD: IRemotePilotEvidence = {
      schemaVersion: 1, process: pProcess, repository: pEnv.GITHUB_REPOSITORY, sha: SHA,
      runId: pEnv.GITHUB_RUN_ID, runAttempt: pEnv.GITHUB_RUN_ATTEMPT ?? '1', model: PROCESS.model,
      configHash: MANIFEST.configHash, files: MANIFEST.files, workspaceHash: HASH.digest('hex'),
      workspaceIntegrity: 'pending', inferenceStatus: 'not-assessed', sonarStatus: 'not-run',
    };
    const DIRECTORY = path.join(pEnv.RUNNER_TEMP, `agentic-pilot-${pProcess}`);
    const FILE = path.join(DIRECTORY, 'evidence.json');
    if (pPhase === 'post') {
      const PREVIOUS = JSON.parse(fs.readFileSync(FILE, 'utf8')) as IRemotePilotEvidence;
      if (JSON.stringify(PREVIOUS) !== JSON.stringify(RECORD)) throw new Error('Integridade/metadados divergentes da preparação.');
      RECORD.workspaceIntegrity = 'verified';
    } else if (fs.existsSync(FILE)) throw new Error('Evidência anterior não pode ser reutilizada.');
    fs.mkdirSync(DIRECTORY, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(RECORD, null, 2) + '\n', { mode: 0o600 });
    return RECORD;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const RECORD = CRemotePilot.run(ROOT, process.argv[2], process.argv[3], process.argv[4], process.env);
    console.log(`Integridade: ${RECORD.workspaceIntegrity}; inferência: avaliar resultado do job.`);
  } catch (ERROR) { console.error(ERROR instanceof Error ? ERROR.message : 'Falha ao conferir piloto.'); process.exitCode = 1; }
}
