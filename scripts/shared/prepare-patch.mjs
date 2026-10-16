import { mkdtemp, mkdir, writeFile, realpath, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { validateRelativePath, contractError } from '../llm/validate-request.mjs';

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

async function git(root, args, hooks, binary = false) {
  const env = patchGitEnvironment();
  try {
    const { stdout } = await execute('git', ['--no-pager', '-c', 'core.autocrlf=false', '-c', 'core.fsmonitor=false',
      '-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, env, encoding: binary ? 'buffer' : 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return binary ? stdout : stdout.trimEnd();
  } catch { throw contractError('INVALID_PREPARED_PATCH'); }
}

function safeTree(tree) {
  for (const entry of tree.split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob [a-f0-9]{40}\t(.+)$/.exec(entry);
    if (!match) throw contractError('INVALID_PREPARED_PATCH');
    validateRelativePath(match[2]);
  }
}

/** Prepare an immutable local commit; no product checks or remote writes occur here. */
export async function preparePatch({ source_sha, patch, sourceRoot, allowed, commitMessage }) {
  const source = await realpath(sourceRoot);
  const directory = await mkdtemp(join(tmpdir(), 'git-proposal-'));
  const hooks = join(directory, 'empty-template'); const repository = join(directory, 'source');
  try {
    await mkdir(hooks);
    if (await git(source, ['rev-parse', 'HEAD'], hooks) !== source_sha) throw contractError('STALE_PATCH_SOURCE');
    safeTree(await git(source, ['ls-tree', '-rz', '--full-tree', source_sha], hooks));
    const cloneSource = process.platform === 'win32' ? source.replaceAll('\\', '/') : source;
    await git(directory, ['clone', '--quiet', '--no-checkout', '--no-hardlinks', `--template=${hooks}`, '--', cloneSource, repository], hooks);
    await git(repository, ['checkout', '--quiet', '--detach', source_sha], hooks);
    const patchFile = join(directory, 'proposal.patch');
    await writeFile(patchFile, patch, { mode: 0o600, flag: 'wx' });
    await git(repository, ['apply', '--check', '--index', '--', patchFile], hooks);
    await git(repository, ['apply', '--index', '--', patchFile], hooks);
    const changed = (await git(repository, ['diff', '--cached', '--name-only', '-z'], hooks)).split('\0').filter(Boolean);
    if (!changed.length || changed.some(path => !allowed(path))) throw contractError('INVALID_PREPARED_PATCH');
    const tree = await git(repository, ['write-tree'], hooks);
    safeTree(await git(repository, ['ls-tree', '-rz', '--full-tree', tree], hooks));
    await git(repository, ['commit', '--quiet', '-m', commitMessage], hooks);
    const commit = await git(repository, ['rev-parse', 'HEAD'], hooks);
    if (await git(repository, ['rev-parse', 'HEAD^'], hooks) !== source_sha) throw contractError('INVALID_PREPARED_PATCH');
    const bundle = join(directory, 'proposal.bundle');
    await git(repository, ['bundle', 'create', bundle, `${source_sha}..HEAD`], hooks);
    const prepared = { directory, sourceRoot: repository, source_sha, commit_sha: commit,
      changed_paths: changed, bundle_file: bundle, bundle_sha256: createHash('sha256').update(await readFile(bundle)).digest('hex') };
    ownedDirectories.set(prepared, { directory, repository, hooks, source_sha, commit_sha: commit,
      patch_sha256: createHash('sha256').update(patch).digest('hex'), changed_paths: [...changed] });
    return prepared;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw contractError(error.code === 'STALE_PATCH_SOURCE' ? error.code : 'INVALID_PREPARED_PATCH');
  }
}

export async function cleanupPreparedPatch(prepared) {
  const state = ownedDirectories.get(prepared);
  if (state) { await rm(state.directory, { recursive: true, force: true }); ownedDirectories.delete(prepared); }
}

/** Read only a fresh, owned proposal. Serialized artifact metadata is not authority. */
export async function readPreparedProposal(prepared) {
  const state = ownedDirectories.get(prepared);
  if (!state) throw contractError('INVALID_PREPARED_PATCH');
  const { repository, hooks, source_sha, commit_sha, changed_paths } = state;
  if (await git(repository, ['rev-parse', 'HEAD'], hooks) !== commit_sha
    || await git(repository, ['rev-parse', 'HEAD^'], hooks) !== source_sha) throw contractError('INVALID_PREPARED_PATCH');
  const tree_sha = await git(repository, ['rev-parse', 'HEAD^{tree}'], hooks);
  const tree = await git(repository, ['ls-tree', '-rz', '--full-tree', 'HEAD'], hooks); safeTree(tree);
  const blobs = new Map(tree.split('\0').filter(Boolean).map(line => {
    const [header, path] = line.split('\t'); const [mode, , sha] = header.split(' '); return [path, { mode, sha }];
  }));
  const changes = [];
  for (const path of changed_paths) {
    const blob = blobs.get(path);
    changes.push(blob ? { path, mode: blob.mode, type: 'blob', content: (await git(repository, ['cat-file', 'blob', blob.sha], hooks, true)).toString('base64') }
      : { path, mode: '100644', type: 'blob', sha: null });
  }
  return { base_sha: source_sha, tree_sha, changes, patch_sha256: state.patch_sha256 };
}
