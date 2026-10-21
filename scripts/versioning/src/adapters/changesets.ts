import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { bumpBetween, planFromReport, validateDescriptor, validateReleasePlan,
  type AdapterContext, type Bump, type ReleasePlan } from '../adapter-contract.js';
import { runProcess, type ProcessRequest, type ProcessResult } from '../ports/process.js';

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const shaPattern = /^[0-9a-f]{40}$/i;

interface NativeRelease { name: string; oldVersion: string; newVersion: string; type: string }
interface NativeStatus { changesets: Array<{ id: string; releases: unknown[] }>;
  releases: NativeRelease[] }
interface BatchRelease { name: string; oldVersion: string; version: string; tag: string; bump: Bump }
export type ChangesetsReport = { schemaVersion: 1; adapter: 'changesets'; sha: string; branch: string;
  tagPrefix: 'v'; releases: BatchRelease[];
  native: { format: 'json'; result: NativeStatus; explanation: string } } &
  ({ status: 'no-release' } | { baseVersion: string; candidateVersion: string;
    tag: string; bump: Bump });

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as Record<string, unknown>;
}

function inside(root: string, path: string): string {
  const base = realpathSync(root);
  const target = realpathSync(path);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) {
    throw new Error('Projeto Changesets fora do workspace');
  }
  return target;
}

function repositoryOf(context: AdapterContext): string {
  if (typeof context.projectPath !== 'string' || !context.projectPath ||
    context.projectPath.startsWith('/') || context.projectPath.includes('\\') ||
    context.projectPath.includes(':') || context.projectPath.split('/').includes('..')) {
    throw new Error('projectPath inválido');
  }
  return inside(context.workspace, join(context.workspace, context.projectPath));
}

function checkContext(context: AdapterContext): string {
  if (context.tagPrefix !== 'v') throw new Error('Changesets usa namespace nativo name@version; prefixo deve ser v');
  if (!shaPattern.test(context.sha)) throw new Error('SHA avaliado inválido');
  if (typeof context.targetBranch !== 'string' || !context.targetBranch) throw new Error('Branch obrigatória');
  if (Object.keys(context.configuration).some(key => key !== 'adapterBin')) {
    throw new Error('Configuração Changesets não permitida');
  }
  const repository = repositoryOf(context);
  if (existsSync(join(repository, '.changeset', 'pre.json'))) {
    throw new Error('Changesets prerelease não suportado');
  }
  return repository;
}

function binary(context: AdapterContext, repository: string): string {
  const configured = context.configuration.adapterBin;
  if (configured !== undefined && (typeof configured !== 'string' || !configured)) {
    throw new Error('adapterBin Changesets inválido');
  }
  return configured ?? join(repository, 'node_modules', '.bin',
    process.platform === 'win32' ? 'changeset.cmd' : 'changeset');
}

function parseStatus(input: string): NativeStatus {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error('JSON nativo Changesets inválido'); }
  const status = record(parsed, 'Plano nativo Changesets');
  if (!Array.isArray(status.changesets) || !Array.isArray(status.releases)) {
    throw new Error('Plano nativo Changesets sem changesets/releases');
  }
  for (const changeset of status.changesets) {
    const item = record(changeset, 'Changeset');
    if (typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id) ||
      !Array.isArray(item.releases)) throw new Error('ID ou releases de Changeset inválidos');
  }
  if (status.releases.length && !status.changesets.length) {
    throw new Error('Release nativa sem changeset de origem');
  }
  return status as unknown as NativeStatus;
}

function normalize(native: NativeStatus): BatchRelease[] {
  const seen = new Set<string>();
  return native.releases.map(value => {
    const item = record(value, 'Release nativa Changesets');
    if (typeof item.name !== 'string' || !packageName.test(item.name) || seen.has(item.name)) {
      throw new Error('Package Changesets inválido ou duplicado');
    }
    seen.add(item.name);
    if (typeof item.oldVersion !== 'string' || !semver.test(item.oldVersion) ||
      typeof item.newVersion !== 'string' || !semver.test(item.newVersion)) {
      throw new Error('Changesets exige versões SemVer estáveis');
    }
    const bump = bumpBetween(item.oldVersion, item.newVersion);
    if (bump === 'none' || !['major', 'minor', 'patch'].includes(String(item.type))) {
      throw new Error('Release Changesets sem incremento válido');
    }
    return { name: item.name, oldVersion: item.oldVersion, version: item.newVersion,
      tag: `${item.name}@${item.newVersion}`, bump };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export function collectChangesets(context: AdapterContext,
  dependencies: { run?: (request: ProcessRequest) => ProcessResult } = {}): ChangesetsReport {
  const repository = checkContext(context);
  const statusFile = `.changeset-status-${randomUUID()}.json`;
  const statusPath = join(repository, statusFile);
  const run = dependencies.run ?? runProcess;
  try {
    const output = run({ command: binary(context, repository), args: ['status', `--output=${statusFile}`],
      cwd: repository, workspace: context.workspace });
    if (!existsSync(statusPath)) throw new Error('Changesets não gerou arquivo de status');
    const native = parseStatus(readFileSync(statusPath, 'utf8'));
    const releases = normalize(native);
    const base = { schemaVersion: 1 as const, adapter: 'changesets' as const,
      sha: context.sha.toLowerCase(), branch: context.targetBranch, tagPrefix: 'v' as const,
      releases, native: { format: 'json' as const, result: native,
        explanation: [output.stdout, output.stderr].filter(Boolean).join('\n') || 'Plano nativo do Changesets' } };
    if (!releases.length) return { ...base, status: 'no-release' };
    const first = releases[0]!;
    return { ...base, baseVersion: first.oldVersion, candidateVersion: first.version,
      tag: first.tag, bump: first.bump };
  } finally {
    rmSync(statusPath, { force: true });
  }
}

function changedFiles(repository: string, workspace: string,
  run: (request: ProcessRequest) => ProcessResult): string[] {
  const tracked = run({ command: 'git', args: ['diff', '--name-only', '-z', 'HEAD'],
    cwd: repository, workspace }).stdout;
  const untracked = run({ command: 'git', args: ['ls-files', '--others', '--exclude-standard', '-z'],
    cwd: repository, workspace }).stdout;
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))].sort();
}

