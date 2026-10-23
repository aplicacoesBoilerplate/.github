import { execFileSync } from 'node:child_process';
const shaPattern = /^[0-9a-f]{40}$/i;
const snapshotAdapters = new Set([
    'go-gitsemver', 'jgitver', 'standard-version', 'changesets', 'release-please',
]);
function checkedSha(value) {
    if (typeof value !== 'string' || !shaPattern.test(value))
        throw new Error('SHA Git inválido');
    return value;
}
function checkedBlobPath(value) {
    if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') ||
        value.includes(':') || value.includes('\0') || value.split('/').some(part => !part || part === '..')) {
        throw new Error('Git blob path inválido');
    }
    return value;
}
function checkedTagRef(value) {
    if (!/^refs\/tags\/[A-Za-z0-9@][A-Za-z0-9._/@+-]*$/.test(value) || value.includes('..')) {
        throw new Error('Git tag ref inválida');
    }
    return value;
}
function defaultExecutor(repository) {
    return {
        text: args => execFileSync('git', [...args], { cwd: repository, encoding: 'utf8' }).trim(),
        bytes: args => execFileSync('git', [...args], { cwd: repository }),
    };
}
export function createGitPort(repository, execute = defaultExecutor(repository)) {
    const headSha = () => checkedSha(execute.text(['rev-parse', 'HEAD']));
    const resolveCommit = (ref) => {
        const safe = shaPattern.test(ref) ? checkedSha(ref) : checkedTagRef(ref);
        return checkedSha(execute.text(['rev-parse', '--verify', `${safe}^{commit}`]));
    };
    const readBlob = (sha, path) => execute.bytes([
        'cat-file', 'blob', `${checkedSha(sha)}:${checkedBlobPath(path)}`,
    ]);
    const subjectsBetween = (baseSha, targetSha) => {
        const raw = execute.text(['log', '--format=%s', `${checkedSha(baseSha)}..${checkedSha(targetSha)}`]);
        return raw ? raw.split(/\r?\n/) : [];
    };
    const captureInputs = (adapter) => {
        if (!snapshotAdapters.has(adapter))
            throw new Error('Adaptador de snapshot inválido');
        const prefixes = adapter === 'go-gitsemver'
            ? ['refs/tags', 'refs/heads', 'refs/remotes'] : ['refs/tags'];
        const raw = execute.text(['for-each-ref', '--sort=refname', '--format=%(refname)\t%(objectname)', ...prefixes]);
        const refs = Object.create(null);
        for (const line of raw.split(/\r?\n/).filter(Boolean)) {
            const parts = line.split('\t');
            if (parts.length !== 2 || !parts[0] || !parts[1] || !shaPattern.test(parts[1])) {
                throw new Error('Referência Git inválida');
            }
            refs[parts[0]] = parts[1];
        }
        return { schemaVersion: 1, adapter, sha: headSha(), refs };
    };
    const verifyInputs = (snapshot, sha, tags, adapter) => {
        if (snapshot?.schemaVersion !== 1 || snapshot.adapter !== adapter || snapshot.sha !== sha ||
            !snapshot.refs || typeof snapshot.refs !== 'object' || Array.isArray(snapshot.refs)) {
            throw new Error('Snapshot Git diverge de SHA/adaptador');
        }
        const current = captureInputs(adapter);
        if (current.sha !== sha)
            throw new Error('Checkout Git diverge do SHA avaliado');
        const expected = { ...snapshot.refs };
        const actual = { ...current.refs };
        for (const tag of typeof tags === 'string' ? tags ? [tags] : [] : tags) {
            const candidate = checkedTagRef(`refs/tags/${tag}`);
            if (!Object.hasOwn(expected, candidate) && Object.hasOwn(actual, candidate) &&
                resolveCommit(candidate) === sha) {
                delete actual[candidate];
            }
        }
        const sorted = (refs) => Object.entries(refs).sort(([left], [right]) => left.localeCompare(right));
        if (JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(actual))) {
            throw new Error('As referências Git mudaram; reexecute a validação de leitura antes de publicar');
        }
        return true;
    };
    return { headSha, resolveCommit, readBlob, subjectsBetween, captureInputs, verifyInputs };
}
export function captureGitInputs(repository, adapter) {
    return createGitPort(repository).captureInputs(adapter);
}
export function verifyGitInputs(repository, snapshot, sha, tags, adapter) {
    return createGitPort(repository).verifyInputs(snapshot, sha, tags, adapter);
}
