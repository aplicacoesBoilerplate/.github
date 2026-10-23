import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitPort } from '../../scripts/versioning/dist/ports/git.js';

const repository = mkdtempSync(join(tmpdir(), 'typed-git-port-'));
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
try {
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  writeFileSync(join(repository, 'content.txt'), 'first\n');
  git('add', 'content.txt');
  git('commit', '-qm', 'feat: first');
  const first = git('rev-parse', 'HEAD');
  const port = createGitPort(repository);
  assert.equal(port.headSha(), first);
  assert.deepEqual(port.readBlob(first, 'content.txt'), Buffer.from('first\n'));
  assert.throws(() => port.readBlob('b'.repeat(40), 'content.txt'));
  assert.throws(() => port.readBlob(first, '../content.txt'), /path/i);
  git('tag', '-a', 'v0.0.1', '-m', 'release');
  assert.equal(port.resolveCommit('refs/tags/v0.0.1'), first, 'Annotated tag must peel to its commit');
  const baseline = port.captureInputs('jgitver');
  assert.equal(port.verifyInputs(baseline, first, 'v0.0.2', 'jgitver'), true);
  git('tag', 'v9.0.0');
  assert.throws(() => port.verifyInputs(baseline, first, 'v0.0.2', 'jgitver'), /referências Git mudaram/);
  git('tag', '-d', 'v9.0.0');
  git('tag', '-a', 'v0.0.2', '-m', 'partial retry');
  assert.equal(port.verifyInputs(baseline, first, 'v0.0.2', 'jgitver'), true, 'Own tag permits retry');
  const batchBaseline=port.captureInputs('changesets');
  assert.equal(port.verifyInputs(batchBaseline,first,'@lab/core@1.0.1','changesets'),true);
  git('tag','@lab/core@1.0.1');git('tag','@lab/cli@1.0.1');
  assert.equal(port.resolveCommit('refs/tags/@lab/core@1.0.1'),first);
  assert.equal(port.verifyInputs(batchBaseline,first,['@lab/core@1.0.1','@lab/cli@1.0.1'],'changesets'),true,
    'retry accepts all own partial batch tags at the published SHA');
  assert.throws(()=>port.verifyInputs(batchBaseline,first,['@lab/core@1.0.1'],'changesets'),/referências Git mudaram/);
  const foreignCommit=git('commit-tree',`${first}^{tree}`,'-p',first,'-m','other delivery');
  git('tag','-f','@lab/cli@1.0.1',foreignCommit);
  assert.throws(()=>port.verifyInputs(batchBaseline,first,['@lab/core@1.0.1','@lab/cli@1.0.1'],'changesets'),
    /referências Git mudaram/,'planned tag at a foreign SHA must still block');
  git('tag','-d','@lab/core@1.0.1','@lab/cli@1.0.1');
  const afterOwnTag = port.captureInputs('jgitver');
  git('tag', '-fa', 'v0.0.2', '-m', 'moved tag');
  assert.throws(() => port.verifyInputs(afterOwnTag, first, 'v0.0.2', 'jgitver'), /referências Git mudaram/);
  writeFileSync(join(repository, 'content.txt'), 'second\n');
  git('commit', '-qam', 'feat: second');
  const second = git('rev-parse', 'HEAD');
  assert.notEqual(first, second);
  assert.deepEqual(port.readBlob(first, 'content.txt'), Buffer.from('first\n'), 'Read by SHA must ignore the advanced branch');
  assert.throws(() => port.verifyInputs(afterOwnTag, first, 'v0.0.2', 'jgitver'), /Checkout Git diverge/);
} finally {
  rmSync(repository, { recursive: true, force: true });
}
console.log('Typed Git port: SHA, blob, annotated tags, refs and retry boundaries passed');
