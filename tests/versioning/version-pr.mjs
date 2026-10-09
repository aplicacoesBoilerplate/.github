import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseVersionPr, validateHumanReview, verifyVersionFiles } from '../../scripts/versioning/version-pr.mjs';

const root = mkdtempSync(join(tmpdir(), 'version-pr-'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
try {
  git('init', '-q', '-b', 'master');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(root, 'package.json'), '{"name":"infra","version":"0.1.0"}\n');
  git('add', '.'); git('commit', '-qm', 'feat: initial');
  const originSha = git('rev-parse', 'HEAD');
  git('switch', '-qc', `versioning/standard-version/${originSha.slice(0, 12)}`);
  writeFileSync(join(root, 'package.json'), '{"name":"infra","version":"0.2.0"}\n');
  writeFileSync(join(root, 'CHANGELOG.md'), '## [0.2.0](https://example.test)\n');
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.2.0',
    packages: { '': { version: '0.2.0' } } }));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  assert.throws(() => verifyVersionFiles({ repository: root, projectPath: '.', version: '0.2.0' }),
    /pnpm|npm/, 'unsupported lockfile must fail before publication');
  unlinkSync(join(root, 'pnpm-lock.yaml'));
  unlinkSync(join(root, 'package-lock.json'));
  assert.throws(() => verifyVersionFiles({ repository: root, projectPath: '.', version: '0.2.0' }),
    /lockfile npm/, 'Node profile requires a lockfile whose version is verified');
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.2.0',
    packages: { '': { version: '0.2.0' } } }));
  git('add', '.'); git('commit', '-qm', 'chore(release): 0.2.0');
  const head = git('rev-parse', 'HEAD');
  const pr = { base: { ref: 'master' }, head: { ref: `versioning/standard-version/${originSha.slice(0, 12)}` },
    body: `Origin-PR: #12\nOrigin-SHA: ${originSha}\nAdapter: standard-version\nProject: .\nTag-Prefix: infra/v\nVersion: 0.2.0\n` };
  assert.deepEqual(parseVersionPr(pr, { targetBranch: 'master', projectPath: '.', tagPrefix: 'infra/v' }),
    { originPr: 12, originSha, version: '0.2.0' });
  verifyVersionFiles({ repository: root, projectPath: '.', version: '0.2.0', base: originSha, head });
  assert.throws(() => parseVersionPr({ ...pr, body: pr.body.replace(originSha, 'f'.repeat(40)) },
    { targetBranch: 'master', projectPath: '.', tagPrefix: 'infra/v' }), /Branch do PR/);
  assert.throws(() => parseVersionPr(pr, { targetBranch: 'master', projectPath: '.', tagPrefix: 'v' }),
    /Metadados/);
  const reviewedPr = { ...pr, head: { ...pr.head, sha: head },
    user: { login: 'version-app[bot]' } };
  const approval = { state: 'APPROVED', commit_id: head,
    user: { login: 'maintainer', type: 'User' } };
  assert.equal(validateHumanReview(reviewedPr, [[approval]]), 'maintainer');
  assert.throws(() => validateHumanReview(reviewedPr, [[{ ...approval,
    user: { login: 'version-app[bot]', type: 'Bot' } }]]), /humana/);
  assert.throws(() => validateHumanReview(reviewedPr, [[{ ...approval,
    commit_id: originSha }]]), /humana/);
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.1.0' }));
  assert.throws(() => verifyVersionFiles({ repository: root, projectPath: '.', version: '0.2.0' }),
    /package-lock.json/);
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.2.0',
    packages: { '': { version: '0.2.0' } } }));
  writeFileSync(join(root, 'unexpected.txt'), 'unexpected\n');
  git('add', '.'); git('commit', '-qm', 'chore: unexpected file');
  assert.throws(() => verifyVersionFiles({ repository: root, projectPath: '.',
    version: '0.2.0', base: originSha, head: git('rev-parse', 'HEAD') }), /Command failed|não permitido/);
  console.log('Version PR: origin, prefix and manifests validated');
} finally {
  rmSync(root, { recursive: true, force: true });
}
