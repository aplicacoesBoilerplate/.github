import { createHash } from 'node:crypto';
import { createReadApi, createWriteApi, type GitHubTransport } from '../ports/github.js';
import { validateReleasePlan, type ReleasePlan } from '../adapter-contract.js';
import { validateVersionFiles, type VersionFilesBundle } from './version-files.js';

const shaPattern = /^[0-9a-f]{40}$/i;
const namePattern = /^[A-Za-z0-9_.-]+$/;
const branchPattern = /^[A-Za-z0-9._/-]+$/;
const marker = /<!-- central-versioning\n([^\n]+)\n-->/;

type RecordValue = Record<string, unknown>;
function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as RecordValue;
}
function sha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error(`${label} SHA inválido`);
  return value.toLowerCase();
}
function branch(value: string): string {
  if (typeof value !== 'string' || !branchPattern.test(value) || value.startsWith('/') ||
    value.endsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..') ||
    value.includes('..')) throw new Error('Branch-alvo inválida');
  return value;
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

interface Provenance {
  readonly originPrNumber: number;
  readonly functionalSha: string;
  readonly planDigest: string;
  readonly bundleDigest: string;
  readonly headSha: string;
  readonly treeSha: string;
}
function provenance(body: unknown): Provenance {
  if (typeof body !== 'string') throw new Error('PR técnico sem proveniência');
  const match = marker.exec(body);
  if (!match) throw new Error('PR técnico sem proveniência');
  let value: RecordValue;
  try { value = record(JSON.parse(match[1]!), 'Proveniência'); }
  catch { throw new Error('Proveniência do PR técnico inválida'); }
  if (!Number.isSafeInteger(value.originPrNumber) || Number(value.originPrNumber) <= 0 ||
    typeof value.planDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.planDigest) ||
    typeof value.bundleDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.bundleDigest)) {
    throw new Error('Proveniência do PR técnico incompleta');
  }
  return { originPrNumber: Number(value.originPrNumber),
    functionalSha: sha(value.functionalSha, 'Origem funcional'),
    planDigest: value.planDigest, bundleDigest: value.bundleDigest,
    headSha: sha(value.headSha, 'Head técnico'), treeSha: sha(value.treeSha, 'Árvore técnica') };
}

export interface TechnicalPrRequest {
  readonly repository: string;
  readonly owner: string;
  readonly repo: string;
  readonly originPrNumber: number;
  readonly botLogin: string;
  readonly plan: ReleasePlan;
  readonly bundle: VersionFilesBundle;
  readonly trustedAllowedWrites?: readonly string[];
  readonly transport: GitHubTransport;
}
export interface TechnicalPrResult {
  readonly outcome: 'created' | 'existing' | 'updated';
  readonly number: number;
  readonly url: string;
  readonly branch: string;
  readonly headSha: string;
  readonly functionalSha: string;
}

