import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planFromReport, type AdapterContext, type AdapterId, type ReleasePlan } from '../adapter-contract.js';
import { resolveAdapter, type AdapterImplementation } from '../adapter-registry.js';
import { createGitPort, type GitPort } from '../ports/git.js';
import { createReadApi, type GitHubTransport, type ReadApi } from '../ports/github.js';
import { buildHomologationGuide } from '../services/homologation-guide.js';
import { collectPrEvidence, type PrEvidence } from '../services/pr-evidence.js';
import { evaluateReleasePolicy, type PolicyOutcome } from '../services/release-policy.js';

type Phase = 'release-to-develop' | 'develop-to-main' | 'hotfix-to-main';
type Guide = ReturnType<typeof buildHomologationGuide>;
const namePart = /^[A-Za-z0-9_.-]+$/;
const shaPattern = /^[0-9a-f]{40}$/i;
const targetPattern = /^[A-Za-z0-9._/-]+$/;

export interface PreviewRequest {
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly adapter: AdapterId;
  readonly context: AdapterContext;
  readonly implementations: Partial<Record<AdapterId, AdapterImplementation>>;
  readonly read: ReadApi;
  readonly git: Pick<GitPort, 'headSha' | 'subjectsBetween'>;
  readonly baseSha: string;
  readonly requiredChecks: readonly string[];
}
export interface PreviewResult {
  readonly report: unknown;
  readonly plan: ReleasePlan;
  readonly snapshot: PrEvidence;
  readonly guide: Guide | null;
  readonly outputs: {
    readonly phase: Phase;
    readonly version: string;
    readonly bump: string;
    readonly policyOutcome: PolicyOutcome | 'not-applicable';
    readonly summary: string;
    readonly releasesJson: string;
  };
}
function phase(snapshot: PrEvidence, targetBranch: string): Phase {
  if (snapshot.baseBranch === 'develop' && snapshot.headBranch !== 'develop' &&
    !snapshot.headBranch.startsWith('versioning/')) return 'release-to-develop';
  if (snapshot.headBranch === 'develop' && snapshot.baseBranch === targetBranch) return 'develop-to-main';
  if (/^hotfix\/.+/.test(snapshot.headBranch) && snapshot.baseBranch === targetBranch) return 'hotfix-to-main';
  throw new Error(`Transição de PR não suportada: ${snapshot.headBranch} -> ${snapshot.baseBranch}`);
}

