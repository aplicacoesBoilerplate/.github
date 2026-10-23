import { adapterCapabilities, planFromReport, validateDescriptor, validateReleasePlan } from '../adapter-contract.js';
import type { ReadApi } from '../ports/github.js';
import { publicationPayloadDigest } from './publication-payload.js';
import type { AdapterId, ReleasePlan } from '../adapter-contract.js';
import type { GitInputsSnapshot } from '../ports/git.js';
import type { PrEvidence } from './pr-evidence.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const shaPattern = /^[0-9a-f]{40}$/i;
const partPattern = /^[A-Za-z0-9_.-]+$/;
type RecordValue = Record<string, unknown>;
function object(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as RecordValue;
}
function positive(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${label} inválido`);
  return Number(value);
}
export interface TrustedPublication {
  readonly owner: string;
  readonly repo: string;
  readonly adapter: AdapterId;
  readonly projectPath: string;
  readonly targetBranch: string;
  readonly tagPrefix: string;
  readonly publishedSha: string;
  readonly centralSha: string;
  readonly centralRepository?: string;
  readonly runId: number;
  readonly runAttempt: number;
  readonly artifactId: number;
  readonly expectedProducerJob: string;
  readonly planDigest: string;
  readonly payloadDigest: string;
  readonly botLogin?: string;
}
export interface PublicationArtifact {
  readonly report: unknown;
  readonly plan: ReleasePlan;
  readonly bundle: unknown | null;
  readonly snapshot: PrEvidence;
  readonly gitInputs: GitInputsSnapshot;
  readonly publicationEvidence: RecordValue;
}

export interface SourceArtifact {
  readonly repository: string;
  readonly artifactId: number;
  readonly runId: number;
  readonly runAttempt: number;
  readonly centralSha: string;
  readonly planDigest: string;
  readonly payloadDigest: string;
}

export function validateSourceArtifact(value: unknown): SourceArtifact {
  const source = object(value, 'Artifact de origem');
  if (typeof source.repository !== 'string' ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository) ||
    !shaPattern.test(String(source.centralSha)) ||
    !/^[0-9a-f]{64}$/.test(String(source.planDigest)) ||
    !/^[0-9a-f]{64}$/.test(String(source.payloadDigest))) {
    throw new Error('Identidade do artifact de origem inválida');
  }
  positive(source.artifactId, 'Artifact ID'); positive(source.runId, 'Run');
  positive(source.runAttempt, 'Tentativa');
  return source as unknown as SourceArtifact;
}

export function loadArtifact(directory: string): PublicationArtifact {
  const file = (name: string): unknown => {
    try { return JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown; }
    catch { throw new Error(`Artifact incompleto ou expirado: ${name}`); }
  };
  const plan = validateReleasePlan(file('release-plan.json'));
  return { report: file('version-report.json'), plan,
    snapshot: file('pr-policy.json') as PrEvidence,
    gitInputs: file('git-inputs.json') as GitInputsSnapshot,
    publicationEvidence: object(file('publication-evidence.json'), 'Evidência'),
    bundle: plan.status === 'release' && adapterCapabilities[plan.adapter].needsVersionPr ?
      file('version-bundle.json') : null };
}

export function verifyPlan(artifact: PublicationArtifact, trust: TrustedPublication): ReleasePlan {
  const plan = validateReleasePlan(artifact.plan);
  if (!/^[0-9a-f]{64}$/.test(trust.planDigest) || !/^[0-9a-f]{64}$/.test(trust.payloadDigest) ||
    plan.planDigest !== trust.planDigest || publicationPayloadDigest(artifact) !== trust.payloadDigest) {
    throw new Error('Identidade do plano/artifact diverge das saídas confiáveis do leitor');
  }
  if (!Object.hasOwn(adapterCapabilities, trust.adapter) || plan.adapter !== trust.adapter ||
    plan.branch !== trust.targetBranch || !artifact.report) {
    throw new Error('Plano/artifact diverge do caller confiável');
  }
  const capability = adapterCapabilities[trust.adapter];
  const descriptor = validateDescriptor({ id: trust.adapter, ...capability,
    collect: () => artifact.report,
    ...(capability.needsVersionPr ? { prepare: () => artifact.bundle } : {}) });
  const expected = planFromReport(artifact.report, descriptor, trust.projectPath);
  if (expected.planDigest !== plan.planDigest) throw new Error('Plano/artifact adulterado');
  const report = object(artifact.report, 'Relatório');
  if (typeof trust.tagPrefix !== 'string' ||
    (report.tagPrefix !== undefined && report.tagPrefix !== trust.tagPrefix) ||
    (['go-gitsemver', 'changesets', 'release-please'].includes(trust.adapter) && trust.tagPrefix !== 'v') ||
    plan.entries.some(entry => entry.tag !== (trust.adapter === 'changesets' ?
      `${entry.package}@${entry.version}` : `${trust.tagPrefix}${entry.version}`))) {
    throw new Error('Tag/prefixo do plano diverge do caller confiável');
  }
  const evidence = object(artifact.publicationEvidence, 'Evidência de publicação');
  if (evidence.planDigest !== plan.planDigest || evidence.publishedSha !== trust.publishedSha ||
    !Number.isSafeInteger(evidence.originPrNumber) || Number(evidence.originPrNumber) < 1 ||
    artifact.gitInputs?.sha !== trust.publishedSha || artifact.gitInputs.adapter !== trust.adapter) {
    throw new Error('Artifact incompleto ou de SHA incorreto');
  }
  if (evidence.phase === 'functional') {
    if (plan.sha !== trust.publishedSha || evidence.functionalSha !== plan.sha ||
      evidence.technicalPrNumber !== null) throw new Error('Origem funcional do artifact inválida');
  } else if (evidence.phase === 'technical') {
    if (plan.status !== 'release' || !capability.needsVersionPr ||
      evidence.functionalSha !== plan.sha || plan.sha === trust.publishedSha ||
      !Number.isSafeInteger(evidence.technicalPrNumber) || Number(evidence.technicalPrNumber) < 1) {
      throw new Error('Origem técnica do artifact inválida');
    }
  } else throw new Error('Fase do artifact inválida');
  return plan;
}

export async function verifyProducer(read: ReadApi, trust: TrustedPublication,
  producerInput: unknown): Promise<void> {
  const name = `${trust.owner}/${trust.repo}`;
  if (!partPattern.test(trust.owner) || !partPattern.test(trust.repo) ||
    !partPattern.test(trust.expectedProducerJob) ||
    positive(trust.runId, 'Run') !== trust.runId ||
    positive(trust.runAttempt, 'Tentativa') !== trust.runAttempt ||
    positive(trust.artifactId, 'Artifact ID') !== trust.artifactId ||
    !shaPattern.test(trust.publishedSha) || !shaPattern.test(trust.centralSha)) {
    throw new Error('Contexto confiável de publicação inválido');
  }
  const producer = object(producerInput, 'Produtor');
  if (producer.repository !== name || producer.runId !== trust.runId ||
    producer.runAttempt !== trust.runAttempt || producer.job !== trust.expectedProducerJob ||
    producer.centralSha !== trust.centralSha) throw new Error('Produtor do artifact divergente');
  const scope = `repos/${name}`;
  const remoteArtifact = object(await read.get(`${scope}/actions/artifacts/${trust.artifactId}`),
    'Artifact remoto');
  const workflowRun = object(remoteArtifact.workflow_run, 'Run produtor do artifact');
  if (remoteArtifact.id !== trust.artifactId ||
    remoteArtifact.name !== `publication-${trust.runId}-${trust.runAttempt}` ||
    remoteArtifact.expired !== false || !Number.isSafeInteger(remoteArtifact.size_in_bytes) ||
    Number(remoteArtifact.size_in_bytes) < 1 || workflowRun.id !== trust.runId ||
    workflowRun.head_sha !== trust.publishedSha) throw new Error('Artifact expirado ou de outra execução');
  const run = object(await read.get(`${scope}/actions/runs/${trust.runId}/attempts/${trust.runAttempt}`),
    'Tentativa do workflow');
  if (run.id !== trust.runId || run.run_attempt !== trust.runAttempt ||
    run.head_sha !== trust.publishedSha || run.head_branch !== trust.targetBranch ||
    run.event !== 'push') throw new Error('Run produtor diverge do push integrado');
  if (trust.centralRepository && (!Array.isArray(run.referenced_workflows) ||
    !run.referenced_workflows.some(value => {
      const workflow = object(value, 'Workflow produtor');
      return workflow.sha === trust.centralSha && typeof workflow.path === 'string' &&
        workflow.path.startsWith(`${trust.centralRepository}/.github/workflows/version-publish.yml@`);
    }))) throw new Error('SHA central não comprovado no workflow produtor');
  const jobs = await read.listField(`${scope}/actions/runs/${trust.runId}/attempts/${trust.runAttempt}` +
    '/jobs?per_page=100', 'jobs');
  const matches = jobs.map(item => object(item, 'Job produtor')).filter(item =>
    (item.name === trust.expectedProducerJob || typeof item.name === 'string' &&
      item.name.endsWith(` / ${trust.expectedProducerJob}`)) && item.run_id === trust.runId &&
    item.head_sha === trust.publishedSha && item.status === 'completed' &&
    item.conclusion === 'success');
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0]?.id)) {
    throw new Error('Job produtor não comprovado no run esperado');
  }
}
