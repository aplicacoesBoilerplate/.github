import { relative } from 'node:path';
import { runProcess } from '../process-runner.mjs';
import { collectJgitver as collectTypedJgitver } from '../dist/adapters/jgitver.js';

export function collectJgitver(context, { run = runProcess } = {}) {
  return collectTypedJgitver({ repository: context.projectDirectory, workspace: context.workspace,
    projectPath: context.projectPath ?? (relative(context.workspace, context.projectDirectory) || '.'),
    targetBranch: context.targetBranch, sha: context.sha, tagPrefix: context.tagPrefix ?? 'v',
    configuration: { adapterBin: context.adapterBin } }, {
    run: request => run({ ...request, env: { ...context.env, JGITVER_BRANCH: context.targetBranch } }),
  });
}
