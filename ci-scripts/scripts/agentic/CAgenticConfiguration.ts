export interface IAgenticProcess {
  engine: 'opencode';
  provider: 'openrouter' | 'openai' | 'anthropic';
  model: string;
  credentialEnv: string;
  promptFile: string;
  inputFile: string;
  contextFiles: string[];
  pricing?: { input: number; output: number };
}

export interface IAgenticConfiguration {
  schemaVersion: 1;
  timeoutMs: number;
  instructionsFile: string;
  sonar: { enabled: boolean; hostUrl: string; projectKey: string; mainBranch: string; scanner: 'cli' | 'maven' | 'gradle'; qualityGateRequired: true };
  processes: { triage: IAgenticProcess; review: IAgenticProcess };
}

/** Valida as escolhas do consumidor antes de acessar credenciais ou iniciar o harness. */
export class CAgenticConfiguration {
  public static parse(pValue: unknown): IAgenticConfiguration {
    const CONFIG = this.record(pValue, ['schemaVersion', 'timeoutMs', 'instructionsFile', 'sonar', 'processes']);
    if (CONFIG.schemaVersion !== 1) throw new Error('schemaVersion não suportada.');
    if (!Number.isInteger(CONFIG.timeoutMs) || Number(CONFIG.timeoutMs) < 1000 || Number(CONFIG.timeoutMs) > 120000) throw new Error('timeoutMs deve estar entre 1000 e 120000.');
    this.path(CONFIG.instructionsFile);
    const PROCESSES = this.record(CONFIG.processes, ['triage', 'review']);
    for (const PROCESS of Object.values(PROCESSES)) {
      const ITEM = this.record(PROCESS, ['engine', 'provider', 'model', 'credentialEnv', 'promptFile', 'inputFile', 'contextFiles'], ['pricing']);
      if (ITEM.engine !== 'opencode') throw new Error('Engine ainda não implementada neste piloto.');
      if (!['openrouter', 'openai', 'anthropic'].includes(String(ITEM.provider))) throw new Error('Provedor não suportado.');
      if (typeof ITEM.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,180}$/.test(ITEM.model)) throw new Error('Modelo inválido.');
      if (typeof ITEM.credentialEnv !== 'string' || !/^[A-Z][A-Z0-9_]{1,80}$/.test(ITEM.credentialEnv)) throw new Error('Nome da variável de credencial inválido.');
      this.path(ITEM.promptFile);
      this.path(ITEM.inputFile);
      if (!Array.isArray(ITEM.contextFiles) || ITEM.contextFiles.length < 1 || ITEM.contextFiles.length > 10) throw new Error('Selecione de 1 a 10 arquivos de contexto.');
      ITEM.contextFiles.forEach(FILE => this.path(FILE));
      if ('pricing' in ITEM) {
        const PRICING = this.record(ITEM.pricing, ['input', 'output']);
        for (const RATE of Object.values(PRICING)) {
          if (typeof RATE !== 'number' || !Number.isFinite(RATE) || RATE < 0) throw new Error('Tarifa deve ser um número finito não negativo.');
        }
      }
    }
    const SONAR = this.record(CONFIG.sonar, ['enabled', 'hostUrl', 'projectKey', 'mainBranch', 'scanner', 'qualityGateRequired']);
    if (SONAR.qualityGateRequired !== true) throw new Error('Quality Gate deve ser obrigatório.');
    if (typeof SONAR.enabled !== 'boolean' || SONAR.enabled) throw new Error('SonarQube real ainda não implementado; mantenha enabled=false.');
    if (typeof SONAR.hostUrl !== 'string' || (SONAR.hostUrl && !/^https?:\/\/[^\s]+$/.test(SONAR.hostUrl))) throw new Error('URL SonarQube inválida.');
    if (typeof SONAR.projectKey !== 'string' || typeof SONAR.mainBranch !== 'string' || !SONAR.mainBranch || !['cli', 'maven', 'gradle'].includes(String(SONAR.scanner))) throw new Error('Configuração SonarQube inválida.');
    return structuredClone(CONFIG) as unknown as IAgenticConfiguration;
  }

  public static path(pValue: unknown): asserts pValue is string {
    if (typeof pValue !== 'string' || !/^[\w.-]+(?:\/[\w.-]+)*$/.test(pValue) || pValue.split('/').some(PART => PART === '..' || PART === '.')) throw new Error('Caminho deve ser relativo e permanecer no repositório.');
  }

  private static record(pValue: unknown, pKeys: string[], pOptional: string[] = []): Record<string, unknown> {
    if (!pValue || typeof pValue !== 'object' || Array.isArray(pValue)) throw new Error('Configuração deve ser objeto.');
    const RECORD = pValue as Record<string, unknown>;
    for (const KEY of Object.keys(RECORD)) if (![...pKeys, ...pOptional].includes(KEY)) throw new Error(`Campo desconhecido: ${KEY}`);
    for (const KEY of pKeys) if (!(KEY in RECORD)) throw new Error(`Campo obrigatório: ${KEY}`);
    return RECORD;
  }
}
