import { relative, isAbsolute } from 'node:path';
import { realpathSync, writeFileSync } from 'node:fs';
import { collectGoVersion } from '../adapters/go-gitsemver.js';
import { collectJgitver as collectNativeJgitver } from '../adapters/jgitver.js';
import { collectStandardVersion } from '../adapters/standard-version.js';
import { runProcess } from '../ports/process.js';
import { normalizeJgitverReport, validateVersionReport, validateTagPrefix } from './version-report.js';
import { argument } from './cli.js';
function typedContext(context) {
    return { repository: context.projectDirectory, workspace: context.workspace,
        projectPath: context.projectPath ?? (relative(context.workspace, context.projectDirectory).replaceAll('\\', '/') || '.'),
        targetBranch: context.targetBranch, sha: context.sha, tagPrefix: context.tagPrefix ?? 'v',
        configuration: { adapterBin: context.adapterBin } };
}
function runner(context, dependencies, java = false) {
    return { run: request => (dependencies.run ?? runProcess)({ ...request,
            ...(java ? { env: { ...context.env, JGITVER_BRANCH: context.targetBranch } } :
                context.env ? { env: context.env } : {}) }) };
}
export function calculateGo(context, dependencies = {}) {
    return validateVersionReport(collectGoVersion(typedContext({ ...context, tagPrefix: 'v' }), runner(context, dependencies)));
}
export function collectJgitver(context, dependencies = {}) {
    return collectNativeJgitver(typedContext(context), runner(context, dependencies, true));
}
export function calculateStandardVersion(context, dependencies = {}) {
    return validateVersionReport(collectStandardVersion(typedContext(context), runner(context, dependencies)));
}
export function resolveAdapter(id, overrides = {}) {
    const adapters = {
        'go-gitsemver': { runtime: 'go', tagKind: 'lightweight', calculate: overrides.go ?? calculateGo },
        'standard-version': { runtime: 'node', tagKind: 'lightweight', calculate: overrides.standard ?? calculateStandardVersion },
        jgitver: { runtime: 'java', tagKind: 'annotated', calculate: (context, dependencies) => normalizeJgitverReport({ native: (overrides.maven ?? collectJgitver)(context, dependencies),
                branch: context.targetBranch, sha: context.sha, repository: context.projectDirectory, tagPrefix: context.tagPrefix ?? 'v' }) },
    };
    if (!Object.hasOwn(adapters, id))
        throw new Error('Adaptador não suportado: ' + id);
    return Object.freeze(adapters[id]);
}
export function main(args) {
    const get = (index) => argument(args, index);
    const adapter = get(0), prefix = validateTagPrefix(args[7] ?? 'v');
    if (adapter === 'go-gitsemver' && prefix !== 'v')
        throw new Error('go-gitsemver exige prefixo v');
    const selected = resolveAdapter(adapter);
    const targetBranch = get(2), sha = get(3), output = get(6);
    if (!/^[0-9a-f]{40}$/i.test(sha) || !/^[A-Za-z0-9_.\/-]+$/.test(targetBranch))
        throw new Error('Contexto de cálculo inválido');
    const workspace = realpathSync(get(4));
    const lexical = relative(workspace, get(1));
    if (lexical === '..' || lexical.startsWith('../') || lexical.startsWith('..\\') || isAbsolute(lexical))
        throw new Error('Projeto fora do workspace');
    const projectDirectory = realpathSync(get(1));
    const path = relative(workspace, projectDirectory);
    if (path === '..' || path.startsWith('../') || path.startsWith('..\\') || isAbsolute(path))
        throw new Error('Projeto fora do workspace');
    const report = selected.calculate({ workspace, projectDirectory, targetBranch, sha,
        adapterBin: get(5), tagPrefix: prefix, env: process.env });
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
