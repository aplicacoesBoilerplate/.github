import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { installPinnedMaven } from '../../scripts/versioning/dist/adapters/maven-installer.js';

const root = mkdtempSync(join(tmpdir(), 'typed-maven-install-'));
const githubPath = join(root, 'github-path');
const archiveBytes = Buffer.from('fixture archive');
const checksum = createHash('sha512').update(archiveBytes).digest('hex');
try {
  let tarCalled = false;
  const run = request => {
    if (request.command === 'curl') {
      const destination = request.args.at(-1);
      writeFileSync(destination, archiveBytes);
    } else if (request.command === 'tar') {
      tarCalled = true;
      const destination = request.args[request.args.indexOf('-C') + 1];
      mkdirSync(join(destination, 'bin'), { recursive: true });
      writeFileSync(join(destination, 'bin', 'mvn'), 'fixture');
    } else throw Error('unexpected command');
    return { stdout: '', stderr: '' };
  };
  const installed = installPinnedMaven({ runnerTemp: root, githubPath }, { run, expectedSha512: checksum });
  assert.equal(tarCalled, true);
  assert.equal(readFileSync(githubPath, 'utf8').trim(), installed.bin);
  assert.equal(existsSync(join(installed.bin, 'mvn')), true);
  const before = readFileSync(githubPath, 'utf8');
  tarCalled = false;
  assert.throws(() => installPinnedMaven({ runnerTemp: root, githubPath },
    { run, expectedSha512: '0'.repeat(128) }), /checksum/i);
  assert.equal(tarCalled, false);
  assert.equal(readFileSync(githubPath, 'utf8'), before);
  console.log('Typed Maven installer: checksum gates extraction and PATH mutation');
} finally { rmSync(root, { recursive: true, force: true }); }
