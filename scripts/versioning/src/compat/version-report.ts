import { readFileSync } from 'node:fs';
import { bumpBetween } from '../adapter-contract.js';
import { collectGoVersion } from '../adapters/go-gitsemver.js';
import { collectStandardVersion } from '../adapters/standard-version.js';
import { normalizeJgitverReport as normalizeJgitver, type JgitverNative } from '../adapters/jgitver.js';
import { selectReachableStableTag as selectTag, validateTagPrefix } from '../services/version-baseline.js';
import { argument } from './cli.js';
export { bumpBetween, validateTagPrefix };

export interface LegacyRelease { name: string; oldVersion: string; version: string; tag: string; bump: string }
export interface LegacyReport {
  schemaVersion: 1; adapter: string; sha: string; branch: string; tagPrefix?: string;
  baseVersion: string; candidateVersion: string; tag: string; bump: string; tagKind?: string;
  releases?: LegacyRelease[];
  native: { format: string; result: Readonly<Record<string, unknown>>; explanation: string };
}
const shaPattern = /^[0-9a-f]{40}$/i;
const stable = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseStableVersion(value: unknown): { text: string; parts: number[] } {
  const match = stable.exec(String(value ?? '').trim());
  if (!match) throw new Error(`SemVer estável inválido: ${String(value)}`);
  return { text: `${match[1]}.${match[2]}.${match[3]}`, parts: match.slice(1).map(Number) };
}
export function selectReachableStableTag(repository: string, sha: string, prefix = 'v'): string | null {
  return selectTag(repository, repository, sha, prefix);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('VersionReport inválido');
  return value as Record<string, unknown>;
}
export function validateVersionReport(input: unknown): LegacyReport {
  const report = object(input);
  if (report.schemaVersion !== 1) throw new Error('VersionReport schemaVersion deve ser 1');
  if (!['go-gitsemver', 'standard-version', 'jgitver', 'changesets'].includes(String(report.adapter))) {
    throw new Error(`Adaptador não suportado: ${String(report.adapter)}`);
  }
  if (typeof report.sha !== 'string' || !shaPattern.test(report.sha)) throw new Error('VersionReport sha inválido');
  if (typeof report.branch !== 'string' || !report.branch) throw new Error('VersionReport branch inválida');
  const base = parseStableVersion(report.baseVersion).text;
  const candidate = parseStableVersion(report.candidateVersion).text;
  const prefix = validateTagPrefix((report.tagPrefix ?? 'v') as string);
  if (report.adapter === 'go-gitsemver' && prefix !== 'v') throw new Error('go-gitsemver usa prefixo v neste contrato');
  if (report.adapter === 'changesets') {
    if (prefix !== 'v' || !Array.isArray(report.releases) || !report.releases.length) {
      throw new Error('Changesets requer plano não vazio e TAG_PREFIX=v');
    }
    const names = new Set<unknown>();
    for (const source of report.releases) {
      const item = object(source);
      if (typeof item.name !== 'string' || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(item.name) ||
        names.has(item.name) || parseStableVersion(item.oldVersion).text !== item.oldVersion ||
        parseStableVersion(item.version).text !== item.version || item.tag !== `${item.name}@${String(item.version)}` ||
        bumpBetween(String(item.oldVersion), String(item.version)) === 'none') throw new Error('Release Changesets inválida, duplicada ou sem incremento');
      names.add(item.name);
    }
    const first = object(report.releases[0]);
    if (report.tag !== first.tag || report.candidateVersion !== first.version || report.baseVersion !== first.oldVersion) {
      throw new Error('Projeção Changesets diverge do plano');
    }
  } else if (report.tag !== `${prefix}${String(report.candidateVersion)}`) throw new Error('VersionReport tag diverge da versão candidata');
  if (!['none', 'patch', 'minor', 'major'].includes(String(report.bump))) throw new Error('VersionReport bump inválido');
  if (report.bump !== bumpBetween(base, candidate)) throw new Error('VersionReport incremento divergente');
  const native = object(report.native);
  if (!['json', 'text', 'java-properties'].includes(String(native.format)) || typeof native.explanation !== 'string') {
    throw new Error('VersionReport native inválido');
  }
  if (['go-gitsemver', 'changesets'].includes(String(report.adapter)) && native.format !== 'json') throw new Error(`${String(report.adapter)} exige JSON nativo`);
  const result = object(native.result);
  if (report.adapter === 'go-gitsemver' && (parseStableVersion(result.SemVer).text !== candidate ||
    result.Sha !== '' && String(result.Sha).toLowerCase() !== report.sha.toLowerCase())) throw new Error('VersionReport native Go divergente');
  if (report.adapter === 'standard-version' && (native.format !== 'text' || result.version !== candidate)) throw new Error('VersionReport native standard-version divergente');
  if (report.adapter === 'jgitver' && report.tagKind !== 'annotated') throw new Error('VersionReport native jgitver exige tag anotada');
  if (report.adapter === 'jgitver' && (native.format !== 'java-properties' ||
    result['jgitver.used_version'] !== candidate || result['jgitver.calculated_version'] !== candidate ||
    String(result['jgitver.git_sha1_full']).toLowerCase() !== report.sha.toLowerCase() || result['jgitver.plugin-version'] !== '1.9.0')) {
    throw new Error('VersionReport native jgitver divergente');
  }
  return input as LegacyReport;
}
type Context = { repository: string; branch: string; sha: string; tagPrefix?: string };
export function normalizeGoReport(request: Context & { nativeJson: string; explanation: string }): LegacyReport {
  return validateVersionReport(collectGoVersion({ repository: request.repository, workspace: request.repository,
    projectPath: '.', targetBranch: request.branch, sha: request.sha, tagPrefix: 'v', configuration: {} },
  { run: () => ({ stdout: request.nativeJson, stderr: request.explanation }) }));
}
export function normalizeStandardVersionReport(request: Context & { nativeOutput: string }): LegacyReport {
  return validateVersionReport(collectStandardVersion({ repository: request.repository, workspace: request.repository,
    projectPath: '.', targetBranch: request.branch, sha: request.sha, tagPrefix: request.tagPrefix ?? 'v', configuration: {} },
  { run: () => ({ stdout: request.nativeOutput, stderr: '' }) }));
}
export function normalizeJgitverReport(request: Context & { native: JgitverNative }): LegacyReport {
  return validateVersionReport(normalizeJgitver(request));
}
export function normalizeChangesetsReport(request: { nativeJson: string; explanation: string; branch: string; sha: string }): LegacyReport {
  if (!shaPattern.test(request.sha)) throw new Error('SHA avaliado inválido');
  let source: Record<string, unknown>;
  try { source = object(JSON.parse(request.nativeJson)); }
  catch { throw new Error('JSON Changesets inválido'); }
  if (!Array.isArray(source.releases) || !source.releases.length || !Array.isArray(source.changesets) || !source.changesets.length) {
    throw new Error('Changesets não encontrou um plano de release com changesets');
  }
  const releases = source.releases.map(value => {
    const item = object(value);
    const version = parseStableVersion(item.newVersion).text;
    return { name: String(item.name), oldVersion: String(item.oldVersion), version,
      tag: `${String(item.name)}@${String(item.newVersion)}`, bump: bumpBetween(String(item.oldVersion), version) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const first = releases[0]!;
  return validateVersionReport({ schemaVersion: 1, adapter: 'changesets', sha: request.sha.toLowerCase(),
    branch: request.branch, tagPrefix: 'v', baseVersion: first.oldVersion, candidateVersion: first.version,
    tag: first.tag, bump: first.bump, releases, native: { format: 'json', result: source,
      explanation: request.explanation || 'Plano nativo do Changesets' } });
}
export function main(args: readonly string[]): void {
  const command = argument(args, 0), get = (index: number) => argument(args, index);
  const json = (index: number): unknown => JSON.parse(readFileSync(get(index), 'utf8'));
  let result: unknown;
  if (command === 'validate-prefix') result = validateTagPrefix(get(1));
  else if (command === 'ensure-new-tag') {
    const latest = selectReachableStableTag(get(1), get(2), args[4] ?? 'v');
    if (latest && bumpBetween(latest, parseStableVersion(get(3)).text) === 'none') throw new Error(`Versão ${get(3)} não supera a última tag alcançável ${latest}`);
    return;
  } else if (command === 'validate') result = validateVersionReport(json(1));
  else if (command === 'normalize-go') result = normalizeGoReport({ nativeJson: readFileSync(get(1), 'utf8'),
    explanation: readFileSync(get(2), 'utf8'), branch: get(3), sha: get(4), repository: get(5) });
  else if (command === 'normalize-changesets') {
    if ((args[5] ?? 'v') !== 'v') throw new Error('Changesets usa tags nativas name@version; TAG_PREFIX deve permanecer v');
    result = normalizeChangesetsReport({ nativeJson: readFileSync(get(1), 'utf8'), explanation: '', branch: get(2), sha: get(3) });
  } else if (command === 'normalize-standard' || command === 'normalize-jgitver') {
    const context = { branch: get(2), sha: get(3), repository: get(4), tagPrefix: args[5] ?? 'v' };
    result = command === 'normalize-standard' ? normalizeStandardVersionReport({ ...context, nativeOutput: readFileSync(get(1), 'utf8') }) :
      normalizeJgitverReport({ ...context, native: json(1) as JgitverNative });
  } else throw new Error(`Subcomando desconhecido: ${command}`);
  process.stdout.write(`${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}\n`);
}
