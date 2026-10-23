import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { bumpBetween, type AdapterContext } from '../adapter-contract.js';
import { runProcess, type ProcessRequest, type ProcessResult } from '../ports/process.js';
import { selectReachableStableTag, validateTagPrefix } from '../services/version-baseline.js';

const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function standardVersionBinary(context: AdapterContext): string {
  const configured = context.configuration.adapterBin;
  if (typeof configured === 'string' && configured) return configured;
  const name = process.platform === 'win32' ? 'standard-version.cmd' : 'standard-version';
  const root = join(context.workspace, 'node_modules', '.bin', name);
  return existsSync(root) ? root : join(context.workspace, context.projectPath, 'node_modules', '.bin', name);
}

export interface StandardVersionReport {
  readonly schemaVersion: 1;
  readonly adapter: 'standard-version';
  readonly sha: string;
  readonly branch: string;
  readonly tagPrefix: string;
  readonly baseVersion: string;
  readonly candidateVersion: string;
  readonly tag: string;
  readonly bump: 'major' | 'minor' | 'patch' | 'none';
  readonly native: { readonly format: 'text'; readonly result: { readonly version: string };
    readonly explanation: string };
}

export function collectStandardVersion(context: AdapterContext,
  dependencies: { run?: (request: ProcessRequest) => ProcessResult } = {}): StandardVersionReport {
  const prefix = validateTagPrefix(context.tagPrefix);
  if (!/^[0-9a-f]{40}$/i.test(context.sha)) throw new Error('SHA avaliado inválido');
  if (Object.keys(context.configuration).some(key => key !== 'adapterBin')) {
    throw new Error('Configuração standard-version não permitida');
  }
  const binary = standardVersionBinary(context);
  const repository = join(context.workspace, context.projectPath);
  const run = dependencies.run ?? runProcess;
  const result = run({ command: binary,
    args: ['--dry-run', '--skip.commit', '--skip.tag', '--tag-prefix', prefix],
    cwd: repository, workspace: context.workspace });
  const output = result.stdout + result.stderr;
  const matches = [...output.matchAll(/bumping version in [^\r\n]+? from \S+ to (\S+)/gi)];
  if (!matches.length) throw new Error('standard-version não informou a versão calculada');
  const candidates = new Set(matches.map(match => {
    const value = match[1];
    if (!value || !stable.test(value)) throw new Error(`SemVer estável inválido: ${String(value)}`);
    return value;
  }));
  if (candidates.size !== 1) throw new Error('standard-version informou versões divergentes');
  const candidateVersion = [...candidates][0]!;
  const reachable = selectReachableStableTag(repository, context.workspace, context.sha, prefix);
  const baseVersion = reachable ?? '0.0.0';
  if (!reachable && candidateVersion !== '0.0.1') {
    throw new Error('Sem tag estável, somente 0.0.1 é publicável');
  }
  return { schemaVersion: 1, adapter: 'standard-version', sha: context.sha.toLowerCase(),
    branch: context.targetBranch, tagPrefix: prefix, baseVersion, candidateVersion,
    tag: `${prefix}${candidateVersion}`, bump: bumpBetween(baseVersion, candidateVersion),
    native: { format: 'text', result: { version: candidateVersion }, explanation: output },
  };
}
