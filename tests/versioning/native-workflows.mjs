import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const yaml=file=>JSON.parse(execFileSync('python',['-c','import yaml,json,sys; print(json.dumps(yaml.load(open(sys.argv[1],encoding="utf-8"),Loader=yaml.BaseLoader)))',resolve(root,file)],{encoding:'utf8'}));
const preview=yaml('.github/workflows/version-preview.yml').jobs.preview;
const publication=yaml('.github/workflows/version-publish.yml');
const read=publication.jobs['validate-publication'],write=publication.jobs.publish;
assert.ok(read,'REC-04 requires a read-only native job before privileged publication');
assert.deepEqual(read.permissions,{contents:'read','pull-requests':'read',issues:'read'});
assert.deepEqual(write.needs,['validate-publication','environment-gate']);
assert.match(write.if,/needs\.validate-publication\.result == 'success'/);
assert.equal(publication.jobs['environment-gate'].needs,'validate-publication');
for(const job of [preview,read,write]) {
  assert.equal(job.steps.find(s=>s.uses?.startsWith('actions/checkout@')&&s.with?.path==='consumer').with['persist-credentials'],'false');
  const automation=job.steps.find(s=>s.with?.path==='.shared-versioning');
  assert.deepEqual(automation.with,{repository:'${{ job.workflow_repository }}',ref:'${{ job.workflow_sha }}',path:'.shared-versioning','persist-credentials':'false'});
  assert.equal(job.steps.find(s=>s.uses?.startsWith('actions/setup-node@')).with['node-version'],'24');
}
for(const job of [preview,read]) {
  const java=job.steps.find(s=>s.uses?.startsWith('actions/setup-java@'));
  assert.equal(java.if,"inputs.adapter == 'jgitver'");
  assert.equal(java.with['java-version'],'21');
  assert.equal(job.steps.find(s=>s.run?.includes(job===preview?'installPinnedMaven':'install-maven.sh')).if,"inputs.adapter == 'jgitver'");
  const npm=job.steps.find(s=>s.run?.includes(job===preview?'installNpmDependencies':'install-node.sh'));
  assert.equal(npm.if,job===preview?
    "(inputs.adapter == 'standard-version' || inputs.adapter == 'changesets') && steps.origin.outputs.technical != 'true'":
    "inputs.adapter == 'standard-version' || inputs.adapter == 'changesets'");
  assert.equal(npm['working-directory'],'consumer');
  if(job===preview) {
    assert.equal(npm.env.VERSIONING_WORKSPACE,'${{ github.workspace }}/consumer');
    assert.match(npm.run,/installNpmDependencies/);
  } else {
    assert.equal(npm.env.NODE_PACKAGE_MANAGER,'npm');
    assert.match(npm.run,/export GITHUB_WORKSPACE="\$PWD"/);
  }
  assert.equal(job.steps.some(s=>s.uses?.includes('create-github-app-token')),false);
  assert.doesNotMatch(JSON.stringify(job),/secrets\.|VERSIONING_TOKEN/);
}
assert.deepEqual(preview.permissions,{contents:'read','pull-requests':'read',issues:'read',checks:'read',actions:'read'});
const previewRun=preview.steps.find(step=>step.id==='preview');
assert.match(previewRun.run,/node .*dist\/entrypoints\/preview\.js/);
assert.equal(previewRun.env.VERSIONING_WORKSPACE,'${{ github.workspace }}/consumer');
assert.equal(previewRun.env.CENTRAL_SHA,'${{ job.workflow_sha }}');
assert.doesNotMatch(JSON.stringify(preview),/\.sh(?:\s|"|')/);
const originStep=preview.steps.find(step=>step.id==='origin');
assert.match(originStep.run,/dist\/entrypoints\/resolve-origin\.js/);
const originDownload=preview.steps.find(step=>step.uses?.includes('download-artifact'));
assert.equal(originDownload.if,"steps.origin.outputs.technical == 'true'");
assert.equal(originDownload.with['artifact-ids'],'${{ steps.origin.outputs.artifact_id }}');
assert.equal(originDownload.with['run-id'],'${{ steps.origin.outputs.run_id }}');
assert.equal(originDownload.with.repository,'${{ github.repository }}');
assert.equal(originDownload.with['merge-multiple'],'true');
const sdk=preview.steps.find(step=>step.name==='Install central Release Please SDK');
assert.equal(sdk['working-directory'],'.shared-versioning/scripts/versioning/tools/release-please');
assert.equal(sdk.run,'npm ci --ignore-scripts --no-audit --no-fund');
for(const adapter of ['go-gitsemver','jgitver','standard-version','changesets','release-please','invalid']) {
  const selected=step=>step.if&&Function('inputs','steps',`return (${step.if})`)({adapter},{origin:{outputs:{technical:'false'}}});
  assert.equal(Boolean(selected(sdk)),adapter==='release-please');
  const npm=preview.steps.find(step=>step.run?.includes('installNpmDependencies'));
  assert.equal(Boolean(selected(npm)),adapter==='standard-version'||adapter==='changesets');
}
assert.deepEqual(write.permissions,{contents:'write','pull-requests':'read',issues:'read'});
assert.equal(write.steps.some(s=>/setup-java|setup-go/.test(s.uses??'')||/install-node|install-maven|go install|npm ci|mvn /.test(s.run??'')),false);
const token=write.steps.find(s=>s.uses?.includes('create-github-app-token'));
assert.equal(token.if,"(inputs.adapter == 'standard-version' || inputs.adapter == 'changesets') && needs.validate-publication.outputs.phase == 'functional'");
assert.equal(token.with['permission-contents'],'write');
assert.equal(token.with['permission-pull-requests'],'write');
assert.equal(read.outputs.phase,'${{ steps.report.outputs.phase }}');
assert.equal(write.steps.find(s=>s.uses?.includes('download-artifact')).with.name,'${{ needs.validate-publication.outputs.artifact_name }}');
const writer=write.steps.find(s=>s.id==='publish');
assert.equal(writer.env.VERSIONING_REQUIRE_PRECOMPUTED,'1');
for(const [key,file] of Object.entries({VERSIONING_PRECOMPUTED_REPORT:'version-report.json',VERSIONING_INPUTS_SNAPSHOT:'git-inputs.json',VERSIONING_PRECOMPUTED_BUNDLE:'version-bundle.json'})) assert.ok(writer.env[key].endsWith('/'+file));
assert.equal(writer['working-directory'],'consumer');
assert.match(writer.run,/export GITHUB_WORKSPACE="\$PWD"/);
assert.equal(read.steps.find(s=>s.id==='report')['working-directory'],'consumer');
assert.match(read.steps.find(s=>s.id==='report').run,/prepare-publication.sh/);
assert.match(read.steps.find(s=>s.uses?.includes('upload-artifact')).with.path,/versioning\/\*/);
for(const output of ['version','tag','published_sha','release_url','outcome','version_pr_url']) assert.equal(publication.on.workflow_call.outputs[output].value,'${{ jobs.publish.outputs.'+output+' }}');
console.log('Native workflows: isolated read/write, tools, artifacts, identity and existing outputs passed');
