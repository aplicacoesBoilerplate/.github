import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '../../scripts/versioning/node_modules/typescript/lib/typescript.js';

const root = resolve(import.meta.dirname, '../..'), prefix = 'scripts/versioning/';
const contracts = {
  'adapter-registry': ['compat/adapters', ['resolveAdapter']],
  'adapters/go-gitsemver': ['compat/adapters', ['calculateGo']],
  'adapters/jgitver': ['compat/adapters', ['collectJgitver']],
  'adapters/standard-version': ['compat/adapters', ['calculateStandardVersion']],
  'changesets-version-pr': ['compat/changesets-version-pr', ['planDigest','verifyChangesetsFiles']],
  'collect-version-report': ['compat/adapters', []],
  'git-inputs': ['ports/git', ['captureGitInputs','verifyGitInputs']],
  'homologation-guide': ['compat/operations', ['buildHomologationGuide']],
  'install-maven': ['compat/operations', []], 'install-node': ['compat/operations', []],
  'java-properties': ['adapters/java-properties', ['parseJavaProperties']],
  'process-runner': ['ports/process', ['runProcess']],
  'publish-changesets': ['compat/publish-changesets', ['publishChangesets','githubApi']],
  'release-policy': ['services/release-policy', ['evaluateReleasePolicy']],
  'sync-npm-lock': ['compat/operations', []],
  'verify-version-files': ['compat/version-pr', []],
  'version-bundle': ['services/legacy-version-bundle', ['captureVersionBundle','applyVersionBundle','validateVersionBundle']],
  'version-pr': ['compat/version-pr', ['parseVersionPr','validateHumanReview','verifyVersionFiles']],
  'version-report': ['compat/version-report', ['validateTagPrefix','parseStableVersion','bumpBetween',
    'selectReachableStableTag','validateVersionReport','normalizeChangesetsReport',
    'normalizeStandardVersionReport','normalizeJgitverReport','normalizeGoReport']],
};
function inventory() {
  const files = new Map();
  function visit(path) {
    for (const item of readdirSync(join(root,path),{withFileTypes:true})) {
      if (['node_modules','.git','tools'].includes(item.name)) continue;
      const name=posix.join(path,item.name);
      if(item.isSymbolicLink())throw Error('Unexpected central inventory symlink: '+name);
      if(item.isDirectory())visit(name);
      else if(/\.(?:mjs|cjs|js|ts|yml|yaml|sh)$/.test(name))files.set(name,readFileSync(join(root,name),'utf8'));
    }
  }
  for(const path of ['scripts/versioning','.github/workflows','tests/versioning'])visit(path);
  return files;
}
export function inspectInventory(files) {
  const errors=[];
  for(const [path,source]of files){
    if(path.startsWith(prefix)&&path.endsWith('.'+'sh'))errors.push('central Shell: '+path);
    // An escaped negative assertion is not an executable reference to a retired script.
    if(/(?<!\\)\.sh\b/.test(source))errors.push('referenced Shell: '+path);
    if(path.startsWith(prefix+'src/')&&/\.mjs['"]/.test(source))errors.push('manual JS bridge: '+path);
    if(path.startsWith(prefix)&&!path.startsWith(prefix+'dist/')&&/\.(?:js|cjs)$/.test(path))errors.push('manual JS outside dist: '+path);
    if(!path.startsWith(prefix)||path.startsWith(prefix+'dist/')||!path.endsWith('.mjs'))continue;
    const name=path.slice(prefix.length,-4),rule=contracts[name];
    if(!rule){errors.push('unregistered/manual JS: '+path);continue;}
    const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const exported=new Set();let star=false,guard=false;
    for(const statement of file.statements){
      if(ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement)){
        const specifier=statement.moduleSpecifier;
        if(!specifier||!ts.isStringLiteral(specifier)){errors.push('invalid facade import: '+path);continue;}
        const target=posix.normalize(posix.join(posix.dirname(path),specifier.text));
        if(!target.startsWith(prefix+'dist/')||!target.endsWith('.js')||!files.has(target))errors.push('invalid facade target: '+path);
        if(ts.isImportDeclaration(statement)&&target===prefix+'dist/compat/cli.js'){
          const elements=statement.importClause?.namedBindings?.elements??[];
          guard=elements.some(item=>item.name.text==='runIfMain'&&(item.propertyName?.text??item.name.text)==='runIfMain');
        }
        if(ts.isExportDeclaration(statement)){
          if(target!==prefix+'dist/'+rule[0]+'.js')errors.push('incompatible facade target: '+path);
          if(!statement.exportClause)star=true;
          else if(ts.isNamedExports(statement.exportClause))for(const item of statement.exportClause.elements){
            exported.add(item.name.text);
            if(item.propertyName&&item.propertyName.text!==item.name.text)errors.push('incompatible facade alias: '+path);
          }
        }
      }else if(ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression)&&
        statement.expression.expression.getText(file)==='runIfMain'&&guard&&
        statement.expression.arguments.length===2&&statement.expression.arguments[0].getText(file)==='import.meta.url'&&
        statement.expression.arguments[1].getText(file)==='main'){
        // Only the compiled main dispatcher may run at facade evaluation time.
      }else errors.push('manual JS business logic: '+path);
    }
    if(!star&&rule[1].some(name=>!exported.has(name)))errors.push('incompatible facade exports: '+path);
  }
  for(const name of Object.keys(contracts))if(!files.has(prefix+name+'.mjs'))errors.push('missing facade: '+name);
  return errors;
}

const files=inventory();
assert.deepEqual(inspectInventory(files),[],'the executable tree must contain no central Shell or manual JS implementation');
const referenced=new Map(files);
referenced.set('.github/workflows/mutant.yml','run: bash scripts/versioning/publish'+'.'+'sh');
assert.ok(inspectInventory(referenced).some(error=>error.includes('referenced Shell')));
for(const extension of ['mjs','js','cjs']){
  const manual=new Map(files);manual.set(prefix+'mutant.'+extension,'export function calculate(){return "bad";}');
  assert.ok(inspectInventory(manual).some(error=>error.includes('manual JS')));
}
const broken=new Map(files);broken.set(prefix+'version-pr.mjs',"export { parseVersionPr } from './dist/compat/version-pr.js';");
assert.ok(inspectInventory(broken).some(error=>error.includes('incompatible facade exports')));
for(const [name,[target,required]]of Object.entries(contracts)){
  const facade=await import(pathToFileURL(join(root,prefix+name+'.mjs')).href);
  const compiled=await import(pathToFileURL(join(root,prefix+'dist/'+target+'.js')).href);
  for(const exported of required){assert.equal(typeof facade[exported],'function',name+': '+exported);
    assert.equal(facade[exported],compiled[exported],name+' must reexport the compiled implementation');}
}
console.log('Migration inventory: conforming tree, Shell reference, manual JS and facade export mutants rejected');
