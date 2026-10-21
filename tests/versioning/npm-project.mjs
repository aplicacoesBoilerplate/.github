import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installNpmDependencies, synchronizeNpmLock } from '../../scripts/versioning/dist/adapters/npm-project.js';

const workspace = mkdtempSync(join(tmpdir(), 'npm-project-'));
try {
  const project = join(workspace, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{"name":"fixture","version":"1.0.1"}\n');
  writeFileSync(join(project, 'package-lock.json'), JSON.stringify({
    version: '1.0.0', packages: { '': { version: '1.0.0' } },
  }, null, 2) + '\n');
  let request;
  installNpmDependencies({ workspace, projectPath: 'project' }, { run: value => {
    request = value; return { stdout: '', stderr: '' };
  } });
  assert.equal(request.cwd, project);
  assert.deepEqual(request.args, ['ci', '--ignore-scripts']);
  writeFileSync(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  assert.throws(() => installNpmDependencies({ workspace, projectPath: 'project' },
    { run: () => { throw Error('should not execute'); } }), /apenas lockfile npm/);
  rmSync(join(project, 'pnpm-lock.yaml'));
  synchronizeNpmLock({ lockPath: join(project, 'package-lock.json'), projectPath: '.',
    packagePath: join(project, 'package.json') });
  const lock = JSON.parse(readFileSync(join(project, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, '1.0.1');
  assert.equal(lock.packages[''].version, '1.0.1');
  assert.throws(() => synchronizeNpmLock({ lockPath: join(project, 'package-lock.json'),
    projectPath: '../outside', packagePath: join(project, 'package.json') }), /projectPath/);
  console.log('Npm project: lockfile-only install and native version lock synchronization');
} finally { rmSync(workspace, { recursive: true, force: true }); }
