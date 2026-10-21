import { relative } from 'node:path';
import { runProcess } from '../process-runner.mjs';
import { collectStandardVersion } from '../dist/adapters/standard-version.js';
import { validateVersionReport } from '../version-report.mjs';

export function calculateStandardVersion(context, { run = runProcess } = {}) {
  const report = collectStandardVersion({ repository: context.projectDirectory,
    workspace: context.workspace,
    projectPath: context.projectPath ?? (relative(context.workspace, context.projectDirectory) || '.'),
    targetBranch: context.targetBranch, sha: context.sha, tagPrefix: context.tagPrefix ?? 'v',
    configuration: { adapterBin: context.adapterBin } }, {
    run: request => run({ ...request, env: context.env }),
  });
  return validateVersionReport(report);
}
