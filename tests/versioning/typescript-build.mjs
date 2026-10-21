import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = resolve(import.meta.dirname, '../../scripts/versioning');
const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(project, 'tsconfig.json'), 'utf8'));
assert.equal(manifest.private, true);
assert.equal(manifest.type, 'module');
assert.equal(manifest.bin, undefined);
assert.equal(manifest.scripts.typecheck, 'tsc --noEmit');
assert.equal(manifest.scripts.build, 'tsc');
assert.ok(manifest.devDependencies.typescript);
assert.ok(manifest.devDependencies['@types/node']);
assert.equal(config.compilerOptions.strict, true);
assert.equal(config.compilerOptions.noEmitOnError, true);
assert.equal(config.compilerOptions.module, 'NodeNext');
assert.equal(config.compilerOptions.moduleResolution, 'NodeNext');
assert.equal(config.compilerOptions.target, 'ES2022');
assert.equal(config.compilerOptions.noUncheckedIndexedAccess, true);
assert.equal(config.compilerOptions.exactOptionalPropertyTypes, true);
assert.equal(config.compilerOptions.rootDir, 'src');
assert.equal(config.compilerOptions.outDir, 'dist');

const compiler = join(project, 'node_modules/typescript/bin/tsc');
assert.ok(existsSync(compiler), 'Install the central TypeScript toolchain before running this fixture');
const scratch = mkdtempSync(join(tmpdir(), 'versioning-ts-build-'));
try {
  mkdirSync(join(scratch, 'src'));
  writeFileSync(join(scratch, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      ...config.compilerOptions,
      types: [],
      rootDir: 'src',
      outDir: 'dist',
    },
    include: ['src/**/*.ts'],
  }));
  writeFileSync(join(scratch, 'src/constant.ts'), 'export const base: number = 40;\n');
  writeFileSync(join(scratch, 'src/main.ts'), "import { base } from './constant.js';\nexport const result: number = base + 2;\n");
  const compile = () => spawnSync(process.execPath, [compiler, '--project', join(scratch, 'tsconfig.json')], {
    encoding: 'utf8', env: process.env,
  });
  const valid = compile();
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.ok(existsSync(join(scratch, 'dist/main.js')));
  assert.equal((await import(pathToFileURL(join(scratch, 'dist/main.js')).href)).result, 42);

  rmSync(join(scratch, 'dist'), { recursive: true });
  writeFileSync(join(scratch, 'src/main.ts'), 'export const result: number = "bad";\n');
  const invalid = compile();
  assert.notEqual(invalid.status, 0, 'A type error must fail compilation');
  assert.match(invalid.stdout + invalid.stderr, /TS2322/);
  assert.equal(existsSync(join(scratch, 'dist')), false, 'noEmitOnError must prevent output');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log('TypeScript toolchain: strict config, ESM output, type failure and no emit passed');
