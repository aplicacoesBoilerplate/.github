import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { validateReleasePlan, type ReleasePlan } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';

const BYTE_LIMIT = 10 * 1024 * 1024;
const SERIALIZED_LIMIT = 16 * 1024 * 1024;
const RELEASE_LIMIT = 100;
const OPERATION_LIMIT = 1000;
const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[0-9a-f]{64}$/;
const rpFiles = new Set(['package.json', 'package-lock.json', 'CHANGELOG.md',
  '.release-please-manifest.json']);

export interface VersionFileOperation {
  readonly op: 'write' | 'delete';
  readonly path: string;
  readonly before: string | null;
  readonly after?: string;
  readonly content?: string;
}
export interface VersionFilesBundle {
  readonly schemaVersion: 2;
  readonly adapter: 'changesets' | 'release-please';
  readonly sha: string;
  readonly projectPath: string;
  readonly planDigest: string;
  readonly configHash: string;
  readonly lockHash: string;
  readonly releaseCount: number;
  readonly operations: readonly VersionFileOperation[];
}
export interface VersionFilesRequest {
  readonly repository: string;
  readonly plan: ReleasePlan;
  readonly trustedAllowedWrites?: readonly string[];
}
export interface CaptureVersionFilesRequest extends VersionFilesRequest {
  readonly operations: readonly ({ op: 'write'; path: string; content: string } |
    { op: 'delete'; path: string })[];
}

export function withinVersionFileLimits(value: { bytes: number; serialized: number;
  releases: number; operations: number }): boolean {
  return Number.isSafeInteger(value.bytes) && value.bytes >= 0 && value.bytes <= BYTE_LIMIT &&
    Number.isSafeInteger(value.serialized) && value.serialized >= 0 &&
    value.serialized <= SERIALIZED_LIMIT && Number.isSafeInteger(value.releases) &&
    value.releases >= 0 && value.releases <= RELEASE_LIMIT &&
    Number.isSafeInteger(value.operations) && value.operations >= 0 &&
    value.operations <= OPERATION_LIMIT;
}

function checkedPath(value: string): string {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') ||
    value.includes(':') || value.includes('\0') ||
    value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Bundle path inválido');
  }
  return value;
}

function inside(root: string, path: string): string {
  checkedPath(path);
  const target = join(root, ...path.split('/'));
  const rel = relative(root, target);
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) {
    throw new Error('Bundle path fora do repositório');
  }
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('Bundle symlink não permitido');
      if (current === target && !stat.isFile()) throw new Error('Bundle arquivo não regular');
      if (current !== target && !stat.isDirectory()) throw new Error('Bundle ancestral não diretório');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return target;
}

function baseBytes(root: string, sha: string, path: string): Buffer | null {
  const entry = execFileSync('git', ['ls-tree', '-z', sha, '--', path], { cwd: root });
  if (!entry.length) return null;
  if (!/^100(?:644|755) blob /.test(entry.toString('utf8'))) {
    throw new Error('Bundle base não é arquivo regular');
  }
  return createGitPort(root).readBlob(sha, path);
}

