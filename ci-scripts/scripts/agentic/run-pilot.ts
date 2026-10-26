import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CAgenticConfiguration, type IAgenticProcess } from './CAgenticConfiguration.js';
import { COpenCodePilot, type IPilotResponse } from './COpenCodePilot.js';

export interface IPilotAdapter {
  run(pProcess: IAgenticProcess, pFiles: Record<string, string>, pPrompt: string, pTimeoutMs: number, pEnvironment?: NodeJS.ProcessEnv): Promise<IPilotResponse>;
}
export interface IPilotEvidence {
  repository: string; revision: string; process: string; engine: string; engineVersion: string;
  provider: string; model: string; configHash: string; inputs: Record<string, string>;
  response: string; durationMs: number; sonarqube: 'not-run'; ghAw: 'not-run';
}

const HASH = (pText: string): string => createHash('sha256').update(pText).digest('hex');
const GIT = (pRoot: string, pArgs: string[]): string => execFileSync('git', ['-C', pRoot, ...pArgs], { encoding: 'utf8', maxBuffer: 262144, stdio: ['ignore', 'pipe', 'ignore'] });

/** Lê o conteúdo da revisão escolhida; alterações não commitadas não entram no contexto. */
export function readSnapshot(pRoot: string, pRevision: string, pFile: string): string {
  CAgenticConfiguration.path(pFile);
  if (!/^[a-f0-9]{40}$/.test(pRevision)) throw new Error('Revisão Git inválida.');
  const ENTRY = GIT(pRoot, ['ls-tree', '-z', pRevision, '--', pFile]);
  if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(ENTRY)) throw new Error(`Arquivo não versionado regular: ${pFile}`);
  const CONTENT = GIT(pRoot, ['show', `${pRevision}:${pFile}`]);
  if (Buffer.byteLength(CONTENT) > 65536) throw new Error(`Arquivo excede 64 KiB: ${pFile}`);
  return CONTENT;
}

export async function runPilot(pRoot: string, pConfigFile: string, pAdapter: IPilotAdapter, pEnvironment: NodeJS.ProcessEnv = process.env): Promise<IPilotEvidence[]> {
  const REVISION = GIT(pRoot, ['rev-parse', 'HEAD']).trim();
  const CONFIG_TEXT = readSnapshot(pRoot, REVISION, pConfigFile);
  const CONFIG = CAgenticConfiguration.parse(JSON.parse(CONFIG_TEXT));
  const GLOBAL = readSnapshot(pRoot, REVISION, CONFIG.instructionsFile);
  const CONSUMER = readSnapshot(pRoot, REVISION, 'AGENTS.md');
  const INSTRUCTIONS = `# Diretrizes globais integrais\n\n${GLOBAL}\n\n# Diretrizes do consumidor\n\n${CONSUMER}`;
  if (Buffer.byteLength(INSTRUCTIONS) > 65536) throw new Error('Diretrizes combinadas excedem 64 KiB.');
  let REPOSITORY = 'local';
  try { REPOSITORY = GIT(pRoot, ['remote', 'get-url', 'origin']).trim().match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)?.[1] || 'local'; } catch { /* Repositório local de teste sem remote. */ }
  for (const PROCESS of Object.values(CONFIG.processes)) if (!pEnvironment[PROCESS.credentialEnv]?.trim()) throw new Error(`Credencial ausente: ${PROCESS.credentialEnv}`);
  const RESULTS: IPilotEvidence[] = [];
  for (const [NAME, PROCESS] of Object.entries(CONFIG.processes)) {
    const FILES: Record<string, string> = { 'AGENTS.md': INSTRUCTIONS, 'input.md': readSnapshot(pRoot, REVISION, PROCESS.inputFile) };
    for (const FILE of PROCESS.contextFiles) {
      if (['AGENTS.md', 'input.md', 'opencode.json'].includes(FILE)) throw new Error('Contexto não pode substituir arquivos internos do piloto.');
      FILES[FILE] = readSnapshot(pRoot, REVISION, FILE);
    }
    const PROMPT = readSnapshot(pRoot, REVISION, PROCESS.promptFile);
    const RESPONSE = await pAdapter.run(PROCESS, FILES, PROMPT, CONFIG.timeoutMs, pEnvironment);
    if (!RESPONSE.text.trim() || RESPONSE.model !== `${PROCESS.provider}/${PROCESS.model}`) throw new Error('Resposta ou modelo divergente do contrato.');
    for (const ITEM of Object.values(CONFIG.processes)) if (RESPONSE.text.includes(pEnvironment[ITEM.credentialEnv]!)) throw new Error('Resposta contém credencial.');
    const EVIDENCE: IPilotEvidence = {
      repository: REPOSITORY, revision: REVISION, process: NAME, engine: PROCESS.engine, engineVersion: '2.0.26',
      provider: PROCESS.provider, model: RESPONSE.model, configHash: HASH(CONFIG_TEXT),
      inputs: Object.fromEntries([...Object.entries(FILES), ['prompt', PROMPT]].map(([FILE, TEXT]) => [FILE, HASH(TEXT)])),
      response: RESPONSE.text, durationMs: RESPONSE.durationMs, sonarqube: 'not-run', ghAw: 'not-run',
    };
    const OUTPUT = path.join(pRoot, 'ci-scripts', 'tmp-agentic-results');
    fs.mkdirSync(OUTPUT, { recursive: true });
    const TARGET = path.join(OUTPUT, `${NAME}-${REVISION}-${EVIDENCE.configHash.slice(0, 12)}.json`);
    fs.writeFileSync(`${TARGET}.tmp`, JSON.stringify(EVIDENCE, null, 2));
    fs.renameSync(`${TARGET}.tmp`, TARGET);
    RESULTS.push(EVIDENCE);
  }
  return RESULTS;
}

async function main(): Promise<void> {
  const ROOT = GIT(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const CONFIG = path.relative(ROOT, path.resolve(process.cwd(), process.argv[2] || '../examples/agentic/self-pilot/config.json')).replaceAll('\\', '/');
  const BINARY = fileURLToPath(new URL(`../../node_modules/@opencode/cli/bin/opencode${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
  // Scripts de instalação são desabilitados no npm ci; preparar explicitamente o binário travado.
  if (!fs.existsSync(BINARY)) execFileSync(process.execPath, [fileURLToPath(new URL('../../node_modules/@opencode/cli/postinstall.mjs', import.meta.url))], { stdio: 'ignore' });
  if (!execFileSync(BINARY, ['--version'], { encoding: 'utf8', timeout: 10000 }).includes('v2.0.26')) throw new Error('Versão OpenCode divergente do lockfile.');
  const RESULTS = await runPilot(ROOT, CONFIG, new COpenCodePilot(BINARY));
  console.log(JSON.stringify(RESULTS.map(ITEM => ({ process: ITEM.process, model: ITEM.model, revision: ITEM.revision, durationMs: ITEM.durationMs, status: 'response-received' })), null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(ERROR => { console.error(ERROR instanceof Error ? ERROR.message : 'Falha no piloto.'); process.exitCode = 1; });
