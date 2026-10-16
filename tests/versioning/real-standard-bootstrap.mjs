import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runProcess} from '../../scripts/versioning/process-runner.mjs';
import {calculateStandardVersion} from '../../scripts/versioning/adapters/standard-version.mjs';
import {captureVersionBundle,applyVersionBundle} from '../../scripts/versioning/version-bundle.mjs';

const scratch=mkdtempSync(join(tmpdir(),'real-standard-bootstrap-'));
const tools=join(scratch,'tools');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const json=value=>JSON.stringify(value,null,2)+'\n';
try {
  mkdirSync(tools);
  // An explicit manifest AND absolute prefix prevent npm finding an ancestor project.
  writeFileSync(join(tools,'package.json'),json({name:'bootstrap-fixture-tools',private:true}));
  const prefix=runProcess({command:npm,args:['prefix','--prefix',tools],cwd:tools,workspace:scratch}).stdout.trim();
  assert.equal(realpathSync(prefix),realpathSync(tools));
  runProcess({command:npm,args:['install','--prefix',tools,'--no-save','--package-lock=false',
    '--ignore-scripts','--no-audit','standard-version@9.5.0'],cwd:tools,workspace:scratch});
  const adapterBin=join(tools,'node_modules','.bin','standard-version'+(process.platform==='win32'?'.cmd':''));
  assert.ok(realpathSync(adapterBin).startsWith(realpathSync(tools)));
  assert.equal(JSON.parse(readFileSync(join(tools,'node_modules','standard-version','package.json'),'utf8')).version,'9.5.0');
  for(const [name,initial,config,expected] of [
    ['default-fix','0.0.0',null,'published-files'],
    ['release-as','0.0.0',{releaseAs:'0.0.1'},'published-files'],
    ['default-already-one','0.0.1',null,'bootstrap-rejected'],
    ['first-release-zero','0.0.0',{firstRelease:true},'missing-bump'],
    ['first-release-one','0.0.1',{firstRelease:true},'missing-bump'],
    ['same-version-formatted','0.0.1',{releaseAs:'0.0.1'},'unchanged-manifest'],
  ]) {
    const repo=join(scratch,name);mkdirSync(repo);
    const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
    git('init','-qb','master');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');
    const pkg=json({name:'fixture',version:initial,private:true});
    const lock=json({name:'fixture',version:initial,lockfileVersion:3,requires:true,
      packages:{'':{name:'fixture',version:initial}}});
    writeFileSync(join(repo,'package.json'),pkg);writeFileSync(join(repo,'package-lock.json'),lock);
    if(config)writeFileSync(join(repo,'.versionrc.json'),json(config));
    git('add','.');git('commit','-qm','chore: initialize fixture');
    writeFileSync(join(repo,'fix.txt'),'bootstrap correction\n');git('add','.');git('commit','-qm','fix: bootstrap');
    const sha=git('rev-parse','HEAD');
    const context={workspace:repo,projectDirectory:repo,targetBranch:'master',tagPrefix:'v',sha,adapterBin,env:process.env};
    if(expected==='missing-bump'||expected==='bootstrap-rejected') {
      assert.throws(()=>calculateStandardVersion(context),expected==='missing-bump'
        ?/standard-version não informou a versão calculada/:/somente 0\.0\.1/);
      assert.equal(readFileSync(join(repo,'package.json'),'utf8'),pkg);
      assert.equal(readFileSync(join(repo,'package-lock.json'),'utf8'),lock);
      assert.equal(git('status','--porcelain'),'');
    }else {
      const report=calculateStandardVersion(context);
      assert.deepEqual({version:report.candidateVersion,base:report.baseVersion,tag:report.tag,bump:report.bump,sha:report.sha},
        {version:'0.0.1',base:'0.0.0',tag:'v0.0.1',bump:'patch',sha});
      runProcess({command:adapterBin,args:['--skip.commit','--skip.tag','--tag-prefix','v'],cwd:repo,workspace:repo});
      if(expected==='unchanged-manifest') {
        assert.equal(readFileSync(join(repo,'package.json'),'utf8'),pkg);
        assert.throws(()=>captureVersionBundle({repository:repo,projectPath:'.',report}),/não altera o package.json/);
      }else {
        const bundle=captureVersionBundle({repository:repo,projectPath:'.',report});
        assert.deepEqual(bundle.files.map(f=>f.path).sort(),['CHANGELOG.md','package-lock.json','package.json']);
        const native=bundle.files.map(f=>[f.path,readFileSync(join(repo,f.path))]);
        writeFileSync(join(repo,'package.json'),pkg);writeFileSync(join(repo,'package-lock.json'),lock);
        rmSync(join(repo,'CHANGELOG.md'));
        assert.deepEqual(applyVersionBundle({repository:repo,projectPath:'.',report,bundle}).sort(),
          ['CHANGELOG.md','package-lock.json','package.json']);
        for(const [path,bytes] of native)assert.deepEqual(readFileSync(join(repo,path)),bytes);
        assert.equal(JSON.parse(readFileSync(join(repo,'package.json'),'utf8')).version,'0.0.1');
        const appliedLock=JSON.parse(readFileSync(join(repo,'package-lock.json'),'utf8'));
        assert.equal(appliedLock.version,'0.0.1');assert.equal(appliedLock.packages[''].version,'0.0.1');
        assert.match(readFileSync(join(repo,'CHANGELOG.md'),'utf8'),/0\.0\.1/);
      }
    }
    assert.equal(git('rev-parse','HEAD'),sha,'native and bundle must not commit');
    assert.equal(git('tag','--list'),'','native and bundle must not tag');
  }
  console.log('Real standard-version bootstrap: 2 native generation/replays and 4 rejection cases passed');
}finally {rmSync(scratch,{recursive:true,force:true});}