/** Read-side composition only. File materialization and GitHub outputs belong to the workflow entrypoint. */
export async function runPreview(request: PreviewRequest): Promise<PreviewResult> {
  if (!namePart.test(request.owner) || !namePart.test(request.repo) ||
    !Number.isSafeInteger(request.prNumber) || request.prNumber < 1 ||
    !shaPattern.test(request.context.sha) || !shaPattern.test(request.baseSha) ||
    !targetPattern.test(request.context.targetBranch) || request.context.targetBranch.includes('..') ||
    !Array.isArray(request.requiredChecks) || !request.requiredChecks.length) {
    throw new Error('Contexto da prévia inválido');
  }
  const projectPath = request.context.projectPath;
  if (typeof projectPath !== 'string' || !projectPath || projectPath.startsWith('/') ||
    projectPath.includes('\\') || projectPath.includes(':') || projectPath.includes('\0') ||
    projectPath.split('/').some(part => !part || part === '..')) {
    throw new Error('projectPath fora do workspace');
  }
  if (request.git.headSha() !== request.context.sha) throw new Error('Checkout difere do head do PR');
  const snapshot = await collectPrEvidence(request.read, { repository: `${request.owner}/${request.repo}`,
    targetBranch: request.context.targetBranch, prNumber: request.prNumber,
    expectedHeadSha: request.context.sha, requiredChecks: request.requiredChecks });
  const route = phase(snapshot, request.context.targetBranch);
  const descriptor = resolveAdapter(request.adapter, request.implementations);
  const report = await descriptor.collect(request.context);
  const plan = planFromReport(report, descriptor, request.context.projectPath);
  if (plan.sha !== request.context.sha || plan.branch !== request.context.targetBranch) {
    throw new Error('Plano calculado não corresponde ao checkout e branch da prévia');
  }
  const homologation = route === 'release-to-develop';
  let guide: Guide | null = null;
  let policyOutcome: PreviewResult['outputs']['policyOutcome'] = 'not-applicable';
  if (homologation) {
    const changes = request.git.subjectsBetween(request.baseSha, request.context.sha);
    guide = buildHomologationGuide(plan, { ...snapshot, changes,
      checks: snapshot.checks, suggestedChecks: [
        { id: 'smoke', description: 'Validate the changed application paths', status: 'pending' },
      ] });
  } else if (plan.status === 'release') {
    const decision = evaluateReleasePolicy({ report: plan.report, snapshot, phase: 'preview' });
    if (decision.outcome === 'blocked') throw new Error(`Política da prévia bloqueou: ${decision.reasons.join('; ')}`);
    policyOutcome = decision.outcome;
  }
  const batch = plan.entries.length > 1;
  const version = plan.status === 'release' && !batch ? plan.entries[0].version : '';
  const bump = plan.status === 'release' && !batch ? plan.entries[0].bump : '';
  const source = plan.report as { releases?: unknown[] };
  const releasesJson = JSON.stringify(request.adapter === 'changesets' && Array.isArray(source.releases) ?
    source.releases : []);
  const summary = homologation ? plan.status === 'no-release' ? 'Sem release; guia de homologação gerado' :
    batch ? `Lote com ${plan.entries.length} pacotes; guia de homologação gerado` :
      `Versão candidata ${version}; guia de homologação gerado` :
    plan.status === 'no-release' ? 'Sem release elegível' :
      batch ? `Política ${policyOutcome} para lote com ${plan.entries.length} pacotes` :
        `Política ${policyOutcome} para versão ${version}`;
  return { report, plan, snapshot, guide, outputs: { phase: route, version, bump,
    policyOutcome, summary, releasesJson } };
}

type PreviewDependencies = {
  readonly read?: ReadApi;
  readonly git?: Pick<GitPort, 'headSha' | 'subjectsBetween'>;
  readonly implementations?: Partial<Record<AdapterId, AdapterImplementation>>;
  readonly transport?: GitHubTransport;
  readonly error?: (message: string) => void;
};
function json(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} obrigatório`);
  return value;
}
function fetchTransport(token: string): GitHubTransport {
  return async request => {
    const response = await fetch(request.url, { method: request.method,
      headers: { Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${token}`,
        ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }) });
    const body = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()),
      body: body ? JSON.parse(body) : null };
  };
}
async function defaultImplementation(adapter: AdapterId, owner: string, repo: string,
  transport: GitHubTransport): Promise<Partial<Record<AdapterId, AdapterImplementation>>> {
  switch (adapter) {
    case 'go-gitsemver': {
      const go = await import('../adapters/go-gitsemver.js');
      return { 'go-gitsemver': { collect: context => go.collectGoVersion(context) } };
    }
    case 'jgitver': {
      const java = await import('../adapters/jgitver.js');
      return { jgitver: { collect: context => java.collectJgitver(context) } };
    }
    case 'standard-version': {
      const standard = await import('../adapters/standard-version.js');
      return { 'standard-version': { collect: context => standard.collectStandardVersion(context),
        prepare: () => { throw new Error('Preparo standard-version não pertence à prévia'); } } };
    }
    case 'changesets': {
      const changesets = await import('../adapters/changesets.js');
      return { changesets: { collect: context => changesets.collectChangesets(context),
        prepare: (context, plan) => changesets.prepareChangesets(context, plan) } };
    }
    case 'release-please': {
      const rp = await import('../adapters/release-please.js');
      return { 'release-please': {
        collect: context => rp.collectReleasePlease(context, { owner, repo, transport }),
        prepare: (context, plan) => rp.prepareReleasePlease(context, plan, { owner, repo, transport }),
      } };
    }
  }
}

