import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const project = resolve(import.meta.dirname, '../../scripts/versioning');
const source = join(project, 'src');
const distributed = join(project, 'dist');
const compiler = join(project, 'node_modules/typescript/bin/tsc');
const scratch = mkdtempSync(join(tmpdir(), 'versioning-dist-'));
const run = (script, expected, actual) => spawnSync(process.execPath, [script, expected, actual], {
  encoding: 'utf8', env: process.env,
});
const contents = directory => readdirSync(directory, { recursive: true }).sort().map(file =>
  `${file}:${readFileSync(join(directory, file)).toString('hex')}`);

try {
  assert.ok(existsSync(join(source, 'build/check-dist.ts')), 'The dist verifier must be TypeScript source');
  writeFileSync(join(scratch, 'package.json'), '{"type":"module"}\n');
  const compile = target => {
    const result = spawnSync(process.execPath, [compiler, '--project', join(project, 'tsconfig.json'), '--outDir', target], {
      encoding: 'utf8', env: process.env,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const first = join(scratch, 'first');
  const second = join(scratch, 'second');
  compile(first);
  compile(second);
  const checker = join(first, 'build/check-dist.js');
  assert.ok(existsSync(checker));
  assert.deepEqual(contents(join(first, 'build')), contents(join(second, 'build')));
  assert.equal(run(checker, first, distributed).status, 0, 'Versioned dist must match isolated compilation');

  const copy = label => {
    const directory = join(scratch, label);
    cpSync(distributed, directory, { recursive: true });
    return directory;
  };
  const changed = copy('changed');
  appendFileSync(join(changed, 'index.js'), '// unexpected byte\n');
  assert.notEqual(run(checker, first, changed).status, 0, 'Changed bytes must fail');
  const missing = copy('missing');
  rmSync(join(missing, 'index.js'));
  assert.notEqual(run(checker, first, missing).status, 0, 'Missing file must fail');
  const extra = copy('extra');
  writeFileSync(join(extra, 'extra.js'), 'export {};\n');
  assert.notEqual(run(checker, first, extra).status, 0, 'Extra file must fail');
  const linked = copy('linked');
  symlinkSync(distributed, join(linked, 'linked-dir'), 'junction');
  const symlinkCheck = run(checker, first, linked);
  assert.notEqual(symlinkCheck.status, 0, 'Symlink must fail even if target bytes match');
  assert.match(symlinkCheck.stderr, /Symlink in distribution/);
  assert.equal(run(checker, second, distributed).status, 0, 'Repeat compilation must match');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log('Dist integrity: exact bytes, missing/extra, symlink and repeatability passed');
