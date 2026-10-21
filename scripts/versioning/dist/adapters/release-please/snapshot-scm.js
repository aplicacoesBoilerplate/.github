import { join, relative, isAbsolute } from 'node:path';
import { realpathSync } from 'node:fs';
import { createGitPort } from '../../ports/git.js';
import { createReadApi } from '../../ports/github.js';
import { runProcess } from '../../ports/process.js';
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const shaPattern = /^[0-9a-f]{40}$/i;
const configKeys = new Set(['$schema', 'packages', 'release-type',
    'include-component-in-tag', 'include-v-in-tag', 'changelog-path', 'changelog-type',
    'changelog-sections', 'bump-minor-pre-major', 'bump-patch-for-minor-pre-major',
    'versioning', 'initial-version']);
const packageKeys = new Set([...configKeys].filter(key => key !== '$schema' && key !== 'packages'));
function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} inválido`);
    return value;
}
function checkedPath(path) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') ||
        path.includes(':') || path.includes('\0') || path.split('/').some(part => !part || part === '..')) {
        throw new Error('Path Release Please inválido');
    }
    return path;
}
function checkedBranch(branch, expected, sha) {
    if (branch !== expected && branch !== sha)
        throw new Error('Branch/ref fora do snapshot Release Please');
}
function checkedRepository(context) {
    if (context.projectPath !== '.')
        throw new Error('Release Please suporta somente projeto raiz, sem workspace');
    if (context.tagPrefix !== 'v')
        throw new Error('Release Please exige prefixo v');
    if (!shaPattern.test(context.sha))
        throw new Error('SHA funcional inválido');
    const root = realpathSync(context.workspace);
    const repository = realpathSync(context.repository);
    const rel = relative(root, repository);
    if (rel !== '' || isAbsolute(rel)) {
        throw new Error('Release Please suporta apenas a raiz do workspace');
    }
    return repository;
}
function gitText(repository, workspace, args) {
    return runProcess({ command: 'git', args, cwd: repository, workspace }).stdout.trim();
}
function validateOptions(input, allowed) {
    for (const key of Object.keys(input)) {
        if (!allowed.has(key))
            throw new Error(`Configuração Release Please não suportada: ${key}`);
    }
    if (input['release-type'] !== undefined && input['release-type'] !== 'node') {
        throw new Error('Release Please suporta somente release-type node');
    }
    if (input['include-component-in-tag'] !== undefined && input['include-component-in-tag'] !== false) {
        throw new Error('Release Please exige include-component-in-tag false');
    }
    if (input['include-v-in-tag'] !== undefined && input['include-v-in-tag'] !== true) {
        throw new Error('Release Please exige include-v-in-tag true');
    }
    if (input['changelog-path'] !== undefined && input['changelog-path'] !== 'CHANGELOG.md') {
        throw new Error('Release Please exige changelog-path CHANGELOG.md');
    }
    if (input['changelog-type'] !== undefined && input['changelog-type'] !== 'default') {
        throw new Error('Release Please exige changelog-type default');
    }
    if (input.versioning !== undefined && input.versioning !== 'default') {
        throw new Error('Release Please exige versioning default');
    }
    for (const key of ['bump-minor-pre-major', 'bump-patch-for-minor-pre-major']) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean') {
            throw new Error(`Release Please exige booleano em ${key}`);
        }
    }
    if (input['initial-version'] !== undefined &&
        (typeof input['initial-version'] !== 'string' || !stable.test(input['initial-version']))) {
        throw new Error('Release Please initial-version instável');
    }
    if (input['changelog-sections'] !== undefined) {
        if (!Array.isArray(input['changelog-sections']))
            throw new Error('changelog-sections inválidas');
        for (const value of input['changelog-sections']) {
            const section = record(value, 'Changelog section');
            if (Object.keys(section).some(key => !['type', 'section', 'hidden'].includes(key)) ||
                typeof section.type !== 'string' || !section.type ||
                typeof section.section !== 'string' || !section.section ||
                (section.hidden !== undefined && typeof section.hidden !== 'boolean')) {
                throw new Error('changelog-sections inválidas');
            }
        }
    }
}
export function readReleasePleaseProfile(context) {
    const repository = checkedRepository(context);
    const git = createGitPort(repository);
    const json = (path) => {
        let blob;
        try {
            blob = git.readBlob(context.sha, path);
        }
        catch {
            throw new Error(`Arquivo obrigatório Release Please ausente: ${path}`);
        }
        try {
            return record(JSON.parse(blob.toString('utf8')), path);
        }
        catch {
            throw new Error(`JSON Release Please inválido: ${path}`);
        }
    };
    const config = json('release-please-config.json');
    validateOptions(config, configKeys);
    const packages = record(config.packages, 'Packages Release Please');
    if (Object.keys(packages).length !== 1 || !Object.hasOwn(packages, '.')) {
        throw new Error('Release Please suporta somente um package raiz, sem workspace');
    }
    const packageConfig = record(packages['.'], 'Package raiz Release Please');
    validateOptions(packageConfig, packageKeys);
    if ((packageConfig['release-type'] ?? config['release-type']) !== 'node') {
        throw new Error('Release Please exige release-type node');
    }
    const manifest = json('.release-please-manifest.json');
    if (Object.keys(manifest).length !== 1 || typeof manifest['.'] !== 'string' ||
        !stable.test(manifest['.']))
        throw new Error('Manifest Release Please divergente');
    const pkg = json('package.json');
    if (pkg.workspaces !== undefined)
        throw new Error('Release Please não suporta workspaces neste perfil');
    if (typeof pkg.name !== 'string' || !pkg.name || typeof pkg.version !== 'string' ||
        !stable.test(pkg.version))
        throw new Error('package.json Release Please inválido');
    const lock = json('package-lock.json');
    const lockRoot = record(record(lock.packages, 'Lock npm')[''], 'Lock npm raiz');
    if (lock.version !== pkg.version || lockRoot.version !== pkg.version ||
        lockRoot.name !== pkg.name) {
        throw new Error('Lockfile Release Please diverge do package.json');
    }
    const tags = gitText(repository, context.workspace, ['tag', '--merged', context.sha])
        .split(/\r?\n/).filter(tag => /^v\d/.test(tag) && stable.test(tag.slice(1)))
        .sort((left, right) => {
        const a = left.slice(1).split('.').map(Number);
        const b = right.slice(1).split('.').map(Number);
        return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
    });
    const baselineVersion = tags.at(-1)?.slice(1) ?? null;
    if (baselineVersion && manifest['.'] !== baselineVersion) {
        throw new Error(`Manifest Release Please diverge da tag v${baselineVersion}`);
    }
    if (!baselineVersion && (manifest['.'] !== '0.0.0' ||
        (packageConfig['initial-version'] ?? config['initial-version']) !== '0.0.1')) {
        throw new Error('Bootstrap Release Please sem baseline exige manifest 0.0.0 e initial-version 0.0.1');
    }
    return { config, manifestVersion: manifest['.'], baselineVersion };
}
export function createSnapshotTransport(transport, apiBase = 'https://api.github.com/') {
    const read = createReadApi(async (request) => {
        if (request.method !== 'GET')
            throw new Error('REST mutation bloqueada: somente leitura');
        return transport(request);
    }, apiBase);
    return Object.freeze({
        requestRest: async (method, endpoint, _body) => {
            if (method !== 'GET')
                throw new Error('REST mutation bloqueada: somente leitura');
            return read.get(endpoint);
        },
        listRest: (endpoint) => read.list(endpoint),
        queryGraphql: async (query) => {
            if (typeof query !== 'string' ||
                !/^\s*query\s+ReleasePleaseSnapshotHistory\b/.test(query) || /\bmutation\b/i.test(query)) {
                throw new Error('GraphQL mutation ou consulta não permitida no snapshot');
            }
            const base = new URL(apiBase);
            const request = { method: 'POST', url: new URL('graphql', base).href,
                body: { query } };
            let response;
            try {
                response = await transport(request);
            }
            catch {
                throw new Error('GraphQL snapshot transport failed');
            }
            if (response.status !== 200 || !response.body || typeof response.body !== 'object' ||
                Array.isArray(response.body) || Object.hasOwn(response.body, 'errors')) {
                throw new Error('GraphQL snapshot response inválida');
            }
            return response.body;
        },
    });
}
export async function createSnapshotScm(context, options) {
    const repositoryPath = checkedRepository(context);
    const profile = readReleasePleaseProfile(context);
    if (!/^[A-Za-z0-9_.-]+$/.test(options.owner) || !/^[A-Za-z0-9_.-]+$/.test(options.repo)) {
        throw new Error('Repositório GitHub inválido');
    }
    const git = createGitPort(repositoryPath);
    const transport = createSnapshotTransport(options.transport);
    const endpoint = (name) => `repos/${options.owner}/${options.repo}/${name}`;
    const tree = gitText(repositoryPath, context.workspace, ['ls-tree', '-r', '--name-only', context.sha]).split(/\r?\n/).filter(Boolean);
    const assertTargetRef = () => {
        const current = gitText(repositoryPath, context.workspace, ['rev-parse', '--verify', `refs/heads/${context.targetBranch}`]);
        if (current.toLowerCase() !== context.sha.toLowerCase()) {
            throw new Error('A branch-alvo avançou e diverge do snapshot');
        }
        return true;
    };
    const getFileContentsOnBranch = async (path, branch) => {
        checkedBranch(branch, context.targetBranch, context.sha);
        const file = checkedPath(path);
        if (!tree.includes(file))
            throw new Error(`FileNotFoundError: ${file}`);
        const mode = gitText(repositoryPath, context.workspace, ['ls-tree', context.sha, '--', file]).split(/\s+/)[0];
        if (mode !== '100644' && mode !== '100755')
            throw new Error('Arquivo não regular no snapshot');
        const bytes = git.readBlob(context.sha, file);
        const blobSha = gitText(repositoryPath, context.workspace, ['rev-parse', `${context.sha}:${file}`]);
        return { content: bytes.toString('base64'), parsedContent: bytes.toString('utf8'),
            mode, sha: blobSha, path: file };
    };
    const paths = (ref, predicate, prefix) => {
        checkedBranch(ref, context.targetBranch, context.sha);
        if (prefix)
            checkedPath(prefix);
        return tree.filter(path => (!prefix || path.startsWith(prefix)) && predicate(path));
    };
    const unsupportedMutation = () => { throw new Error('Release Please SCM é somente leitura'); };
    const getTags = async () => {
        const values = await transport.listRest(`${endpoint('tags')}?per_page=100`);
        return values.map(value => {
            const item = record(value, 'Tag GitHub');
            const commit = record(item.commit, 'Tag commit');
            if (typeof item.name !== 'string' || typeof commit.sha !== 'string' ||
                !shaPattern.test(commit.sha))
                throw new Error('Tag GitHub inválida');
            return { name: item.name, sha: commit.sha };
        });
    };
    const scm = {
        repository: Object.freeze({ owner: options.owner, repo: options.repo,
            defaultBranch: context.targetBranch }),
        profile,
        snapshotSha: context.sha,
        assertTargetRef,
        requestRest: transport.requestRest,
        queryGraphql: transport.queryGraphql,
        getFileContents: (path) => getFileContentsOnBranch(path, context.targetBranch),
        getFileContentsOnBranch,
        getFileJson: async (path, branch) => JSON.parse((await getFileContentsOnBranch(path, branch)).parsedContent),
        findFilesByFilename: async (filename, prefix) => paths(context.targetBranch, path => path.split('/').at(-1) === filename, prefix),
        findFilesByFilenameAndRef: async (filename, ref, prefix) => paths(ref, path => path.split('/').at(-1) === filename, prefix),
        findFilesByExtension: async (extension, prefix) => paths(context.targetBranch, path => path.endsWith(extension), prefix),
        findFilesByExtensionAndRef: async (extension, ref, prefix) => paths(ref, path => path.endsWith(extension), prefix),
        findFilesByGlob: async (glob, prefix) => paths(context.targetBranch, path => path === glob, prefix),
        findFilesByGlobAndRef: async (glob, ref, prefix) => paths(ref, path => path === glob, prefix),
        async *tagIterator(options = {}) {
            const tags = await getTags();
            for (const tag of tags.slice(0, options.maxResults ?? tags.length))
                yield tag;
        },
        async *releaseIterator(options = {}) {
            const values = await transport.listRest(`${endpoint('releases')}?per_page=100`);
            for (const value of values.slice(0, options.maxResults ?? values.length)) {
                const item = record(value, 'Release GitHub');
                if (!Number.isInteger(item.id) || typeof item.tag_name !== 'string') {
                    throw new Error('Release GitHub inválida');
                }
                const sha = git.resolveCommit(`refs/tags/${item.tag_name}`);
                yield { id: item.id, name: item.name, tagName: item.tag_name, sha,
                    notes: item.body, url: item.html_url, draft: item.draft };
            }
        },
        async *mergeCommitIterator(branch, options = {}) {
            checkedBranch(branch, context.targetBranch, context.sha);
            const rows = gitText(repositoryPath, context.workspace, ['log', '-z', '--format=%H%n%B', context.sha]).split('\0').filter(Boolean);
            for (const row of rows.slice(0, options.maxResults ?? rows.length)) {
                const newline = row.indexOf('\n');
                const sha = row.slice(0, newline);
                if (!shaPattern.test(sha))
                    throw new Error('Commit Git inválido');
                yield { sha, message: row.slice(newline + 1).trim() };
            }
        },
        async commitsSince(branch, filter, options = {}) {
            const result = [];
            for await (const commit of scm.mergeCommitIterator(branch, options)) {
                if (filter(commit))
                    break;
                result.push(commit);
            }
            return result;
        },
        async *pullRequestIterator() { throw new Error('Consulta de PR Release Please não habilitada no snapshot'); },
        async getPullRequest() { throw new Error('Consulta de PR Release Please não habilitada no snapshot'); },
        createPullRequest: unsupportedMutation,
        updatePullRequest: unsupportedMutation,
        createRelease: unsupportedMutation,
        commentOnIssue: unsupportedMutation,
        removeIssueLabels: unsupportedMutation,
        addIssueLabels: unsupportedMutation,
        createFileOnNewBranch: unsupportedMutation,
        generateReleaseNotes: unsupportedMutation,
        buildChangeSet: unsupportedMutation,
    };
    return scm;
}
