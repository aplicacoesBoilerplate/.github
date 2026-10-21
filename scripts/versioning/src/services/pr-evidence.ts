import type { ReadApi } from '../ports/github.js';

export interface PrEvidenceOptions {
  readonly repository: string;
  readonly targetBranch: string;
  readonly prNumber?: number;
  readonly commitSha?: string;
  readonly expectedHeadSha?: string;
  readonly requiredChecks?: readonly string[];
}

export interface PrCheckEvidence {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly headSha: string;
}

export interface PrEvidence {
  readonly repository: string;
  readonly number: number;
  readonly headSha: string;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly mergedAt: string | null;
  readonly mergeCommitSha: string | null;
  readonly milestone: { readonly title: string } | null;
  readonly override: {
    readonly labelPresent: boolean;
    readonly labeledBy: string | null;
    readonly labeledAt: string | null;
    readonly labelerRole: string | null;
    readonly approvalBy: string | null;
    readonly approvedAt: string | null;
    readonly approverRole: string | null;
    readonly reviewedCommitSha: string | null;
  };
  readonly checks: readonly PrCheckEvidence[];
  readonly ciSatisfied: boolean;
}

const shaPattern = /^[0-9a-f]{40}$/i;
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const authorizedRoles = new Set(['maintain', 'admin']);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} incompleto`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} ausente`);
  return value;
}

function sha(value: unknown, label: string): string {
  const result = string(value, label);
  if (!shaPattern.test(result)) throw new Error(`${label} inválido`);
  return result;
}

function login(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const user = value as Record<string, unknown>;
  return typeof user.login === 'string' && user.login ? user.login : null;
}

function isBot(value: unknown): boolean {
  const user = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return user.type === 'Bot' || (typeof user.login === 'string' && user.login.endsWith('[bot]'));
}

function timestamp(value: unknown, label: string): number {
  const parsed = Date.parse(string(value, label));
  if (!Number.isFinite(parsed)) throw new Error(`${label} inválido`);
  return parsed;
}

function activeLabel(events: readonly unknown[]): Record<string, unknown> | null {
  const relevant = events.map(event => record(event, 'Timeline event'))
    .filter(event => (event.event === 'labeled' || event.event === 'unlabeled') &&
      record(event.label, 'Label').name === 'versioning:override')
    .sort((left, right) => timestamp(left.created_at, 'Label timestamp') -
      timestamp(right.created_at, 'Label timestamp'));
  let active: Record<string, unknown> | null = null;
  for (const event of relevant) active = event.event === 'labeled' ? event : null;
  return active;
}

function latestReviews(reviews: readonly unknown[]): Record<string, unknown>[] {
  const ordered = reviews.map(review => record(review, 'Review'))
    .filter(review => review.state !== 'PENDING')
    .sort((left, right) => timestamp(left.submitted_at, 'Review timestamp') -
      timestamp(right.submitted_at, 'Review timestamp'));
  const current = new Map<string, Record<string, unknown>>();
  for (const review of ordered) {
    const reviewer = login(review.user);
    if (reviewer) current.set(reviewer, review);
  }
  return [...current.values()];
}

async function currentRole(read: ReadApi, repository: string, actor: string,
  cache: Map<string, string>): Promise<string> {
  const existing = cache.get(actor);
  if (existing) return existing;
  const value = record(await read.get(`repos/${repository}/collaborators/${encodeURIComponent(actor)}/permission`),
    'Collaborator permission');
  const role = string(value.role_name, 'role_name').toLowerCase();
  cache.set(actor, role);
  return role;
}

function checkedPull(value: unknown, number: number): Record<string, unknown> {
  const pr = record(value, 'Pull request');
  if (pr.number !== number) throw new Error('Resposta de pull request incompleta');
  const head = record(pr.head, 'PR head');
  const base = record(pr.base, 'PR base');
  if (!login(pr.user)) throw new Error('Autor do pull request ausente');
  sha(head.sha, 'PR head SHA');
  string(head.ref, 'PR head branch');
  string(base.ref, 'PR base branch');
  return pr;
}

async function selectedNumber(read: ReadApi, options: PrEvidenceOptions): Promise<number> {
  if (options.commitSha && options.prNumber !== undefined) throw new Error('Selecione PR ou commit, não ambos');
  if (!options.commitSha) {
    if (!Number.isInteger(options.prNumber) || (options.prNumber ?? 0) < 1) {
      throw new Error('Número de PR inválido');
    }
    return options.prNumber!;
  }
  const commit = sha(options.commitSha, 'Commit integrado');
  const associated = await read.list(`repos/${options.repository}/commits/${commit}/pulls?per_page=100`);
  const matches = associated.map(value => record(value, 'Associated PR')).filter(pr => {
    const head = record(pr.head, 'Associated head');
    const base = record(pr.base, 'Associated base');
    return (head.ref === 'develop' || (typeof head.ref === 'string' && /^hotfix\/.+$/.test(head.ref))) &&
      base.ref === options.targetBranch && pr.merged_at && pr.merge_commit_sha === commit;
  });
  if (matches.length !== 1 || !Number.isInteger(matches[0]?.number)) {
    throw new Error(`Associação ambígua: ${matches.length} PRs integrados (develop ou hotfix/<nome>) -> ${options.targetBranch}`);
  }
  return matches[0]!.number as number;
}

