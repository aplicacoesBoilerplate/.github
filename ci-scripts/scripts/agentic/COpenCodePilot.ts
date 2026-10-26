import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CAgenticConfiguration, type IAgenticProcess } from './CAgenticConfiguration.js';

export interface IPilotResponse { text: string; model: string; durationMs: number }

/** Executa análise controlada sem reutilizar o serviço, perfil ou credenciais pessoais. */
export class COpenCodePilot {
  public constructor(private readonly EXECUTABLE: string, private readonly ARGUMENTS: string[] = []) {}

  public async run(pProcess: IAgenticProcess, pFiles: Record<string, string>, pPrompt: string, pTimeoutMs: number, pEnvironment: NodeJS.ProcessEnv = process.env): Promise<IPilotResponse> {
    const KEY = pEnvironment[pProcess.credentialEnv];
    if (!KEY?.trim()) throw new Error(`Credencial ausente: ${pProcess.credentialEnv}`);
    for (const FILE of Object.keys(pFiles)) CAgenticConfiguration.path(FILE);
    if (Buffer.byteLength(pFiles['AGENTS.md'] || '') > 65536) throw new Error('Diretrizes excedem o limite de 64 KiB.');
    if (Buffer.byteLength(pPrompt) > 8192 || Object.entries(pFiles).filter(([FILE]) => FILE !== 'AGENTS.md').reduce((SUM, [, TEXT]) => SUM + Buffer.byteLength(TEXT), Buffer.byteLength(pPrompt)) > 65536) throw new Error('Contexto excede o limite de 64 KiB.');
    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-pilot-'));
    const WORKSPACE = path.join(ROOT, 'workspace');
    const PROFILE = path.join(ROOT, 'profile');
    const START = Date.now();
    try {
      fs.mkdirSync(WORKSPACE);
      for (const [FILE, CONTENT] of Object.entries(pFiles)) {
        const TARGET = path.join(WORKSPACE, FILE);
        fs.mkdirSync(path.dirname(TARGET), { recursive: true });
        fs.writeFileSync(TARGET, CONTENT);
      }
      const PERMISSIONS = [
        { action: '*', resource: '*', effect: 'deny' },
        ...Object.keys(pFiles).map(FILE => ({ action: 'read', resource: FILE, effect: 'allow' })),
      ];
      const CONFIG = {
        model: `${pProcess.provider}/${pProcess.model}`, default_agent: 'pilot', snapshots: false, instructions: ['AGENTS.md'],
        permissions: PERMISSIONS, mcp: { servers: {} },
        agents: { pilot: { description: 'Análise local controlada', mode: 'primary', permissions: PERMISSIONS } },
      };
      fs.writeFileSync(path.join(WORKSPACE, 'opencode.json'), JSON.stringify(CONFIG));
      const GLOBAL = path.join(PROFILE, '.config', 'opencode');
      fs.mkdirSync(GLOBAL, { recursive: true });
      fs.writeFileSync(path.join(GLOBAL, 'opencode.json'), JSON.stringify({ update: 'disable' }));
      const ENV: NodeJS.ProcessEnv = {
        HOME: PROFILE, USERPROFILE: PROFILE, XDG_CONFIG_HOME: path.join(PROFILE, '.config'),
        XDG_DATA_HOME: path.join(PROFILE, '.local', 'share'), XDG_CACHE_HOME: path.join(PROFILE, '.cache'),
        XDG_STATE_HOME: path.join(PROFILE, '.local', 'state'), APPDATA: path.join(PROFILE, 'AppData', 'Roaming'),
        LOCALAPPDATA: path.join(PROFILE, 'AppData', 'Local'), PROGRAMDATA: path.join(ROOT, 'system'),
        TMP: ROOT, TEMP: ROOT, TMPDIR: ROOT, CI: 'true', NO_COLOR: '1',
        OPENCODE_DISABLE_PROJECT_CONFIG: '1', OPENCODE_CONFIG: path.join(WORKSPACE, 'opencode.json'),
        OPENCODE_CONFIG_DIR: GLOBAL, OPENCODE_TEST_HOME: PROFILE,
      };
      for (const NAME of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT']) if (process.env[NAME]) ENV[NAME] = process.env[NAME];
      const CREDENTIAL = { openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }[pProcess.provider];
      ENV[CREDENTIAL] = KEY;
      const ATTACHMENTS = Object.keys(pFiles).filter(FILE => FILE !== 'AGENTS.md').flatMap(FILE => ['--file', FILE]);
      const OUTPUT = await this.execute([...this.ARGUMENTS, 'run', '--standalone', '--format', 'json', '--agent', 'pilot', '--model', CONFIG.model, ...ATTACHMENTS, pPrompt], WORKSPACE, ENV, pTimeoutMs);
      let EVENTS: { type?: string; part?: { text?: string }; error?: unknown }[];
      try { EVENTS = OUTPUT.split(/\r?\n/).filter(LINE => LINE.trim()).map(LINE => JSON.parse(LINE)); }
      catch { throw new Error('OpenCode retornou resposta JSONL inválida.'); }
      const ERROR = EVENTS.find(EVENT => EVENT.type === 'error' || EVENT.error);
      if (ERROR) throw new Error(`OpenCode retornou erro: ${JSON.stringify(ERROR.error || ERROR.type).replaceAll(KEY, '[REDACTED]').slice(0, 1200)}`);
      const TEXT = EVENTS.filter(EVENT => EVENT.type === 'text').map(EVENT => EVENT.part?.text || '').join('\n').trim();
      if (!TEXT) throw new Error('OpenCode terminou sem resposta.');
      if (TEXT.includes(KEY)) throw new Error('Resposta contém credencial; persistência recusada.');
      return { text: TEXT, model: CONFIG.model, durationMs: Date.now() - START };
    } finally {
      if (path.dirname(ROOT) !== path.resolve(os.tmpdir()) || !path.basename(ROOT).startsWith('agentic-pilot-')) throw new Error('Diretório temporário inválido para limpeza.');
      fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }

  private execute(pArgs: string[], pCwd: string, pEnv: NodeJS.ProcessEnv, pTimeoutMs: number): Promise<string> {
    return new Promise((RESOLVE, REJECT) => {
      const CHILD = spawn(this.EXECUTABLE, pArgs, { cwd: pCwd, env: pEnv, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      let OUTPUT = '';
      let DIAGNOSTIC = '';
      let FAILURE = '';
      const TERMINATE = (): void => {
        if (!CHILD.pid) return;
        try {
          if (process.platform === 'win32') execFileSync(path.join(pEnv.SystemRoot || pEnv.SYSTEMROOT || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(CHILD.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 3000, env: { SystemRoot: pEnv.SystemRoot || pEnv.SYSTEMROOT, PATH: pEnv.PATH } });
          else process.kill(-CHILD.pid, 'SIGKILL');
        } catch { CHILD.kill(); }
      };
      const TIMER = setTimeout(() => { FAILURE = 'OpenCode timeout.'; TERMINATE(); }, pTimeoutMs);
      CHILD.stdout.on('data', (CHUNK: Buffer) => {
        OUTPUT += CHUNK.toString('utf8');
        if (Buffer.byteLength(OUTPUT) > 1048576) { FAILURE = 'OpenCode excedeu o limite de resposta.'; TERMINATE(); }
      });
      CHILD.stderr.on('data', (CHUNK: Buffer) => { DIAGNOSTIC = (DIAGNOSTIC + CHUNK.toString('utf8')).slice(-8192); });
      CHILD.once('error', () => { clearTimeout(TIMER); REJECT(new Error('OpenCode falhou ao iniciar.')); });
      CHILD.once('close', CODE => {
        clearTimeout(TIMER);
        const DETAIL = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].reduce((TEXT, NAME) => pEnv[NAME] ? TEXT.replaceAll(pEnv[NAME]!, '[REDACTED]') : TEXT, DIAGNOSTIC || OUTPUT).slice(-2000);
        if (FAILURE || CODE !== 0) REJECT(new Error(FAILURE ? `${FAILURE} ${DETAIL}` : `OpenCode falhou com código ${CODE}. ${DETAIL}`));
        else RESOLVE(OUTPUT);
      });
    });
  }
}
