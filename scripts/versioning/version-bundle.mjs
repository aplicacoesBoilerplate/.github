import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,realpathSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,posix} from 'node:path';
import {validateVersionReport,validateTagPrefix} from './version-report.mjs';
import {verifyVersionFiles} from './version-pr.mjs';

const limit=10*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(repository,args)=>execFileSync('git',args,{cwd:repository,stdio:['ignore','pipe','pipe']});
function project(value){
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_./-]+$/.test(value)||value.startsWith('/')||value.split('/').includes('..'))throw Error('project path inválido');
  return posix.normalize(value).replace(/\/$/,'');
}
function allowedPath(root,path,projectPath){
  const prefix=projectPath==='.'?'':projectPath+'/';
  if(!['package.json','package-lock.json','npm-shrinkwrap.json','CHANGELOG.md'].some(name=>path===prefix+name))throw Error('arquivo/path não permitido');
  let current=root;
  for(const part of path.split('/')){
    current=join(current,part);
    let entry;
    try{entry=lstatSync(current);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(entry?.isSymbolicLink())throw Error('arquivo/path symlink não permitido');
  }
  return current;
}
function baseHash(root,sha,path){
  const entry=git(root,['ls-tree','-z',sha,'--',path]).toString();
  if(!entry)return null;
  if(!/^100(?:644|755) blob /.test(entry))throw Error('arquivo base não regular');
  return digest(git(root,['show',sha+':'+path]));
}
function identity(root,report,projectPath){
  validateVersionReport(report);validateTagPrefix(report.tagPrefix??'v');
  if(report.adapter!=='standard-version'||git(root,['rev-parse','HEAD']).toString().trim()!==report.sha)throw Error('Bundle SHA/adaptador divergente');
  return project(projectPath);
}
function verifyPayload(root,projectPath,version,records){
  const prefix=projectPath==='.'?'':projectPath+'/';
  const get=name=>records.get(prefix+name)??(existsSync(allowedPath(root,prefix+name,projectPath))?readFileSync(join(root,prefix+name)):null);
  const pkg=JSON.parse(get('package.json')?.toString()??'null');
  if(pkg?.version!==version)throw Error('package.json diverge da versão homologada');
  let locks=0;
  for(const name of ['package-lock.json','npm-shrinkwrap.json']){
    const raw=get(name);if(!raw)continue;locks++;
    const lock=JSON.parse(raw);
    if(lock.version!==version||(lock.packages?.['']&&lock.packages[''].version!==version))throw Error('lockfile diverge da versão homologada');
  }
  if(!locks)throw Error('Bundle sem lockfile npm');
  const changelog=get('CHANGELOG.md')?.toString()??'';
  if(!new RegExp('(?:^|\\n)#{1,3}\\s+\\[?'+version.replaceAll('.','\\.')+'\\]?(?:\\s|$|\\()').test(changelog))throw Error('Changelog diverge da versão homologada');
}
export function captureVersionBundle({repository,projectPath,report}){
  const root=realpathSync(repository),selected=identity(root,report,projectPath);
  verifyVersionFiles({repository:root,projectPath:selected,version:report.candidateVersion});
  const paths=execFileSync(process.execPath,[join(import.meta.dirname,'verify-version-files.mjs'),'working','standard-version',selected],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const files=paths.map(path=>{
    const target=allowedPath(root,path,selected);
    if(!lstatSync(target).isFile())throw Error('arquivo não regular');
    const bytes=readFileSync(target);
    return {path,before:baseHash(root,report.sha,path),hash:digest(bytes),content:bytes.toString('base64')};
  });
  const bundle={schemaVersion:1,adapter:'standard-version',sha:report.sha,version:report.candidateVersion,
    tagPrefix:report.tagPrefix??'v',projectPath:selected,files};
  validateFiles(root,bundle,report,selected,false);
  return bundle;
}
function validateFiles(root,bundle,report,selected,checkWorking){
  if(bundle?.schemaVersion!==1||bundle.adapter!=='standard-version'||bundle.sha!==report.sha)throw Error('Bundle SHA/schema divergente');
  if(bundle.version!==report.candidateVersion||bundle.tagPrefix!==(report.tagPrefix??'v')||bundle.projectPath!==selected)throw Error('Bundle identidade divergente');
  if(!Array.isArray(bundle.files)||!bundle.files.length||bundle.files.length>4)throw Error('Bundle arquivos inválidos');
  const records=new Map();let bytesTotal=0;
  for(const entry of bundle.files){
    if(!entry||typeof entry.path!=='string')throw Error('Bundle arquivo inválido');
    const target=allowedPath(root,entry.path,selected);
    if(records.has(entry.path)||typeof entry.content!=='string')throw Error('Bundle arquivo duplicado/inválido');
    const bytes=Buffer.from(entry.content,'base64');bytesTotal+=bytes.length;
    if(bytesTotal>limit)throw Error('Bundle excede limite de10MiB');
    if(bytes.toString('base64')!==entry.content||digest(bytes)!==entry.hash)throw Error('Bundle hash/conteúdo divergente');
    if(baseHash(root,report.sha,entry.path)!==entry.before)throw Error('Bundle base divergente');
    if(checkWorking&&(existsSync(target)?digest(readFileSync(target)):null)!==entry.before)throw Error('Checkout base divergente');
    records.set(entry.path,bytes);
  }
  const prefix=selected==='.'?'':selected+'/';
  if(!records.has(prefix+'package.json'))throw Error('Bundle não altera package.json');
  verifyPayload(root,selected,report.candidateVersion,records);
  return records;
}
export function applyVersionBundle({repository,bundle,report,projectPath}){
  const root=realpathSync(repository),selected=identity(root,report,projectPath);
  const records=validateFiles(root,bundle,report,selected,true);
  for(const [path,bytes] of records)writeFileSync(allowedPath(root,path,selected),bytes);
  return [...records.keys()];
}
if(process.argv[1]&&import.meta.filename===process.argv[1]){
  try{
    const [mode,repository,projectPath,reportPath,bundlePath]=process.argv.slice(2);
    const report=JSON.parse(readFileSync(reportPath,'utf8'));
    if(mode==='capture')writeFileSync(bundlePath,JSON.stringify(captureVersionBundle({repository,projectPath,report}))+'\n');
    else if(mode==='apply'){
      if(statSync(bundlePath).size>16*1024*1024)throw Error('Bundle excede limite serializado');
      process.stdout.write(applyVersionBundle({repository,projectPath,report,bundle:JSON.parse(readFileSync(bundlePath,'utf8'))}).join('\n'));
    }else throw Error('Modo de bundle inválido');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
