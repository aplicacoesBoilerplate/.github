import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { bumpBetween } from '../adapter-contract.js';
import { selectReachableStableTag, validateTagPrefix } from '../services/version-baseline.js';
import { runProcess } from '../ports/process.js';
import { parseJavaProperties } from './java-properties.js';
const fields = ['used_version', 'calculated_version', 'git_sha1_full', 'plugin-version',
    'base_tag', 'base_tag_type', 'base_version', 'branch_name', 'provided_branch_name', 'dirty'];
export function normalizeJgitverReport(request) {
    const { native } = request;
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(native.version)) {
        throw new Error('SemVer estável jgitver inválido');
    }
    if (native.sha.toLowerCase() !== request.sha.toLowerCase())
        throw new Error('SHA jgitver divergente');
    const prefix = validateTagPrefix(request.tagPrefix ?? 'v');
    const reachable = selectReachableStableTag(request.repository, request.workspace ?? request.repository, request.sha, prefix);
    if (!reachable && native.version !== '0.0.1')
        throw new Error('Sem tag estável, somente 0.0.1 é publicável');
    const baseVersion = reachable ?? '0.0.0';
    return { schemaVersion: 1, adapter: 'jgitver', sha: request.sha.toLowerCase(),
        branch: request.branch, tagPrefix: prefix, baseVersion, candidateVersion: native.version,
        tag: prefix + native.version, tagKind: 'annotated',
        bump: bumpBetween(baseVersion, native.version), native: { format: 'java-properties',
            result: native.properties, explanation: native.explanation } };
}
export function collectJgitverReport(context, dependencies = {}) {
    return normalizeJgitverReport({ native: collectJgitver(context, dependencies),
        branch: context.targetBranch, sha: context.sha, repository: projectDirectory(context),
        workspace: context.workspace, tagPrefix: context.tagPrefix });
}
function projectDirectory(context) {
    const workspace = realpathSync(context.workspace);
    const project = realpathSync(join(workspace, context.projectPath));
    const path = relative(workspace, project);
    if (path === '..' || path.startsWith('../') || path.startsWith('..\\') || isAbsolute(path)) {
        throw new Error('Projeto fora do workspace');
    }
    return project;
}
function validateExtension(project) {
    if (!existsSync(join(project, 'pom.xml')) || !existsSync(join(project, '.mvn/extensions.xml'))) {
        throw new Error('jgitver requer pom.xml e .mvn/extensions.xml');
    }
    const xml = readFileSync(join(project, '.mvn/extensions.xml'), 'utf8');
    const extensions = [...xml.matchAll(/<(?:\w+:)?extension\b[^>]*>([\s\S]*?)<\/(?:\w+:)?extension>/g)]
        .map(match => match[1] ?? '');
    const field = (entry, key) => entry.match(new RegExp('<(?:\\w+:)?' + key + '\\b[^>]*>\\s*([^<]+)\\s*</(?:\\w+:)?' + key + '>'))?.[1]?.trim();
    const matching = extensions.filter(entry => field(entry, 'groupId') === 'fr.brouillard.oss' &&
        field(entry, 'artifactId') === 'jgitver-maven-plugin');
    if (matching.length !== 1 || field(matching[0], 'version') !== '1.9.0') {
        throw new Error('Declare exatamente jgitver-maven-plugin 1.9.0 na extensão Maven');
    }
    const configFile = join(project, '.mvn/maven.config');
    if (existsSync(configFile) && /jgitver\.(skip|use-version)\s*[= ]/.test(readFileSync(configFile, 'utf8'))) {
        throw new Error('jgitver.skip/use-version não são permitidos no cálculo');
    }
}
export function collectJgitver(context, dependencies = {}) {
    if (!/^[0-9a-f]{40}$/i.test(context.sha))
        throw new Error('SHA jgitver inválido');
    if (!/^[A-Za-z0-9_.\/-]+$/.test(context.targetBranch))
        throw new Error('Branch jgitver inválida');
    const project = projectDirectory(context);
    validateExtension(project);
    const temporary = mkdtempSync(join(tmpdir(), 'jgitver-output-'));
    try {
        const output = join(temporary, 'native.properties');
        const binary = typeof context.configuration.adapterBin === 'string' &&
            context.configuration.adapterBin ? context.configuration.adapterBin :
            process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
        const run = dependencies.run ?? runProcess;
        run({ command: binary,
            args: ['-B', '-ntp', '-N', '-Djgitver.branch=' + context.targetBranch,
                '-Djgitver.export-properties-path=' + output,
                'org.apache.maven.plugins:maven-help-plugin:3.5.1:evaluate', '-Dexpression=project.version'],
            cwd: project, workspace: context.workspace,
            env: { ...process.env, JGITVER_BRANCH: context.targetBranch },
        });
        if (!existsSync(output))
            throw new Error('jgitver não conseguiu exportar propriedades nativas');
        const raw = parseJavaProperties(readFileSync(output, 'latin1'));
        for (const field of ['used_version', 'calculated_version', 'git_sha1_full', 'plugin-version']) {
            if (!raw['jgitver.' + field])
                throw new Error('Propriedade jgitver ausente: ' + field);
        }
        if (raw['jgitver.plugin-version'] !== '1.9.0')
            throw new Error('Versão de plugin jgitver divergente');
        if (raw['jgitver.used_version'] !== raw['jgitver.calculated_version']) {
            throw new Error('Versão aplicada diverge do cálculo jgitver');
        }
        if (raw['jgitver.git_sha1_full']?.toLowerCase() !== context.sha.toLowerCase()) {
            throw new Error('SHA jgitver divergente');
        }
        const properties = Object.fromEntries(fields.filter(field => Object.hasOwn(raw, 'jgitver.' + field))
            .map(field => ['jgitver.' + field, raw['jgitver.' + field]]));
        return { version: raw['jgitver.used_version'], sha: context.sha.toLowerCase(), properties,
            explanation: 'Evidência derivada das propriedades nativas do jgitver 1.9.0: versão ' +
                raw['jgitver.used_version'] + ', SHA ' + raw['jgitver.git_sha1_full'] + ', base ' +
                (raw['jgitver.base_tag'] || 'sem tag') + '.', };
    }
    finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
