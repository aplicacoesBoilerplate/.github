import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planFromReport, validateReleasePlan, type AdapterContext, type AdapterId,
  type ReleasePlan } from '../adapter-contract.js';
import { resolveAdapter, type AdapterImplementation } from '../adapter-registry.js';
import { createGitPort, type GitInputsSnapshot, type GitPort } from '../ports/git.js';
import { createReadApi, type GitHubTransport, type ReadApi } from '../ports/github.js';
import { runProcess } from '../ports/process.js';
import { collectPrEvidence, type PrEvidence } from '../services/pr-evidence.js';
import { evaluateReleasePolicy, type ReleasePolicyDecision } from '../services/release-policy.js';
import { publicationPayloadDigest } from '../services/publication-payload.js';
import { verifyLegacyTechnicalMerge } from '../services/legacy-technical-merge.js';
import { verifyTechnicalMerge, type TechnicalMergeEvidence } from '../services/technical-merge.js';
import { allowedVersionWrites, captureVersionFiles, validateVersionFiles,
  type VersionFilesBundle } from '../services/version-files.js';
export { allowedVersionWrites } from '../services/version-files.js';

const shaPattern = /^[0-9a-f]{40}$/i;
const partPattern = /^[A-Za-z0-9_.-]+$/;
const branchPattern = /^[A-Za-z0-9._/-]+$/;
type Bundle = VersionFilesBundle | Record<string, unknown>;

export interface ProducerIdentity {
  readonly repository: string;
  readonly runId: number;
  readonly runAttempt: number;
  readonly job: string;
  readonly centralSha: string;
}
export interface OriginArtifact {
  readonly report: unknown;
  readonly plan: ReleasePlan;
  readonly bundle: Bundle;
  readonly snapshot: PrEvidence;
  readonly producer: ProducerIdentity;
}
export interface PublicationEvidence {
  readonly phase: 'functional' | 'technical';
  readonly producer: ProducerIdentity;
  readonly functionalSha: string;
  readonly publishedSha: string;
  readonly originPrNumber: number;
  readonly technicalPrNumber: number | null;
  readonly report: unknown;
  readonly plan: ReleasePlan;
  readonly bundle: Bundle | null;
  readonly snapshot: PrEvidence;
  readonly policy: ReleasePolicyDecision | null;
  readonly gitInputs: GitInputsSnapshot;
  readonly technicalMerge: TechnicalMergeEvidence | null;
}
export interface PreparePublicationRequest {
  readonly owner: string;
  readonly repo: string;
  readonly adapter: AdapterId;
  readonly context: AdapterContext;
  readonly producer: ProducerIdentity;
  readonly read: ReadApi;
  readonly git: Pick<GitPort, 'headSha' | 'captureInputs' | 'verifyInputs'>;
  readonly implementations: Partial<Record<AdapterId, AdapterImplementation>>;
  readonly requiredChecks: readonly string[];
  readonly origin?: OriginArtifact;
  readonly botLogin?: string;
  readonly prepareBundle?: (plan: ReleasePlan) => Promise<Bundle>;
  readonly validateOrigin?: (origin: OriginArtifact) => { plan: ReleasePlan; bundle: Bundle };
  readonly verifyTechnical?: (request: Parameters<typeof verifyTechnicalMerge>[0]) =>
    Promise<TechnicalMergeEvidence>;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as Record<string, unknown>;
}
function checkedSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error(`${label} SHA inválido`);
  return value.toLowerCase();
}
function checkedProducer(value: ProducerIdentity, repository: string): ProducerIdentity {
  if (!value || value.repository !== repository || !Number.isSafeInteger(value.runId) || value.runId < 1 ||
    !Number.isSafeInteger(value.runAttempt) || value.runAttempt < 1 ||
    typeof value.job !== 'string' || !partPattern.test(value.job)) {
    throw new Error('Identidade do job produtor inválida');
  }
  return { ...value, centralSha: checkedSha(value.centralSha, 'Workflow central') };
}
function isFunctional(ref: unknown): boolean {
  return ref === 'develop' || typeof ref === 'string' && /^hotfix\/.+/.test(ref);
}
function validateOriginArtifact(origin: OriginArtifact, context: AdapterContext,
  adapter: AdapterId): { plan: ReleasePlan; bundle: Bundle } {
  const plan = validateReleasePlan(origin.plan);
  if (plan.adapter !== adapter || plan.branch !== context.targetBranch ||
    plan.status !== 'release' || !origin.bundle || !origin.report || !origin.snapshot ||
    JSON.stringify(plan.report) !== JSON.stringify(origin.report)) {
    throw new Error('Artifact de origem incompleto ou divergente');
  }
  const descriptor = resolveAdapter(adapter, { [adapter]: { collect: () => origin.report,
    ...(['standard-version', 'changesets', 'release-please'].includes(adapter) ?
      { prepare: () => origin.bundle } : {}) } });
  if (planFromReport(origin.report, descriptor, plan.entries[0]!.projectPath).planDigest !== plan.planDigest) {
    throw new Error('Artifact de origem tem plano adulterado');
  }
  if (adapter === 'changesets' || adapter === 'release-please') {
    validateVersionFiles({ repository: context.repository, plan,
      bundle: origin.bundle as VersionFilesBundle,
      trustedAllowedWrites: allowedVersionWrites(plan, context.repository) }, false, false);
  } else if (adapter !== 'standard-version') throw new Error('PR técnico não permitido para o adaptador');
  return { plan, bundle: origin.bundle };
}

