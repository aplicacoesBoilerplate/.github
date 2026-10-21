import { runProcess } from '../process-runner.mjs';
import { collectGoVersion } from '../dist/adapters/go-gitsemver.js';
import { validateVersionReport } from '../version-report.mjs';
import { relative } from 'node:path';

export function calculateGo(context, { run = runProcess } = {}) {
  const report = collectGoVersion({ repository: context.projectDirectory,
    workspace: context.workspace, projectPath: context.projectPath ?? (relative(context.workspace, context.projectDirectory) || '.'),
    targetBranch: context.targetBranch, sha: context.sha, tagPrefix: 'v',
    configuration: { adapterBin: context.adapterBin } }, {
    run: request => run({ ...request, env: context.env }),
  });
  return validateVersionReport(report);
}
