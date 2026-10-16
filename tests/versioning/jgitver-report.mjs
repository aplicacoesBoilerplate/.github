import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { normalizeGoReport, normalizeJgitverReport, validateVersionReport } from '../../scripts/versioning/version-report.mjs';
import { evaluateReleasePolicy } from '../../scripts/versioning/release-policy.mjs';
import { buildHomologationGuide } from '../../scripts/versioning/homologation-guide.mjs';
const repo=mkdtempSync(join(tmpdir(),'jgitver-report-'));
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
try {
  git('init','-q'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.test');
  git('commit','--allow-empty','-qm','chore: bootstrap');
  const sha=git('rev-parse','HEAD');
  const native={version:'0.0.1',sha,properties:{'jgitver.used_version':'0.0.1','jgitver.calculated_version':'0.0.1',
    'jgitver.git_sha1_full':sha,'jgitver.plugin-version':'1.9.0'},explanation:'derived native evidence'};
  const context={native,branch:'master',sha,repository:repo};
  const report=normalizeJgitverReport(context);
  const input=join(repo,'native.json');
  writeFileSync(input,JSON.stringify(native));
  const cli=JSON.parse(execFileSync(process.execPath,[resolve(import.meta.dirname,'../../scripts/versioning/version-report.mjs'),
    'normalize-jgitver',input,'master',sha,repo],{encoding:'utf8'}));
  assert.deepEqual(cli,report,'CLI must normalize the same native Properties envelope');
  assert.deepEqual({adapter:report.adapter,version:report.candidateVersion,base:report.baseVersion,tag:report.tag,bump:report.bump,sha:report.sha,format:report.native.format,kind:report.tagKind},
    {adapter:'jgitver',version:'0.0.1',base:'0.0.0',tag:'v0.0.1',bump:'patch',sha,format:'java-properties',kind:'annotated'});
  assert.deepEqual(report.native.result,native.properties);
  assert.equal(validateVersionReport(report),report);
  const goReport=normalizeGoReport({nativeJson:JSON.stringify({SemVer:'0.0.1',Sha:sha}),
    explanation:'Go native explanation',branch:'master',sha,repository:repo});
  const validOverride={labelPresent:true,labeledBy:'maintainer-one',labeledAt:'2026-10-13T10:00:00Z',
    labelerRole:'maintain',approvalBy:'maintainer-two',approvedAt:'2026-10-13T10:01:00Z',
    approverRole:'admin',reviewedCommitSha:sha};
  const policyCases=[
    [null,null,'adapter-authoritative'],[{title:'v0.0.1'},null,'matched'],
    [{title:'invalid'},validOverride,'blocked'],[{title:'v1.0.0'},null,'blocked'],
    [{title:'v1.0.0'},validOverride,'overridden'],
    [{title:'v1.0.0'},{...validOverride,labelerRole:'triage'},'blocked'],
    [{title:'v1.0.0'},{...validOverride,reviewedCommitSha:'b'.repeat(40)},'blocked'],
    [{title:'v1.0.0'},{...validOverride,approvalBy:'maintainer-one'},'blocked'],
  ];
  for(const [milestone,override,expected] of policyCases){
    const snapshot={headSha:sha,milestone,...(override ? {override} : {})};
    const mavenDecision=evaluateReleasePolicy({report,snapshot});
    assert.equal(mavenDecision.outcome,expected);
    assert.deepEqual(mavenDecision,evaluateReleasePolicy({report:goReport,snapshot}),
      'equivalent adapters share the complete policy decision, reasons and audit');
  }
  assert.equal(evaluateReleasePolicy({report,snapshot:{headSha:sha,milestone:{title:'v0.0.1'}}}).outcome,'matched');
  assert.equal(evaluateReleasePolicy({report,snapshot:{headSha:sha,milestone:null}}).outcome,'adapter-authoritative');
  assert.equal(evaluateReleasePolicy({report,snapshot:{headSha:sha,milestone:{title:'v1.0.0'}}}).outcome,'blocked');
  assert.equal(buildHomologationGuide(report,{repository:'acme/java',number:1,headSha:sha}).guide.facts.candidateVersion,'0.0.1');
  const mavenGuide=buildHomologationGuide(report,{repository:'acme/java',number:1,headSha:sha});
  assert.deepEqual(mavenGuide.guide.facts.nativeEvidence,{format:'java-properties',properties:{
    'jgitver.used_version':'0.0.1','jgitver.calculated_version':'0.0.1','jgitver.git_sha1_full':sha,
    'jgitver.plugin-version':'1.9.0'},explanation:{kind:'derived',text:'derived native evidence'}});
  assert.match(mavenGuide.markdown,/Native jgitver properties/);
  assert.match(mavenGuide.markdown,/Derived adapter explanation/);
  assert.ok(mavenGuide.markdown.includes(sha));
  assert.ok(mavenGuide.markdown.includes('jgitver\\.used\\_version: 0\\.0\\.1'));
  assert.ok(mavenGuide.markdown.includes('jgitver\\.plugin\\-version: 1\\.9\\.0'));
  assert.throws(()=>normalizeJgitverReport({...context,native:{...native,version:'0.0.1-SNAPSHOT'}}),/SemVer estável/);
  assert.throws(()=>normalizeJgitverReport({...context,native:{...native,sha:'b'.repeat(40)}}),/SHA/);
  assert.throws(()=>validateVersionReport({...report,native:{...report.native,format:'json'}}),/native/);
  assert.throws(()=>validateVersionReport({...report,tagKind:'lightweight'}),/anotada/);
  git('tag','v0.0.1');
  const next={...native,version:'0.0.2',properties:{...native.properties,'jgitver.used_version':'0.0.2','jgitver.calculated_version':'0.0.2'}};
  assert.equal(normalizeJgitverReport({...context,native:next}).baseVersion,'0.0.1');
  git('commit','--allow-empty','-qm','feat!: next major');
  const majorSha=git('rev-parse','HEAD');
  git('tag','1.0.0');
  const majorNative={...native,version:'1.0.0',sha:majorSha,properties:{...native.properties,
    'jgitver.used_version':'1.0.0','jgitver.calculated_version':'1.0.0','jgitver.git_sha1_full':majorSha,
    'jgitver.base_tag':'1.0.0'}};
  const majorContext={native:majorNative,branch:'master',sha:majorSha,repository:repo};
  const majorReport=normalizeJgitverReport(majorContext);
  assert.equal(majorReport.baseVersion,'0.0.1','planning checkpoint is not a published release');
  assert.equal(majorReport.bump,'major');
  assert.equal(evaluateReleasePolicy({report:majorReport,snapshot:{headSha:majorSha,milestone:{title:'v1.0.0'}}}).outcome,'matched');
  git('tag','-a','v1.0.0','-m','release');
  assert.equal(normalizeJgitverReport(majorContext).baseVersion,'1.0.0');
  assert.equal(normalizeJgitverReport(majorContext).bump,'none','same published version permits reconciliation');
  console.log('Jgitver report, policy and guide contract passed');
} finally {rmSync(repo,{recursive:true,force:true});}
