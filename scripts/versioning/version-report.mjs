import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const stableSemver = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const shaPattern = /^[0-9a-f]{40}$/i;
const bumps = new Set(['none', 'patch', 'minor', 'major']);
const prefixPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function validateTagPrefix(prefix) {
  if (typeof prefix !== 'string' || !prefixPattern.test(prefix) || prefix.includes('..') ||
      prefix.endsWith('.') || prefix.endsWith('/')) {
    throw new Error(`Prefixo de tag inválido: ${prefix}`);
  }
  return prefix;
}

export function parseStableVersion(value) {
  const match = stableSemver.exec(String(value ?? '').trim());
  if (!match) throw new Error(`SemVer estável inválido: ${value}`);
  return { text: `${match[1]}.${match[2]}.${match[3]}`, parts: match.slice(1).map(Number) };
}

function compareVersions(left, right) {
  const a = parseStableVersion(left).parts;
  const b = parseStableVersion(right).parts;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function bumpBetween(before, after) {
  const a = parseStableVersion(before).parts;
  const b = parseStableVersion(after).parts;
  if (compareVersions(after, before) <= 0) return 'none';
  if (a[0] !== b[0]) return 'major';
  if (a[1] !== b[1]) return 'minor';
  return 'patch';
}

export function selectReachableStableTag(repository, sha, tagPrefix = 'v') {
  if (!shaPattern.test(sha)) throw new Error(`SHA avaliado inválido: ${sha}`);
  validateTagPrefix(tagPrefix);
  let output = '';
  try {
    output = execFileSync('git', ['tag', '--merged', sha], { cwd: repository, encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Não foi possível consultar tags alcançáveis: ${error.message}`);
  }
  const versions = output.split(/\r?\n/).filter(Boolean)
    .filter(tag => tagPrefix === 'v' ? stableSemver.test(tag) : tag.startsWith(tagPrefix))
    .map(tag => tagPrefix === 'v' ? tag : tag.slice(tagPrefix.length))
    .filter(tag => stableSemver.test(tag))
    .map(tag => parseStableVersion(tag).text)
    .sort(compareVersions);
  return versions.at(-1) ?? null;
}

export function validateVersionReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('VersionReport inválido');
  if (report.schemaVersion !== 1) throw new Error('VersionReport schemaVersion deve ser 1');
  if (!['go-gitsemver', 'standard-version', 'jgitver'].includes(report.adapter)) {
    throw new Error(`Adaptador não suportado: ${report.adapter}`);
  }
  if (!shaPattern.test(report.sha)) throw new Error('VersionReport sha inválido');
  if (typeof report.branch !== 'string' || !report.branch) throw new Error('VersionReport branch inválida');
  parseStableVersion(report.baseVersion);
  parseStableVersion(report.candidateVersion);
  const prefix = validateTagPrefix(report.tagPrefix ?? 'v');
  if (report.adapter === 'go-gitsemver' && prefix !== 'v') {
    throw new Error('go-gitsemver usa prefixo v neste contrato');
  }
  if (report.tag !== `${prefix}${report.candidateVersion}`) throw new Error('VersionReport tag diverge da versão candidata');
  if (!bumps.has(report.bump)) throw new Error('VersionReport bump inválido');
  if (!report.native || !['json', 'text'].includes(report.native.format) ||
      typeof report.native.explanation !== 'string') {
    throw new Error('VersionReport native inválido');
  }
  if (report.adapter === 'go-gitsemver' && report.native.format !== 'json') {
    throw new Error('go-gitsemver exige JSON nativo');
  }
  return report;
}

function normalizeTextReport({ adapter, candidate, nativeOutput, branch, sha, repository, tagPrefix = 'v' }) {
  if (!shaPattern.test(sha)) throw new Error(`SHA avaliado inválido: ${sha}`);
  const prefix = validateTagPrefix(tagPrefix);
  const candidateVersion = parseStableVersion(candidate).text;
  const baseVersion = selectReachableStableTag(repository, sha, prefix) ?? '0.0.0';
  return validateVersionReport({
    schemaVersion: 1, adapter, sha: sha.toLowerCase(), branch, tagPrefix: prefix,
    baseVersion, candidateVersion, tag: `${prefix}${candidateVersion}`,
    bump: bumpBetween(baseVersion, candidateVersion),
    native: { format: 'text', result: { version: candidateVersion }, explanation: nativeOutput },
  });
}

export function normalizeStandardVersionReport({ nativeOutput, branch, sha, repository, tagPrefix = 'v' }) {
  const matches = [...nativeOutput.matchAll(/bumping version in [^\r\n]+? from \S+ to (\S+)/gi)];
  if (!matches.length) throw new Error('standard-version não informou a versão calculada');
  const candidates = new Set(matches.map(match => parseStableVersion(match[1]).text));
  if (candidates.size !== 1) throw new Error('standard-version informou versões divergentes');
  return normalizeTextReport({ adapter: 'standard-version', candidate: [...candidates][0],
    nativeOutput, branch, sha, repository, tagPrefix });
}

export function normalizeJgitverReport({ nativeOutput, branch, sha, repository, tagPrefix = 'v' }) {
  const candidate = nativeOutput.replace(/\x1b\[[0-9;]*m/g, '').trim().split(/\r?\n/).at(-1);
  return normalizeTextReport({ adapter: 'jgitver', candidate,
    nativeOutput, branch, sha, repository, tagPrefix });
}

export function normalizeGoReport({ nativeJson, explanation, branch, sha, repository }) {
  let nativeResult;
  try { nativeResult = JSON.parse(nativeJson); }
  catch (error) { throw new Error(`JSON nativo inválido: ${error.message}`); }
  const candidateVersion = parseStableVersion(nativeResult?.SemVer).text;
  if (nativeResult?.Sha === '') {
    const candidateTag = `v${candidateVersion}`;
    let taggedSha;
    try {
      taggedSha = execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${candidateTag}^{commit}`], {
        cwd: repository, encoding: 'utf8',
      }).trim();
    } catch {
      throw new Error(`SHA nativo vazio e não há tag ${candidateTag} no checkout`);
    }
    if (taggedSha.toLowerCase() !== sha.toLowerCase()) {
      throw new Error(`SHA nativo vazio e a tag ${candidateTag} não aponta para ${sha}`);
    }
  } else if (String(nativeResult?.Sha ?? '').toLowerCase() !== sha.toLowerCase()) {
    throw new Error(`SHA calculado diverge do SHA avaliado: ${nativeResult?.Sha ?? '<ausente>'} != ${sha}`);
  }
  const reachable = selectReachableStableTag(repository, sha);
  const baseVersion = reachable ?? '0.0.0';
  if (!reachable && candidateVersion !== '0.0.1') {
    throw new Error(`Sem tag estável, somente 0.0.1 é publicável; recebido ${candidateVersion}`);
  }
  return validateVersionReport({
    schemaVersion: 1,
    adapter: 'go-gitsemver',
    sha: sha.toLowerCase(),
    branch,
    baseVersion,
    candidateVersion,
    tag: `v${candidateVersion}`,
    bump: bumpBetween(baseVersion, candidateVersion),
    native: { format: 'json', result: nativeResult, explanation },
  });
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'validate-prefix') {
      process.stdout.write(`${validateTagPrefix(args[0])}\n`);
    } else if (command === 'ensure-new-tag') {
      const [repository, sha, candidate, prefix = 'v'] = args;
      const latest = selectReachableStableTag(repository, sha, prefix);
      if (latest && compareVersions(candidate, latest) <= 0) {
        throw Error(`Versão ${candidate} não supera a última tag alcançável ${prefix}${latest}`);
      }
    } else if (command === 'validate') {
      const report = JSON.parse(readFileSync(args[0], 'utf8'));
      process.stdout.write(`${JSON.stringify(validateVersionReport(report))}\n`);
    } else if (command === 'normalize-go') {
      const [nativePath, explanationPath, branch, sha, repository] = args;
      const report = normalizeGoReport({
        nativeJson: readFileSync(nativePath, 'utf8'),
        explanation: readFileSync(explanationPath, 'utf8'),
        branch, sha, repository,
      });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (command === 'normalize-standard' || command === 'normalize-jgitver') {
      const [nativePath, branch, sha, repository, tagPrefix = 'v'] = args;
      const normalize = command === 'normalize-standard' ? normalizeStandardVersionReport : normalizeJgitverReport;
      const report = normalize({ nativeOutput: readFileSync(nativePath, 'utf8'),
        branch, sha, repository, tagPrefix });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      throw new Error(`Subcomando desconhecido: ${command}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
