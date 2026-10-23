import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { publicationNeedsVersionPr } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';
const workflow=JSON.parse(execFileSync('python',['-c',
  'import yaml,json,sys; print(json.dumps(yaml.load(open(sys.argv[1],encoding="utf-8"),Loader=yaml.BaseLoader)))',
  resolve(import.meta.dirname,'../../.github/workflows/version-publish.yml')],{encoding:'utf8'}));
const read=workflow.jobs['validate-publication'],write=workflow.jobs.publish,gate=workflow.jobs['environment-gate'];
const report=read.steps.find(s=>s.id==='report'),upload=read.steps.find(s=>s.id==='upload');
const writer=write.steps.find(s=>s.id==='publish'),app=write.steps.find(s=>s.id==='versioning-app-token');
const js=expression=>expression.replace(/needs\.([a-z-]+)/g,(_,name)=>`needs['${name}']`);
assert.match(report.run,/node .*dist\/entrypoints\/prepare-publication\.js/);
assert.match(writer.run,/node .*dist\/entrypoints\/publish\.js/);
assert.doesNotMatch(JSON.stringify(workflow),/\.sh(?:\s|["'])|PRECOMPUTED/);
assert.equal(read.outputs.artifact_id,'${{ steps.upload.outputs.artifact-id }}');
assert.equal(read.outputs.plan_digest,'${{ steps.report.outputs.plan_digest }}');
assert.equal(read.outputs.payload_digest,'${{ steps.report.outputs.payload_digest }}');
assert.equal(upload.with.name,'${{ steps.report.outputs.artifact_name }}');
for(const [key,output] of Object.entries({VERSIONING_ARTIFACT_ID:'artifact_id',
  VERSIONING_PLAN_DIGEST:'plan_digest',VERSIONING_PAYLOAD_DIGEST:'payload_digest',
  VERSIONING_PRODUCER_RUN_ID:'producer_run_id',VERSIONING_PRODUCER_RUN_ATTEMPT:'producer_run_attempt'})) {
  assert.equal(writer.env[key],'${{ needs.validate-publication.outputs.'+output+' }}');
}
assert.equal(read.outputs.producer_run_attempt,'${{ steps.report.outputs.producer_run_attempt }}');
assert.equal(writer.env.CHANGELOG_PATH,'${{ inputs.changelog_path }}');
for(const step of [report,writer]) {
  assert.equal(step.env.VERSIONING_WORKSPACE,'${{ github.workspace }}/consumer');
  assert.equal(step.env.CENTRAL_SHA,'${{ job.workflow_sha }}');
  assert.equal(step.env.CENTRAL_REPOSITORY,'${{ job.workflow_repository }}');
}
assert.equal(write.steps.find(s=>s.uses?.includes('download-artifact')).with['artifact-ids'],
  '${{ needs.validate-publication.outputs.artifact_id }}');
for(const adapter of ['go-gitsemver','jgitver','standard-version','changesets','release-please']) {
  for(const phase of ['functional','technical']) for(const status of ['release','no-release']) {
    const needs=publicationNeedsVersionPr({phase,plan:{adapter,status}});
    assert.equal(needs,phase==='functional'&&status==='release'&&
      ['standard-version','changesets','release-please'].includes(adapter));
    const allowed=Function('needs', 'return ('+js(app.if)+')')(
      {'validate-publication':{outputs:{needs_version_pr:String(needs)}}});
    assert.equal(allowed,needs,'App only for a functional version PR, never no-release');
  }
  for(const technical of ['false','true']) {
    const steps={origin:{outputs:{technical}}};
    const select=s=>s.if&&Function('inputs','steps','return ('+s.if+')')({adapter},steps);
    const npm=read.steps.find(s=>s.run?.includes('installNpmDependencies'));
    const sdk=read.steps.find(s=>s.name==='Install central Release Please SDK');
    assert.equal(Boolean(select(npm)),technical==='false'&&['standard-version','changesets'].includes(adapter));
    assert.equal(Boolean(select(sdk)),technical==='false'&&adapter==='release-please');
  }
}
for(const environment of ['','production']) {
  assert.equal(Function('inputs','return ('+gate.if+')')({publication_environment:environment}),Boolean(environment));
}
for(const envResult of ['success','skipped','failure','cancelled']) {
  const expression=js(write.if.trim().replace(/^\$\{\{\s*|\s*\}\}$/g,''));
  const context={'validate-publication':{result:'success'},'environment-gate':{result:envResult}};
  assert.equal(Function('always','github','inputs','needs','return ('+expression+')')(()=>true,
    {event_name:'push',ref_name:'master'},{target_branch:'master'},context),
  envResult==='success'||envResult==='skipped');
}
assert.equal(write.steps.some(s=>/npm ci|installNpm|installPinned|setup-go|setup-java|go install|tsc/.test(s.run??s.uses??'')),false);
assert.equal(report.env.VERSIONING_TOKEN,undefined);
assert.equal(report.env.VERSIONING_BOT_LOGIN,'${{ steps.origin.outputs.bot_login }}');
console.log('Five-adapter workflow: capabilities/status, environment, trusted artifact and isolated writer');