/** A read-side result only: it never receives a WriteApi or an App credential. */
export async function preparePublication(request: PreparePublicationRequest): Promise<PublicationEvidence> {
  const repository = `${request.owner}/${request.repo}`;
  if (!partPattern.test(request.owner) || !partPattern.test(request.repo) ||
    !branchPattern.test(request.context.targetBranch) || request.context.targetBranch.includes('..') ||
    !Array.isArray(request.requiredChecks) || !request.requiredChecks.length ||
    request.requiredChecks.some(name => typeof name !== 'string' || !name)) {
    throw new Error('Contexto de publicação inválido');
  }
  const publishedSha = checkedSha(request.context.sha, 'Commit integrado');
  const producer = checkedProducer(request.producer, repository);
  if (request.git.headSha() !== publishedSha) throw new Error('Checkout difere do SHA integrado');
  const metadata = record(await request.read.get(`repos/${repository}`), 'Repositório');
  if (metadata.default_branch !== request.context.targetBranch) {
    throw new Error('Publicação restrita à branch principal');
  }
  const ref = record(await request.read.get(`repos/${repository}/git/ref/heads/${request.context.targetBranch}`),
    'Ref principal');
  if (checkedSha(record(ref.object, 'Objeto da ref').sha, 'Ref principal') !== publishedSha) {
    throw new Error('Branch principal avançou; recolete evidência');
  }
  const associated = await request.read.list(`repos/${repository}/commits/${publishedSha}/pulls?per_page=100`);
  const matches = associated.map(value => record(value, 'PR associado')).filter(value =>
    value.merged_at && value.merge_commit_sha === publishedSha &&
    record(value.base, 'Base do PR').ref === request.context.targetBranch);
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0]!.number)) {
    throw new Error('Associação de PR integrado ambígua ou origem inválida');
  }
  const merged = matches[0]!;
  const headBranch = record(merged.head, 'Head do PR').ref;
  const technical = typeof headBranch === 'string' && headBranch.startsWith('versioning/');
  if (!technical && !isFunctional(headBranch)) throw new Error('Origem do PR integrado inválida');
  const gitInputs = request.git.captureInputs(request.adapter);
  if (technical) {
    const origin = request.origin;
    if (!origin || !origin.report || !origin.plan || !origin.bundle || !origin.snapshot ||
      !origin.producer) throw new Error('Artifact técnico incompleto');
    checkedProducer(origin.producer, repository);
    const { plan, bundle } = (request.validateOrigin ?? (value =>
      validateOriginArtifact(value, request.context, request.adapter)))(origin);
    if (plan.sha !== origin.snapshot.mergeCommitSha || origin.snapshot.number < 1 ||
      origin.snapshot.repository !== repository || origin.snapshot.baseBranch !== plan.branch ||
      !isFunctional(origin.snapshot.headBranch)) throw new Error('Origem funcional do artifact inválida');
    const verified = request.adapter === 'standard-version' ?
      await verifyLegacyTechnicalMerge({ repository: request.context.repository, owner: request.owner,
        repo: request.repo, plan, bundle, origin: origin.snapshot,
        technicalPrNumber: Number(merged.number), publishedSha,
        requiredChecks: request.requiredChecks, read: request.read,
        ...(request.botLogin ? { botLogin: request.botLogin } : {}) }) :
      await (request.verifyTechnical ?? verifyTechnicalMerge)({
      repository: request.context.repository, owner: request.owner, repo: request.repo,
      botLogin: request.botLogin ?? '', plan, bundle: bundle as VersionFilesBundle,
      trustedAllowedWrites: allowedVersionWrites(plan, request.context.repository),
      originPrNumber: origin.snapshot.number,
      technicalPrNumber: Number(merged.number), expectedFunctionalEvidence: origin.snapshot,
      publishedSha, requiredChecks: request.requiredChecks, read: request.read,
      });
    if (verified.functionalSha !== plan.sha || verified.publishedSha !== publishedSha ||
      verified.planDigest !== plan.planDigest) throw new Error('Merge técnico diverge do artifact');
    const policy = evaluateReleasePolicy({ report: plan.report, snapshot: origin.snapshot,
      phase: 'publication' });
    if (policy.outcome === 'blocked') throw new Error(`Policy funcional bloqueou: ${policy.reasons.join('; ')}`);
    request.git.verifyInputs(gitInputs, publishedSha, '', request.adapter);
    return { phase: 'technical', producer, functionalSha: verified.functionalSha, publishedSha,
      originPrNumber: origin.snapshot.number, technicalPrNumber: Number(merged.number),
      report: origin.report, plan, bundle, snapshot: origin.snapshot,
      policy,
      gitInputs, technicalMerge: verified };
  }
  if (request.origin) throw new Error('Artifact técnico inesperado no merge funcional');
  const snapshot = await collectPrEvidence(request.read, { repository,
    targetBranch: request.context.targetBranch, commitSha: publishedSha,
    requiredChecks: request.requiredChecks });
  if (snapshot.number !== merged.number) throw new Error('Origem funcional divergente');
  const descriptor = resolveAdapter(request.adapter, request.implementations);
  const report = await descriptor.collect(request.context);
  const plan = planFromReport(report, descriptor, request.context.projectPath);
  if (plan.sha !== publishedSha || plan.branch !== request.context.targetBranch) {
    throw new Error('Plano nativo diverge do commit integrado');
  }
  const policy = plan.status === 'release' ? evaluateReleasePolicy({ report: plan.report,
    snapshot, phase: 'publication' }) : null;
  if (policy?.outcome === 'blocked') throw new Error(`Policy bloqueou publicação: ${policy.reasons.join('; ')}`);
  const bundle = plan.status === 'release' && descriptor.needsVersionPr ?
    await (request.prepareBundle ?? (async () => { throw new Error('Preparador de bundle ausente'); }))(plan) : null;
  if (plan.status === 'release' && descriptor.needsVersionPr && !bundle) {
    throw new Error('Artifact de bundle incompleto');
  }
  request.git.verifyInputs(gitInputs, publishedSha, plan.status === 'release' ? plan.entries[0].tag : '',
    request.adapter);
  return { phase: 'functional', producer, functionalSha: publishedSha, publishedSha,
    originPrNumber: snapshot.number, technicalPrNumber: null, report, plan, bundle, snapshot,
    policy, gitInputs, technicalMerge: null };
}

