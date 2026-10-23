import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const yaml=JSON.parse(execFileSync('python',['-c',
  'import yaml,json,sys; print(json.dumps(yaml.load(open(sys.argv[1],encoding="utf-8"),Loader=yaml.BaseLoader)))',
  join(root,'.github/workflows/ci.yml')],{encoding:'utf8'}));
const job=yaml.jobs.versioning,steps=job.steps;
const install=steps.findIndex(step=>step.name==='Install central TypeScript toolchain');
assert.notEqual(install,-1,'central typecheck/dist gate requires an explicit lockfile installation');
assert.equal(steps[install]['working-directory'],'scripts/versioning');
assert.equal(steps[install].run,'npm ci --ignore-scripts --no-audit --no-fund');
const typecheck=steps.findIndex(step=>step.run==='npm --prefix scripts/versioning run typecheck');
const integrity=steps.findIndex(step=>step.run==='npm --prefix scripts/versioning run check-dist');
const local=steps.findIndex(step=>step.run==='node tests/versioning/run.mjs --local');
assert.ok(install<typecheck&&typecheck<integrity&&integrity<local,'validate received dist before any execution/build rewrite');
for(const step of steps.slice(0,integrity))assert.doesNotMatch(step.run??'',/run build|\btsc\b/);
for(const command of ['real-standard-version.mjs','real-standard-bootstrap.mjs','real-changesets.mjs',
  'maven-setup.mjs','real-jgitver.mjs','real-maven-reactor.mjs','real-jgitver-prefix.mjs','real-release-please.mjs','real-maven-artifacts.mjs']) {
  assert.ok(steps.some(step=>(step.run??'').includes('node tests/versioning/'+command)),command+' is mandatory');
}
assert.ok(steps.some(step=>step.run==='node tests/versioning/run.mjs --real-go'));
assert.doesNotMatch(JSON.stringify(job),/--if-present|continue-on-error/);
assert.ok(steps.some(step=>(step.run??'').includes('installPinnedMaven')));
const bootstrap=steps.find(step=>(step.run??'').includes('installPinnedMaven')).run;
const snippet=bootstrap.match(/^node --input-type=module -e "([\s\S]*)"$/)?.[1];
assert.ok(snippet,'Maven bootstrap uses the compiled Node module');
assert.match(snippet,/scripts\/versioning\/dist\/adapters\/maven-installer\.js/);
const importPattern=/import\s*{\s*installPinnedMaven\s*}\s*from\s*'[^']+';/;
assert.match(snippet,importPattern);
const controlled=snippet.replace(importPattern,`import assert from 'node:assert/strict';let called=false;
const installPinnedMaven=async options=>{called=true;
assert.equal(options?.runnerTemp,'runtime-sentinel');
assert.equal(options?.githubPath,'path-sentinel');};`);
execFileSync(process.execPath,['--input-type=module','-e',controlled+';assert.equal(called,true);'],
  {env:{...process.env,RUNNER_TEMP:'runtime-sentinel',GITHUB_PATH:'path-sentinel'},stdio:'pipe'});
assert.doesNotMatch(JSON.stringify(job),/install-maven\.sh/);
const source=readFileSync(join(root,'tests/versioning/run.mjs'),'utf8');
const listed=[...source.match(/const localFixtures = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+\.mjs)'/g)].map(match=>match[1]);
assert.equal(new Set(listed).size,listed.length,'no duplicated fixtures');
const required=["adapter-contract.mjs","adapter-registry.mjs","adapter-report.mjs","annotated-publish.mjs","changesets-adapter.mjs","changesets-flow.mjs","changesets-publish.mjs","collect-version-report.mjs","dist-integrity.mjs","git-inputs.mjs","git-port.mjs","github-port.mjs","go-adapter.mjs","go-version.mjs","homologation-guide.mjs","install-node.mjs","java-properties.mjs","jgitver-adapter.mjs","jgitver-report.mjs","legacy-technical-merge.mjs","multi-version-bundle.mjs","native-workflows.mjs","npm-project.mjs","origin-artifact.mjs","post-merge.mjs","pr-check.mjs","pr-evidence.mjs","pr-policy.mjs","prepare-publication.mjs","preview-entrypoint.mjs","process-runner.mjs","publication.mjs","publish-entrypoint.mjs","reconciled-report.mjs","release-notes.mjs","release-please-snapshot.mjs","release-policy.mjs","runner-self-test.mjs","standard-adapter.mjs","standard-flow.mjs","standard-precomputed.mjs","technical-merge.mjs","technical-release.mjs","type-contracts.mjs","typed-maven-install.mjs","typescript-build.mjs","version-bundle.mjs","version-pr.mjs","version-report.mjs","workflow-contract.mjs","workflow-five-adapters.mjs"];
for(const name of [...required,'ci-five-adapters.mjs']) {
  assert.ok(listed.includes(name),'preserve baseline and typed coverage: '+name);
  assert.ok(existsSync(join(root,'tests/versioning',name)),name+' must exist');
}
const changesets=readFileSync(join(root,'tests/versioning/real-changesets.mjs'),'utf8');
assert.match(changesets,/2\.29\.5/);assert.match(changesets,/3\.0\.3/);
const rp=readFileSync(join(root,'tests/versioning/real-release-please.mjs'),'utf8');
assert.match(rp,/17\.11\.2/);
console.log('CI: received dist first, 29 baseline plus new fixtures, and all five real profiles');

