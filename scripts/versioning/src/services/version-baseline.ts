import { runProcess } from '../ports/process.js';

const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateTagPrefix(prefix: string): string {
  if (typeof prefix !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(prefix) ||
    prefix.includes('..') || prefix.endsWith('.') || prefix.endsWith('/')) {
    throw new Error(`Prefixo de tag inválido: ${String(prefix)}`);
  }
  return prefix;
}

export function selectReachableStableTag(repository: string, workspace: string,
  sha: string, prefix: string): string | null {
  validateTagPrefix(prefix);
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('SHA avaliado inválido');
  const output = runProcess({ command: 'git', args: ['tag', '--merged', sha],
    cwd: repository, workspace }).stdout;
  const versions = output.split(/\r?\n/).filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length)).filter(tag => stable.test(tag));
  versions.sort((left, right) => {
    const a = left.split('.').map(Number);
    const b = right.split('.').map(Number);
    return (a[0]! - b[0]!) || (a[1]! - b[1]!) || (a[2]! - b[2]!);
  });
  return versions.at(-1) ?? null;
}
