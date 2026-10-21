import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bumpBetween, planFromReport, validateDescriptor, validateReleasePlan,
  type AdapterContext, type Bump, type ReleasePlan } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';
import { createSnapshotScm, type SnapshotScmOptions } from './release-please/snapshot-scm.js';

const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const allowedFiles = new Set(['package.json', 'package-lock.json', 'CHANGELOG.md',
  '.release-please-manifest.json']);
const toolRoot = join(dirname(fileURLToPath(import.meta.url)), '../../tools/release-please');

interface NativeUpdate { path: string; createIfMissing: boolean;
  updater: { updateContent(content: string | undefined): string } }
interface NativePullRequest { title: { toString(): string }; body: { notes(): string; toString(): string };
  version?: { toString(): string }; updates: NativeUpdate[] }
interface NativeManifest { buildPullRequests(): Promise<NativePullRequest[]> }
interface ManifestModule { Manifest: { fromManifest(scm: unknown, branch: string): Promise<NativeManifest> } }

export interface ReleasePleaseReport {
  readonly schemaVersion: 1;
  readonly adapter: 'release-please';
  readonly sha: string;
  readonly branch: string;
  readonly tagPrefix: 'v';
  readonly status: 'release' | 'no-release';
  readonly native: { tool: 'release-please'; version: '17.11.2'; title: string;
    explanation: string; body: string; updatePaths: string[] };
  readonly baseVersion?: string;
  readonly candidateVersion?: string;
  readonly tag?: string;
  readonly bump?: Bump;
}

export interface PreparedReleasePlease {
  readonly version: string;
  readonly title: string;
  readonly body: string;
  readonly files: readonly { path: string; content: string; baseSha: string | null }[];
}

async function loadManifest(): Promise<ManifestModule> {
  const manifestPath = join(toolRoot, 'node_modules/release-please/build/src/manifest.js');
  let module: unknown;
  try { module = await import(pathToFileURL(manifestPath).href); }
  catch { throw new Error('SDK Release Please 17.11.2 não instalado no tool root isolado'); }
  const sdk = module as Partial<ManifestModule>;
  if (!sdk.Manifest || typeof sdk.Manifest.fromManifest !== 'function') {
    throw new Error('SDK Release Please não corresponde à API fixada');
  }
  const pin = JSON.parse(readFileSync(join(toolRoot, 'node_modules/release-please/package.json'), 'utf8')) as
    { version?: string };
  if (pin.version !== '17.11.2') throw new Error('SDK Release Please fora do pin 17.11.2');
  return sdk as ManifestModule;
}

async function inspect(context: AdapterContext, options: SnapshotScmOptions) {
  const scm = await createSnapshotScm(context, options);
  scm.assertTargetRef();
  const baseline = scm.profile.baselineVersion;
  const tags: Array<{ name: string; sha: string }> = [];
  for await (const tag of scm.tagIterator()) tags.push(tag);
  const releases: Array<{ tagName: string; sha: string }> = [];
  for await (const release of scm.releaseIterator()) releases.push(release);
  if (baseline) {
    const tag = tags.find(item => item.name === `v${baseline}`);
    const localSha = createGitPort(context.repository).resolveCommit(`refs/tags/v${baseline}`);
    const stableTags = tags.filter(item => /^v\d/.test(item.name) && stable.test(item.name.slice(1)));
    if (!tag || tag.sha !== localSha || stableTags.some(item =>
      item.name !== tag.name && bumpBetween(baseline, item.name.slice(1)) !== 'none') ||
      releases.some(item => item.tagName === `v${baseline}` && item.sha !== tag.sha)) {
      throw new Error('Histórico Release Please diverge da tag/Release base');
    }
  } else if (tags.some(item => /^v\d/.test(item.name)) || releases.some(item => /^v\d/.test(item.tagName))) {
    throw new Error('Histórico Release Please diverge do bootstrap sem baseline');
  }
  const sdk = await loadManifest();
  const manifest = await sdk.Manifest.fromManifest(scm, context.targetBranch);
  const pullRequests = await manifest.buildPullRequests();
  if (pullRequests.length > 1) throw new Error('Release Please gerou mais de um PR para package único');
  const pullRequest = pullRequests[0];
  scm.assertTargetRef();
  const base = { schemaVersion: 1 as const, adapter: 'release-please' as const,
    sha: context.sha.toLowerCase(), branch: context.targetBranch, tagPrefix: 'v' as const };
  if (!pullRequest) {
    return { scm, pullRequest: null, report: { ...base, status: 'no-release' as const,
      native: { tool: 'release-please' as const, version: '17.11.2' as const, title: '',
        explanation: 'Release Please não produziu release elegível', body: '', updatePaths: [] } } };
  }
  const version = pullRequest.version?.toString();
  if (!version || !stable.test(version)) throw new Error('Versão nativa Release Please inválida');
  if (!baseline && version !== '0.0.1') throw new Error('Bootstrap Release Please não gerou 0.0.1');
  const baseVersion = baseline ?? '0.0.0';
  const bump = bumpBetween(baseVersion, version);
  if (bump === 'none') throw new Error('Release Please não incrementou a versão');
  const notes = pullRequest.body.notes();
  if (typeof notes !== 'string') throw new Error('Notas nativas Release Please inválidas');
  const report: ReleasePleaseReport = { ...base, status: 'release', baseVersion,
    candidateVersion: version, tag: `v${version}`, bump,
    native: { tool: 'release-please', version: '17.11.2', title: pullRequest.title.toString(),
      explanation: notes, body: pullRequest.body.toString(),
      updatePaths: pullRequest.updates.map(update => update.path).sort() } };
  return { scm, pullRequest, report };
}

