import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'version-pr-check-'));
const bin = join(temp, 'bin');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const baseSha = execFileSync('git', ['rev-parse', 'HEAD^'], { cwd: root, encoding: 'utf8' }).trim();
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

try {
  mkdirSync(bin);
  const goTool = join(bin, 'go-gitsemver');
  writeFileSync(goTool, `#!/usr/bin/env node
console.error('native preview explanation');
console.log(JSON.stringify({SemVer:process.env.TEST_VERSION,Sha:process.env.GITHUB_SHA}));
`);
  chmodSync(goTool, 0o755);
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(2),path=a[a.indexOf('api')+1],sha=process.env.GITHUB_SHA;
fs.appendFileSync(process.env.GH_CALLS,path+'\\n');
const milestone=process.env.TEST_MILESTONE?{title:process.env.TEST_MILESTONE}:null;
if(path.includes('/pulls/42/reviews')) console.log(JSON.stringify([[]]));
else if(path.includes('/issues/42/timeline')) console.log(JSON.stringify([[]]));
else if(path.includes('/commits/')&&path.includes('/check-runs')) console.log(JSON.stringify([[{name:'go-ci',status:'completed',conclusion:'success'}]]));
else if(path.endsWith('/pulls/42')) console.log(JSON.stringify({number:42,head:{ref:process.env.TEST_HEAD,sha},base:{ref:process.env.TEST_BASE},merged_at:null,merge_commit_sha:null,milestone}));
else {console.error('unexpected '+path);process.exit(2)}
`);
  chmodSync(gh, 0o755);

  const event = (head, base, milestone = null) => ({ pull_request: { number: 42,
    base: { ref: base, sha: baseSha }, head: { ref: head, sha }, milestone } });
  const run = (payload, overrides = {}) => {
    const caseDir = mkdtempSync(join(temp, 'case-'));
    const eventPath = join(caseDir, 'event.json');
    const outputPath = join(caseDir, 'outputs.txt');
    const callsPath = join(caseDir, 'gh.log');
    writeFileSync(eventPath, JSON.stringify(payload)); writeFileSync(outputPath, ''); writeFileSync(callsPath, '');
    const result = spawnSync(bash, [join(root, 'scripts/versioning/preview.sh')], {
      cwd: root, encoding: 'utf8', env: { ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: root, GITHUB_REPOSITORY: 'owner/repo',
        TARGET_BRANCH: 'master', ADAPTER: 'go-gitsemver', PROJECT_PATH: '.', GITHUB_OUTPUT: outputPath,
        VERSIONING_OUTPUT_DIR: caseDir, GH_TOKEN: 'fixture', TEST_VERSION: '0.0.1',
        TEST_HEAD: payload.pull_request.head.ref, TEST_BASE: payload.pull_request.base.ref,
        TEST_MILESTONE: payload.pull_request.milestone?.title ?? '', GH_CALLS: callsPath, ...overrides },
    });
    return { result, caseDir, output: readFileSync(outputPath, 'utf8'), calls: readFileSync(callsPath, 'utf8') };
  };

  const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const tagsBefore = execFileSync('git', ['tag'], { cwd: root, encoding: 'utf8' });
  const develop = run(event('release/v0.0.1', 'develop'));
  assert.equal(develop.result.status, 0, develop.result.stderr);
  assert.match(develop.output, /phase=release-to-develop/);
  assert.match(develop.output, /version=0\.0\.1/);
  assert.match(develop.output, /bump=patch/);
  assert.ok(readFileSync(join(develop.caseDir, 'homologation.md'), 'utf8').includes('native preview explanation'));
  assert.equal(JSON.parse(readFileSync(join(develop.caseDir, 'homologation.json'), 'utf8')).facts.pullRequest, 42);

  const master = run(event('develop', 'master', { title: 'v0.0.1' }));
  assert.equal(master.result.status, 0, master.result.stderr);
  assert.match(master.output, /phase=develop-to-main/);
  assert.match(master.output, /policy_outcome=matched/);
  assert.equal(master.calls.includes('/releases'), false, 'preview must not call release APIs');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), headBefore);
  assert.equal(execFileSync('git', ['tag'], { cwd: root, encoding: 'utf8' }), tagsBefore);

  const divergent = run(event('develop', 'master', { title: 'v1.0.0' }));
  assert.notEqual(divergent.result.status, 0, 'divergent milestone must block');
  const failedAdapter = run(event('release/v0.0.1', 'develop'), { TEST_VERSION: 'invalid' });
  assert.notEqual(failedAdapter.result.status, 0, 'calculation failure must fail the check');
  const unsupported = run(event('feature/demo', 'master'));
  assert.notEqual(unsupported.result.status, 0, 'unsupported PR phase must fail');
  console.log('PR preview: 15 assertions passed');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