/** CLI boundary: all environment, network and filesystem access happens only when called. */
export async function previewMain(env: NodeJS.ProcessEnv = process.env,
  dependencies: PreviewDependencies = {}): Promise<number> {
  try {
    const workspace = realpathSync(required(env.GITHUB_WORKSPACE, 'GITHUB_WORKSPACE'));
    const event = JSON.parse(readFileSync(required(env.GITHUB_EVENT_PATH, 'GITHUB_EVENT_PATH'), 'utf8')) as
      { pull_request?: { number?: number; head?: { sha?: string }; base?: { sha?: string } } };
    const pull = event.pull_request;
    if (!pull?.number || !pull.head?.sha || !pull.base?.sha) throw new Error('Evento pull_request inválido');
    const repositoryName = required(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY').split('/');
    if (repositoryName.length !== 2) throw new Error('Identidade do repositório inválida');
    const [owner, repo] = repositoryName as [string, string];
    const token = dependencies.read && dependencies.implementations ? '' :
      required(env.GH_TOKEN ?? env.GITHUB_TOKEN, 'GH_TOKEN');
    const transport = dependencies.transport ?? fetchTransport(token);
    const read = dependencies.read ?? createReadApi(transport);
    const adapter = required(env.ADAPTER, 'ADAPTER') as AdapterId;
    const implementations = dependencies.implementations ??
      await defaultImplementation(adapter, owner, repo, transport);
    const projectPath = env.PROJECT_PATH ?? '.';
    const context: AdapterContext = {
      repository: join(workspace, projectPath), workspace, projectPath,
      targetBranch: required(env.TARGET_BRANCH, 'TARGET_BRANCH'), sha: pull.head.sha,
      tagPrefix: env.TAG_PREFIX ?? 'v',
      configuration: env.ADAPTER_BIN ? { adapterBin: env.ADAPTER_BIN } : {},
    };
    const checks = (env.REQUIRED_CHECKS ?? 'build').split(',').map(value => value.trim()).filter(Boolean);
    const output = await runPreview({ owner, repo, prNumber: pull.number,
      adapter, context,
      implementations, read, git: dependencies.git ?? createGitPort(workspace),
      baseSha: pull.base.sha, requiredChecks: checks });
    const directory = env.VERSIONING_OUTPUT_DIR ?? join(env.RUNNER_TEMP ?? workspace, 'versioning');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'version-report.json'), json(output.report));
    writeFileSync(join(directory, 'release-plan.json'), json(output.plan));
    writeFileSync(join(directory, 'pr-policy.json'), json(output.snapshot));
    const markdown = output.guide ? `${output.guide.markdown}\n` : null;
    const guideJson = output.guide ? json(output.guide.guide) : null;
    if (markdown && guideJson) {
      writeFileSync(join(directory, 'homologation.md'), markdown);
      writeFileSync(join(directory, 'homologation.json'), guideJson);
    }
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY,
      output.guide ? `${output.guide.markdown}\n` : `${output.outputs.summary}\n`);
    const limitText = env.VERSIONING_ARTIFACT_MAX_BYTES ?? '10737418240';
    if (!/^[1-9][0-9]*$/.test(limitText) || !Number.isSafeInteger(Number(limitText))) {
      throw new Error('VERSIONING_ARTIFACT_MAX_BYTES inválido');
    }
    if (markdown && guideJson && Buffer.byteLength(markdown) + Buffer.byteLength(guideJson) > Number(limitText)) {
      throw new Error(`Artifacts de homologação excedem o limite de ${limitText} bytes`);
    }
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT,
      Object.entries({ phase: output.outputs.phase, version: output.outputs.version,
        bump: output.outputs.bump, policy_outcome: output.outputs.policyOutcome,
        summary: output.outputs.summary, releases_json: output.outputs.releasesJson })
        .map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
    process.stdout.write(`${output.outputs.summary}\n`);
    return 0;
  } catch (error) {
    (dependencies.error ?? console.error)(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await previewMain();
}