export function prepareChangesets(context: AdapterContext, plan: ReleasePlan,
  dependencies: { run?: (request: ProcessRequest) => ProcessResult } = {}): string[] {
  const checked = validateReleasePlan(plan);
  if (checked.adapter !== 'changesets' || checked.sha !== context.sha.toLowerCase()) {
    throw new Error('Plano Changesets não corresponde à origem');
  }
  const repository = checkContext(context);
  const descriptor = validateDescriptor({ id: 'changesets', runtime: 'node', reportKind: 'batch',
    needsVersionPr: true, tagKind: 'lightweight', collect: collectChangesets, prepare: prepareChangesets });
  const expected = planFromReport(checked.report, descriptor, context.projectPath);
  if (expected.planDigest !== checked.planDigest) throw new Error('Plano Changesets adulterado');
  if (checked.status === 'no-release') return [];
  if (!existsSync(join(repository, 'package-lock.json')) ||
    existsSync(join(repository, 'pnpm-lock.yaml')) || existsSync(join(repository, 'yarn.lock'))) {
    throw new Error('Changesets exige package-lock.json exclusivo antes do preparo');
  }
  const run = dependencies.run ?? runProcess;
  const head = run({ command: 'git', args: ['rev-parse', 'HEAD'],
    cwd: repository, workspace: context.workspace }).stdout.trim();
  if (head.toLowerCase() !== checked.sha) throw new Error('Checkout diverge do SHA funcional');
  run({ command: binary(context, repository), args: ['version'],
    cwd: repository, workspace: context.workspace });
  run({ command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    cwd: repository, workspace: context.workspace });
  return verifyPreparedChangesets(context, checked, dependencies);
}

export function verifyPreparedChangesets(context: AdapterContext, plan: ReleasePlan,
  dependencies: { run?: (request: ProcessRequest) => ProcessResult } = {}): string[] {
  const checked = validateReleasePlan(plan);
  if (checked.adapter !== 'changesets' || checked.sha !== context.sha.toLowerCase() ||
    checked.status !== 'release') throw new Error('Plano Changesets de preparo inválido');
  const repository = checkContext(context);
  const run = dependencies.run ?? runProcess;
  const report = record(checked.report, 'Report Changesets');
  const native = record(record(report.native, 'Native Changesets').result, 'Plano nativo Changesets');
  const allowed = new Set(['package-lock.json']);
  const lock = record(JSON.parse(readFileSync(join(repository, 'package-lock.json'), 'utf8')), 'Lockfile');
  const packages = record(lock.packages, 'Workspaces do lockfile');
  for (const entry of checked.entries) {
    const matches = Object.entries(packages).filter(([, value]) => {
      const item = record(value, 'Pacote no lockfile');
      return item.name === entry.package && item.link !== true;
    });
    if (matches.length !== 1) throw new Error(`Lockfile não identifica ${entry.package} uma vez`);
    const [path, locked] = matches[0]!;
    if (path.startsWith('/') || path.includes('..') || path.startsWith('node_modules/')) {
      throw new Error('Caminho de package inválido no lockfile');
    }
    const manifest = path ? `${path}/package.json` : 'package.json';
    const changelog = path ? `${path}/CHANGELOG.md` : 'CHANGELOG.md';
    const pkg = record(JSON.parse(readFileSync(inside(repository, join(repository, manifest)), 'utf8')),
      'Manifest Changesets');
    if (pkg.name !== entry.package || pkg.version !== entry.version ||
      record(locked, 'Versão no lockfile').version !== entry.version) {
      throw new Error(`Manifest ou lockfile diverge de ${entry.tag}`);
    }
    for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (JSON.stringify(pkg[kind] ?? {}) !== JSON.stringify(record(locked, 'Dependências no lockfile')[kind] ?? {})) {
        throw new Error(`Lockfile diverge das dependências de ${entry.package}`);
      }
    }
    if (!readFileSync(inside(repository, join(repository, changelog)), 'utf8').includes(entry.version)) {
      throw new Error(`Changelog não registra ${entry.tag}`);
    }
    allowed.add(manifest); allowed.add(changelog);
  }
  for (const value of native.changesets as unknown[]) {
    const item = record(value, 'Changeset consumido');
    if (typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id)) {
      throw new Error('ID Changesets inválido');
    }
    const path = `.changeset/${item.id}.md`;
    if (existsSync(join(repository, path))) throw new Error(`Changeset não consumido: ${path}`);
    allowed.add(path);
  }
  const changed = changedFiles(repository, context.workspace, run);
  if (!changed.length || changed.some(path => !allowed.has(path))) {
    throw new Error(`Arquivos Changesets não permitidos: ${changed.filter(path => !allowed.has(path)).join(', ')}`);
  }
  for (const entry of checked.entries) {
    const match = Object.entries(packages).find(([, value]) => record(value, 'Pacote').name === entry.package);
    const manifest = match?.[0] ? `${match[0]}/package.json` : 'package.json';
    if (!changed.includes(manifest)) throw new Error(`Manifest de ${entry.package} não foi alterado`);
  }
  return changed;
}
