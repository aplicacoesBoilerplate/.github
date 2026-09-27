import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const shared = resolve(import.meta.dirname, '../..');
const changesets = process.argv.includes('--changesets');
const adapterName = changesets ? 'changesets' : 'standard-version';
const projectPath = changesets ? 'packages/core' : '.';
const expectedVersion = changesets ? '2.1.0' : '1.0.1';
const expectedTag = changesets ? '@lab/core@2.1.0' : 'v1.0.1';
const temp = mkdtempSync(join(tmpdir(), 'version-post-merge-'));
const workspace = join(temp, 'consumer');
const bare = join(temp, 'origin.git');
const bin = join(temp, 'bin');
const stateFile = join(temp, 'state.json');
const output = join(temp, 'output.txt');
const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8' }).trim();
const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));
const save = value => writeFileSync(stateFile, JSON.stringify(value));
const run = (sha, overrides = {}) => {
  writeFileSync(output, '');
  return spawnSync('bash', [join(shared, 'scripts/versioning/publish.sh')], {
    cwd: workspace, encoding: 'utf8', env: { ...process.env,
      PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      MOCK_STATE: stateFile, MOCK_BARE: bare, GH_TOKEN: 'mock', VERSIONING_TOKEN: 'mock-app',
      GITHUB_REPOSITORY: 'acme/consumer', GITHUB_WORKSPACE: workspace,
      GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: 'main', GITHUB_SHA: sha,
      ADAPTER: adapterName, RELEASE_BRANCH: 'release/v1.2.3',
      TARGET_BRANCH: 'main', PROJECT_PATH: projectPath, GITHUB_OUTPUT: output, ...overrides },
  });
};

