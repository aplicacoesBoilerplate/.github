import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, dirname } from 'node:path';
import { runProcess } from '../ports/process.js';
function inside(root, target) {
    const base = realpathSync(root);
    const path = realpathSync(target);
    const rel = relative(base, path);
    if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) {
        throw new Error('Projeto fora do workspace');
    }
    return path;
}
function projectPath(value) {
    if (typeof value !== 'string' || !value || value.startsWith('/') ||
        value.includes('\\') || value.includes(':') || value.split('/').includes('..')) {
        throw new Error('projectPath inválido');
    }
    return value === '.' ? '' : value.replace(/^\.\//, '').replace(/\/$/, '');
}
export function installNpmDependencies(options, dependencies = {}) {
    const key = projectPath(options.projectPath);
    const directory = inside(options.workspace, join(options.workspace, key));
    if (!existsSync(join(directory, 'package-lock.json')) &&
        !existsSync(join(directory, 'npm-shrinkwrap.json'))) {
        throw new Error('standard-version exige package-lock.json ou npm-shrinkwrap.json no projeto');
    }
    if (existsSync(join(directory, 'pnpm-lock.yaml')) || existsSync(join(directory, 'yarn.lock'))) {
        throw new Error('standard-version aceita apenas lockfile npm');
    }
    (dependencies.run ?? runProcess)({ command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['ci', '--ignore-scripts'], cwd: directory, workspace: options.workspace });
}
export function synchronizeNpmLock(options) {
    const key = projectPath(options.projectPath);
    const lockPath = realpathSync(options.lockPath);
    const root = dirname(lockPath);
    const packagePath = inside(root, options.packagePath);
    if (relative(root, dirname(packagePath)).replaceAll('\\', '/') !== key) {
        throw new Error('packagePath não corresponde ao projectPath');
    }
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    const original = readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(original);
    if (!lock.packages?.[key] || typeof pkg.version !== 'string' ||
        !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version)) {
        throw new Error(`Lockfile não contém pacote versionado ${key || '(raiz)'}`);
    }
    lock.packages[key].version = pkg.version;
    if (!key)
        lock.version = pkg.version;
    const indent = /\n( +)"/.exec(original)?.[1]?.length ?? 2;
    writeFileSync(lockPath, JSON.stringify(lock, null, indent) + '\n');
}