type MainDependencies = { readonly read?: ReadApi; readonly git?: PreparePublicationRequest['git'];
  readonly implementations?: PreparePublicationRequest['implementations'];
  readonly prepareBundle?: PreparePublicationRequest['prepareBundle'];
  readonly transport?: GitHubTransport; readonly error?: (message: string) => void };
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} obrigatório`);
  return value;
}
function positive(value: string | undefined, name: string): number {
  if (!value || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} inválido`);
  }
  return Number(value);
}
function transport(token: string): GitHubTransport {
  return async request => {
    const response = await fetch(request.url, { method: request.method,
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}` } });
    const body = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()),
      body: body ? JSON.parse(body) : null };
  };
}
async function nativeImplementations(adapter: AdapterId, owner: string, repo: string,
  api: GitHubTransport): Promise<Partial<Record<AdapterId, AdapterImplementation>>> {
  switch (adapter) {
    case 'go-gitsemver': { const module = await import('../adapters/go-gitsemver.js');
      return { [adapter]: { collect: context => module.collectGoVersion(context) } }; }
    case 'jgitver': { const module = await import('../adapters/jgitver.js');
      return { [adapter]: { collect: context => module.collectJgitver(context) } }; }
    case 'standard-version': { const module = await import('../adapters/standard-version.js');
      return { [adapter]: { collect: context => module.collectStandardVersion(context),
        prepare: () => { throw new Error('Preparação acontece no leitor após o cálculo'); } } }; }
    case 'changesets': { const module = await import('../adapters/changesets.js');
      return { [adapter]: { collect: context => module.collectChangesets(context),
        prepare: (context, plan) => module.prepareChangesets(context, plan) } }; }
    case 'release-please': { const module = await import('../adapters/release-please.js');
      return { [adapter]: { collect: context => module.collectReleasePlease(context, { owner, repo, transport: api }),
        prepare: (context, plan) => module.prepareReleasePlease(context, plan,
          { owner, repo, transport: api }) } }; }
  }
}

async function nativeBundle(context: AdapterContext, plan: ReleasePlan, owner: string,
  repo: string, api: GitHubTransport): Promise<Bundle> {
  if (plan.status !== 'release') throw new Error('Bundle exige plano de release');
  if (plan.adapter === 'release-please') {
    const module = await import('../adapters/release-please.js');
    const prepared = await module.prepareReleasePlease(context, plan, { owner, repo, transport: api });
    return captureVersionFiles({ repository: context.repository, plan,
      operations: prepared.files.map(file => ({ op: 'write', path: file.path, content: file.content })) });
  }
  if (plan.adapter === 'changesets') {
    const module = await import('../adapters/changesets.js');
    const changed = module.prepareChangesets(context, plan);
    return captureVersionFiles({ repository: context.repository, plan,
      trustedAllowedWrites: allowedVersionWrites(plan, context.repository), operations: changed.map(path => {
        try { return { op: 'write' as const, path,
          content: readFileSync(join(context.repository, path)).toString('base64') }; }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { op: 'delete' as const, path };
          throw error;
        }
      }) });
  }
  if (plan.adapter === 'standard-version') {
    // Transitional bridge: T27 removes the legacy schema1 implementation after workflow cutover.
    const legacy = await import(new URL('../../version-bundle.mjs', import.meta.url).href) as
      { captureVersionBundle(request: { repository: string; projectPath: string; report: unknown }): Bundle };
    const binary = context.configuration.adapterBin;
    runProcess({ command: typeof binary === 'string' && binary ? binary : 'standard-version',
      args: ['--skip.commit', '--skip.tag', '--tag-prefix', context.tagPrefix],
      cwd: join(context.workspace, context.projectPath), workspace: context.workspace });
    return legacy.captureVersionBundle({ repository: context.repository,
      projectPath: context.projectPath, report: plan.report });
  }
  throw new Error('Adaptador não gera bundle técnico');
}

function originFromDirectory(directory: string): OriginArtifact {
  const file = (name: string): unknown => {
    try { return JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown; }
    catch { throw new Error(`Artifact de origem incompleto ou expirado: ${name}`); }
  };
  const metadata = record(file('publication-evidence.json'), 'Evidência de origem');
  if (metadata.phase !== 'functional') throw new Error('Artifact de origem não é funcional');
  const plan = file('release-plan.json') as ReleasePlan;
  if (metadata.planDigest !== plan.planDigest || metadata.functionalSha !== plan.sha) {
    throw new Error('Artifact de origem tem identidade divergente');
  }
  return { report: file('version-report.json'), plan,
    bundle: file('version-bundle.json') as Bundle, snapshot: file('pr-policy.json') as PrEvidence,
    producer: metadata.producer as ProducerIdentity };
}

/** CLI boundary. T24–T25 wire the hosted workflow and the technical-origin artifact. */
export async function preparePublicationMain(env: NodeJS.ProcessEnv = process.env,
  dependencies: MainDependencies = {}): Promise<number> {
  try {
    if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_NAME !== env.TARGET_BRANCH) {
      throw new Error('Publicação exige push na branch principal');
    }
    const workspace = realpathSync(required(env.GITHUB_WORKSPACE, 'GITHUB_WORKSPACE'));
    const [owner, repo, extra] = required(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY').split('/');
    if (!owner || !repo || extra) throw new Error('Repositório inválido');
    const adapter = required(env.ADAPTER, 'ADAPTER') as AdapterId;
    const api = dependencies.transport ?? transport(dependencies.read && dependencies.implementations ? '' :
      required(env.GH_TOKEN ?? env.GITHUB_TOKEN, 'GH_TOKEN'));
    const context: AdapterContext = { repository: workspace, workspace,
      projectPath: env.PROJECT_PATH ?? '.', targetBranch: required(env.TARGET_BRANCH, 'TARGET_BRANCH'),
      sha: required(env.GITHUB_SHA, 'GITHUB_SHA'), tagPrefix: env.TAG_PREFIX ?? 'v',
      configuration: env.ADAPTER_BIN ? { adapterBin: env.ADAPTER_BIN } : {} };
    if (!context.projectPath || context.projectPath.startsWith('/') ||
      context.projectPath.includes('\\') || context.projectPath.includes(':') ||
      context.projectPath.split('/').some(part => !part || part === '..')) {
      throw new Error('projectPath fora do workspace');
    }
    const result = await preparePublication({ owner, repo, adapter, context,
      producer: { repository: `${owner}/${repo}`, runId: positive(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
        runAttempt: positive(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'),
        job: required(env.GITHUB_JOB, 'GITHUB_JOB'),
        centralSha: required(env.CENTRAL_SHA, 'CENTRAL_SHA') },
      read: dependencies.read ?? createReadApi(api), git: dependencies.git ?? createGitPort(workspace),
      implementations: dependencies.implementations ?? await nativeImplementations(adapter, owner, repo, api),
      requiredChecks: (env.REQUIRED_CHECKS ?? 'build').split(',').map(item => item.trim()).filter(Boolean),
      prepareBundle: dependencies.prepareBundle ?? (plan => nativeBundle(context, plan, owner, repo, api)),
      ...(env.VERSIONING_ORIGIN_DIR ? { origin: originFromDirectory(env.VERSIONING_ORIGIN_DIR) } : {}),
      ...(env.VERSIONING_BOT_LOGIN ? { botLogin: env.VERSIONING_BOT_LOGIN } : {}),
    });
    const directory = env.VERSIONING_OUTPUT_DIR ?? join(env.RUNNER_TEMP ?? workspace, 'versioning');
    mkdirSync(directory, { recursive: true });
    const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(directory, 'version-report.json'), json(result.report));
    writeFileSync(join(directory, 'release-plan.json'), json(result.plan));
    writeFileSync(join(directory, 'pr-policy.json'), json(result.snapshot));
    writeFileSync(join(directory, 'release-policy.json'), json(result.policy));
    writeFileSync(join(directory, 'git-inputs.json'), json(result.gitInputs));
    const publicationEvidence = { phase: result.phase,
      producer: result.producer, functionalSha: result.functionalSha,
      publishedSha: result.publishedSha, originPrNumber: result.originPrNumber,
      technicalPrNumber: result.technicalPrNumber, planDigest: result.plan.planDigest,
      technicalMerge: result.technicalMerge };
    writeFileSync(join(directory, 'publication-evidence.json'), json(publicationEvidence));
    if (result.bundle) writeFileSync(join(directory, 'version-bundle.json'), json(result.bundle));
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT,
      `phase=${result.phase}\nartifact_name=publication-${result.producer.runId}-${result.producer.runAttempt}\n` +
      `plan_digest=${result.plan.planDigest}\npayload_digest=${publicationPayloadDigest({ ...result,
        publicationEvidence })}\n`);
    return 0;
  } catch (error) {
    (dependencies.error ?? console.error)(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await preparePublicationMain();
}
