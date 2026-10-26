import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_DIR = path.resolve(SCRIPTS_DIR, '..');
const COMMITLINT_CLI = path.join(REPOSITORY_DIR, 'node_modules/@commitlint/cli/cli.js');
const COMMITLINT_CONFIG = path.join(REPOSITORY_DIR, 'config/commitlint/commitlint.config.cjs');

test('commitlint bloqueia uma mensagem completa sem Conventional Commits e aceita uma mensagem completa válida', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'commitlint-test-'));

  try {
    const invalidMessageFile = path.join(temporaryDirectory, 'invalid.msg');
    const validMessageFile = path.join(temporaryDirectory, 'valid.msg');

    fs.writeFileSync(
      invalidMessageFile,
      'Atualiza o versionamento das aplicações\n\nDescreve a atualização dos adaptadores.\n\nRefs: #123\n',
    );
    fs.writeFileSync(
      validMessageFile,
      'feat(versionamento): atualiza os adaptadores\n\nDescreve a atualização dos adaptadores.\n\nRefs: #123\n',
    );

    const lintMessage = (messageFile: string) =>
      spawnSync(process.execPath, [COMMITLINT_CLI, '--config', COMMITLINT_CONFIG, '--edit', messageFile], {
        cwd: REPOSITORY_DIR,
        encoding: 'utf8',
      });

    const invalidResult = lintMessage(invalidMessageFile);
    assert.ifError(invalidResult.error);
    assert.equal(invalidResult.status, 1, invalidResult.stderr || invalidResult.stdout);
    assert.match(invalidResult.stdout + invalidResult.stderr, /type-empty/);

    const validResult = lintMessage(validMessageFile);
    assert.ifError(validResult.error);
    assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
