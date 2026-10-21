import { readFileSync, writeFileSync } from 'node:fs';
import { captureGitInputs, verifyGitInputs } from './dist/ports/git.js';

export { captureGitInputs, verifyGitInputs };

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [mode, repository, path, sha, tag, adapter] = process.argv.slice(2);
    if (mode === 'capture') {
      writeFileSync(path, JSON.stringify(captureGitInputs(repository, sha), null, 2) + '\n');
    } else if (mode === 'verify') {
      verifyGitInputs(repository, JSON.parse(readFileSync(path, 'utf8')), sha, tag, adapter);
    } else {
      throw new Error('Modo de snapshot Git inválido');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
