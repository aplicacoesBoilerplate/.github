import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import type { ReadApi } from '../ports/github.js';
import type { ReleasePlan } from '../adapter-contract.js';
import { collectPrEvidence, type PrEvidence } from './pr-evidence.js';
import { evaluateReleasePolicy } from './release-policy.js';
import type { TechnicalMergeEvidence } from './technical-merge.js';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
export type LegacyFile = { path: string; before: string | null; hash: string; content: string };
export type LegacyBundle = { schemaVersion: 1; adapter: 'standard-version'; sha: string;
  version: string; tagPrefix: string; projectPath: string; files: LegacyFile[] };
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as Record<string, unknown>;
}
function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function bytes(root: string, ...args: string[]): Buffer {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}
function base(root: string, sha: string, path: string): string | null {
  const entry = bytes(root, 'ls-tree', '-z', sha, '--', path).toString('utf8');
  if (!entry) return null;
  if (!/^100(?:644|755) blob /.test(entry)) throw new Error('Bundle base não regular');
  return hash(bytes(root, 'show', `${sha}:${path}`));
}
function checkedBundle(value: unknown, plan: ReleasePlan, root: string): LegacyBundle {
  const bundle = object(value, 'Bundle standard-version');
  const report = object(plan.report, 'Relatório standard-version');
  if (plan.status !== 'release' || plan.adapter !== 'standard-version' ||
    bundle.schemaVersion !== 1 || bundle.adapter !== plan.adapter || bundle.sha !== plan.sha ||
    bundle.version !== plan.entries[0].version || bundle.tagPrefix !== report.tagPrefix ||
    bundle.projectPath !== plan.entries[0].projectPath || !Array.isArray(bundle.files) ||
    !bundle.files.length || bundle.files.length > 4 ||
    Buffer.byteLength(JSON.stringify(bundle)) > 16 * 1024 * 1024) {
    throw new Error('Artifact standard-version incompleto ou divergente');
  }
  const prefix = bundle.projectPath === '.' ? '' : `${bundle.projectPath}/`;
  const allowed = new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json',
    'CHANGELOG.md'].map(name => prefix + name));
  const seen = new Set<string>();
  let total = 0;
  for (const item of bundle.files) {
    const file = object(item, 'Arquivo do bundle');
    if (typeof file.path !== 'string' || !allowed.has(file.path) || seen.has(file.path) ||
      typeof file.content !== 'string' || typeof file.hash !== 'string' ||
      !digestPattern.test(file.hash) || file.before !== null &&
      (typeof file.before !== 'string' || !digestPattern.test(file.before))) {
      throw new Error('Arquivo standard-version fora do contrato');
    }
    seen.add(file.path);
    const content = Buffer.from(file.content, 'base64');
    total += content.length;
    if (total > 10 * 1024 * 1024 || content.toString('base64') !== file.content ||
      hash(content) !== file.hash || base(root, plan.sha, file.path) !== file.before) {
      throw new Error('Bundle standard-version adulterado');
    }
  }
  if (!seen.has(prefix + 'package.json') || !seen.has(prefix + 'CHANGELOG.md') ||
    ![prefix + 'package-lock.json', prefix + 'npm-shrinkwrap.json'].some(path => seen.has(path))) {
    throw new Error('Bundle standard-version sem manifest, lockfile ou changelog');
  }
  const files = bundle.files as LegacyFile[];
  const content = (name: string): string | null => {
    const item = files.find(file => file.path === prefix + name);
    return item ? Buffer.from(item.content, 'base64').toString('utf8') : null;
  };
  const manifest = object(JSON.parse(content('package.json')!), 'Manifest standard-version');
  if (manifest.version !== bundle.version) throw new Error('Manifest standard-version diverge da versão');
  for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
    const raw = content(name);
    if (!raw) continue;
    const lock = object(JSON.parse(raw), 'Lockfile standard-version');
    if (lock.version !== bundle.version ||
      (lock.packages && object(lock.packages, 'Packages do lock')[''] &&
        object(object(lock.packages, 'Packages do lock')[''], 'Root do lock').version !== bundle.version)) {
      throw new Error('Lockfile standard-version diverge da versão');
    }
  }
  const heading = new RegExp(`(?:^|\\n)#{1,3}\\s+\\[?${bundle.version.replaceAll('.', '\\.')}\\]?(?:\\s|$|\\()`);
  if (!heading.test(content('CHANGELOG.md') ?? '')) {
    throw new Error('Changelog standard-version diverge da versão');
  }
  return bundle as LegacyBundle;
}
export function validateLegacyBundle(value: unknown, plan: ReleasePlan, repository: string): true {
  checkedBundle(value, plan, realpathSync(repository));
  return true;
}
function evidenceSignature(value: PrEvidence): string {
  return JSON.stringify({ repository: value.repository, number: value.number, headSha: value.headSha,
    headBranch: value.headBranch, baseBranch: value.baseBranch,
    mergedAt: value.mergedAt, mergeCommitSha: value.mergeCommitSha,
    milestone: value.milestone, override: value.override });
}

