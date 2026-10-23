import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const reader = readFileSync(resolve(root,
  'scripts/versioning/src/entrypoints/prepare-publication.ts'), 'utf8');
assert.doesNotMatch(reader, /\.mjs['"]/,
  'the reader must capture the schema1 bundle in typed code, not a handwritten JS bridge');
for (const name of ['version-report', 'version-bundle', 'version-pr', 'verify-version-files']) {
  const source = readFileSync(resolve(root, `scripts/versioning/${name}.mjs`), 'utf8');
  assert.doesNotMatch(source, /(?:function\s|=>|try\s*\{|catch\s*\()/,
    `${name} is only a compatibility facade; business logic lives in TypeScript`);
}
for (const name of ['collect-version-report', 'install-node', 'install-maven', 'sync-npm-lock',
  'git-inputs', 'homologation-guide', 'release-policy', 'version-pr', 'version-bundle', 'verify-version-files']) {
  const url = pathToFileURL(resolve(root, `scripts/versioning/${name}.mjs`)).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`],
    { encoding: 'utf8', env: { ...process.env, NODE_PACKAGE_MANAGER: 'invalid-import-sentinel' } });
  assert.equal(result.status, 0, `${name} import must not execute its CLI: ${result.stderr}`);
  assert.equal(result.stdout, '', `${name} import must not emit outputs`);
  assert.equal(result.stderr, '', `${name} import must not install tools or inspect host state`);
}
console.log('Legacy TypeScript boundary: native report and schema1 have no handwritten JS bridge');
