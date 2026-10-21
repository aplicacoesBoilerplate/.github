import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, isAbsolute, join, relative } from 'node:path';
function insideWorkspace(workspace, cwd) {
    const root = realpathSync(workspace);
    const directory = realpathSync(cwd);
    const path = relative(root, directory);
    if (path === '..' || path.startsWith('..\\') || path.startsWith('../') || isAbsolute(path)) {
        throw new Error('Diretório de execução fora do workspace');
    }
    return directory;
}
function sanitizedEnvironment(env) {
    return Object.fromEntries(Object.entries(env).filter(([key]) => {
        const upper = key.toUpperCase();
        return !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)/.test(upper) &&
            !['NODE_OPTIONS', 'MAVEN_OPTS', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS'].includes(upper);
    }));
}
function resolvedWindowsCommand(command, args, env) {
    if (/\.cmd$/i.test(command)) {
        let resolved = command;
        if (!/[\\/]/.test(command)) {
            const search = env.PATH ?? env.Path ?? env.path ?? '';
            resolved = search.split(delimiter).map(path => join(path, command)).find(existsSync) ?? command;
        }
        if ([resolved, ...args].some(value => /[&|<>^%!\r\n"]/.test(value))) {
            throw new Error('Argumento inseguro para launcher Windows');
        }
        return {
            binary: 'cmd.exe',
            argv: ['/d', '/s', '/c', '"' + [resolved, ...args].map(value => '"' + value + '"').join(' ') + '"'],
        };
    }
    if (existsSync(command) && !/\.(exe|com)$/i.test(command)) {
        const source = readFileSync(command, 'utf8').slice(0, 100);
        if (/^#!.*\bnode\b/.test(source))
            return { binary: process.execPath, argv: [command, ...args] };
        if (/^#!.*\b(?:ba)?sh\b/.test(source)) {
            return { binary: 'C:/Program Files/Git/bin/bash.exe', argv: [command, ...args] };
        }
    }
    return { binary: command, argv: [...args] };
}
export function runProcess(request) {
    const { command, args, cwd, workspace } = request;
    if (typeof command !== 'string' || !command || !Array.isArray(args) ||
        args.some(value => typeof value !== 'string') || typeof cwd !== 'string' ||
        typeof workspace !== 'string') {
        throw new Error('Comando e argv inválidos');
    }
    const timeoutMs = request.timeoutMs ?? 120000;
    const maxBuffer = request.maxBuffer ?? 1048576;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
        throw new Error('Processo com timeout inválido');
    }
    if (!Number.isInteger(maxBuffer) || maxBuffer < 1 || maxBuffer > 1048576) {
        throw new Error('Processo com limite de saída inválido');
    }
    const directory = insideWorkspace(workspace, cwd);
    const env = sanitizedEnvironment(request.env ?? process.env);
    const { binary, argv } = process.platform === 'win32'
        ? resolvedWindowsCommand(command, args, env)
        : { binary: command, argv: [...args] };
    const result = spawnSync(binary, argv, {
        cwd: directory, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer,
        windowsHide: true, windowsVerbatimArguments: binary === 'cmd.exe',
    });
    if (result.error) {
        const code = result.error.code;
        if (code === 'ETIMEDOUT')
            throw new Error(`Processo excedeu timeout: ${command}`);
        if (code === 'ENOBUFS')
            throw new Error(`Processo excedeu limite de saída: ${command}`);
        throw new Error(`Falha ao executar ${command}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`Processo ${command} exit ${result.status}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    }
    return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
