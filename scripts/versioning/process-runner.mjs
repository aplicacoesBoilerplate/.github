import { spawnSync } from 'node:child_process';
import { realpathSync, readFileSync, existsSync } from 'node:fs';
import { relative, isAbsolute, join, delimiter } from 'node:path';

export function runProcess({ command, args, cwd, workspace, env = process.env,
  timeoutMs = 120000, maxBuffer = 1048576 }) {
  if (typeof command !== 'string' || !command || !Array.isArray(args) ||
    args.some(value => typeof value !== 'string')) throw new Error('Comando e argv inválidos');
  const root = realpathSync(workspace), directory = realpathSync(cwd);
  const path = relative(root, directory);
  if (path === '..' || path.startsWith('..\\') || path.startsWith('../') || isAbsolute(path)) {
    throw new Error('Diretório de execução fora do workspace');
  }
  const cleanEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) &&
    !['NODE_OPTIONS', 'MAVEN_OPTS', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS'].includes(key)));
  let binary = command, argv = args;
  if (process.platform === 'win32' && /\.cmd$/i.test(command)) {
    if (!/[\\/]/.test(command)) {
      const search = cleanEnv.PATH ?? cleanEnv.Path ?? cleanEnv.path ?? '';
      command = search.split(delimiter).map(path => join(path, command)).find(existsSync) ?? command;
    }
    if ([command, ...args].some(value => /[&|<>^%!\r\n"]/.test(value))) {
      throw new Error('Argumento inseguro para launcher Windows');
    }
    binary = 'cmd.exe';
    argv = ['/d', '/s', '/c', '"' + [command, ...args].map(value => '"' + value + '"').join(' ') + '"'];
  } else if (process.platform === 'win32' && existsSync(command) && !/\.(exe|com)$/i.test(command)) {
    const source = readFileSync(command, 'utf8').slice(0, 100);
    if (/^#!.*\bnode\b/.test(source)) { binary = process.execPath; argv = [command, ...args]; }
    else if (/^#!.*\b(?:ba)?sh\b/.test(source)) { binary = 'C:/Program Files/Git/bin/bash.exe'; argv = [command, ...args]; }
  }
  const result = spawnSync(binary, argv, { cwd: directory, env: cleanEnv, encoding: 'utf8',
    timeout: timeoutMs, maxBuffer, windowsHide: true, windowsVerbatimArguments: binary === 'cmd.exe' });
  if (result.error) throw new Error(
    result.error.code === 'ETIMEDOUT' ? 'Processo excedeu timeout: ' + command :
      'Falha ao executar ' + command + ': ' + result.error.message);
  if (result.status !== 0) throw new Error('Processo ' + command + ' exit ' + result.status +
    '\n' + result.stdout + '\n' + result.stderr);
  return { stdout: result.stdout, stderr: result.stderr };
}
