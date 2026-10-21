import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { validateReleasePlan, type ReleasePlan } from '../adapter-contract.js';
import type { ReadApi } from '../ports/github.js';
import { collectPrEvidence, type PrEvidence } from './pr-evidence.js';
import { evaluateReleasePolicy } from './release-policy.js';
import { parseTechnicalPrProvenance, technicalBranchName } from './technical-release.js';
import { validateVersionFiles, type VersionFilesBundle } from './version-files.js';

const shaPattern = /^[0-9a-f]{40}$/i;
const repoPart = /^[A-Za-z0-9_.-]+$/;
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as Record<string, unknown>;
}
function checkedSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error(`${label} SHA inválido`);
  return value.toLowerCase();
}
function git(repository: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitBytes(repository: string, args: string[]): Buffer {
  return execFileSync('git', args, { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function functionalSignature(value: PrEvidence): string {
  return digest({ repository: value.repository, number: value.number, headSha: value.headSha,
    headBranch: value.headBranch, baseBranch: value.baseBranch,
    mergedAt: value.mergedAt, mergeCommitSha: value.mergeCommitSha,
    milestone: value.milestone, override: value.override });
}

export interface TechnicalMergeRequest {
  readonly repository: string;
  readonly owner: string;
  readonly repo: string;
  readonly botLogin: string;
  readonly plan: ReleasePlan;
  readonly bundle: VersionFilesBundle;
  readonly trustedAllowedWrites?: readonly string[];
  readonly originPrNumber: number;
  readonly technicalPrNumber: number;
  readonly expectedFunctionalEvidence: PrEvidence;
  readonly publishedSha: string;
  readonly requiredChecks: readonly string[];
  readonly read: ReadApi;
}
export interface TechnicalMergeEvidence {
  readonly functionalSha: string;
  readonly reviewedHeadSha: string;
  readonly publishedSha: string;
  readonly method: 'merge' | 'single-parent';
  readonly approvalBy: string;
  readonly planDigest: string;
}

export async function verifyTechnicalMerge(request: TechnicalMergeRequest): Promise<TechnicalMergeEvidence> {
  if (!repoPart.test(request.owner) || !repoPart.test(request.repo) ||
    typeof request.botLogin !== 'string' || !/^[A-Za-z0-9_.-]+\[bot\]$/.test(request.botLogin) ||
    !Number.isSafeInteger(request.originPrNumber) || request.originPrNumber <= 0 ||
    !Number.isSafeInteger(request.technicalPrNumber) || request.technicalPrNumber <= 0 ||
    !Array.isArray(request.requiredChecks) || !request.requiredChecks.length ||
    request.requiredChecks.some(name => typeof name !== 'string' || !name)) {
    throw new Error('Contexto do merge técnico incompleto');
  }
  const root = realpathSync(request.repository);
  const plan = validateReleasePlan(request.plan);
  if (plan.status !== 'release' ||
    (plan.adapter !== 'changesets' && plan.adapter !== 'release-please')) {
    throw new Error('Merge técnico exige plano de arquivo');
  }
  const publishedSha = checkedSha(request.publishedSha, 'Commit publicado');
  if (git(root, ['rev-parse', 'HEAD']) !== publishedSha) {
    throw new Error('Checkout não corresponde ao SHA publicado');
  }
  validateVersionFiles({ repository: root, plan, bundle: request.bundle,
    ...(request.trustedAllowedWrites && { trustedAllowedWrites: request.trustedAllowedWrites }) },
  false, false);
  const repositoryName = `${request.owner}/${request.repo}`;
  const currentFunctional = await collectPrEvidence(request.read, { repository: repositoryName,
    targetBranch: plan.branch, prNumber: request.originPrNumber,
    requiredChecks: request.requiredChecks });
  if (functionalSignature(currentFunctional) !== functionalSignature(request.expectedFunctionalEvidence) ||
    currentFunctional.mergeCommitSha !== plan.sha || !currentFunctional.mergedAt ||
    currentFunctional.baseBranch !== plan.branch ||
    !(currentFunctional.headBranch === 'develop' ||
      /^hotfix\/.+/.test(currentFunctional.headBranch))) {
    throw new Error('Metadado ou origem funcional mudou após homologação');
  }
  const policy = evaluateReleasePolicy({ report: plan.report, snapshot: currentFunctional,
    phase: 'publication' });
  if (policy.outcome === 'blocked') throw new Error(`Policy funcional bloqueou publicação: ${policy.reasons.join('; ')}`);
  const scope = `repos/${repositoryName}`;
  const pr = record(await request.read.get(`${scope}/pulls/${request.technicalPrNumber}`), 'PR técnico');
  const head = record(pr.head, 'Head técnico');
  const base = record(pr.base, 'Base técnica');
  const reviewedHeadSha = checkedSha(head.sha, 'Head técnico');
  const expectedBranch = technicalBranchName(request.owner, request.repo, plan.branch,
    plan.adapter, plan.entries[0]!.projectPath);
  const technicalAuthor = record(pr.user, 'Autor técnico');
  if (technicalAuthor.type !== 'Bot' || technicalAuthor.login !== request.botLogin) {
    throw new Error('Identidade do bot autor do PR técnico diverge da automação');
  }
  if (pr.number !== request.technicalPrNumber || !pr.merged_at ||
    pr.merge_commit_sha !== publishedSha || base.ref !== plan.branch ||
    head.ref !== expectedBranch) {
    throw new Error('PR técnico não corresponde ao merge integrado');
  }
  const marker = parseTechnicalPrProvenance(pr.body);
  if (marker.originPrNumber !== request.originPrNumber || marker.functionalSha !== plan.sha ||
    marker.planDigest !== plan.planDigest || marker.bundleDigest !== digest(request.bundle) ||
    marker.headSha !== reviewedHeadSha) {
    throw new Error('Proveniência ou head técnico diverge do plano revisado');
  }
  const technicalTree = git(root, ['rev-parse', `${reviewedHeadSha}^{tree}`]);
  if (marker.treeSha !== technicalTree) {
    throw new Error('Árvore do head técnico diverge da proveniência revisada');
  }
  const technicalParents = git(root, ['rev-list', '--parents', '-n', '1', reviewedHeadSha])
    .split(' ').slice(1);
  if (!technicalParents.includes(plan.sha)) throw new Error('Head técnico não descende da origem funcional');
  const releaseParents = git(root, ['rev-list', '--parents', '-n', '1', publishedSha])
    .split(' ').slice(1);
  let method: TechnicalMergeEvidence['method'];
  if (releaseParents.length === 2 && releaseParents[0] === plan.sha &&
    releaseParents[1] === reviewedHeadSha) method = 'merge';
  else if (releaseParents.length === 1 && releaseParents[0] === plan.sha && pr.commits === 1) {
    method = 'single-parent';
  } else throw new Error('Rebase multi-commit ou relação de merge técnico não comprovada');
  if (git(root, ['rev-parse', `${publishedSha}^{tree}`]) !== technicalTree) {
    throw new Error('Árvore integrada diverge da árvore técnica revisada');
  }
  const diff = gitBytes(root, ['diff', '--name-status', '--no-renames', '-z', plan.sha, publishedSha])
    .toString('utf8').split('\0').filter(Boolean);
  const changed = new Map<string, string>();
  for (let index = 0; index < diff.length; index += 2) {
    if (!diff[index + 1] || !['A', 'M', 'D'].includes(diff[index]!)) {
      throw new Error('Diff técnico contém operação não suportada');
    }
    changed.set(diff[index + 1]!, diff[index]!);
  }
  if (changed.size !== request.bundle.operations.length) throw new Error('Diff técnico diverge do bundle');
  for (const operation of request.bundle.operations) {
    const status = changed.get(operation.path);
    if (!status || (operation.op === 'delete' ? status !== 'D' : status !== 'A' && status !== 'M')) {
      throw new Error(`Diff técnico diverge de ${operation.path}`);
    }
    if (operation.op === 'write') {
      const bytes = gitBytes(root, ['show', `${publishedSha}:${operation.path}`]);
      if (createHash('sha256').update(bytes).digest('hex') !== operation.after) {
        throw new Error(`Conteúdo integrado diverge de ${operation.path}`);
      }
    }
  }
  const reviews = await request.read.list(`${scope}/pulls/${request.technicalPrNumber}/reviews?per_page=100`);
  const effective = new Map<string, Record<string, unknown>>();
  for (const value of reviews.map(item => record(item, 'Review técnico'))
    .sort((a, b) => Date.parse(String(a.submitted_at)) - Date.parse(String(b.submitted_at)) ||
      Number(a.id ?? 0) - Number(b.id ?? 0))) {
    const user = record(value.user, 'Reviewer');
    if (!Number.isSafeInteger(value.id) || !Number.isFinite(Date.parse(String(value.submitted_at)))) {
      throw new Error('Review técnico sem ordem auditável');
    }
    if (typeof user.login === 'string' && value.state !== 'PENDING') effective.set(user.login, value);
  }
  if ([...effective.values()].some(value => value.state === 'CHANGES_REQUESTED')) {
    throw new Error('Review técnico solicitou alterações');
  }
  const author = record(pr.user, 'Autor técnico').login;
  const approval = [...effective.values()].find(value => {
    const user = record(value.user, 'Reviewer');
    return value.state === 'APPROVED' && value.commit_id === reviewedHeadSha &&
      user.type === 'User' && user.login !== author &&
      typeof user.login === 'string' && !user.login.endsWith('[bot]');
  });
  if (!approval) throw new Error('Aprovação humana vigente do head técnico ausente');
  const checkRuns = await request.read.listField(`${scope}/commits/${publishedSha}/check-runs?per_page=100`,
    'check_runs');
  const checks = checkRuns.map(value => record(value, 'Check run')).sort((a, b) => Number(a.id) - Number(b.id));
  if (checks.some(value => !Number.isSafeInteger(value.id))) throw new Error('CI sem ID auditável');
  if (checks.some(value => value.head_sha !== publishedSha)) throw new Error('CI de SHA incorreto');
  for (const required of request.requiredChecks) {
    const latest = checks.filter(value => value.name === required).at(-1);
    if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
      throw new Error(`CI obrigatória ausente ou reprovada: ${required}`);
    }
  }
  return { functionalSha: plan.sha, reviewedHeadSha, publishedSha,
    method, approvalBy: String(record(approval.user, 'Reviewer').login), planDigest: plan.planDigest };
}
