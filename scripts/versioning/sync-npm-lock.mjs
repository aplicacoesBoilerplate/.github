import { readFileSync, writeFileSync } from 'node:fs';

const [lockPath, projectPath, packagePath] = process.argv.slice(2);
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const original = readFileSync(lockPath, 'utf8');
const lock = JSON.parse(original);
const key = projectPath === '.' ? '' : projectPath.replace(/^\.\//, '').replace(/\/$/, '');
if (!lock.packages?.[key] || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw Error(`Lockfile não contém pacote versionado ${key || '(raiz)'}`);
}
lock.packages[key].version = pkg.version;
if (!key) lock.version = pkg.version;
const indent = /\n( +)"/.exec(original)?.[1]?.length ?? 2;
writeFileSync(lockPath, JSON.stringify(lock, null, indent) + '\n');
