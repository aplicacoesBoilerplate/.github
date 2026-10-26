import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { CAgenticConfiguration } from './CAgenticConfiguration.js';

export const GH_AW_VERSION = '0.93.5';
export const GH_AW_REF = '32ecafbc061c9af57e9361942099e381102ae304';
export const PILOT_CONFIG = 'examples/agentic/self-pilot/config.json';
export const PILOT_MANIFEST = '.github/agentic-pilot/inputs.json';
export const normalized = (pText: string): string => pText.replace(/\r\n/g, '\n');
export const fingerprint = (pText: string): string => createHash('sha256').update(normalized(pText)).digest('hex');

export interface IRemotePilotManifest {
  schemaVersion: 1; normalization: 'LF'; configFile: string; configHash: string;
  ghAwVersion: string; ghAwRef: string; files: Record<string, string>;
  processes: Record<string, { model: string; provider: string; engine: string }>;
}

/** Renderiza callers do consumidor, sem ler valores de autenticação. */
export class CGhAwPilot {
  public static read(pRoot: string, pFile: string): string {
    CAgenticConfiguration.path(pFile);
    const TARGET = path.resolve(pRoot, pFile);
    const RELATIVE = path.relative(fs.realpathSync(pRoot), fs.realpathSync(TARGET));
    if (fs.lstatSync(TARGET).isSymbolicLink() || RELATIVE.startsWith('..') || path.isAbsolute(RELATIVE)) throw new Error(`Arquivo fora do consumidor: ${pFile}`);
    return normalized(fs.readFileSync(TARGET, 'utf8'));
  }

