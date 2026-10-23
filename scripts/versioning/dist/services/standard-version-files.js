import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { parseStableVersion, validateTagPrefix } from '../compat/version-report.js';
export function parseVersionPr(pr, options) {
    const { targetBranch, projectPath, tagPrefix, adapter = 'standard-version' } = options;
    if (!pr || pr.base?.ref !== targetBranch || !['standard-version', 'changesets'].includes(adapter) ||
        !pr.head?.ref?.startsWith(`versioning/${adapter}/`)) {
        throw new Error(`PR de versão precisa partir de versioning/${adapter}/ para a principal`);
    }
    const field = (key) => new RegExp(`^${key}: (.+)$`, 'm').exec(pr.body ?? '')?.[1]?.trim();
    const originPr = field('Origin-PR')?.replace(/^#/, '');
    const originSha = field('Origin-SHA');
    const version = field('Version');
    if (!/^[1-9][0-9]*$/.test(originPr ?? '') || !/^[0-9a-f]{40}$/i.test(originSha ?? '') ||
        field('Adapter') !== adapter || field('Project') !== projectPath ||
        field('Tag-Prefix') !== validateTagPrefix(tagPrefix) || parseStableVersion(version).text !== version) {
        throw new Error('Metadados do PR de versão inválidos ou divergentes do caller');
    }
    if (!pr.head.ref.endsWith(`/${originSha.slice(0, 12)}`))
        throw new Error('Branch do PR de versão não corresponde ao SHA de origem');
    if (adapter === 'changesets' && !/^[0-9a-f]{64}$/.test(field('Plan-SHA256') ?? ''))
        throw new Error('Digest do plano Changesets ausente ou inválido');
    return { originPr: Number(originPr), originSha: originSha.toLowerCase(), version,
        ...(adapter === 'changesets' ? { planSha256: field('Plan-SHA256') } : {}) };
}
export function validateHumanReview(pr, pages) {
    if (!/^[0-9a-f]{40}$/i.test(pr?.head?.sha ?? '') || !Array.isArray(pages) || pages.some(page => !Array.isArray(page))) {
        throw new Error('Reviews do PR de versão incompletos');
    }
    const effective = new Map();
    for (const review of pages.flat()) {
        if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review?.state ?? '') && review.user?.login)
            effective.set(review.user.login, review);
    }
    const approval = [...effective.values()].find(review => review.state === 'APPROVED' &&
        review.commit_id === pr.head.sha && review.user?.type === 'User' && review.user.login && review.user.login !== pr.user?.login);
    if (!approval?.user?.login)
        throw new Error('PR de versão sem aprovação humana no SHA atual');
    return approval.user.login;
}
export function changedVersionFiles(repository, projectPath, adapter, base, head) {
    const prefix = projectPath === '.' ? '' : `${projectPath.replace(/^\.\//, '').replace(/\/$/, '')}/`;
    const files = base && head ? execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { cwd: repository, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean) :
        execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean).map(row => row.slice(3))
            .filter(file => file !== '.shared-versioning/' && !file.startsWith('.shared-versioning/'));
    if (!files.length)
        throw new Error('PR de versionamento sem arquivos alterados');
    const allowed = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'CHANGELOG.md'];
    const invalid = files.filter(file => !allowed.some(name => file === prefix + name) &&
        !(adapter !== 'standard-version' && (['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].includes(file) ||
            ['pnpm-lock.yaml', 'yarn.lock'].some(name => file === prefix + name) ||
            adapter === 'changesets' && /^\.changeset\/[A-Za-z0-9_.-]+\.md$/.test(file))));
    if (invalid.length)
        throw new Error(`PR de versionamento contém arquivos não permitidos: ${invalid.join(', ')}`);
    if (!files.includes(prefix + 'package.json'))
        throw new Error('PR de versionamento não altera o package.json selecionado');
    return files;
}
export function verifyVersionFiles(request) {
    const { repository, projectPath, version, base, head } = request;
    const project = resolve(repository, projectPath), path = relative(resolve(repository), project);
    if (path === '..' || path.startsWith('../') || path.startsWith('..\\') || isAbsolute(path))
        throw new Error('Caminho do projeto fora do checkout');
    if (base && head)
        changedVersionFiles(repository, projectPath, 'standard-version', base, head);
    for (const name of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'CHANGELOG.md']) {
        let current = resolve(repository);
        for (const segment of [...(path ? path.split(/[\\/]/) : []), name]) {
            current = join(current, segment);
            try {
                if (lstatSync(current).isSymbolicLink())
                    throw new Error('arquivo/path symlink não permitido');
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
        }
    }
    const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
    if (pkg.version !== version)
        throw new Error('package.json diverge da versão nativa homologada');
    if (['pnpm-lock.yaml', 'yarn.lock'].some(name => existsSync(join(project, name))))
        throw new Error('Perfil standard-version aceita apenas lockfile npm');
    if (!['package-lock.json', 'npm-shrinkwrap.json'].some(name => existsSync(join(project, name))))
        throw new Error('Perfil standard-version exige lockfile npm');
    const changelog = readFileSync(join(project, 'CHANGELOG.md'), 'utf8');
    if (!new RegExp(`(?:^|\\n)#{1,3}\\s+\\[?${version.replaceAll('.', '\\.')}\\]?(?:\\s|$|\\()`).test(changelog))
        throw new Error('CHANGELOG.md não registra a versão nativa homologada');
    for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
        let lock;
        try {
            lock = JSON.parse(readFileSync(join(project, name), 'utf8'));
        }
        catch (error) {
            if (error.code === 'ENOENT')
                continue;
            throw error;
        }
        if (lock.version !== version || lock.packages?.[''] && lock.packages[''].version !== version)
            throw new Error(`${name} diverge da versão nativa homologada`);
    }
}
