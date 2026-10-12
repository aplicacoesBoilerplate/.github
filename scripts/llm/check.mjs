import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
for (const file of await readdir(root)) {
  if (!file.endsWith('.mjs')) continue;
  const result = spawnSync(process.execPath, ['--check', root + file], { stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(1);
}
