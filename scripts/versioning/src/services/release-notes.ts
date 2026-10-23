import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

/** Optional caller-configured text, never executable code or an alternate version source. */
export function readChangelog(repository: string, path: string): string {
  if (!path) return '';
  if (isAbsolute(path) || path.includes(':') || path.includes('\\') ||
    path.split('/').includes('..')) {
    throw new Error('changelog_path deve ser relativo ao repositório');
  }
  const root = realpathSync(repository), candidate = join(root, path);
  if (!existsSync(candidate)) return '';
  const resolved = realpathSync(candidate), location = relative(root, resolved);
  if (!location || location === '..' || location.startsWith('../') ||
    location.startsWith('..\\') || isAbsolute(location) || !statSync(resolved).isFile()) {
    throw new Error('Changelog fora do repositório ou não regular');
  }
  return readFileSync(resolved, 'utf8');
}
