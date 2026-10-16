import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { contractError, readTrustedFile, validateRelativePath } from './validate-request.mjs';

const defaultGlobal = fileURLToPath(new URL('./instructions/AGENTS.md', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function prepareInstructions(root, global = defaultGlobal, limit = 65536, { cwd = '.' } = {}) {
  try {
    if (!Number.isInteger(limit) || limit < 1 || limit > 65536) throw contractError('INSTRUCTIONS_INVALID');
    const base = await realpath(root);
    const segments = cwd === '.' ? [] : validateRelativePath(cwd).split('/');
    let current = base;
    for (const segment of segments) {
      current = join(current, segment);
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw contractError('INSTRUCTIONS_INVALID');
    }
    const rel = relative(base, await realpath(current));
    if (isAbsolute(rel) || rel.startsWith('..')) throw contractError('INSTRUCTIONS_INVALID');
    const globalInfo = await lstat(global);
    if (!globalInfo.isFile() || globalInfo.isSymbolicLink() || globalInfo.size > limit) throw contractError('INSTRUCTIONS_INVALID');
    const globalBytes = await readFile(global);
    if (!globalBytes.length) throw contractError('INSTRUCTIONS_INVALID');
    if (global === defaultGlobal) {
      const recorded = JSON.parse(await readFile(new URL('./instructions/provenance.json', import.meta.url), 'utf8'));
      if (recorded.sha256 !== hash(globalBytes) || recorded.bytes !== globalBytes.length) throw contractError('INSTRUCTIONS_INVALID');
    }
    const chunks = [globalBytes];
    const sources = [{ path: 'global/AGENTS.md', sha256: hash(globalBytes), bytes: globalBytes.length }];
    let total = globalBytes.length;
    for (let depth = 0; depth <= segments.length; depth++) {
      const dir = segments.slice(0, depth).join('/');
      for (const filename of ['AGENTS.override.md', 'AGENTS.md']) {
        const path = dir ? `${dir}/${filename}` : filename;
        try { await lstat(join(base, path)); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        const bytes = await readTrustedFile(base, path, limit, 'INSTRUCTIONS_INVALID');
        if (!bytes.length) continue;
        total += 2 + bytes.length;
        if (total > limit) throw contractError('INSTRUCTIONS_INVALID');
        chunks.push(Buffer.from('\n\n'), bytes);
        sources.push({ path, sha256: hash(bytes), bytes: bytes.length });
        break;
      }
    }
    const combined = Buffer.concat(chunks);
    if (combined.length > limit) throw contractError('INSTRUCTIONS_INVALID');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(combined);
    return { content, bytes: combined.length, sha256: hash(combined), sources };
  } catch { throw contractError('INSTRUCTIONS_INVALID'); }
}
