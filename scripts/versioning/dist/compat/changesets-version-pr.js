import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateVersionReport } from './version-report.js';
export function planDigest(report) {
    validateVersionReport(report);
    if (report.adapter !== 'changesets')
        throw Error('Plano Changesets obrigatório');
    return createHash('sha256').update(JSON.stringify(report.releases)).digest('hex');
}
function changedFiles(repository, { working, base, head }) {
    if (working) {
        return execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean)
            .map(row => row.slice(3).replaceAll('\\', '/'))
            .filter(file => file !== '.shared-versioning' && !file.startsWith('.shared-versioning/'));
    }
    if (!base || !head)
        throw Error('Diff do PR técnico obrigatório');
    return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { cwd: repository, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
        .map(file => file.replaceAll('\\', '/'));
}
export function verifyChangesetsFiles({ repository, report, working = false, base, head }) {
    validateVersionReport(report);
    if (report.adapter !== 'changesets')
        throw Error('Relatório Changesets obrigatório');
    const lockPath = join(repository, 'package-lock.json');
    if (!existsSync(lockPath) || existsSync(join(repository, 'pnpm-lock.yaml')) ||
        existsSync(join(repository, 'yarn.lock')))
        throw Error('Changesets exige lockfile npm exclusivo');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (!lock.packages || typeof lock.packages !== 'object')
        throw Error('lockfile npm sem workspaces');
    const allowed = new Set(['package-lock.json']);
    for (const item of report.releases) {
        const matches = Object.entries(lock.packages).filter(([, pkg]) => pkg?.name === item.name && !pkg.link);
        if (matches.length !== 1)
            throw Error(`lockfile não identifica o pacote ${item.name} uma vez`);
        const [path, locked] = matches[0];
        if (path.includes('..') || path.startsWith('/') || path.startsWith('node_modules/')) {
            throw Error(`Caminho inválido no lockfile para ${item.name}`);
        }
        const manifestPath = path ? `${path}/package.json` : 'package.json';
        const changelogPath = path ? `${path}/CHANGELOG.md` : 'CHANGELOG.md';
        const pkg = JSON.parse(readFileSync(join(repository, manifestPath), 'utf8'));
        if (pkg.name !== item.name || pkg.version !== item.version || locked.version !== item.version) {
            throw Error(`manifest ou lockfile diverge da versão ${item.tag}`);
        }
        for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            if (JSON.stringify(pkg[kind] ?? {}) !== JSON.stringify(locked[kind] ?? {})) {
                throw Error(`lockfile diverge das dependências de ${item.name}`);
            }
        }
        const changelog = readFileSync(join(repository, changelogPath), 'utf8');
        if (!new RegExp(`(?:^|\\n)#{1,3}\\s+\\[?${item.version.replaceAll('.', '\\.')}\\]?\\b`).test(changelog)) {
            throw Error(`Changelog não registra ${item.tag}`);
        }
        allowed.add(manifestPath);
        allowed.add(changelogPath);
    }
    if (!Array.isArray(report.native.result.changesets))
        throw new Error('Changesets nativos inválidos');
    for (const entry of report.native.result.changesets) {
        if (!/^[a-z0-9-]+$/.test(entry.id))
            throw Error('ID Changesets inválido');
        const file = `.changeset/${entry.id}.md`;
        if (existsSync(join(repository, file)))
            throw Error(`Changeset não consumido: ${file}`);
        allowed.add(file);
    }
    const changed = changedFiles(repository, { working, ...(base ? { base } : {}), ...(head ? { head } : {}) });
    if (!changed.length)
        throw Error('PR de versão sem arquivos alterados');
    const invalid = changed.filter(file => !allowed.has(file));
    if (invalid.length)
        throw Error(`PR de versionamento contém arquivos não permitidos: ${invalid.join(', ')}`);
    for (const item of report.releases) {
        const paths = Object.entries(lock.packages).filter(([, pkg]) => pkg?.name === item.name && !pkg.link);
        const path = paths[0][0];
        if (!changed.includes(path ? `${path}/package.json` : 'package.json')) {
            throw Error(`PR de versão não altera manifest de ${item.name}`);
        }
    }
    return changed;
}
import { argument } from './cli.js';
export function main(args) {
    const get = (index) => argument(args, index);
    const mode = get(0), repository = get(1);
    const report = validateVersionReport(JSON.parse(readFileSync(get(2), 'utf8')));
    if (mode === 'digest')
        process.stdout.write(planDigest(report));
    else if (mode === 'working' || mode === 'pr')
        process.stdout.write(verifyChangesetsFiles({ repository, report,
            working: mode === 'working', ...(args[3] ? { base: args[3] } : {}), ...(args[4] ? { head: args[4] } : {}) }).join('\n'));
    else
        throw new Error('Modo Changesets desconhecido');
}
