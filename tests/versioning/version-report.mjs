import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  normalizeGoReport,
  selectReachableStableTag,
  validateVersionReport,
} from '../../scripts/versioning/version-report.mjs';

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const throws = (fn, pattern, message) => { assertions += 1; assert.throws(fn, pattern, message); };

const repository = mkdtempSync(join(tmpdir(), 'version-report-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  git('commit', '--allow-empty', '-qm', 'chore: bootstrap');
  git('tag', 'v0.1.0');
  git('commit', '--allow-empty', '-qm', 'feat: reachable');
  const evaluatedSha = git('rev-parse', 'HEAD');
  git('tag', 'v0.2.0');
  git('checkout', '-qb', 'unrelated', 'HEAD~1');
  git('commit', '--allow-empty', '-qm', 'feat: unrelated');
  git('tag', 'v9.0.0');

  equal(selectReachableStableTag(repository, evaluatedSha), '0.2.0',
    'highest stable tag reachable from evaluated SHA is authoritative');

  const report = normalizeGoReport({
    nativeJson: JSON.stringify({ SemVer: '0.2.1', Sha: evaluatedSha }),
    explanation: 'native explanation', branch: 'master', sha: evaluatedSha,
    repository,
  });
  equal(report.schemaVersion, 1, 'schema version is fixed');
  equal(report.adapter, 'go-gitsemver', 'adapter identity is preserved');
  equal(report.baseVersion, '0.2.0', 'reachable base is selected');
  equal(report.candidateVersion, '0.2.1', 'native candidate is preserved');
  equal(report.tag, 'v0.2.1', 'tag is normalized with v prefix');
  equal(report.bump, 'patch', 'increment is derived only for comparison metadata');
  equal(report.native.explanation, 'native explanation', 'stderr explanation remains separate');

  const taggedCommit = normalizeGoReport({
    nativeJson: JSON.stringify({ SemVer: '0.2.0', Sha: '' }),
    explanation: 'already tagged', branch: 'master', sha: evaluatedSha, repository,
  });
  equal(taggedCommit.sha, evaluatedSha, 'empty native SHA reconciles to the evaluated SHA');
  equal(taggedCommit.tag, 'v0.2.0', 'empty native SHA requires the exact candidate tag');
  throws(() => normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: '0.2.1', Sha: '' }),
    explanation: '', branch: 'master', sha: evaluatedSha, repository }), /não há tag v0\.2\.1/,
  'empty native SHA without the candidate tag fails');
  git('tag', 'v0.2.1', 'HEAD~1');
  throws(() => normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: '0.2.1', Sha: '' }),
    explanation: '', branch: 'master', sha: evaluatedSha, repository }), /não aponta para/,
  'empty native SHA with a candidate tag on another commit fails');

  const noTags = mkdtempSync(join(tmpdir(), 'version-report-empty-'));
  try {
    const emptyGit = (...args) => execFileSync('git', args, { cwd: noTags, encoding: 'utf8' }).trim();
    emptyGit('init', '-q'); emptyGit('config', 'user.email', 'fixture@example.test');
    emptyGit('config', 'user.name', 'Fixture'); emptyGit('commit', '--allow-empty', '-qm', 'chore: bootstrap');
    const sha = emptyGit('rev-parse', 'HEAD');
    equal(normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: '0.0.1', Sha: sha }),
      explanation: '', branch: 'master', sha, repository: noTags }).baseVersion, '0.0.0',
    'bootstrap uses zero only as the internal base');
    throws(() => normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: '0.1.0', Sha: sha }),
      explanation: '', branch: 'master', sha, repository: noTags }), /0\.0\.1/,
    'bootstrap accepts only candidate 0.0.1');
  } finally { rmSync(noTags, { recursive: true, force: true }); }

  throws(() => normalizeGoReport({ nativeJson: '{', explanation: '', branch: 'master',
    sha: evaluatedSha, repository }), /JSON nativo inválido/, 'malformed native JSON fails');
  throws(() => normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: 'next', Sha: evaluatedSha }),
    explanation: '', branch: 'master', sha: evaluatedSha, repository }), /SemVer estável inválido/,
  'invalid SemVer fails');
  throws(() => normalizeGoReport({ nativeJson: JSON.stringify({ SemVer: '0.2.1', Sha: 'f'.repeat(40) }),
    explanation: '', branch: 'master', sha: evaluatedSha, repository }), /SHA calculado diverge/,
  'mismatched SHA fails');
  throws(() => validateVersionReport({ ...report, schemaVersion: 2 }), /schemaVersion/,
    'unknown schema version fails validation');

  console.log(`Version report: ${assertions} assertions passed`);
} finally {
  rmSync(repository, { recursive: true, force: true });
}
