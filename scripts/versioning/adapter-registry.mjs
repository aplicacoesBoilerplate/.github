import { calculateGo } from './adapters/go-gitsemver.mjs';
import { collectJgitver } from './adapters/jgitver.mjs';
import { normalizeJgitverReport } from './version-report.mjs';
import { calculateStandardVersion } from './adapters/standard-version.mjs';

export function resolveAdapter(id, { go = calculateGo, maven = collectJgitver, standard = calculateStandardVersion } = {}) {
  const adapters = {
    'go-gitsemver': { runtime: 'go', tagKind: 'lightweight', calculate: go },
    'standard-version': { runtime: 'node', tagKind: 'lightweight', calculate: standard },
    jgitver: { runtime: 'java', tagKind: 'annotated',
      calculate: (context, dependencies) => normalizeJgitverReport({
        native: maven(context, dependencies), branch: context.targetBranch,
        sha: context.sha, repository: context.projectDirectory, tagPrefix: context.tagPrefix??'v' }) },
  };
  if (!Object.hasOwn(adapters, id)) throw new Error('Adaptador não suportado: ' + id);
  return Object.freeze(adapters[id]);
}
