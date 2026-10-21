import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const project = resolve(import.meta.dirname, '../../scripts/versioning');
const compiler = resolve(project, 'node_modules/typescript/bin/tsc');
const fixture = resolve(project, 'type-tests/adapter-contract.ts');
const result = spawnSync(process.execPath, [compiler, '--noEmit', '--strict', '--noUncheckedIndexedAccess',
  '--exactOptionalPropertyTypes', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
  '--target', 'ES2022', '--types', 'node', fixture], { cwd: project, encoding: 'utf8' });
assert.equal(result.status, 0, result.stdout + result.stderr);
console.log('Type contracts: incompatible contexts and capabilities rejected by TypeScript');
