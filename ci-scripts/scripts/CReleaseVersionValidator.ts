import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BranchName } from 'release-please/build/src/util/branch-name.js';
import { PullRequestBody } from 'release-please/build/src/util/pull-request-body.js';
import { CReleaseTagGuard } from './CReleaseTagGuard.js';
import { CReleaseProjectConfig } from './CReleaseProjectConfig.js';
import { CReleaseVersionPolicy } from './CReleaseVersionPolicy.js';

interface IPullRequest {
  commits: number;
  changed_files?: number;
  base?: { ref: string };
  body: string | null;
  milestone: { title: string } | null;
  user: { login: string };
  head: { ref: string; repo: { full_name: string } | null; sha?: string };
  labels: { name: string }[];
  merged: boolean;
  merge_commit_sha: string | null;
}

// O acesso ao GitHub fica separado da regra de resolução da versão.
export class CReleaseVersionValidator {
  public constructor(private readonly REQUEST: typeof fetch = fetch) {}

  public async validate(pRepository: string, pNumber: number, pToken: string, pApiUrl = 'https://api.github.com', pOptions: { projectPath?: string; configFile?: string; versionPolicy?: string } = {}): Promise<{ version?: string; technical: boolean; overrides?: Record<string, string> }> {
    if (pOptions.versionPolicy && !['milestone', 'native'].includes(pOptions.versionPolicy)) throw new Error('Política de versão não suportada.');
    if (!/^[\w.-]+\/[\w.-]+$/.test(pRepository) || !Number.isInteger(pNumber) || pNumber < 1) {
      throw new Error('Repositório ou número do PR inválido.');
    }
    const GET = async <T>(pEndpoint: string, pOptional = false): Promise<T | undefined> => {
      const RESPONSE = await this.REQUEST(`${pApiUrl.replace(/\/$/, '')}/repos/${pRepository}/${pEndpoint}`, {
        headers: { Authorization: `Bearer ${pToken}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(30000),
      });
      if (RESPONSE.status === 404 && pOptional) return undefined;
      if (!RESPONSE.ok) throw new Error(`Não foi possível validar a versão no GitHub: HTTP ${RESPONSE.status} em ${pEndpoint}.`);
      return await RESPONSE.json() as T;
    };
    const PR = (await GET<IPullRequest>(`pulls/${pNumber}`))!;
    const TECHNICAL = ['github-actions[bot]', 'release-please[bot]'].includes(PR.user.login)
      && /^release-please(?:--|\/)/.test(PR.head.ref)
      && PR.head.repo?.full_name.toLowerCase() === pRepository.toLowerCase()
      && PR.labels.some(LABEL => ['autorelease: pending', 'autorelease: tagged'].includes(LABEL.name));
    // A conclusão/reexecução do PR técnico é responsabilidade idempotente do motor.
    if (TECHNICAL) {
      const RELEASE_DATA = PullRequestBody.parse(PR.body || '')?.releaseData;
      if (!RELEASE_DATA?.length || RELEASE_DATA.some(DATA => !DATA.version)) {
        throw new Error('PR técnico sem dados de release válidos no corpo.');
      }
      let PROJECTS: import('./CReleaseProjectConfig.js').IReleaseProject[] = [{ path: '.', releaseType: '', tagPrefix: 'v' }];
      if (pOptions.configFile) {
        const REF = PR.merge_commit_sha || PR.head.sha;
        if (!REF) throw new Error('Revisão da configuração técnica ausente.');
        const FILE = (await GET<{ content: string }>(`contents/${CReleaseProjectConfig.normalizePath(pOptions.configFile)}?ref=${encodeURIComponent(REF)}`))!;
        PROJECTS = CReleaseProjectConfig.read(JSON.parse(Buffer.from(FILE.content, 'base64').toString('utf8')), pOptions.projectPath || '.');
      }
      if (pOptions.versionPolicy === 'milestone' && (PROJECTS.length !== 1 || PROJECTS[0].path !== '.')) {
        throw new Error('Override da milestone exige um único componente na raiz; versões independentes usam política native');
      }
      if (PR.merged && !PR.merge_commit_sha) throw new Error('SHA do merge técnico ausente.');
      const GUARD = new CReleaseTagGuard(this.REQUEST);
      for (const DATA of RELEASE_DATA) {
        const COMPONENT = DATA.component || BranchName.parse(PR.head.ref)?.component;
        const PROJECT = PROJECTS.find(ITEM => ITEM.component === COMPONENT)
          || (!DATA.component && PROJECTS.length === 1 ? PROJECTS[0] : undefined);
        if (!PROJECT) throw new Error('Componente do PR técnico não pertence à configuração.');
        await GUARD.check(pRepository, `${PROJECT.tagPrefix}${DATA.version}`, pToken,
          PR.merged ? PR.merge_commit_sha! : undefined, pApiUrl);
      }
      return { technical: true };
    }

    if (PR.commits > 250) throw new Error("PR acima de 250 commits: não é possível validar todos os footers com segurança.");
    const MESSAGES = [PR.body || ''];
    for (let PAGE = 1; ; PAGE++) {
      const COMMITS = (await GET<{ commit: { message: string } }[]>(`pulls/${pNumber}/commits?per_page=100&page=${PAGE}`))!;
      MESSAGES.push(...COMMITS.map(COMMIT => COMMIT.commit.message));
      if (COMMITS.length < 100) break;
      // O endpoint de commits de PR tem limite de 250; não aceitar análise incompleta.
      if (PAGE === 3) throw new Error('PR excede a janela de commits validável; divida a entrega antes de versionar.');
    }
    if (PR.merged && PR.merge_commit_sha) {
      const MERGE = (await GET<{ commit: { message: string } }>(`commits/${PR.merge_commit_sha}`))!;
      MESSAGES.push(MERGE.commit.message);
    }
    const PROJECT_PATH = CReleaseProjectConfig.normalizePath(pOptions.projectPath || '.');
    const AVAILABLE = async (pVersion: string, pPrefix = 'v') => {
      const TAG = encodeURIComponent(`${pPrefix}${pVersion}`);
      const EXISTING_TAG = await GET<object>(`git/ref/tags/${TAG}`, true);
      CReleaseVersionPolicy.assertAvailable(pVersion, EXISTING_TAG !== undefined, pPrefix);
      if (await GET<object>(`releases/tags/${TAG}`, true)) {
        throw new Error(`A tag ${pPrefix}${pVersion} já possui uma GitHub Release.`);
      }
    };
    if (!pOptions.configFile) {
      const VERSION = CReleaseVersionPolicy.resolve(pOptions.versionPolicy === 'native' ? undefined : PR.milestone?.title, MESSAGES);
      await AVAILABLE(VERSION);
      return { version: VERSION, technical: false };
    }
    const CONFIG_PATH = CReleaseProjectConfig.normalizePath(pOptions.configFile);
    const REF = PR.merge_commit_sha || PR.head.sha;
    if (!REF) throw new Error('Não foi possível fixar a revisão da configuração do PR.');
    const FILE = (await GET<{ content: string }>(`contents/${CONFIG_PATH}?ref=${encodeURIComponent(REF)}`))!;
    const PROJECTS = CReleaseProjectConfig.read(JSON.parse(Buffer.from(FILE.content, 'base64').toString('utf8')), PROJECT_PATH);
    if (pOptions.versionPolicy === 'milestone' && (PROJECTS.length !== 1 || PROJECTS[0].path !== '.')) {
      throw new Error('Override da milestone exige um único componente na raiz; versões independentes usam política native');
    }
    const OVERRIDES: Record<string, string> = Object.fromEntries(PROJECTS.filter(PROJECT => PROJECT.releaseAs)
      .map(PROJECT => [PROJECT.path, PROJECT.releaseAs!]));
    let DECLARED: string | undefined;
    try { DECLARED = CReleaseVersionPolicy.resolve(pOptions.versionPolicy === 'native' ? undefined : PR.milestone?.title, MESSAGES); }
    catch (ERROR) {
      if (!(ERROR instanceof Error) || !ERROR.message.includes('sem uma Milestone')) throw ERROR;
    }
    if (DECLARED) {
      let TARGETS = PROJECTS;
      if (PROJECT_PATH === '.' && PROJECTS.length > 1) {
        if ((PR.changed_files || 0) > 3000) throw new Error('PR excede o limite de arquivos validável.');
        const AFFECTED = new Set<string>();
        for (let PAGE = 1; ; PAGE++) {
          const FILES = (await GET<{ filename: string; previous_filename?: string }[]>(`pulls/${pNumber}/files?per_page=100&page=${PAGE}`))!;
          for (const CHANGED of FILES) for (const FILENAME of [CHANGED.filename, CHANGED.previous_filename].filter(Boolean) as string[]) {
            const MATCHES = PROJECTS.filter(PROJECT => PROJECT.path === '.' || FILENAME.startsWith(PROJECT.path + '/'))
              .sort((A, B) => B.path.length - A.path.length);
            if (MATCHES[0]) AFFECTED.add(MATCHES[0].path);
          }
          if (FILES.length < 100) break;
          if (PAGE === 30) throw new Error('PR excede o limite de arquivos validável.');
        }
        TARGETS = PROJECTS.filter(PROJECT => AFFECTED.has(PROJECT.path));
      }
      if (TARGETS.length !== 1) throw new Error('Release-As ou milestone global é ambíguo: selecione um pacote ou declare release-as por pacote na configuração.');
      const TARGET = TARGETS[0];
      if (OVERRIDES[TARGET.path] && OVERRIDES[TARGET.path] !== DECLARED) throw new Error('Versões divergentes entre configuração e declaração do PR.');
      OVERRIDES[TARGET.path] = DECLARED;
    }
    for (const PROJECT of PROJECTS) if (OVERRIDES[PROJECT.path]) await AVAILABLE(OVERRIDES[PROJECT.path], PROJECT.tagPrefix);
    return { technical: false, overrides: OVERRIDES };
  }
}

async function main(): Promise<void> {
  const EVENT = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'));
  const RESULT = await new CReleaseVersionValidator().validate(
    process.env.GITHUB_REPOSITORY || '', EVENT.pull_request?.number || EVENT.number,
    process.env.GITHUB_TOKEN || '', process.env.GITHUB_API_URL || 'https://api.github.com',
    { projectPath: process.env.PROJECT_PATH, configFile: process.env.RELEASE_CONFIG_FILE, versionPolicy: process.env.VERSION_POLICY },
  );
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `project_path=${CReleaseProjectConfig.normalizePath(process.env.PROJECT_PATH || '.')}\nversion=${RESULT.version || ''}\ntechnical=${RESULT.technical}\noverrides=${JSON.stringify(RESULT.overrides || {})}\n`, 'utf8');
  console.log(RESULT.technical ? 'PR técnico do Release Please: ciclo de publicação/reexecução.' : `Versão/projetos validados: ${RESULT.version || JSON.stringify(RESULT.overrides)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(ERROR => { console.error(ERROR.message); process.exitCode = 1; });
}
