import { join } from 'node:path';
import { bumpBetween } from '../adapter-contract.js';
import type { AdapterContext } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';
import { runProcess, type ProcessRequest, type ProcessResult } from '../ports/process.js';
import { selectReachableStableTag } from '../services/version-baseline.js';

const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const shaPattern = /^[0-9a-f]{40}$/i;

export interface GoVersionReport {
  readonly schemaVersion: 1;
  readonly adapter: 'go-gitsemver';
  readonly sha: string;
  readonly branch: string;
  readonly baseVersion: string;
  readonly candidateVersion: string;
  readonly tag: string;
  readonly bump: 'major' | 'minor' | 'patch' | 'none';
  readonly native: { readonly format: 'json'; readonly result: Record<string, unknown>;
    readonly explanation: string };
}

function version(value: unknown): string {
  if (typeof value !== 'string' || !stableSemver.test(value)) {
    throw new Error(`SemVer estável inválido: ${String(value)}`);
  }
  return value;
}

export function collectGoVersion(context: AdapterContext,
  dependencies: { run?: (request: ProcessRequest) => ProcessResult } = {}): GoVersionReport {
  if (context.tagPrefix !== 'v') throw new Error('go-gitsemver usa prefixo v neste contrato');
  if (!shaPattern.test(context.sha)) throw new Error('SHA avaliado inválido');
  const repository = join(context.workspace, context.projectPath);
  const run = dependencies.run ?? runProcess;
  const binary = typeof context.configuration.adapterBin === 'string' &&
    context.configuration.adapterBin ? context.configuration.adapterBin : 'go-gitsemver';
  const native = run({ command: binary,
    args: ['--branch', context.targetBranch, '--commit', context.sha, '-o', 'json', '--explain'],
    cwd: repository, workspace: context.workspace });
  let result: unknown;
  try { result = JSON.parse(native.stdout); }
  catch { throw new Error('JSON nativo inválido'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('JSON nativo inválido');
  }
  const data = result as Record<string, unknown>;
  const candidateVersion = version(data.SemVer);
  if (data.Sha === '') {
    let taggedSha: string;
    try { taggedSha = createGitPort(repository).resolveCommit(`refs/tags/v${candidateVersion}`); }
    catch { throw new Error(`SHA nativo vazio e não há tag v${candidateVersion} no checkout`); }
    if (taggedSha.toLowerCase() !== context.sha.toLowerCase()) {
      throw new Error(`SHA nativo vazio e a tag v${candidateVersion} não aponta para ${context.sha}`);
    }
  } else if (typeof data.Sha !== 'string' || data.Sha.toLowerCase() !== context.sha.toLowerCase()) {
    throw new Error(`SHA calculado diverge do SHA avaliado: ${String(data.Sha ?? '<ausente>')} != ${context.sha}`);
  }
  const reachable = selectReachableStableTag(repository, context.workspace, context.sha, 'v');
  const baseVersion = reachable ?? '0.0.0';
  if (!reachable && candidateVersion !== '0.0.1') {
    throw new Error(`Sem tag estável, somente 0.0.1 é publicável; recebido ${candidateVersion}`);
  }
  return {
    schemaVersion: 1, adapter: 'go-gitsemver', sha: context.sha.toLowerCase(),
    branch: context.targetBranch, baseVersion, candidateVersion,
    tag: `v${candidateVersion}`, bump: bumpBetween(baseVersion, candidateVersion),
    native: { format: 'json', result: data, explanation: native.stderr },
  };
}