  public static render(pRoot: string, pConfigFile = PILOT_CONFIG): Record<string, string> {
    const CONFIG_TEXT = this.read(pRoot, pConfigFile);
    const CONFIG = CAgenticConfiguration.parse(JSON.parse(CONFIG_TEXT));
    const OUTPUT: Record<string, string> = {};
    const FILES: Record<string, string> = { [pConfigFile]: CONFIG_TEXT };
    const read = (FILE: string): string => {
      const TEXT = this.read(pRoot, FILE);
      if (/\$\{\{|\{\{#/.test(TEXT)) throw new Error(`Interpolação em dados não permitida: ${FILE}`);
      FILES[FILE] = TEXT;
      return TEXT;
    };
    const GLOBAL = read(CONFIG.instructionsFile);
    const CONSUMER = read('AGENTS.md');
    if (Buffer.byteLength(GLOBAL + CONSUMER) > 65536) throw new Error('Diretrizes excedem 64 KiB.');
    const PROCESSES: IRemotePilotManifest['processes'] = {};
    for (const [NAME, PROCESS] of Object.entries(CONFIG.processes)) {
      if (PROCESS.engine !== 'opencode' || PROCESS.provider !== 'openrouter') throw new Error('Rota remota ainda não homologada para esta engine/provedora.');
      const PROMPT = read(PROCESS.promptFile);
      const INPUT = read(PROCESS.inputFile);
      const CONTEXT = PROCESS.contextFiles.map(FILE => `### ${FILE}\n\n\`\`\`typescript\n${read(FILE)}\n\`\`\``).join('\n\n');
      if (Buffer.byteLength(PROMPT + INPUT + CONTEXT) > 65536) throw new Error('Contexto excede 64 KiB.');
      const COMMAND = `node --import tsx scripts/agentic/remote-pilot.ts`;
      const CREDENTIAL = '${{ secrets.' + PROCESS.credentialEnv + ' }}';
      const HEADER = {
        description: `Piloto ${NAME} manual, somente leitura e artefatos`,
        on: { workflow_call: { inputs: { model: { type: 'string', required: true } }, secrets: { OPENAI_API_KEY: { required: true } } } },
        permissions: { contents: 'read' },
        engine: { id: 'opencode', env: { OPENAI_BASE_URL: 'https://openrouter.ai/api/v1' } },
        model: 'openai/${{ inputs.model }}',
        ...(PROCESS.pricing ? { models: { providers: { openai: { models: { [PROCESS.model]: { cost: PROCESS.pricing } } } } } } : {}),
        imports: ['shared/agentic-opencode.md'],
        'inlined-imports': true,
        network: { allowed: ['defaults', 'openrouter.ai'] },
        tools: { github: { mode: 'local', 'read-only': true, 'min-integrity': 'merged', 'allowed-repos': '${{ github.repository }}', toolsets: ['repos'], allowed: ['get_file_contents'] }, 'cli-proxy': false },
        'safe-outputs': { 'create-issue': false, noop: false, 'report-missing-data': false, 'report-missing-tool': false, 'report-incomplete': false, 'report-failure-as-issue': false, 'report-failed-jobs': false, 'threat-detection': false },
        'runs-on': 'ubuntu-latest', 'timeout-minutes': 8, 'max-turns': 4,
        concurrency: { group: '${{ github.repository }}-agentic-pilot', 'cancel-in-progress': false },
        'pre-agent-steps': [
          { name: 'Setup Node.js para verificações', uses: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020', with: { 'node-version': '22' } },
          { name: 'Instalar validadores travados sem lifecycle scripts', run: 'npm ci --prefix ci-scripts --ignore-scripts --no-audit --no-fund' },
          { name: 'Validar snapshot antes da inferência', 'working-directory': 'ci-scripts', env: { PILOT_MODEL: '${{ inputs.model }}' }, run: `${COMMAND} pre ${NAME} ${pConfigFile}` },
        ],
        'post-steps': [
          { name: 'Verificar integridade após o agente', if: 'always()', 'working-directory': 'ci-scripts', env: { PILOT_MODEL: '${{ inputs.model }}' }, run: `${COMMAND} post ${NAME} ${pConfigFile}` },
          { name: 'Guardar proveniência do piloto', if: 'always()', uses: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', with: { name: `agentic-pilot-${NAME}-provenance`, path: '${{ runner.temp }}/agentic-pilot-' + NAME + '/evidence.json', 'retention-days': 3, 'if-no-files-found': 'error' } },
        ],
      };
      PROCESSES[NAME] = { model: PROCESS.model, provider: PROCESS.provider, engine: PROCESS.engine };
      const BODY = `# Piloto ${NAME} do próprio consumidor\n\nNão publique comentários, issues, PRs ou alterações. A saída é análise local ao job, para inspeção humana. Não execute comandos nem altere arquivos. SonarQube não foi executado.\n\nOs anexos citados no template estão apresentados integralmente nas seções abaixo. Use esse contexto; não procure credenciais ou serviços externos.\n\n## Diretrizes globais integrais\n\n${GLOBAL}\n\n## Diretrizes do consumidor\n\n${CONSUMER}\n\n## Tarefa\n\n${PROMPT}\n\n## input.md${NAME === 'triage' ? ': metadados do issue' : ': patch proposto'}\n\n\`\`\`text\n${INPUT}\n\`\`\`\n\n## Código-base versionado\n\n${CONTEXT}\n`;
      OUTPUT[`.github/workflows/agentic-${NAME}.md`] = `---\n${stringify(HEADER, { lineWidth: 0 })}---\n\n${BODY}`;
      OUTPUT[`.github/workflows/agentic-${NAME}-pilot.yml`] = stringify({
        name: `Agentic ${NAME} pilot`,
        on: { workflow_dispatch: {} },
        permissions: { contents: 'read', actions: 'read' },
        jobs: { pilot: {
          uses: `./.github/workflows/agentic-${NAME}.lock.yml`,
          with: { model: PROCESS.model },
          secrets: { OPENAI_API_KEY: CREDENTIAL },
        } },
      }, { lineWidth: 0 });
    }
    const MANIFEST: IRemotePilotManifest = { schemaVersion: 1, normalization: 'LF', configFile: pConfigFile, configHash: fingerprint(CONFIG_TEXT), ghAwVersion: GH_AW_VERSION, ghAwRef: GH_AW_REF, files: Object.fromEntries(Object.entries(FILES).map(([FILE, TEXT]) => [FILE, fingerprint(TEXT)])), processes: PROCESSES };
    OUTPUT[PILOT_MANIFEST] = JSON.stringify(MANIFEST, null, 2) + '\n';
    return OUTPUT;
  }

  public static generate(pRoot: string, pConfigFile = PILOT_CONFIG, pCheck = false): void {
    for (const [FILE, CONTENT] of Object.entries(this.render(pRoot, pConfigFile))) {
      const TARGET = path.join(pRoot, FILE);
      if (pCheck) {
        if (!fs.existsSync(TARGET) || normalized(fs.readFileSync(TARGET, 'utf8')) !== CONTENT) throw new Error(`Arquivo gerado divergente: ${FILE}`);
      } else {
        fs.mkdirSync(path.dirname(TARGET), { recursive: true });
        fs.writeFileSync(TARGET, CONTENT);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const CONFIG_INDEX = process.argv.indexOf('--config');
    CGhAwPilot.generate(ROOT, CONFIG_INDEX < 0 ? PILOT_CONFIG : process.argv[CONFIG_INDEX + 1], process.argv.includes('--check'));
    console.log('Callers e fingerprints do piloto conferidos.');
  } catch (ERROR) { console.error(ERROR instanceof Error ? ERROR.message : 'Falha ao gerar callers.'); process.exitCode = 1; }
}
