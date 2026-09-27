import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'version-pr-check-'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const mock = join(temp, 'gh');
writeFileSync(mock, `#!/usr/bin/env node
const args = process.argv.slice(2);
const url = args.find(value => value.startsWith('repos/')) ?? '';
if (args[0] === 'pr') {
  console.log(process.env.MOCK_APPROVED === 'false' ? 'REVIEW_REQUIRED' : 'APPROVED');
} else if (url.endsWith('/issues/11')) {
  if (args.includes('.milestone.title // ""')) console.log(process.env.MOCK_WRONG_ISSUE === 'true' ? 'v9.9.9' : 'v1.2.3');
  else console.log('https://api.github.com/repos/acme/lab/issues/10');
} else if (url.endsWith('/issues/10')) {
  const issue = { title: process.env.MOCK_WRONG_EPIC === 'true' ? 'v9.9.9' : 'v1.2.3', state: process.env.MOCK_EPIC_CLOSED === 'false' ? 'open' : 'closed',
    milestone: { title: 'v1.2.3', state: process.env.MOCK_EPIC_CLOSED === 'false' ? 'open' : 'closed', open_issues: 0 } };
  console.log(args.includes('.title // ""') ? issue.title : JSON.stringify(issue));
} else if (url.endsWith('/pulls')) {
  const pr = { number: 3, merged_at: process.env.MOCK_ORIGIN === 'false' ? null : '2026-09-24T12:00:00Z',
    merge_commit_sha: process.env.MOCK_ORIGIN_SHA ?? process.env.MOCK_HEAD_SHA,
    base: { ref: 'develop' }, head: { ref: 'release/v1.2.3' }, body: 'Epic: #10' };
  console.log(JSON.stringify([pr]));
} else if (url.includes('/pulls/')) {
  console.log(process.env.MOCK_HOMOLOGATION === 'false' ? 'pendente' : 'Homologação: aprovada');
} else { console.error('API inesperada: ' + args.join(' ')); process.exit(1); }
`);
chmodSync(mock, 0o755);

const event = (head, base, body) => ({ pull_request: { number: 4,
  base: { ref: base }, head: { ref: head, sha }, body } });
const run = (payload, overrides = {}) => {
  const file = join(temp, 'event.json');
  const output = join(temp, 'output.txt');
  writeFileSync(file, JSON.stringify(payload));
  writeFileSync(output, '');
  const result = spawnSync('bash', [join(root, 'scripts/versioning/preview.sh')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${temp}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
      GITHUB_EVENT_PATH: file, GITHUB_WORKSPACE: root, GITHUB_REPOSITORY: 'acme/lab',
      RELEASE_BRANCH: 'release/v1.2.3', TARGET_BRANCH: 'main', GITHUB_OUTPUT: output,
      MOCK_HEAD_SHA: sha,
      ...overrides },
  });
  return { result, output: readFileSync(output, 'utf8').trim() };
};

try {
  const feature = run(event('feature/issue-11', 'release/v1.2.3', 'Refs #11'));
  assert.equal(feature.result.status, 0, feature.result.stderr);
  assert.match(feature.output, /phase=feature-to-release/);

  const release = run(event('release/v1.2.3', 'develop', 'Epic: #10'));
  assert.equal(release.result.status, 0, release.result.stderr);
  assert.match(release.output, /phase=release-to-develop/);

  const integration = run(event('develop', 'main', 'Epic: #10\nHomologação: aprovada'));
  assert.equal(integration.result.status, 0, integration.result.stderr);
  assert.match(integration.output, /phase=develop-to-main/);
  const master = run(event('develop', 'master', 'Epic: #10\nHomologação: aprovada'), { TARGET_BRANCH: 'master' });
  assert.equal(master.result.status, 0, master.result.stderr);
  assert.match(master.output, /phase=develop-to-main/);
  assert.match(readFileSync(join(root, '.github/workflows/version-preview.yml'), 'utf8'),
    /continue-on-error: true/);

  for (const [payload, env] of [
    [event('feature/issue-11', 'release/v1.2.3', 'Refs #11'), { MOCK_WRONG_ISSUE: 'true' }],
    [event('release/v1.2.3', 'develop', 'Epic: #10'), { MOCK_WRONG_EPIC: 'true' }],
    [event('release/v1.2.3', 'develop', 'Epic: #10'), { MOCK_EPIC_CLOSED: 'false' }],
    [event('develop', 'main', 'Epic: #10'), { MOCK_HOMOLOGATION: 'false' }],
    [event('develop', 'main', 'Epic: #10'), { MOCK_APPROVED: 'false' }],
    [event('develop', 'main', 'Epic: #10'), { MOCK_EPIC_CLOSED: 'false' }],
    [event('develop', 'main', 'Epic: #10'), { MOCK_ORIGIN: 'false' }],
    [event('develop', 'main', 'Epic: #10'), { MOCK_ORIGIN_SHA: '0000000000000000000000000000000000000000' }],
    [event('feature/issue-11', 'main', 'Refs #11'), {}],
  ]) {
    assert.notEqual(run(payload, env).result.status, 0, `PR inválido aceito: ${JSON.stringify(payload)}`);
  }
  console.log('PRs feature/release/integração: cenários válidos e inválidos aprovados');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