try {
  mkdirSync(workspace);
  mkdirSync(bin);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  if (changesets) {
    mkdirSync(join(workspace, 'packages', 'core'), { recursive: true });
    mkdirSync(join(workspace, '.changeset'));
    writeFileSync(join(workspace, 'package.json'), '{"name":"lab","private":true,"workspaces":["packages/*"]}\n');
    writeFileSync(join(workspace, 'package-lock.json'), JSON.stringify({name:'lab',lockfileVersion:3,
      packages:{'':{name:'lab',workspaces:['packages/*']},'packages/core':{name:'@lab/core',version:'2.0.0'}}})+'\n');
    writeFileSync(join(workspace, 'packages', 'core', 'package.json'), '{"name":"@lab/core","version":"2.0.0"}\n');
    writeFileSync(join(workspace, '.changeset', 'config.json'), '{"baseBranch":"main"}\n');
    writeFileSync(join(workspace, '.changeset', 'two-features.md'), '---\n"@lab/core": minor\n---\n\nDuas entregas.\n');
  } else {
    writeFileSync(join(workspace, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  }
  writeFileSync(join(workspace, '.gitignore'), 'node_modules/\n');
  mkdirSync(join(workspace, 'node_modules', '.bin'), { recursive: true });
  const adapter = join(workspace, 'node_modules', '.bin', changesets ? 'changeset' : 'standard-version');
  writeFileSync(adapter, changesets ? `#!/usr/bin/env node
const fs=require('node:fs');const p='packages/core/package.json';
const data=JSON.parse(fs.readFileSync(p,'utf8'));data.version='2.1.0';
fs.writeFileSync(p,JSON.stringify(data)+'\\n');
fs.writeFileSync('packages/core/CHANGELOG.md','# 2.1.0\\n');
fs.rmSync('.changeset/two-features.md');
` : `#!/usr/bin/env node
const fs=require('node:fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.version='1.0.1'; fs.writeFileSync('package.json',JSON.stringify(p)+'\\n');
fs.writeFileSync('CHANGELOG.md','# 1.0.1\\n');
`);
  chmodSync(adapter, 0o755);
  git('add', 'package.json', '.gitignore');
  if (changesets) git('add', 'package-lock.json', 'packages', '.changeset');
  git('commit', '-m', 'feat: add sample');
  const originalSha = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--bare', workspace, bare]);
  git('remote', 'add', 'origin', bare);
  save({ originalSha, tagSha: null, release: null, pr: null });
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'); const cp=require('node:child_process');
const args=process.argv.slice(2), file=process.env.MOCK_STATE, s=JSON.parse(fs.readFileSync(file,'utf8'));
const url=args.find(a=>a.startsWith('repos/'))??'';
const save=()=>fs.writeFileSync(file,JSON.stringify(s));
const git=(...a)=>cp.execFileSync('git',['--git-dir='+process.env.MOCK_BARE,...a],{encoding:'utf8'}).trim();
const versionPr=()=>({number:5,merged_at:s.versionMergeSha?'2026-09-24T12:00:00Z':null,
  merge_commit_sha:s.versionMergeSha,head:{ref:s.pr?.branch},base:{ref:'main'},body:s.pr?.body});
if(args[0]==='auth') process.exit(0);
if(args[0]==='pr'&&args[1]==='view'){console.log(process.env.MOCK_APPROVED?'REVIEW_REQUIRED':'APPROVED');process.exit(0)}
if(args[0]==='pr'&&args[1]==='list'){console.log(JSON.stringify(s.pr?[{number:5,url:s.pr.url,state:s.versionMergeSha?'MERGED':'OPEN'}]:[]));process.exit(0)}
if(args[0]==='pr'&&args[1]==='create'){
 const body=args[args.indexOf('--body')+1],branch=args[args.indexOf('--head')+1];
 s.pr={body,branch,url:'https://github.com/acme/consumer/pull/5'};save();console.log(s.pr.url);process.exit(0);
}
if(url==='repos/acme/consumer'){console.log('main');process.exit(0)}
if(url.endsWith('/milestones')){console.log(JSON.stringify([{number:2,title:'v1.2.3',state:'closed',open_issues:0}]));process.exit(0)}
if(url.endsWith('/issues/10')){console.log(JSON.stringify({number:10,title:'v1.2.3',state:'closed',milestone:{title:'v1.2.3',state:'closed',open_issues:0}}));process.exit(0)}
if(url.endsWith('/issues')){console.log(JSON.stringify([{number:10,title:'v1.2.3',state:'closed'}]));process.exit(0)}
if(url.includes('/commits/')&&url.endsWith('/pulls')){
  if(process.env.MOCK_NO_PR){console.log('[]');process.exit(0)}
  const sha=url.split('/')[4];console.log(JSON.stringify(sha===s.originalSha?
    [{number:4,merged_at:'2026-09-24T12:00:00Z',merge_commit_sha:s.originalSha,
      base:{ref:'main'},head:{ref:process.env.MOCK_RELEASE_HEAD?'release/v1.2.3':'develop'}}]:sha===s.versionMergeSha?[versionPr()]:[]));process.exit(0);
}
if(url.endsWith('/pulls/4')){
  const pr={number:4,merged_at:'2026-09-24T12:00:00Z',merge_commit_sha:s.originalSha,
    base:{ref:'main'},head:{ref:'develop'},body:process.env.MOCK_HOMOLOGATION?'Epic: #10':'Epic: #10\\nHomologação: aprovada'};
  console.log(args.includes('--jq')?pr.body:JSON.stringify(pr));process.exit(0);
}
if(url.endsWith('/pulls/5')){console.log(args.includes('--jq')?s.pr.body:JSON.stringify(versionPr()));process.exit(0)}
if(url.endsWith('/pulls')){console.log(JSON.stringify([{number:3,merged_at:'2026-09-24T11:00:00Z',
  merge_commit_sha:s.originalSha,base:{ref:'develop'},head:{ref:'release/v1.2.3'},body:'Epic: #10'}]));process.exit(0)}
if(url.endsWith('/git/ref/heads/main')){console.log(process.env.MOCK_REMOTE_SHA??git('rev-parse','refs/heads/main'));process.exit(0)}
if(url.includes('/git/ref/tags/')){
  if(process.env.MOCK_TAG_ERROR){console.error('gh: Forbidden (HTTP 403)');process.exit(1)}
  if(!s.tagSha){console.error('gh: Not Found (HTTP 404)');process.exit(1)}
  console.log(JSON.stringify({object:{type:'commit',sha:s.tagSha}}));process.exit(0);
}
if(url.includes('/releases/tags/')){
  if(!s.release){console.error('gh: Not Found (HTTP 404)');process.exit(1)}console.log(JSON.stringify(s.release));process.exit(0);
}
if(args.includes('POST')&&url.endsWith('/git/refs')){
  if(s.tagSha)process.exit(1);s.tagSha=args.find(a=>a.startsWith('sha=')).slice(4);save();console.log('{}');process.exit(0);
}
if(args.includes('POST')&&url.endsWith('/releases')){
  if(s.release)process.exit(1);
  s.release={tag_name:args.find(a=>a.startsWith('tag_name=')).slice(9),
    target_commitish:args.find(a=>a.startsWith('target_commitish=')).slice(18),
    html_url:'https://github.com/acme/consumer/releases/tag/'+args.find(a=>a.startsWith('tag_name=')).slice(9)};
  save();console.log(JSON.stringify(s.release));process.exit(0);
}
console.error('Comando gh inesperado: '+args.join(' '));process.exit(1);
`);
  chmodSync(gh, 0o755);

  let result = run(originalSha);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=pending-version-pr/);
  assert.equal(state().tagSha, null);
  assert.equal(JSON.parse(readFileSync(join(workspace, projectPath, 'package.json'), 'utf8')).version, expectedVersion);
  if (changesets) {
    const lock = JSON.parse(readFileSync(join(workspace, 'package-lock.json'), 'utf8'));
    assert.equal(lock.packages['packages/core'].version, expectedVersion);
  }
  const branch = state().pr.branch;
  git('switch', 'main');
  result = run(originalSha);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /já existente/);
  assert.equal(state().tagSha, null);
  result = run(originalSha, { MOCK_REMOTE_SHA: '0000000000000000000000000000000000000000' });
  assert.notEqual(result.status, 0);
  for (const overrides of [{ MOCK_NO_PR: '1' }, { MOCK_RELEASE_HEAD: '1' },
    { MOCK_APPROVED: '1' }, { MOCK_HOMOLOGATION: '1' }]) {
    assert.notEqual(run(originalSha, overrides).status, 0, 'publication requires an approved develop merge');
    assert.equal(state().tagSha, null);
  }
  for (const overrides of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF_NAME: 'develop' },
    { GITHUB_SHA: '0000000000000000000000000000000000000000' }]) {
    assert.notEqual(run(originalSha, overrides).status, 0);
  }

  git('switch', branch);
  git('fetch', 'origin', 'main');
  const versionCommit = git('rev-parse', 'HEAD');
  const prEvent = join(temp, 'version-pr.json');
  writeFileSync(prEvent, JSON.stringify({ pull_request: { number: 5, body: state().pr.body,
    base: { ref: 'main' }, head: { ref: branch, sha: versionCommit } } }));
  result = spawnSync('bash', [join(shared, 'scripts/versioning/preview.sh')], {
    cwd: workspace, encoding: 'utf8', env: { ...process.env,
      PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      MOCK_STATE: stateFile, MOCK_BARE: bare, GH_TOKEN: 'mock',
      GITHUB_EVENT_PATH: prEvent, GITHUB_REPOSITORY: 'acme/consumer', GITHUB_WORKSPACE: workspace,
      ADAPTER: adapterName, RELEASE_BRANCH: 'release/v1.2.3',
      TARGET_BRANCH: 'main', PROJECT_PATH: projectPath, GITHUB_OUTPUT: output },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /phase=version-pr/);

  git('switch', 'main');
  git('merge', '--no-ff', branch, '-m', 'Merge PR #5');
  const versionMergeSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'main');
  save({ ...state(), versionMergeSha });
  const pristine = state();
  save({ ...pristine, pr: { ...pristine.pr, body: 'Epic: #10\nHomologação: aprovada' } });
  assert.notEqual(run(versionMergeSha).status, 0);
  save(pristine);
  result = run(versionMergeSha);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=published/);
  assert.match(readFileSync(output, 'utf8'), new RegExp(`published_sha=${versionMergeSha}`));
  assert.equal(state().tagSha, versionMergeSha);
  assert.equal(state().release.tag_name, expectedTag);
  for (let i = 0; i < 10; i++) {
    result = run(versionMergeSha);
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  }
  git('tag', 'v99.0.0', versionMergeSha);
  result = run(versionMergeSha);
  assert.equal(result.status, 0, 'an older valid rerun must reconcile before latest-tag validation');
  assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  result = run(versionMergeSha, { MOCK_TAG_ERROR: '1' });
  assert.notEqual(result.status, 0, 'API authorization errors must never look like missing tags');
  git('switch', '--detach', originalSha);
  result = run(originalSha);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /outcome=already-published/);
  git('switch', 'main');
  save({ ...state(), release: null });
  result = run(versionMergeSha);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(state().tagSha, versionMergeSha);
  assert.match(readFileSync(output, 'utf8'), /outcome=published/);
  save({ ...state(), tagSha: null });
  result = run(versionMergeSha);
  assert.notEqual(result.status, 0);
  assert.equal(state().tagSha, null);
  save({ ...state(), tagSha: originalSha });
  result = run(versionMergeSha);
  assert.notEqual(result.status, 0);
  assert.equal(state().tagSha, originalSha);
  console.log(`Pós-merge ${adapterName}: PR, tag ${expectedTag} no SHA versionado, reexecução e conflito aprovados`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
