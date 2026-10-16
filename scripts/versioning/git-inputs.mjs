import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';

const git=(repository,args)=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
export function captureGitInputs(repository,adapter){
  if(!['go-gitsemver','jgitver','standard-version'].includes(adapter))throw new Error('Adaptador de snapshot inválido');
  const prefixes=adapter==='go-gitsemver'?['refs/tags','refs/heads','refs/remotes']:['refs/tags'];
  const raw=git(repository,['for-each-ref','--sort=refname','--format=%(refname)\t%(objectname)',...prefixes]);
  return {schemaVersion:1,adapter,sha:git(repository,['rev-parse','HEAD']),
    refs:Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(line=>line.split('\t')))};
}
export function verifyGitInputs(repository,snapshot,sha,tag,adapter){
  if(snapshot?.schemaVersion!==1||snapshot.adapter!==adapter||snapshot.sha!==sha||!snapshot.refs||
    typeof snapshot.refs!=='object'||Array.isArray(snapshot.refs))throw new Error('Snapshot Git diverge de SHA/adaptador');
  const current=captureGitInputs(repository,adapter);
  if(current.sha!==sha)throw new Error('Checkout Git diverge do SHA avaliado');
  const expected={...snapshot.refs},actual={...current.refs},candidate='refs/tags/'+tag;
  if(!Object.hasOwn(expected,candidate)&&Object.hasOwn(actual,candidate)){
    const target=git(repository,['rev-parse',candidate+'^{commit}']);
    if(target===sha)delete actual[candidate];
  }
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('As referências Git mudaram; reexecute a validação de leitura antes de publicar');
  return true;
}
if(process.argv[1]&&import.meta.filename===process.argv[1]){
  try{
    const [mode,repository,path,sha,tag,adapter]=process.argv.slice(2);
    if(mode==='capture')writeFileSync(path,JSON.stringify(captureGitInputs(repository,sha),null,2)+'\n');
    else if(mode==='verify')verifyGitInputs(repository,JSON.parse(readFileSync(path,'utf8')),sha,tag,adapter);
    else throw new Error('Modo de snapshot Git inválido');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