export async function collectPrEvidence(read: ReadApi, options: PrEvidenceOptions): Promise<PrEvidence> {
  if (!repoPattern.test(options.repository) || !/^[A-Za-z0-9_.\/-]+$/.test(options.targetBranch) ||
    options.targetBranch.includes('..')) throw new Error('Contexto de PR inválido');
  const number = await selectedNumber(read, options);
  const pr = checkedPull(await read.get(`repos/${options.repository}/pulls/${number}`), number);
  const head = record(pr.head, 'PR head');
  const base = record(pr.base, 'PR base');
  const headSha = sha(head.sha, 'PR head SHA');
  if (options.expectedHeadSha && headSha !== options.expectedHeadSha) throw new Error('PR head SHA mudou');
  const mergeCommitSha = pr.merge_commit_sha == null ? null : sha(pr.merge_commit_sha, 'Merge SHA');
  if (options.commitSha && (mergeCommitSha !== options.commitSha || !pr.merged_at ||
    base.ref !== options.targetBranch)) throw new Error('PR integrado diverge do commit');
  const [timeline, reviews] = await Promise.all([
    read.list(`repos/${options.repository}/issues/${number}/timeline?per_page=100`),
    read.list(`repos/${options.repository}/pulls/${number}/reviews?per_page=100`),
  ]);
  const label = activeLabel(timeline);
  const labeler = label ? login(label.actor) : null;
  const labelTime = label ? string(label.created_at, 'Label timestamp') : null;
  const roleCache = new Map<string, string>();
  const labelerRole = labeler && !isBot(label?.actor)
    ? await currentRole(read, options.repository, labeler, roleCache) : null;
  const author = login(pr.user);
  const candidates = latestReviews(reviews).filter(review => {
    const reviewer = login(review.user);
    return label && labelTime && reviewer && review.state === 'APPROVED' &&
      reviewer !== labeler && reviewer !== author && !isBot(review.user) &&
      review.commit_id === headSha && timestamp(review.submitted_at, 'Review timestamp') >
        timestamp(labelTime, 'Label timestamp');
  });
  let approval: Record<string, unknown> | null = null;
  let approverRole: string | null = null;
  for (const review of candidates) {
    const reviewer = login(review.user)!;
    const role = await currentRole(read, options.repository, reviewer, roleCache);
    if (authorizedRoles.has(role) && (!approval || timestamp(review.submitted_at, 'Review timestamp') >
      timestamp(approval.submitted_at, 'Review timestamp'))) {
      approval = review;
      approverRole = role;
    }
  }
  const ciSha = options.commitSha ?? headSha;
  const checkRuns = await read.listField(`repos/${options.repository}/commits/${ciSha}/check-runs?per_page=100`,
    'check_runs');
  const checkEntries = checkRuns.map(value => {
    const check = record(value, 'Check run');
    const checkSha = sha(check.head_sha, 'CI SHA');
    if (checkSha !== ciSha) throw new Error('CI vinculada a SHA diferente');
    if (!Number.isInteger(check.id) || (check.id as number) < 1) throw new Error('CI id inválido');
    return { id: check.id as number, evidence: {
      name: string(check.name, 'Check name'), status: string(check.status, 'Check status'),
      conclusion: check.conclusion == null ? null : string(check.conclusion, 'Check conclusion'),
      headSha: checkSha } };
  }).sort((left, right) => left.id - right.id);
  const checks: PrCheckEvidence[] = checkEntries.map(item => item.evidence);
  for (const required of options.requiredChecks ?? []) {
    const matches = checks.filter(check => check.name === required);
    if (!matches.length || matches.at(-1)?.status !== 'completed' ||
      matches.at(-1)?.conclusion !== 'success') throw new Error(`CI obrigatória ausente ou reprovada: ${required}`);
  }
  const milestone = pr.milestone == null ? null : {
    title: string(record(pr.milestone, 'Milestone').title, 'Milestone title'),
  };
  return {
    repository: options.repository, number, headSha, headBranch: string(head.ref, 'PR head branch'),
    baseBranch: string(base.ref, 'PR base branch'), mergedAt: pr.merged_at == null ? null :
      string(pr.merged_at, 'Merged at'), mergeCommitSha, milestone,
    override: { labelPresent: Boolean(label), labeledBy: labeler, labeledAt: labelTime,
      labelerRole, approvalBy: approval ? login(approval.user) : null,
      approvedAt: approval ? string(approval.submitted_at, 'Review timestamp') : null,
      approverRole, reviewedCommitSha: approval ? headSha : null },
    checks, ciSatisfied: true,
  };
}
