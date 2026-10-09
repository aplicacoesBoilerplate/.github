import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStableVersion, validateTagPrefix } from './version-report.mjs';

const sha = /^[0-9a-f]{40}$/i;
const positive = /^[1-9][0-9]*$/;

export function parseVersionPr(pr, { targetBranch, projectPath, tagPrefix }) {
  if (!pr || pr.base?.ref !== targetBranch ||
      !/^versioning\/standard-version\//.test(pr.head?.ref ?? '')) {
    throw Error('PR de versão precisa partir de versioning/standard-version/ para a principal');
  }
  const body = pr.body ?? '';
  const field = key => new RegExp(`^${key}: (.+)$`, 'm').exec(body)?.[1]?.trim();
  const originPr = field('Origin-PR')?.replace(/^#/, '');
  const originSha = field('Origin-SHA');
  const version = field('Version');
  if (!positive.test(originPr ?? '') || !sha.test(originSha ?? '') ||
      field('Adapter') !== 'standard-version' || field('Project') !== projectPath ||
      field('Tag-Prefix') !== validateTagPrefix(tagPrefix) ||
      parseStableVersion(version).text !== version) {
    throw Error('Metadados do PR de versão inválidos ou divergentes do caller');
  }
  if (!pr.head.ref.endsWith(`/${originSha.slice(0, 12)}`)) {
    throw Error('Branch do PR de versão não corresponde ao SHA de origem');
  }
  return { originPr: Number(originPr), originSha: originSha.toLowerCase(), version };
}

export function verifyVersionFiles({ repository, projectPath, version, base, head }) {
  const project = resolve(repository, projectPath);
  if (project !== resolve(repository) && !project.startsWith(`${resolve(repository)}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw Error('Caminho do projeto fora do checkout');
  }
  if (base && head) execFileSync(process.execPath, [join(import.meta.dirname, 'verify-version-files.mjs'),
    'pr', 'standard-version', projectPath, base, head], { cwd: repository, stdio: 'pipe' });
  const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  if (pkg.version !== version) throw Error('package.json diverge da versão nativa homologada');
  const changelog = readFileSync(join(project, 'CHANGELOG.md'), 'utf8');
  if (!new RegExp(`(?:^|\\n)#{1,3}\\s+\\[?${version.replaceAll('.', '\\.')}\\]?(?:\\s|$|\\()`).test(changelog)) {
    throw Error('CHANGELOG.md não registra a versão nativa homologada');
  }
  for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
    let lock;
    try { lock = JSON.parse(readFileSync(join(project, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (lock.version !== version || (lock.packages?.[''] && lock.packages[''].version !== version)) {
      throw Error(`${name} diverge da versão nativa homologada`);
    }
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'parse') {
      const [prPath, targetBranch, projectPath, tagPrefix] = args;
      process.stdout.write(`${JSON.stringify(parseVersionPr(JSON.parse(readFileSync(prPath, 'utf8')),
        { targetBranch, projectPath, tagPrefix }))}\n`);
    } else if (command === 'verify-files' || command === 'verify-manifests') {
      const [repository, projectPath, version, base, head] = args;
      verifyVersionFiles({ repository, projectPath, version, base, head });
    } else throw Error('Comando version-pr desconhecido');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