function requiredIdentity(request: VersionFilesRequest, requireHead = true) {
  const root = realpathSync(request.repository);
  const plan = validateReleasePlan(request.plan);
  if (plan.status !== 'release' ||
    (plan.adapter !== 'changesets' && plan.adapter !== 'release-please')) {
    throw new Error('Bundle schema2 exige plano de files adapter');
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (requireHead && head !== plan.sha) throw new Error('Bundle SHA não corresponde ao checkout');
  const paths = new Set(plan.entries.map(entry => entry.projectPath));
  if (paths.size !== 1) throw new Error('Bundle exige um projeto por plano');
  const projectPath = [...paths][0]!;
  if (projectPath !== '.') checkedPath(projectPath);
  if (plan.adapter === 'release-please' && projectPath !== '.') {
    throw new Error('Release Please exige projeto raiz');
  }
  const configPath = plan.adapter === 'release-please' ? 'release-please-config.json' : '.changeset/config.json';
  const config = baseBytes(root, plan.sha, configPath);
  const lock = baseBytes(root, plan.sha, 'package-lock.json');
  if (!config || !lock) throw new Error('Bundle exige configuração e lockfile do snapshot');
  return { root, plan, projectPath, configHash: digest(config), lockHash: digest(lock) };
}

function decoded(value: string): Buffer {
  if (typeof value !== 'string' || value.length % 4 !== 0 ||
    value.length > Math.ceil(BYTE_LIMIT / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('Bundle conteúdo base64 inválido');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('Bundle conteúdo base64 não canônico');
  return bytes;
}

function consumedChangesets(plan: ReleasePlan): Set<string> {
  const report = plan.report as { native?: { result?: { changesets?: Array<{ id: string }> } } };
  const ids = report?.native?.result?.changesets;
  if (!Array.isArray(ids)) throw new Error('Bundle Changesets sem lista nativa de changesets');
  return new Set(ids.map(item => {
    if (typeof item?.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id)) {
      throw new Error('ID Changesets inválido');
    }
    return `.changeset/${item.id}.md`;
  }));
}

function policy(path: string, op: 'write' | 'delete', plan: ReleasePlan,
  trustedAllowedWrites?: readonly string[]): void {
  if (plan.adapter === 'release-please') {
    if (op !== 'write') throw new Error(`Exclusão Release Please não autorizada: ${path}`);
    if (!rpFiles.has(path)) throw new Error(`Arquivo Release Please não permitido: ${path}`);
    return;
  }
  if (op === 'delete') {
    if (!consumedChangesets(plan).has(path)) throw new Error(`Exclusão Changesets não autorizada: ${path}`);
    return;
  }
  if (!(path === 'package-lock.json' || path === 'package.json' || path === 'CHANGELOG.md' ||
    path.endsWith('/package.json') || path.endsWith('/CHANGELOG.md')) ||
    !trustedAllowedWrites || !trustedAllowedWrites.includes(path)) {
    throw new Error(`Arquivo Changesets não permitido: ${path}`);
  }
}

function semantic(plan: ReleasePlan, records: Map<string, Buffer>): void {
  if (plan.adapter === 'release-please') {
    const version = plan.entries[0]!.version;
    const json = (path: string) => JSON.parse((records.get(path) ?? Buffer.from('null')).toString('utf8')) as
      Record<string, unknown> | null;
    const pkg = json('package.json');
    const lock = json('package-lock.json');
    const manifest = json('.release-please-manifest.json');
    const heading = new RegExp(`(?:^|\\n)#{1,3}\\s+\\[?${version.replaceAll('.', '\\.')}\\]?(?:\\s|$|\\()`);
    if (pkg?.version !== version || lock?.version !== version ||
      (lock?.packages as Record<string, { version?: string }> | undefined)?.['']?.version !== version ||
      manifest?.['.'] !== version || !heading.test(records.get('CHANGELOG.md')?.toString('utf8') ?? '')) {
      throw new Error('Bundle Release Please diverge da versão planejada');
    }
    return;
  }
  const lock = JSON.parse((records.get('package-lock.json') ?? Buffer.from('null')).toString('utf8')) as
    { packages?: Record<string, { name?: string; version?: string }> } | null;
  if (!lock?.packages) throw new Error('Bundle Changesets sem lockfile');
  for (const entry of plan.entries) {
    const packageRecord = [...records.entries()].find(([path, bytes]) => path.endsWith('/package.json') ||
      path === 'package.json' ? (() => { try { return JSON.parse(bytes.toString('utf8')).name === entry.package; }
        catch { return false; } })() : false);
    if (!packageRecord) throw new Error(`Bundle Changesets sem manifest de ${entry.package}`);
    const pkg = JSON.parse(packageRecord[1].toString('utf8')) as { version?: string };
    const matchingLock = Object.values(lock.packages).filter(value => value.name === entry.package &&
      value.version === entry.version);
    const changelogPath = packageRecord[0].replace(/package\.json$/, 'CHANGELOG.md');
    if (pkg.version !== entry.version || matchingLock.length !== 1 ||
      !records.get(changelogPath)?.toString('utf8').includes(entry.version)) {
      throw new Error(`Bundle Changesets diverge de ${entry.tag}`);
    }
  }
}

export function captureVersionFiles(request: CaptureVersionFilesRequest): VersionFilesBundle {
  const identity = requiredIdentity(request);
  if (!Array.isArray(request.operations) || !request.operations.length ||
    request.operations.length > OPERATION_LIMIT || identity.plan.entries.length > RELEASE_LIMIT) {
    throw new Error('Bundle excede limite de operações ou releases');
  }
  const operations = request.operations.map(item => {
    const path = checkedPath(item.path);
    const before = baseBytes(identity.root, identity.plan.sha, path);
    if (item.op === 'delete') return { op: 'delete' as const, path, before: before ? digest(before) : null };
    const bytes = decoded(item.content);
    return { op: 'write' as const, path, before: before ? digest(before) : null,
      after: digest(bytes), content: item.content };
  });
  const bundle: VersionFilesBundle = { schemaVersion: 2,
    adapter: identity.plan.adapter as 'changesets' | 'release-please',
    sha: identity.plan.sha, projectPath: identity.projectPath, planDigest: identity.plan.planDigest,
    configHash: identity.configHash, lockHash: identity.lockHash,
    releaseCount: identity.plan.entries.length, operations };
  validateVersionFiles({ ...request, bundle }, false);
  return bundle;
}

export function validateVersionFiles(request: VersionFilesRequest & { bundle: VersionFilesBundle },
  checkWorking = false, requireHead = true): true {
  const { root, plan, projectPath, configHash, lockHash } = requiredIdentity(request, requireHead);
  const bundle = request.bundle;
  if (!bundle || bundle.schemaVersion !== 2 || bundle.adapter !== plan.adapter ||
    bundle.sha !== plan.sha || bundle.planDigest !== plan.planDigest ||
    bundle.projectPath !== projectPath || bundle.configHash !== configHash ||
    bundle.lockHash !== lockHash || bundle.releaseCount !== plan.entries.length ||
    Object.keys(bundle).some(key => !['schemaVersion', 'adapter', 'sha', 'projectPath',
      'planDigest', 'configHash', 'lockHash', 'releaseCount', 'operations'].includes(key))) {
    throw new Error('Bundle identidade/schema/digest divergente');
  }
  const serialized = Buffer.byteLength(JSON.stringify(bundle), 'utf8');
  if (!Array.isArray(bundle.operations) || !bundle.operations.length ||
    !withinVersionFileLimits({ bytes: 0, serialized, releases: plan.entries.length,
      operations: bundle.operations.length })) throw new Error('Bundle excede limites de tamanho ou contagem');
  const seen = new Set<string>();
  const records = new Map<string, Buffer>();
  let bytesTotal = 0;
  for (const item of bundle.operations) {
    if (!item || (item.op !== 'write' && item.op !== 'delete')) throw new Error('Bundle operação inválida');
    const path = checkedPath(item.path);
    if (seen.has(path)) throw new Error('Bundle path duplicado');
    seen.add(path);
    const target = inside(root, path);
    policy(path, item.op, plan, request.trustedAllowedWrites);
    const base = baseBytes(root, plan.sha, path);
    const before = base ? digest(base) : null;
    if (item.before !== before) throw new Error('Bundle base divergente');
    if (checkWorking) {
      const working = existsSync(target) ? digest(readFileSync(target)) : null;
      if (working !== before) throw new Error('Checkout base divergente');
    }
    if (item.op === 'delete') {
      if (!base || item.after !== undefined || item.content !== undefined ||
        Object.keys(item).some(key => !['op', 'path', 'before'].includes(key))) {
        throw new Error('Bundle exclusão inválida');
      }
      continue;
    }
    if (Object.keys(item).some(key => !['op', 'path', 'before', 'after', 'content'].includes(key)) ||
      typeof item.content !== 'string' || typeof item.after !== 'string' ||
      !hashPattern.test(item.after)) throw new Error('Bundle escrita inválida');
    const bytes = decoded(item.content);
    bytesTotal += bytes.length;
    if (bytesTotal > BYTE_LIMIT) throw new Error('Bundle excede limite de 10MiB');
    if (digest(bytes) !== item.after) throw new Error('Bundle hash posterior divergente');
    records.set(path, bytes);
  }
  semantic(plan, records);
  return true;
}

export function applyVersionFiles(request: VersionFilesRequest & { bundle: VersionFilesBundle }): string[] {
  validateVersionFiles(request, true);
  const root = realpathSync(request.repository);
  for (const item of request.bundle.operations) {
    const target = inside(root, item.path);
    if (item.op === 'delete') rmSync(target);
    else writeFileSync(target, decoded(item.content!));
  }
  return request.bundle.operations.map(item => item.path);
}

export async function validateLegacyVersionFiles(request: { repository: string; projectPath: string;
  report: unknown; bundle: unknown }): Promise<true> {
  const module = await import(new URL('../../version-bundle.mjs', import.meta.url).href) as
    { validateVersionBundle: (value: typeof request) => true };
  return module.validateVersionBundle(request);
}
