import { appendFileSync, readFileSync } from 'node:fs';
import { runProcess } from '../ports/process.js';
import { createReadApi, createWriteApi, type ReadApi, type WriteApi } from '../ports/github.js';
import { adapterCapabilities, planFromReport, validateDescriptor, bumpBetween } from '../adapter-contract.js';
import { publishReleasePlan } from '../services/publication.js';
import { validateVersionReport } from './version-report.js';
import { argument } from './cli.js';

type Maybe<T> = T | Promise<T>;
export interface ChangesetsApi {
  getTag(tag: string): Maybe<string | null>;
  getRelease(tag: string): Maybe<unknown | null>;
  createTag(tag: string, sha: string): Maybe<unknown>;
  createRelease(tag: string, sha: string, body: string): Maybe<unknown>;
  latestVersion?(name: string, sha: string): Maybe<string | null>;
}

/** Legacy-shaped API adapter; all reconciliation is performed by the common publisher. */
export async function publishChangesets(request: { report: unknown; sha: string; stale: boolean; api: ChangesetsApi }) {
  const report = validateVersionReport(request.report), { api, sha, stale } = request;
  if (report.adapter !== 'changesets' || !/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Plano Changesets ou SHA de publicação inválido');
  const plan = planFromReport(report, validateDescriptor({ id:'changesets', ...adapterCapabilities.changesets,
    collect:()=>report, prepare:()=>undefined }), '.');
  for (const entry of plan.entries) {
    if (!await api.getTag(entry.tag) && api.latestVersion) {
      const latest = await api.latestVersion(entry.package!, sha);
      if (latest && bumpBetween(latest, entry.version) === 'none') throw new Error(`Versão ${entry.tag} não supera a última tag ${latest}`);
    }
  }
  const tag = (endpoint: string, prefix: string) => decodeURIComponent(endpoint.slice(endpoint.indexOf(prefix) + prefix.length));
  const read: ReadApi = {
    async get() { return {object:{sha:stale?(sha==='f'.repeat(40)?'e':'f').repeat(40):sha}}; },
    async getOptional(endpoint) {
      if (endpoint.includes('/git/ref/tags/')) { const value=await api.getTag(tag(endpoint,'/git/ref/tags/'));
        return value ? {object:{type:'commit',sha:value}} : null; }
      return api.getRelease(tag(endpoint,'/releases/tags/'));
    },
    async list() { throw new Error('list não suportado'); }, async listField() { throw new Error('listField não suportado'); },
  };
  const unsupported = async (): Promise<never> => { throw new Error('Mutação não suportada'); };
  const write: WriteApi = { async post(endpoint, value) {
    const body = value as Record<string,string>;
    if (endpoint.endsWith('/git/refs')) return api.createTag(body.ref!.slice('refs/tags/'.length),body.sha!);
    return api.createRelease(body.tag_name!,body.target_commitish!,body.body!);
  }, patch:unsupported, put:unsupported, delete:unsupported };
  const result = await publishReleasePlan({owner:'legacy',repo:'compat',plan,publishedSha:sha,read,write,
    verify:async()=>({publishedSha:sha})});
  if (!result.publishedSha) throw new Error(result.outcome==='conflict'?'Conflito: '+result.error:
    stale?'Push antigo com lote Changesets incompleto; nenhuma escrita será feita':result.error??'Publicação incompleta');
  const releases=plan.entries.map(entry=>({name:entry.package!,version:entry.version,tag:entry.tag,
    release_url:result.entries.find(value=>value.tag===entry.tag)!.releaseUrl!,published_sha:sha}));
  const single=releases.length===1?releases[0]:null;
  return {outcome:result.outcome,publishedSha:sha,version:single?.version??'',tag:single?.tag??'',
    releaseUrl:single?.release_url??'',releases};
}

export function githubApi(repository: string, workspace: string): ChangesetsApi {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Repositório inválido');
  const transport = async (request: { url:string; method:string; body?:unknown }) => {
    const response=await fetch(request.url,{method:request.method,headers:{Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${process.env.GH_TOKEN??process.env.GITHUB_TOKEN??''}`,
      ...(request.body===undefined?{}:{'Content-Type':'application/json'})},
      ...(request.body===undefined?{}:{body:JSON.stringify(request.body)})});
    const raw=await response.text();return {status:response.status,headers:Object.fromEntries(response.headers.entries()),body:raw?JSON.parse(raw):null};
  };
  const read=createReadApi(transport),write=createWriteApi(transport),scope='repos/'+repository;
  return {
    async getTag(tag) {
      const ref=await read.getOptional(scope+'/git/ref/tags/'+encodeURIComponent(tag)) as {object?:{type?:string;sha?:string}}|null;
      if(!ref)return null;
      if(ref.object?.type!=='commit'||!/^[0-9a-f]{40}$/i.test(ref.object.sha??'')) throw new Error('Changesets exige tag lightweight em commit');
      return ref.object.sha!;
    },
    getRelease:tag=>read.getOptional(scope+'/releases/tags/'+encodeURIComponent(tag)),
    createTag:(tag,sha)=>write.post(scope+'/git/refs',{ref:'refs/tags/'+tag,sha}),
    createRelease:(tag,sha,body)=>write.post(scope+'/releases',{tag_name:tag,target_commitish:sha,name:tag,body}),
    latestVersion(name,sha){
      const tags=runProcess({command:'git',args:['tag','--merged',sha],cwd:workspace,workspace}).stdout;
      return tags.split(/\r?\n/).filter(tag=>tag.startsWith(name+'@')).map(tag=>tag.slice(name.length+1))
        .filter(version=>/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
        .sort((a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return x[0]!-y[0]!||x[1]!-y[1]!||x[2]!-y[2]!;}).at(-1)??null;
    },
  };
}
export async function main(args: readonly string[]): Promise<void> {
  const {GITHUB_SHA:sha,GITHUB_REPOSITORY:repository,GITHUB_WORKSPACE:workspace}=process.env;
  if(!sha||!repository||!workspace)throw new Error('Contexto GitHub obrigatório');
  const result=await publishChangesets({report:JSON.parse(readFileSync(argument(args,0),'utf8')),sha,
    stale:process.env.STALE_PUSH==='1',api:githubApi(repository,workspace)});
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,Object.entries({version:result.version,
    tag:result.tag,published_sha:result.publishedSha,release_url:result.releaseUrl,outcome:result.outcome,
    version_pr_url:process.env.VERSION_PR_NUMBER?`https://github.com/${repository}/pull/${process.env.VERSION_PR_NUMBER}`:'',
    releases_json:JSON.stringify(result.releases)}).map(([key,value])=>key+'='+value).join('\n')+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Changesets: ${result.outcome}\n${result.releases.map(item=>`- ${item.tag}: ${item.release_url}`).join('\n')}\n`);
  process.stdout.write(result.outcome+': '+result.releases.map(item=>item.tag).join(', ')+'\n');
}