export async function collectReleasePlease(context: AdapterContext,
  dependencies: SnapshotScmOptions): Promise<ReleasePleaseReport> {
  return (await inspect(context, dependencies)).report;
}

const descriptor = validateDescriptor({ id: 'release-please', runtime: 'node', reportKind: 'single',
  needsVersionPr: true, tagKind: 'lightweight', collect: collectReleasePlease,
  prepare: prepareReleasePlease });

export async function prepareReleasePlease(context: AdapterContext, plan: ReleasePlan,
  dependencies: SnapshotScmOptions): Promise<PreparedReleasePlease> {
  const checked = validateReleasePlan(plan);
  if (checked.adapter !== 'release-please' || checked.status !== 'release' ||
    checked.sha !== context.sha.toLowerCase() || checked.branch !== context.targetBranch) {
    throw new Error('Plano Release Please não corresponde ao snapshot');
  }
  const { scm, pullRequest, report } = await inspect(context, dependencies);
  if (!pullRequest || report.status !== 'release' ||
    planFromReport(report, descriptor, '.').planDigest !== checked.planDigest) {
    throw new Error('Plano Release Please diverge do recálculo nativo');
  }
  const files: Array<{ path: string; content: string; baseSha: string | null }> = [];
  for (const update of pullRequest.updates) {
    if (!allowedFiles.has(update.path)) {
      // The Node strategy may suggest optional paths. They are safe only when absent.
      try { await scm.getFileContents(update.path); }
      catch (error) {
        if (!update.createIfMissing && String(error).includes('FileNotFoundError')) continue;
        throw error;
      }
      throw new Error(`Arquivo Release Please não suportado: ${update.path}`);
    }
    let original: { parsedContent: string; sha: string } | null = null;
    try { original = await scm.getFileContents(update.path); }
    catch (error) {
      if (!String(error).includes('FileNotFoundError')) throw error;
      if (!update.createIfMissing) continue;
    }
    const next = update.updater.updateContent(original?.parsedContent);
    if (typeof next !== 'string') throw new Error(`Updater Release Please inválido: ${update.path}`);
    if (next !== original?.parsedContent) {
      files.push({ path: update.path, content: Buffer.from(next, 'utf8').toString('base64'),
        baseSha: original?.sha ?? null });
    }
  }
  const paths = files.map(file => file.path);
  if (new Set(paths).size !== paths.length ||
    !['package.json', 'package-lock.json', '.release-please-manifest.json'].every(path => paths.includes(path))) {
    throw new Error('Release Please não preparou manifests e lockfile esperados');
  }
  const json = (path: string): Record<string, unknown> => {
    const file = files.find(item => item.path === path);
    if (!file) throw new Error(`Release Please não preparou ${path}`);
    const value: unknown = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`JSON nativo Release Please inválido: ${path}`);
    }
    return value as Record<string, unknown>;
  };
  const packageJson = json('package.json');
  const packageLock = json('package-lock.json');
  const manifest = json('.release-please-manifest.json');
  const lockPackages = packageLock.packages as Record<string, Record<string, unknown>> | undefined;
  if (packageJson.version !== report.candidateVersion ||
    packageLock.version !== report.candidateVersion ||
    lockPackages?.['']?.version !== report.candidateVersion ||
    manifest['.'] !== report.candidateVersion) {
    throw new Error('Release Please gerou versões divergentes entre manifest e lockfile');
  }
  const changelog = files.find(file => file.path === 'CHANGELOG.md');
  if (!changelog || !Buffer.from(changelog.content, 'base64').toString('utf8').includes(report.candidateVersion!)) {
    throw new Error('Changelog nativo Release Please não registra a versão');
  }
  scm.assertTargetRef();
  return { version: report.candidateVersion!, title: report.native.title, body: report.native.body,
    files: files.sort((left, right) => left.path.localeCompare(right.path)) };
}
