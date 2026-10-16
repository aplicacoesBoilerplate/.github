import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { patchGitEnvironment } from '../triage/prepare-patch.mjs';
import { validateRelativePath, contractError } from '../llm/validate-request.mjs';
import { isExcludedSourcePath } from '../llm/execute.mjs';

const execute = promisify(execFile);

/** Read committed regular blobs before authentication; working-tree contents are not authority. */
export async function prepareReviewSource(sourceRoot, snapshot) {
  try {
    if (!/^[a-f0-9]{40}$/.test(snapshot.source_sha)) throw new Error();
    const git = async (args, maxBuffer) => (await execute('git', ['--no-pager', '--literal-pathspecs', '-c', 'core.fsmonitor=false',
      '-c', 'core.hooksPath=NUL', ...args], { cwd: sourceRoot, env: patchGitEnvironment(), encoding: 'buffer', maxBuffer, timeout: 30000, windowsHide: true })).stdout;
    const files = []; let bytes = 0;
    for (const file of snapshot.diff_index.files) {
      validateRelativePath(file.path);
      if (isExcludedSourcePath(file.path)) continue;
      const entry = (await git(['ls-tree', '-z', snapshot.source_sha, '--', file.path], 4096)).toString('utf8');
      if (!entry && file.added_lines.length === 0) continue;
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entry);
      if (!match || match[3] !== file.path) throw new Error();
      const blob = await git(['cat-file', 'blob', match[2]], 1048576); bytes += blob.length;
      if (bytes > 1048576) throw new Error();
      files.push({ path: file.path, content: new TextDecoder('utf-8', { fatal: true }).decode(blob) });
    }
    return files;
  } catch { throw contractError('REVIEW_INCONCLUSIVE'); }
}
