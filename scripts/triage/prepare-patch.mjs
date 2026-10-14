import { mkdtemp, mkdir, writeFile, realpath, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { validateEnvelope, validatePatch } from '../llm/result.mjs';
import { validateRelativePath, contractError } from '../llm/validate-request.mjs';
import { validateTriageConfig } from './policy.mjs';

const execute = promisify(execFile);
const ownedDirectories = new WeakMap();

// Never inherit credentials, Git config injection or caller-provided execution options.
export function patchGitEnvironment() {
  return { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'file',
    GIT_AUTHOR_NAME: 'Triage proposal', GIT_AUTHOR_EMAIL: 'triage@example.invalid',
    GIT_COMMITTER_NAME: 'Triage proposal', GIT_COMMITTER_EMAIL: 'triage@example.invalid' };
}

async function git(root, args, hooks) {
  const env = patchGitEnvironment();
  try {
    const { stdout } = await execute('git', ['--no-pager', '-c', 'core.autocrlf=false', '-c', 'core.fsmonitor=false',
      '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return stdout.trimEnd();
  } catch { throw contractError('INVALID_TRIAGE_PATCH'); }
}

function safeTree(tree) {
  for (const entry of tree.split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob [a-f0-9]{40}\t(.+)$/.exec(entry);
    if (!match) throw contractError('INVALID_TRIAGE_PATCH');
    validateRelativePath(match[2]);
  }
}

/** Prepare an immutable local commit; no product checks or remote writes occur here. */
export async function preparePatch({ envelope, expected, patch, sourceRoot, config }) {
  const policy = validateTriageConfig(config);
  validateEnvelope(envelope, expected);
  if (envelope.schema_version !== 2 || envelope.status !== 'succeeded' || envelope.patch_file !== 'proposal.patch') throw contractError('INVALID_RESULT');
  validatePatch(patch);
  if (Buffer.byteLength(patch) > 1048576) throw contractError('INVALID_TRIAGE_PATCH');
  const allowed = path => policy.allowed_paths.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  const paths = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)\r?$/gm)].flatMap(match => [match[1], match[2]]);
  if (paths.some(path => !allowed(path) || path.startsWith('.github/triage/'))) throw contractError('INVALID_TRIAGE_PATCH');
  const source = await realpath(sourceRoot);
  const directory = await mkdtemp(join(tmpdir(), 'triage-proposal-'));
  const hooks = join(directory, 'empty-template'); const repository = join(directory, 'source');
  try {
    await mkdir(hooks);
    if (await git(source, ['rev-parse', 'HEAD'], hooks) !== expected.source_sha) throw contractError('STALE_TRIAGE_INPUT');
    safeTree(await git(source, ['ls-tree', '-rz', '--full-tree', expected.source_sha], hooks));
    const cloneSource = process.platform === 'win32' ? source.replaceAll('\\', '/') : source;
    await git(directory, ['clone', '--quiet', '--no-checkout', '--no-hardlinks', `--template=${hooks}`, '--', cloneSource, repository], hooks);
    await git(repository, ['checkout', '--quiet', '--detach', expected.source_sha], hooks);
    const patchFile = join(directory, 'proposal.patch');
    await writeFile(patchFile, patch, { mode: 0o600, flag: 'wx' });
    await git(repository, ['apply', '--check', '--index', '--', patchFile], hooks);
    await git(repository, ['apply', '--index', '--', patchFile], hooks);
    const changed = (await git(repository, ['diff', '--cached', '--name-only', '-z'], hooks)).split('\0').filter(Boolean);
    if (!changed.length || changed.some(path => !allowed(path))) throw contractError('INVALID_TRIAGE_PATCH');
    const tree = await git(repository, ['write-tree'], hooks);
    safeTree(await git(repository, ['ls-tree', '-rz', '--full-tree', tree], hooks));
    await git(repository, ['commit', '--quiet', '-m', 'Apply validated triage proposal'], hooks);
    const commit = await git(repository, ['rev-parse', 'HEAD'], hooks);
    if (await git(repository, ['rev-parse', 'HEAD^'], hooks) !== expected.source_sha) throw contractError('INVALID_TRIAGE_PATCH');
    const bundle = join(directory, 'proposal.bundle');
    await git(repository, ['bundle', 'create', bundle, `${expected.source_sha}..HEAD`], hooks);
    const prepared = { directory, sourceRoot: repository, source_sha: expected.source_sha, commit_sha: commit,
      changed_paths: changed, bundle_file: bundle, bundle_sha256: createHash('sha256').update(await readFile(bundle)).digest('hex') };
    ownedDirectories.set(prepared, directory);
    return prepared;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw contractError(error.code === 'STALE_TRIAGE_INPUT' ? error.code : 'INVALID_TRIAGE_PATCH');
  }
}

export async function cleanupPreparedPatch(prepared) {
  const directory = ownedDirectories.get(prepared);
  if (directory) { await rm(directory, { recursive: true, force: true }); ownedDirectories.delete(prepared); }
}