export async function verifyLegacyTechnicalMerge(request: { repository: string; owner: string;
  repo: string; plan: ReleasePlan; bundle: unknown; origin: PrEvidence; technicalPrNumber: number;
  publishedSha: string; requiredChecks: readonly string[]; read: ReadApi; botLogin?: string }):
  Promise<TechnicalMergeEvidence> {
  const root = realpathSync(request.repository);
  const plan = request.plan;
  const published = request.publishedSha;
  if (!shaPattern.test(published) || git(root, 'rev-parse', 'HEAD') !== published ||
    !Number.isSafeInteger(request.technicalPrNumber) || request.technicalPrNumber < 1) {
    throw new Error('Commit técnico standard-version inválido');
  }
  const bundle = checkedBundle(request.bundle, plan, root);
  const repository = `${request.owner}/${request.repo}`;
  const current = await collectPrEvidence(request.read, { repository, targetBranch: plan.branch,
    prNumber: request.origin.number, requiredChecks: request.requiredChecks });
  if (evidenceSignature(current) !== evidenceSignature(request.origin) ||
    current.mergeCommitSha !== plan.sha || !current.mergedAt ||
    !(current.headBranch === 'develop' || /^hotfix\/.+/.test(current.headBranch))) {
    throw new Error('Origem funcional standard-version mudou');
  }
  const policy = evaluateReleasePolicy({ report: plan.report, snapshot: current, phase: 'publication' });
  if (policy.outcome === 'blocked') throw new Error('Policy funcional bloqueou merge técnico');
  const pr = object(await request.read.get(`repos/${repository}/pulls/${request.technicalPrNumber}`),
    'PR técnico standard-version');
  const head = object(pr.head, 'Head técnico');
  const baseRef = object(pr.base, 'Base técnica');
  const reviewedHeadSha = head.sha;
  const body = String(pr.body ?? '');
  const field = (name: string) => new RegExp(`^${name}: (.+)$`, 'm').exec(body)?.[1]?.trim();
  if (pr.number !== request.technicalPrNumber || !shaPattern.test(String(reviewedHeadSha)) || pr.merged_at == null ||
    pr.merge_commit_sha !== published || baseRef.ref !== plan.branch ||
    head.ref !== `versioning/standard-version/${plan.sha.slice(0, 12)}` ||
    field('Origin-PR') !== `#${request.origin.number}` || field('Origin-SHA') !== plan.sha ||
    field('Adapter') !== 'standard-version' || field('Project') !== bundle.projectPath ||
    field('Tag-Prefix') !== bundle.tagPrefix || field('Version') !== bundle.version ||
    object(pr.user, 'Autor técnico').type !== 'Bot' ||
    !String(object(pr.user, 'Autor técnico').login).endsWith('[bot]') ||
    request.botLogin && object(pr.user, 'Autor técnico').login !== request.botLogin) {
    throw new Error('PR técnico standard-version sem proveniência válida');
  }
  const tree = git(root, 'rev-parse', `${reviewedHeadSha}^{tree}`);
  if (git(root, 'rev-parse', `${published}^{tree}`) !== tree ||
    !git(root, 'rev-list', '--parents', '-n', '1', String(reviewedHeadSha)).split(' ').slice(1)
      .includes(plan.sha)) throw new Error('Árvore técnica standard-version diverge do review');
  const parents = git(root, 'rev-list', '--parents', '-n', '1', published).split(' ').slice(1);
  let method: TechnicalMergeEvidence['method'];
  if (parents.length === 2 && parents[0] === plan.sha && parents[1] === reviewedHeadSha) method = 'merge';
  else if (parents.length === 1 && parents[0] === plan.sha && pr.commits === 1) method = 'single-parent';
  else throw new Error('Relação de merge técnico standard-version não comprovada');
  const changed = bytes(root, 'diff', '--name-status', '--no-renames', '-z', plan.sha, published)
    .toString('utf8').split('\0').filter(Boolean);
  if (changed.length !== bundle.files.length * 2) throw new Error('Diff standard-version diverge do bundle');
  const expected = new Map(bundle.files.map(file => [file.path, file]));
  for (let index = 0; index < changed.length; index += 2) {
    const path = changed[index + 1]!;
    const file = expected.get(path);
    if (!['A', 'M'].includes(changed[index]!) || !file ||
      hash(bytes(root, 'show', `${published}:${path}`)) !== file.hash) {
      throw new Error('Diff técnico standard-version adulterado');
    }
    expected.delete(path);
  }
  if (expected.size) throw new Error('Bundle standard-version incompleto no merge');
  const reviews = await request.read.list(`repos/${repository}/pulls/${request.technicalPrNumber}/reviews?per_page=100`);
  const effective = new Map<string, Record<string, unknown>>();
  for (const review of reviews.map(item => object(item, 'Review técnico'))
    .sort((a, b) => Date.parse(String(a.submitted_at)) - Date.parse(String(b.submitted_at)) ||
      Number(a.id) - Number(b.id))) {
    const user = object(review.user, 'Reviewer');
    if (!Number.isSafeInteger(review.id) || !Number.isFinite(Date.parse(String(review.submitted_at)))) {
      throw new Error('Review técnico sem ordem auditável');
    }
    if (typeof user.login === 'string' && review.state !== 'PENDING') effective.set(user.login, review);
  }
  if ([...effective.values()].some(review => review.state === 'CHANGES_REQUESTED')) {
    throw new Error('Review técnico solicitou alterações');
  }
  const author = object(pr.user, 'Autor técnico').login;
  const approval = [...effective.values()].find(review => {
    const user = object(review.user, 'Reviewer');
    return review.state === 'APPROVED' && review.commit_id === reviewedHeadSha &&
      user.type === 'User' && user.login !== author &&
      typeof user.login === 'string' && !user.login.endsWith('[bot]');
  });
  if (!approval) throw new Error('Aprovação humana vigente do PR técnico ausente');
  const checks = await request.read.listField(`repos/${repository}/commits/${published}/check-runs?per_page=100`,
    'check_runs');
  if (checks.map(item => object(item, 'CI técnica')).some(item =>
    !Number.isSafeInteger(item.id) || item.head_sha !== published)) {
    throw new Error('CI técnica contém SHA ou ID inválido');
  }
  for (const required of request.requiredChecks) {
    const matching = checks.map(item => object(item, 'CI técnica')).filter(item => item.name === required)
      .sort((a, b) => Number(a.id) - Number(b.id));
    const latest = matching.at(-1);
    if (!latest || latest.head_sha !== published || latest.status !== 'completed' ||
      latest.conclusion !== 'success') throw new Error(`CI técnica ausente ou de outro SHA: ${required}`);
  }
  return { functionalSha: plan.sha, reviewedHeadSha: String(reviewedHeadSha), publishedSha: published,
    method, approvalBy: String(object(approval.user, 'Reviewer').login), planDigest: plan.planDigest };
}
