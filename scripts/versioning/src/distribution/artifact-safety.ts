import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createGitPort} from '../ports/git.js';

export interface BuildIdentity {
  readonly sha: string;
  readonly runId: number;
  readonly runAttempt: number;
}
export interface DistributionContext {
  readonly repository: string;
  readonly publishedSha: string;
  readonly expectedTags: readonly string[];
  readonly build: BuildIdentity;
}
export interface ArtifactFile { readonly path: string; readonly sha256: string }
export type RegistryState = 'missing' | 'existing-identical' | 'conflict' | 'unverifiable';
export interface RegistryEntry extends ArtifactFile { readonly coordinate: string; readonly registryState: RegistryState }
export interface DistributionReport {
  readonly schemaVersion: 1;
  readonly publishedSha: string;
  readonly build: BuildIdentity;
  readonly manifestDigest: string;
  readonly status: 'ready' | 'already-distributed' | 'partial-reconciliation-required' | 'blocked' | 'no-distribution';
  readonly distributionAllowed: boolean;
  readonly entries: readonly RegistryEntry[];
}
export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/** Invoke before packaging AND after it. Build receipts are not independent GitHub authorization. */
export function assertDistributionContext(context: DistributionContext): void {
  if (!/^[a-f0-9]{40}$/.test(context.publishedSha) || context.build?.sha !== context.publishedSha ||
      !Number.isSafeInteger(context.build.runId) || context.build.runId < 1 ||
      !Number.isSafeInteger(context.build.runAttempt) || context.build.runAttempt < 1) {
    throw new Error('Identidade de build/SHA inválida');
  }
  const git = createGitPort(context.repository);
  if (git.headSha() !== context.publishedSha) throw new Error('Checkout diverge do published SHA');
  if (!context.expectedTags.length || new Set(context.expectedTags).size !== context.expectedTags.length) {
    throw new Error('Tags esperadas ausentes/duplicadas');
  }
  for (const tag of context.expectedTags) {
    if (git.resolveCommit(`refs/tags/${tag}`) !== context.publishedSha) throw new Error('Tag diverge do published SHA');
  }
  if (execFileSync('git', ['diff', '--name-only', 'HEAD'], {cwd:context.repository, encoding:'utf8'}).trim()) {
    throw new Error('Arquivos rastreados divergem do published SHA');
  }
}

export function readArtifact(root: string, file: ArtifactFile, maxBytes = 64 * 1024 * 1024): Buffer {
  if (typeof file.path !== 'string' || !file.path || isAbsolute(file.path) || file.path.includes('\\') ||
      file.path.includes(':') || file.path.includes('\0') || file.path.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Artifact path inválido');
  }
  const base = resolve(root);
  if (lstatSync(base).isSymbolicLink() || !lstatSync(base).isDirectory() || realpathSync(base) !== base) {
    throw new Error('Staging root contém symlink ou não é diretório real');
  }
  let path = base;
  for (const part of file.path.split('/')) {
    path = join(path, part);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Artifact contém symlink');
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes || relative(base, realpathSync(path)).startsWith('..')) {
    throw new Error('Artifact inválido ou fora do limite');
  }
  const bytes = readFileSync(path);
  if (!/^[a-f0-9]{64}$/.test(file.sha256) || sha256(bytes) !== file.sha256) throw new Error('Artifact digest diverge');
  return bytes;
}

/** A read-only byte lookup must return null only for a confirmed missing coordinate. */
export async function inspectDistribution<T extends ArtifactFile & {readonly coordinate: string}>(
  context: DistributionContext, artifacts: readonly T[],
  lookup: (artifact: T) => Promise<Buffer | null | undefined>,
): Promise<DistributionReport> {
  const entries: RegistryEntry[] = [];
  for (const artifact of artifacts) {
    let registryState: RegistryState;
    try {
      const bytes = await lookup(artifact);
      registryState = bytes === null ? 'missing' : !Buffer.isBuffer(bytes) ? 'unverifiable' :
        sha256(bytes) === artifact.sha256 ? 'existing-identical' : 'conflict';
    } catch { registryState = 'unverifiable'; }
    entries.push({coordinate:artifact.coordinate, path:artifact.path, sha256:artifact.sha256, registryState});
  }
  assertDistributionContext(context);
  const states = new Set(entries.map(e => e.registryState));
  const status = !entries.length ? 'no-distribution' : states.has('conflict') || states.has('unverifiable') ? 'blocked' :
    states.size > 1 ? 'partial-reconciliation-required' : states.has('existing-identical') ? 'already-distributed' : 'ready';
  return {schemaVersion:1, publishedSha:context.publishedSha, build:{...context.build},
    manifestDigest:sha256(JSON.stringify({sha:context.publishedSha, tags:context.expectedTags, build:context.build,
      files:entries.map(({registryState: _state, ...identity}) => identity)})),
    status, distributionAllowed:status === 'ready', entries};
}
