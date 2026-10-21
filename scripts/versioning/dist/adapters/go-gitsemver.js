import { join } from 'node:path';
import { bumpBetween } from '../adapter-contract.js';
import { createGitPort } from '../ports/git.js';
import { runProcess } from '../ports/process.js';
const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const shaPattern = /^[0-9a-f]{40}$/i;
function version(value) {
    if (typeof value !== 'string' || !stableSemver.test(value)) {
        throw new Error(`SemVer estável inválido: ${String(value)}`);
    }
    return value;
}
function latestReachableTag(repository, workspace, sha) {
    const output = runProcess({ command: 'git', args: ['tag', '--merged', sha], cwd: repository,
        workspace }).stdout;
    const versions = output.split(/\r?\n/).filter(tag => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
        .map(tag => tag.slice(1));
    versions.sort((left, right) => {
        const a = left.split('.').map(Number);
        const b = right.split('.').map(Number);
        return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
    });
    return versions.at(-1) ?? null;
}
export function collectGoVersion(context, dependencies = {}) {
    if (context.tagPrefix !== 'v')
        throw new Error('go-gitsemver usa prefixo v neste contrato');
    if (!shaPattern.test(context.sha))
        throw new Error('SHA avaliado inválido');
    const repository = join(context.workspace, context.projectPath);
    const run = dependencies.run ?? runProcess;
    const binary = typeof context.configuration.adapterBin === 'string' &&
        context.configuration.adapterBin ? context.configuration.adapterBin : 'go-gitsemver';
    const native = run({ command: binary,
        args: ['--branch', context.targetBranch, '--commit', context.sha, '-o', 'json', '--explain'],
        cwd: repository, workspace: context.workspace });
    let result;
    try {
        result = JSON.parse(native.stdout);
    }
    catch {
        throw new Error('JSON nativo inválido');
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('JSON nativo inválido');
    }
    const data = result;
    const candidateVersion = version(data.SemVer);
    if (data.Sha === '') {
        let taggedSha;
        try {
            taggedSha = createGitPort(repository).resolveCommit(`refs/tags/v${candidateVersion}`);
        }
        catch {
            throw new Error(`SHA nativo vazio e não há tag v${candidateVersion} no checkout`);
        }
        if (taggedSha.toLowerCase() !== context.sha.toLowerCase()) {
            throw new Error(`SHA nativo vazio e a tag v${candidateVersion} não aponta para ${context.sha}`);
        }
    }
    else if (typeof data.Sha !== 'string' || data.Sha.toLowerCase() !== context.sha.toLowerCase()) {
        throw new Error(`SHA calculado diverge do SHA avaliado: ${String(data.Sha ?? '<ausente>')} != ${context.sha}`);
    }
    const reachable = latestReachableTag(repository, context.workspace, context.sha);
    const baseVersion = reachable ?? '0.0.0';
    if (!reachable && candidateVersion !== '0.0.1') {
        throw new Error(`Sem tag estável, somente 0.0.1 é publicável; recebido ${candidateVersion}`);
    }
    return {
        schemaVersion: 1, adapter: 'go-gitsemver', sha: context.sha.toLowerCase(),
        branch: context.targetBranch, baseVersion, candidateVersion,
        tag: `v${candidateVersion}`, bump: bumpBetween(baseVersion, candidateVersion),
        native: { format: 'json', result: data, explanation: native.stderr },
    };
}
