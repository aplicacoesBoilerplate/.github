import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyTechnicalMerge, verifyTechnicalPreview } from '../../scripts/versioning/dist/services/technical-merge.js';
import { captureVersionFiles } from '../../scripts/versioning/dist/services/version-files.js';
import { collectPrEvidence } from '../../scripts/versioning/dist/services/pr-evidence.js';
import { planFromReport, validateDescriptor } from '../../scripts/versioning/dist/adapter-contract.js';
import { previewMain, runTechnicalPreview } from '../../scripts/versioning/dist/entrypoints/preview.js';
import { publicationPayloadDigest } from '../../scripts/versioning/dist/services/publication-payload.js';
import { preparePublicationMain } from '../../scripts/versioning/dist/entrypoints/prepare-publication.js';

const root = mkdtempSync(join(tmpdir(), 'technical-merge-'));
const descriptor = validateDescriptor({ id: 'release-please', runtime: 'node', reportKind: 'single',
  needsVersionPr: true, tagKind: 'lightweight', collect() {}, prepare() {} });
const randomSha = 'f'.repeat(40);
const now = '2026-10-21T10:00:00Z';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function scenario(method) {
  const cwd = join(root, method);
  mkdirSync(cwd);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const json = (path, value) => writeFileSync(join(cwd, path), `${JSON.stringify(value)}\n`);
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  json('package.json', { name: 'app', version: '1.0.0' });
  json('package-lock.json', { name: 'app', version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  json('.release-please-manifest.json', { '.': '1.0.0' });
  json('release-please-config.json', { packages: { '.': { 'release-type': 'node' } } });
  git('add', '.'); git('commit', '-qm', 'chore: baseline');
  git('switch', '-qc', 'develop');
  writeFileSync(join(cwd, 'feature.txt'), 'feature\n'); git('add', '.');
  git('commit', '-qm', 'fix: feature'); const developSha = git('rev-parse', 'HEAD');
  git('switch', 'master'); git('merge', '--no-ff', 'develop', '-m', 'Merge develop');
  const functionalSha = git('rev-parse', 'HEAD');
  const report = { schemaVersion: 1, adapter: 'release-please', sha: functionalSha,
    branch: 'master', status: 'release', baseVersion: '1.0.0', candidateVersion: '1.0.1',
    bump: 'patch', tag: 'v1.0.1', native: { explanation: 'Fix feature' } };
  const plan = planFromReport(report, descriptor, '.');
  const changes = {
    'package.json': '{"name":"app","version":"1.0.1"}\n',
    'package-lock.json': '{"name":"app","version":"1.0.1","packages":{"":{"version":"1.0.1"}}}\n',
    '.release-please-manifest.json': '{".":"1.0.1"}\n',
    'CHANGELOG.md': '## 1.0.1\n\nFix feature\n',
  };
  const bundle = captureVersionFiles({ repository: cwd, plan,
    operations: Object.entries(changes).map(([path, value]) =>
      ({ op: 'write', path, content: Buffer.from(value).toString('base64') })) });
  const branchIdentity = createHash('sha256').update(JSON.stringify(
    'acme/app/master/release-please/.')).digest('hex').slice(0, 16);
  const technicalBranch = `versioning/release-please/${branchIdentity}`;
  git('switch', '-qc', technicalBranch);
  for (const [path, value] of Object.entries(changes)) writeFileSync(join(cwd, path), value);
  git('add', '.'); git('commit', '-qm', `chore(release): release-please\n\nCentral-Versioning-Plan: ${plan.planDigest}\nFunctional-SHA: ${functionalSha}`);
  const reviewedHeadSha = git('rev-parse', 'HEAD');
  const treeSha = git('rev-parse', `${reviewedHeadSha}^{tree}`);
  git('switch', 'master');
  if (method === 'merge') git('merge', '--no-ff', technicalBranch, '-m', 'Merge release PR');
  else if (method === 'squash') { git('merge', '--squash', technicalBranch); git('commit', '-qm', 'Squash release PR'); }
  else { git('cherry-pick', reviewedHeadSha); }
  const publishedSha = git('rev-parse', 'HEAD');
  const provenance = { originPrNumber: 12, functionalSha, planDigest: plan.planDigest,
    bundleDigest: hash(bundle), headSha: reviewedHeadSha, treeSha };
  const state = { milestone: 'v1.0.1', functionalMergeSha: functionalSha,
    technicalHeadSha: reviewedHeadSha, technicalAuthor: 'version-bot[bot]', publishedSha, reviews: [
      { id: 1, state: 'APPROVED', commit_id: reviewedHeadSha, submitted_at: now,
        user: { login: 'maintainer', type: 'User' } } ],
    commits: 1, checkSha: publishedSha, checkConclusion: 'success', preview: false };
  const pr = () => ({ number: 99, state: state.preview ? 'open' : 'closed',
    merged_at: state.preview ? null : now, merge_commit_sha: state.preview ? null : publishedSha,
    commits: state.commits, head: { ref: technicalBranch, sha: state.technicalHeadSha },
    base: { ref: 'master' }, user: { login: state.technicalAuthor, type: 'Bot' },
    body: `Origin-PR: #12\n<!-- central-versioning\n${JSON.stringify(provenance)}\n-->` });
  const functional = () => ({ number: 12, head: { ref: 'develop', sha: developSha },
    base: { ref: 'master' }, user: { login: 'developer', type: 'User' },
    merged_at: now, merge_commit_sha: state.functionalMergeSha,
    milestone: state.milestone === null ? null : { title: state.milestone } });
  const read = {
    async get(endpoint) {
      if (endpoint.endsWith('/pulls/99')) return pr();
      if (endpoint.endsWith('/pulls/12')) return functional();
      if (endpoint === 'repos/acme/app') return {default_branch:'master'};
      if (endpoint.endsWith('/git/ref/heads/master')) return {object:{sha:publishedSha}};
      if (endpoint.endsWith('/actions/artifacts/500')) return {id:500,name:'publication-77-1',
        expired:false,size_in_bytes:400,workflow_run:{id:77,head_sha:functionalSha}};
      if (endpoint.endsWith('/actions/runs/77/attempts/1')) return {id:77,run_attempt:1,
        head_sha:functionalSha,head_branch:'master',event:'push',referenced_workflows:[
          {path:'acme/central/.github/workflows/version-publish.yml@master',sha:'c'.repeat(40)}]};
      throw Error(`unexpected get ${endpoint}`);
    },
    async list(endpoint) {
      if (endpoint.includes('/commits/') && endpoint.endsWith('/pulls?per_page=100')) return [pr()];
      if (endpoint.endsWith('/pulls/99/reviews?per_page=100')) return state.reviews;
      if (endpoint.endsWith('/pulls/12/reviews?per_page=100') ||
        endpoint.endsWith('/issues/12/timeline?per_page=100')) return [];
      throw Error(`unexpected list ${endpoint}`);
    },
    async listField(endpoint, field) {
      if(field==='jobs')return [{id:77,run_id:77,head_sha:functionalSha,
        name:'versioning / validate-publication',status:'completed',conclusion:'success'}];
      assert.equal(field, 'check_runs');
      const sha = endpoint.match(/commits\/([0-9a-f]{40})\/check-runs/)?.[1];
      if (!sha) throw Error(`unexpected check ${endpoint}`);
      return [{ id: 1, name: 'build', head_sha: sha === publishedSha ? state.checkSha : sha,
        status: 'completed', conclusion: state.checkConclusion }];
    },
  };
  return { cwd, git, plan, bundle, state, read, publishedSha, reviewedHeadSha,
    functionalSha, developSha, technicalBranch, provenance };
}

try {
  for (const method of ['merge', 'squash', 'rebase']) {
    const fixture = scenario(method);
    const expectedFunctionalEvidence = await collectPrEvidence(fixture.read,
      { repository: 'acme/app', targetBranch: 'master', prNumber: 12, requiredChecks: ['build'] });
    const request = { repository: fixture.cwd, owner: 'acme', repo: 'app', botLogin: 'version-bot[bot]', plan: fixture.plan,
      bundle: fixture.bundle, originPrNumber: 12, technicalPrNumber: 99,
      expectedFunctionalEvidence, publishedSha: fixture.publishedSha,
      requiredChecks: ['build'], read: fixture.read };
    const verified = await verifyTechnicalMerge(request);
    assert.equal(verified.publishedSha, fixture.publishedSha, method);
    assert.equal(verified.reviewedHeadSha, fixture.reviewedHeadSha, method);
    assert.equal(verified.functionalSha, fixture.functionalSha, method);
    if (method === 'merge') {
      fixture.git('checkout', '--detach', fixture.reviewedHeadSha);
      fixture.state.preview = true;
      const reviews = fixture.state.reviews; fixture.state.reviews = [];
      const preview = await verifyTechnicalPreview({ ...request, headSha: fixture.reviewedHeadSha });
      assert.equal(preview.functionalSha, fixture.functionalSha);
      assert.equal(preview.reviewedHeadSha, fixture.reviewedHeadSha);
      assert.equal(preview.planDigest, fixture.plan.planDigest);
      assert.equal(preview.approvalBy, undefined, 'preview cannot claim human approval');
      const centralSha='c'.repeat(40);
      const origin={report:Object.fromEntries(Object.entries(fixture.plan.report).reverse()),
        plan:fixture.plan,bundle:fixture.bundle,
        snapshot:expectedFunctionalEvidence,gitInputs:{schemaVersion:1,adapter:'release-please',sha:fixture.functionalSha,refs:{}},
        publicationEvidence:{phase:'functional',functionalSha:fixture.functionalSha,publishedSha:fixture.functionalSha,
          originPrNumber:12,technicalPrNumber:null,planDigest:fixture.plan.planDigest,technicalMerge:null,
          producer:{repository:'acme/app',runId:77,runAttempt:1,job:'validate-publication',centralSha}}};
      const source={repository:'acme/app',artifactId:500,runId:77,runAttempt:1,centralSha,
        planDigest:fixture.plan.planDigest,payloadDigest:publicationPayloadDigest(origin)};
      fixture.provenance.sourceArtifact=source;
      const technicalRequest={owner:'acme',repo:'app',prNumber:99,adapter:'release-please',origin,
        centralSha,centralRepository:'acme/central',baseSha:fixture.functionalSha,
        context:{repository:fixture.cwd,workspace:fixture.cwd,projectPath:'.',targetBranch:'master',
          sha:fixture.reviewedHeadSha,tagPrefix:'v',configuration:{adapterBin:'native-must-not-run'}},
        git:{headSha:()=>fixture.git('rev-parse','HEAD'),subjectsBetween:()=>[]},
        requiredChecks:['build'],read:fixture.read};
      const technicalOutput=await runTechnicalPreview(technicalRequest);
      assert.equal(technicalOutput.outputs.phase,'versioning-to-main');
      assert.equal(technicalOutput.outputs.version,'1.0.1');
      assert.equal(technicalOutput.outputs.policyOutcome,'matched');
      assert.equal(technicalOutput.plan.sha,fixture.functionalSha);
      assert.equal(technicalOutput.guide,null);
      await assert.rejects(runTechnicalPreview({...technicalRequest,baseSha:randomSha}),/origem.*avan/i);
      const originDirectory=join(root,'origin');mkdirSync(originDirectory);
      for(const [file,value] of Object.entries({'version-report.json':origin.report,'release-plan.json':origin.plan,
        'version-bundle.json':origin.bundle,'pr-policy.json':origin.snapshot,'git-inputs.json':origin.gitInputs,
        'publication-evidence.json':origin.publicationEvidence})) {
        writeFileSync(join(originDirectory,file),JSON.stringify(value));
      }
      const eventPath=join(root,'event.json'),outputPath=join(root,'outputs.txt');
      writeFileSync(eventPath,JSON.stringify({pull_request:{number:99,
        head:{sha:fixture.reviewedHeadSha},base:{sha:fixture.functionalSha}}}));
      const env={VERSIONING_WORKSPACE:fixture.cwd,GITHUB_WORKSPACE:'must-not-use-this-workspace',
        GITHUB_EVENT_PATH:eventPath,GITHUB_REPOSITORY:'acme/app',TARGET_BRANCH:'master',
        ADAPTER:'release-please',ADAPTER_BIN:'native-must-not-run',REQUIRED_CHECKS:'build',
        VERSIONING_ORIGIN_DIR:originDirectory,VERSIONING_OUTPUT_DIR:join(root,'preview'),
        CENTRAL_SHA:centralSha,CENTRAL_REPOSITORY:'acme/central',GITHUB_OUTPUT:outputPath};
      let error='';
      assert.equal(await previewMain(env,{read:fixture.read,error:value=>{error=value;}}),0,error);
      assert.match(readFileSync(outputPath,'utf8'),/phase=versioning-to-main/);
      assert.equal(JSON.parse(readFileSync(join(root,'preview/release-plan.json'),'utf8')).planDigest,
        fixture.plan.planDigest);
      writeFileSync(join(originDirectory,'publication-evidence.json'),JSON.stringify({
        ...origin.publicationEvidence,originPrNumber:13}));
      assert.equal(await previewMain(env,{read:fixture.read,error:value=>{error=value;}}),1);
      assert.match(error,/identidade|confiáve|artifact/i);
      fixture.state.milestone = 'v9.0.0';
      await assert.rejects(verifyTechnicalPreview({ ...request, headSha: fixture.reviewedHeadSha }), /origem|metadado/i);
      fixture.state.milestone = 'v1.0.1';
      fixture.state.reviews = reviews; fixture.state.preview = false;
      fixture.git('checkout', 'master');
      writeFileSync(join(originDirectory,'publication-evidence.json'),JSON.stringify(origin.publicationEvidence));
      const readerOutput=join(root,'reader-outputs.txt'),readerDirectory=join(root,'publication');
      const readerEnv={...env,GITHUB_EVENT_NAME:'push',GITHUB_REF_NAME:'master',
        GITHUB_SHA:fixture.publishedSha,GITHUB_RUN_ID:'88',GITHUB_RUN_ATTEMPT:'1',
        GITHUB_JOB:'validate-publication',VERSIONING_OUTPUT_DIR:readerDirectory,GITHUB_OUTPUT:readerOutput};
      assert.equal(await preparePublicationMain(readerEnv,{read:fixture.read,error:value=>{error=value;}}),0,error);
      const integratedEvidence=JSON.parse(readFileSync(join(readerDirectory,'publication-evidence.json'),'utf8'));
      assert.equal(integratedEvidence.phase,'technical');
      assert.equal(integratedEvidence.functionalSha,fixture.functionalSha);
      assert.equal(integratedEvidence.publishedSha,fixture.publishedSha);
      assert.equal(integratedEvidence.producer.runId,88);
      assert.match(readFileSync(readerOutput,'utf8'),/needs_version_pr=false/);
      assert.match(readFileSync(readerOutput,'utf8'),/bot_login=version-bot\[bot\]/);
      writeFileSync(join(originDirectory,'publication-evidence.json'),JSON.stringify({
        ...origin.publicationEvidence,originPrNumber:13}));
      assert.equal(await preparePublicationMain(readerEnv,{read:fixture.read,error:value=>{error=value;}}),1);
      assert.match(error,/identidade|confiáve|artifact/i);
    }
    if (method !== 'merge') {
      fixture.state.commits = 2;
      await assert.rejects(verifyTechnicalMerge(request), /multi-commit|rebase|squash/i);
      fixture.state.commits = 1;
    }
    fixture.state.reviews.push({ id: 2, state: 'DISMISSED', commit_id: fixture.reviewedHeadSha,
      submitted_at: '2026-10-21T10:01:00Z', user: { login: 'maintainer', type: 'User' } });
    await assert.rejects(verifyTechnicalMerge(request), /review|aprovação/i);
    fixture.state.reviews.pop();
    fixture.state.reviews[0].commit_id = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /head|review|aprovação/i);
    fixture.state.reviews[0].commit_id = fixture.reviewedHeadSha;
    fixture.state.technicalHeadSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /head|proveniência|técnico/i);
    fixture.state.technicalHeadSha = fixture.reviewedHeadSha;
    fixture.state.technicalAuthor = 'other-bot[bot]';
    await assert.rejects(verifyTechnicalMerge(request), /bot|autor|identidade/i);
    fixture.state.technicalAuthor = 'version-bot[bot]';
    fixture.state.milestone = 'v2.0.0';
    await assert.rejects(verifyTechnicalMerge(request), /metadado|milestone|origem/i);
    fixture.state.milestone = 'v1.0.1';
    fixture.state.functionalMergeSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /origem|funcional/i);
    fixture.state.functionalMergeSha = fixture.functionalSha;
    fixture.state.checkSha = randomSha;
    await assert.rejects(verifyTechnicalMerge(request), /CI|SHA|check/i);
  }
  console.log('Technical merge: merge/squash/rebase-one, review, origin, milestone, CI and multi-commit gates');
} finally { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