export async function prepareTechnicalPr(request: TechnicalPrRequest): Promise<TechnicalPrResult> {
  const plan = validateReleasePlan(request.plan);
  if (!namePattern.test(request.owner) || !namePattern.test(request.repo) ||
    typeof request.botLogin !== 'string' || !/^[A-Za-z0-9_.-]+\[bot\]$/.test(request.botLogin) ||
    !Number.isSafeInteger(request.originPrNumber) || request.originPrNumber <= 0) {
    throw new Error('Identidade do PR técnico inválida');
  }
  if (plan.status !== 'release' ||
    (plan.adapter !== 'changesets' && plan.adapter !== 'release-please')) {
    throw new Error('PR técnico exige plano com arquivos nativos');
  }
  const targetBranch = branch(plan.branch);
  validateVersionFiles({ repository: request.repository, plan, bundle: request.bundle,
    ...(request.trustedAllowedWrites && { trustedAllowedWrites: request.trustedAllowedWrites }) }, true);
  const component = plan.entries[0]!.projectPath;
  const identity = digest(`${request.owner}/${request.repo}/${targetBranch}/${plan.adapter}/${component}`)
    .slice(0, 16);
  const technicalBranch = `versioning/${plan.adapter}/${identity}`;
  const scope = `repos/${request.owner}/${request.repo}`;
  const read = createReadApi(request.transport);
  const write = createWriteApi(request.transport);
  const targetRef = async () => {
    const value = record(await read.get(`${scope}/git/ref/heads/${targetBranch}`), 'Branch-alvo');
    return sha(record(value.object, 'Objeto da branch-alvo').sha, 'Branch-alvo');
  };
  if (await targetRef() !== plan.sha) throw new Error('Branch-alvo avançou antes do PR técnico');
  const remoteBranch = await read.getOptional(`${scope}/git/ref/heads/${technicalBranch}`);
  const remoteHead = remoteBranch ? sha(record(record(remoteBranch, 'Ref técnica').object,
    'Objeto da ref técnica').sha, 'Head técnico') : null;
  const prs = await read.list(`${scope}/pulls?state=all&head=${encodeURIComponent(`${request.owner}:${technicalBranch}`)}` +
    `&base=${encodeURIComponent(targetBranch)}&per_page=100`);
  const matches = prs.map(value => record(value, 'PR técnico')).filter(value =>
    value.state === 'open' &&
    record(value.head, 'Head do PR').ref === technicalBranch &&
    record(value.base, 'Base do PR').ref === targetBranch);
  if (matches.length > 1 || (!remoteHead && matches.length) || (remoteHead && !matches.length)) {
    throw new Error('PR técnico/ref ambíguo; intervenção humana necessária');
  }
  const current = matches[0];
  const bundleDigest = digest(request.bundle);
  let oldHead: string | null = null;
  if (current) {
    if (record(current.user, 'Autor do PR').login !== request.botLogin ||
      !Number.isSafeInteger(current.number) || Number(current.number) <= 0) {
      throw new Error('PR técnico não pertence à automação ou está fechado');
    }
    const previous = provenance(current.body);
    oldHead = sha(record(current.head, 'Head do PR').sha, 'Head do PR');
    if (previous.originPrNumber !== request.originPrNumber || oldHead !== remoteHead ||
      oldHead !== previous.headSha) throw new Error('Head manual ou proveniência do PR técnico divergente');
    const commit = record(await read.get(`${scope}/git/commits/${oldHead}`), 'Commit técnico');
    const treeSha = sha(record(commit.tree, 'Árvore técnica').sha, 'Árvore técnica');
    if (treeSha !== previous.treeSha || typeof commit.message !== 'string' ||
      !commit.message.includes(`Central-Versioning-Plan: ${previous.planDigest}`) ||
      !commit.message.includes(`Functional-SHA: ${previous.functionalSha}`)) {
      throw new Error('Head técnico contém alteração manual ou proveniência inválida');
    }
    if (previous.planDigest === plan.planDigest && previous.functionalSha === plan.sha &&
      previous.bundleDigest === bundleDigest) {
      if (typeof current.html_url !== 'string') throw new Error('URL do PR técnico inválida');
      return { outcome: 'existing', number: Number(current.number), url: current.html_url,
        branch: technicalBranch, headSha: oldHead, functionalSha: plan.sha };
    }
  }
  const functionalCommit = record(await read.get(`${scope}/git/commits/${plan.sha}`), 'Commit funcional');
  const baseTree = sha(record(functionalCommit.tree, 'Árvore funcional').sha, 'Árvore funcional');
  const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];
  for (const operation of request.bundle.operations) {
    if (operation.op === 'delete') {
      treeEntries.push({ path: operation.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const value = record(await write.post(`${scope}/git/blobs`,
      { content: operation.content, encoding: 'base64' }), 'Blob técnico');
    treeEntries.push({ path: operation.path, mode: '100644', type: 'blob',
      sha: sha(value.sha, 'Blob técnico') });
  }
  const treeValue = record(await write.post(`${scope}/git/trees`,
    { base_tree: baseTree, tree: treeEntries }), 'Árvore técnica');
  const treeSha = sha(treeValue.sha, 'Árvore técnica');
  const message = `chore(release): ${plan.adapter}\n\nCentral-Versioning-Plan: ${plan.planDigest}` +
    `\nFunctional-SHA: ${plan.sha}\n`;
  const parents = oldHead ? [oldHead, plan.sha] : [plan.sha];
  const commitValue = record(await write.post(`${scope}/git/commits`,
    { message, tree: treeSha, parents }), 'Commit técnico');
  const headSha = sha(commitValue.sha, 'Commit técnico');
  if (await targetRef() !== plan.sha) throw new Error('Branch-alvo avançou durante preparo técnico');
  const details: Provenance = { originPrNumber: request.originPrNumber, functionalSha: plan.sha,
    planDigest: plan.planDigest, bundleDigest, headSha, treeSha };
  const title = `chore(release): ${plan.adapter} ${plan.entries.map(entry => entry.tag).join(', ')}`;
  const body = `Origin-PR: #${request.originPrNumber}\nOrigin-SHA: ${plan.sha}\nAdapter: ${plan.adapter}` +
    `\nPlan-SHA256: ${plan.planDigest}\n\n${plan.entries.map(entry => entry.notes).join('\n\n')}` +
    `\n\n<!-- central-versioning\n${JSON.stringify(details)}\n-->`;
  if (oldHead) {
    const value = record(await write.patch(`${scope}/git/refs/heads/${technicalBranch}`,
      { sha: headSha, force: false }), 'Ref técnica atualizada');
    if (sha(record(value.object, 'Ref técnica').sha, 'Ref técnica') !== headSha) {
      throw new Error('Ref técnica não confirmou o novo head');
    }
    const valuePr = record(await write.patch(`${scope}/pulls/${current!.number}`, { title, body }),
      'PR técnico atualizado');
    if (typeof valuePr.html_url !== 'string' ||
      sha(record(valuePr.head, 'Head do PR atualizado').sha, 'Head do PR atualizado') !== headSha ||
      provenance(valuePr.body).headSha !== headSha) {
      throw new Error('PR técnico não confirmou novo head e proveniência');
    }
    return { outcome: 'updated', number: Number(current!.number), url: valuePr.html_url,
      branch: technicalBranch, headSha, functionalSha: plan.sha };
  }
  const newRef = record(await write.post(`${scope}/git/refs`,
    { ref: `refs/heads/${technicalBranch}`, sha: headSha }), 'Ref técnica criada');
  if (sha(record(newRef.object, 'Ref técnica').sha, 'Ref técnica') !== headSha) {
    throw new Error('Ref técnica não confirmou o novo head');
  }
  const valuePr = record(await write.post(`${scope}/pulls`,
    { title, body, head: technicalBranch, base: targetBranch }), 'PR técnico criado');
  if (!Number.isSafeInteger(valuePr.number) || typeof valuePr.html_url !== 'string' ||
    sha(record(valuePr.head, 'Head do PR criado').sha, 'Head do PR criado') !== headSha ||
    provenance(valuePr.body).headSha !== headSha) {
    throw new Error('PR técnico não confirmou número, URL, head e proveniência');
  }
  return { outcome: 'created', number: Number(valuePr.number), url: valuePr.html_url,
    branch: technicalBranch, headSha, functionalSha: plan.sha };
}
