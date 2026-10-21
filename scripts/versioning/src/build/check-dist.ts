import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

function filesUnder(root: string): Map<string, Buffer> {
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Distribution root is not a real directory: ${root}`);
  }
  const files = new Map<string, Buffer>();
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symlink in distribution: ${relative(root, path)}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.set(relative(root, path), readFileSync(path));
      else throw new Error(`Unsupported distribution entry: ${relative(root, path)}`);
    }
  };
  visit(root);
  return files;
}

export function verifyDistribution(compiledRoot: string, versionedRoot: string): void {
  const compiled = filesUnder(compiledRoot);
  const versioned = filesUnder(versionedRoot);
  const expectedNames = [...compiled.keys()].sort();
  const actualNames = [...versioned.keys()].sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
    throw new Error(`Distribution file set differs: expected ${expectedNames.join(', ')}, actual ${actualNames.join(', ')}`);
  }
  for (const name of expectedNames) {
    const expected = compiled.get(name);
    const actual = versioned.get(name);
    if (!expected || !actual || !expected.equals(actual)) {
      throw new Error(`Distribution bytes differ: ${name}`);
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  try {
    const [, , compiledRoot, versionedRoot] = process.argv;
    if (!compiledRoot || !versionedRoot) throw new Error('Usage: check-dist <compiled-root> <versioned-root>');
    verifyDistribution(compiledRoot, versionedRoot);
    console.log('Versioned distribution matches isolated TypeScript compilation');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
