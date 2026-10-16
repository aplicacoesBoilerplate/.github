import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
for (const directory of [root, fileURLToPath(new URL('../triage/', import.meta.url))]) {
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.mjs')) continue;
    const result = spawnSync(process.execPath, ['--check', join(directory, file)], { stdio: 'inherit' });
    if (result.error || result.status !== 0) process.exit(1);
  }
}
