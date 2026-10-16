import { runProcess } from '../process-runner.mjs';
import { normalizeGoReport } from '../version-report.mjs';

export function calculateGo(context, { run = runProcess } = {}) {
  const native = run({ command: context.adapterBin || 'go-gitsemver',
    args: ['--branch', context.targetBranch, '--commit', context.sha, '-o', 'json', '--explain'],
    cwd: context.projectDirectory, workspace: context.workspace, env: context.env });
  return normalizeGoReport({ nativeJson: native.stdout, explanation: native.stderr,
    branch: context.targetBranch, sha: context.sha, repository: context.projectDirectory });
}
