import {createHash} from 'node:crypto';
import {mkdirSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {Parser} from 'tar';
import {satisfies, validRange} from 'semver';
import picomatch from 'picomatch';
import {createGitPort} from '../ports/git.js';
import {runProcess, type ProcessRequest, type ProcessResult} from '../ports/process.js';
import {assertDistributionContext, inspectDistribution, readArtifact, sha256} from './artifact-safety.js';
import type {ArtifactFile, DistributionContext, DistributionReport} from './artifact-safety.js';

type Json = Record<string, unknown>;
type NpmAdapter = 'standard-version' | 'changesets' | 'release-please';
export interface NpmRelease {readonly package: string | null; readonly version: string; readonly tag: string; readonly status: 'created' | 'existing'}
export interface NpmArtifact extends ArtifactFile {
  readonly name: string;
  readonly version: string;
  readonly integrity: string;
  readonly files: readonly {readonly path: string; readonly size: number}[];
}
export interface NpmPublicationContext extends DistributionContext {
  readonly adapter: NpmAdapter;
  readonly projectPath: string;
  readonly publicationOutcome: string;
  readonly releasesJson: string;
  readonly stagingRoot: string;
}
export interface NpmDistributionInput extends NpmPublicationContext {readonly artifacts: readonly NpmArtifact[]}
export interface NpmTarget {readonly name: string; readonly version: string; readonly tag: string;
  readonly projectPath: string; readonly manifest: Json; readonly eligible: boolean}
export interface NpmPackageEvidence {readonly name: string; readonly version: string; readonly tag: string;
  readonly projectPath: string; readonly integrity: string;
  readonly files: readonly {readonly path: string; readonly size: number; readonly sha256: string}[]}
export interface NpmDistributionReport extends DistributionReport {readonly packages: readonly NpmPackageEvidence[]}
export interface NpmRegistryReader {lookup(artifact: NpmArtifact & {readonly coordinate: string}): Promise<Buffer | null | undefined>}
const namePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function object(value: unknown, label = 'JSON'): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} inválido`);
  return value as Json;
}
function safePath(path: string, allowRoot = false): string {
  if (allowRoot && path === '.') return '';
  if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\:\0]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Caminho/path npm inválido');
  return path;
}
function json(bytes: Buffer): Json { return object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown); }
function canonical(value: unknown): string {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ?
    Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,item]) => [k,sorted(item)])) : v;
  return JSON.stringify(sorted(value));
}
function verifyReferences(manifest: Json, targets: readonly NpmTarget[]): void {
  for (const field of ['dependencies','optionalDependencies','peerDependencies'] as const) {
    const deps = manifest[field] === undefined ? {} : object(manifest[field],field);
    for (const target of targets) {
      const range = deps[target.name];
      if (range === undefined) continue;
      if (!target.eligible) throw new Error(`Dependência interna não publicável: ${target.name}`);
      if (typeof range !== 'string' || !validRange(range)) throw new Error(`Protocolo/range de dependência não suportado: ${target.name}`);
      if (!satisfies(target.version,range)) throw new Error(`Dependência interna incompatível/antiga: ${target.name}`);
    }
  }
}

/** Native tags do not make private/ignored workspaces publishable. Paths come from committed lockfile manifests. */
export function resolveNpmTargets(input: NpmPublicationContext): readonly NpmTarget[] {
  assertDistributionContext(input);
  if (!['published','already-published'].includes(input.publicationOutcome)) throw new Error('Publicação não concluída para distribuição npm');
  if (!['standard-version','changesets','release-please'].includes(input.adapter)) throw new Error('Adaptador npm inválido');
  const project = safePath(input.projectPath,true), prefix = project ? project+'/' : '';
  const git = createGitPort(input.repository);
  const read = (path: string): Json => json(git.readBlob(input.publishedSha,prefix+path));
  const root = read('package.json');
  let candidates: {path: string; manifest: Json}[] = [{path:project || '.',manifest:root}];
  let ignored: string[] = [];
  if (input.adapter === 'changesets') {
    const lock = object(read('package-lock.json').packages,'Lockfile packages');
    const config = read('.changeset/config.json');
    if (config.ignore !== undefined && (!Array.isArray(config.ignore) || config.ignore.some(v => typeof v !== 'string'))) {
      throw new Error('Changesets ignore inválido');
    }
    ignored = Array.isArray(config.ignore) ? config.ignore as string[] : [];
    candidates.push(...Object.entries(lock).filter(([path,entry]) => path && !path.split('/').includes('node_modules') && object(entry).link !== true)
      .map(([path]) => ({path:prefix+safePath(path),manifest:read(path+'/package.json')})));
  }
  const isIgnored = (name: string): boolean => ignored.some(pattern => picomatch(pattern,{windows:false})(name));
  const parsed: unknown = JSON.parse(input.releasesJson);
  if (!Array.isArray(parsed) || !parsed.length || (input.adapter !== 'changesets' && parsed.length !== 1)) throw new Error('releases_json inválido/vazio');
  const names = new Set<string>(), tags = new Set<string>();
  const targets = parsed.map(value => {
    const release = object(value,'Release npm');
    if (typeof release.version !== 'string' || !versionPattern.test(release.version) || typeof release.tag !== 'string' ||
        typeof release.status !== 'string' || !['existing','created'].includes(release.status) || tags.has(release.tag)) throw new Error('Release npm sem versão/tag/status concluídos');
    tags.add(release.tag);
    if (input.adapter === 'changesets' ? typeof release.package !== 'string' || !namePattern.test(release.package) : release.package !== null) {
      throw new Error('Nome/package nativo incompatível com o perfil');
    }
    const matches = input.adapter === 'changesets' ? candidates.filter(c => c.manifest.name === release.package) : candidates;
    if (matches.length !== 1) throw new Error('Manifest package ausente/ambíguo no lockfile');
    const candidate = matches[0]!, manifest = candidate.manifest;
    if (typeof manifest.name !== 'string' || !namePattern.test(manifest.name) || names.has(manifest.name) ||
        manifest.version !== release.version || (manifest.private !== undefined && typeof manifest.private !== 'boolean')) {
      throw new Error('Manifest npm diverge de nome/versão aprovados');
    }
    if (input.adapter === 'changesets' && release.tag !== `${manifest.name}@${release.version}`) throw new Error('Tag diverge do namespace Changesets');
    names.add(manifest.name);
    return {name:manifest.name,version:release.version,tag:release.tag,projectPath:candidate.path,
      manifest,eligible:manifest.private !== true && !isIgnored(manifest.name)};
  }).sort((a,b) => a.name.localeCompare(b.name));
  if (canonical([...tags].sort()) !== canonical([...input.expectedTags].sort())) throw new Error('Tags esperadas divergem de releases_json');
  const references: NpmTarget[] = candidates.filter(c => typeof c.manifest.name === 'string').map(candidate => ({
    name:candidate.manifest.name as string, version:typeof candidate.manifest.version === 'string' ? candidate.manifest.version : '',
    tag:'',projectPath:candidate.path,manifest:candidate.manifest,
    eligible:candidate.manifest.private !== true && !isIgnored(candidate.manifest.name as string),
  }));
  for (const target of targets.filter(t => t.eligible)) verifyReferences(target.manifest,references);
  return targets;
}

/** Runs only npm pack --ignore-scripts; the caller builds explicitly in a credential-free job first. */
export async function packNpmArtifacts(input: NpmPublicationContext, dependencies: {
  readonly env?: NodeJS.ProcessEnv; readonly run?: (request: ProcessRequest) => ProcessResult;
} = {}): Promise<readonly NpmArtifact[]> {
  const targets = resolveNpmTargets(input).filter(t => t.eligible);
  const stagingRoot = resolve(input.stagingRoot), repository = realpathSync(input.repository);
  const rel = relative(repository,stagingRoot);
  if (!rel || (!rel.startsWith('..'+(process.platform === 'win32' ? '\\' : '/')) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('Staging npm deve ficar fora do checkout');
  }
  mkdirSync(stagingRoot,{recursive:true});
  if (lstatSync(stagingRoot).isSymbolicLink() || realpathSync(stagingRoot) !== stagingRoot) throw new Error('Staging npm contém symlink');
  const env = Object.fromEntries(Object.entries(dependencies.env ?? process.env).filter(([key]) =>
    !/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key) && key.toUpperCase() !== 'NODE_OPTIONS'));
  const artifacts: NpmArtifact[] = [];
  for (const target of targets) {
    const result = (dependencies.run ?? runProcess)({command:process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args:['pack','--json','--ignore-scripts','--pack-destination',stagingRoot], cwd:join(repository,target.projectPath),workspace:repository,env});
    const output: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(output) || output.length !== 1) throw new Error('Relatório npm pack inválido');
    const packed = object(output[0]);
    if (packed.name !== target.name || packed.version !== target.version || typeof packed.filename !== 'string' ||
        !Array.isArray(packed.files) || typeof packed.integrity !== 'string' || packed.filename.includes('/')) throw new Error('npm pack diverge do package elegível');
    const path = safePath(packed.filename), file = join(stagingRoot,path);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size < 1 || stat.size > 64*1024*1024) throw new Error('npm pack artifact inválido/symlink');
    // The destination and its file are regular; seal the exact bytes and recheck confinement.
    const sha = sha256(readFileSync(file));
    const artifact = {name:target.name,version:target.version,path,sha256:sha,integrity:packed.integrity,
      files:packed.files.map(value => { const entry = object(value); if (typeof entry.path !== 'string' || typeof entry.size !== 'number') throw new Error('Inventário npm pack inválido');
        return {path:entry.path,size:entry.size}; })};
    readArtifact(stagingRoot,artifact); artifacts.push(artifact);
  }
  assertDistributionContext(input);
  return artifacts;
}

interface TarFile {readonly path: string; readonly size: number; readonly sha256: string; readonly manifest?: Buffer}
async function inspectTarball(bytes: Buffer): Promise<readonly TarFile[]> {
  let raw: Buffer;
  try {raw = gunzipSync(bytes,{maxOutputLength:128*1024*1024});} catch {throw new Error('Tarball gzip inválido ou fora do limite');}
  return new Promise((done,fail) => {
    const files: TarFile[] = [], seen = new Set<string>(); let invalid: Error | undefined;
    const parser = new Parser({strict:true,onReadEntry:entry => {
      try {
        const path = entry.path.endsWith('/') ? entry.path.slice(0,-1) : entry.path;
        safePath(path);
        if (!(path === 'package' || path.startsWith('package/')) || seen.has(path) || seen.size >= 10000 ||
            !['File','Directory'].includes(entry.type) || entry.size > 16*1024*1024) throw new Error('Tarball path/tipo/tamanho inválido ou duplicado');
        seen.add(path);
        if (entry.type === 'Directory') {entry.resume();return;}
        const name = path.slice('package/'.length); safePath(name);
        const digest = createHash('sha256'), chunks: Buffer[] = []; let size = 0;
        if (name === 'package.json' && entry.size > 1024*1024) throw new Error('Manifest npm fora do limite');
        entry.on('data',(chunk: Buffer) => {size+=chunk.length;digest.update(chunk);if(name === 'package.json') chunks.push(chunk);});
        entry.on('end',() => {
          if (size !== entry.size) invalid = new Error('Tarball arquivo truncado');
          files.push({path:name,size,sha256:digest.digest('hex'),...(name === 'package.json' ? {manifest:Buffer.concat(chunks)} : {})});
        });
        entry.resume();
      } catch (error) {invalid = error instanceof Error ? error : new Error('Tarball inválido');entry.resume();}
    }});
    parser.on('error',fail);parser.on('end',() => invalid ? fail(invalid) : done(files.sort((a,b) => a.path.localeCompare(b.path))));
    try {parser.end(raw);} catch(error) {fail(error);}
  });
}
function entrypoints(manifest: Json): string[] {
  const result: string[] = [];
  const add = (value: unknown, exports = false): void => {
    if (typeof value === 'string') {
      if (exports && !value.startsWith('./')) throw new Error('Entrada exports npm não suportada');
      result.push(safePath(value.replace(/^\.\//,'')));
    } else if (value && typeof value === 'object') for (const item of Object.values(value)) add(item,exports);
    else if (value !== undefined && value !== null) throw new Error('Entrada npm inválida');
  };
  for (const key of ['main','module','types','typings','bin']) add(manifest[key]);
  add(manifest.exports,true); return result;
}

export async function validateNpmArtifacts(input: NpmDistributionInput, registry: NpmRegistryReader): Promise<NpmDistributionReport> {
  const targets = resolveNpmTargets(input), eligible = targets.filter(t => t.eligible), seen = new Set<string>();
  const evidence: NpmPackageEvidence[] = [];
  const artifacts = [...input.artifacts].sort((a,b) => a.name.localeCompare(b.name));
  for (const artifact of artifacts) {
    const target = eligible.find(t => t.name === artifact.name);
    if (!target || seen.has(artifact.name)) throw new Error('Package não elegível/privado/duplicado no lote npm');
    seen.add(artifact.name);
    if (artifact.version !== target.version) throw new Error('Tarball versão divergente');
    const bytes = readArtifact(input.stagingRoot,artifact);
    if (artifact.integrity !== 'sha512-'+createHash('sha512').update(bytes).digest('base64')) throw new Error('Tarball integrity SHA512 diverge');
    const files = await inspectTarball(bytes), packed = files.find(f => f.path === 'package.json');
    if (!packed?.manifest) throw new Error('Tarball sem package.json');
    const manifest = json(packed.manifest);
    if (canonical(manifest) !== canonical(target.manifest)) throw new Error('Tarball manifest divergente de nome/versão/dependências aprovadas');
    const expected = artifact.files.map(file => ({path:safePath(file.path),size:file.size})).sort((a,b) => a.path.localeCompare(b.path));
    if (canonical(files.map(({path,size}) => ({path,size}))) !== canonical(expected)) throw new Error('Inventário de arquivos npm diverge do tarball');
    const paths = new Set(files.map(f => f.path));
    for (const path of entrypoints(manifest)) {
      const regex = new RegExp('^'+path.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
      if (!paths.has(path) && (!path.includes('*') || ![...paths].some(p => regex.test(p)))) throw new Error(`Arquivo de entrada npm ausente: ${path}`);
    }
    verifyReferences(manifest,targets);
    evidence.push({name:target.name,version:target.version,tag:target.tag,projectPath:target.projectPath,
      integrity:artifact.integrity,files:files.map(({manifest:_manifest,...file}) => file)});
  }
  if (seen.size !== eligible.length) throw new Error('Lote npm incompleto: tarball elegível ausente');
  const report = await inspectDistribution(input, artifacts.map(a => ({...a,coordinate:`${a.name}@${a.version}`})), artifact => registry.lookup(artifact));
  // Recheck after asynchronous registry inspection; upload must revalidate the same manifest before sending bytes.
  for (const artifact of artifacts) readArtifact(input.stagingRoot,artifact);
  return {...report,packages:evidence};
}
