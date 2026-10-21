import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const localFixtures = [
  'adapter-report.mjs',
  'adapter-contract.mjs',
  'changesets-adapter.mjs',
  'release-please-snapshot.mjs',
  'changesets-flow.mjs',
  'changesets-publish.mjs',
  'install-node.mjs',
  'npm-project.mjs',
  'multi-version-bundle.mjs',
  'typed-maven-install.mjs',
  'technical-release.mjs',
  'version-report.mjs',
  'version-pr.mjs',
  'go-version.mjs',
  'release-policy.mjs',
  'pr-policy.mjs',
  'pr-evidence.mjs',
  'homologation-guide.mjs',
  'pr-check.mjs',
  'post-merge.mjs',
  'workflow-contract.mjs',
  'runner-self-test.mjs',
  'standard-flow.mjs',
  'adapter-registry.mjs',
  'process-runner.mjs',
  'java-properties.mjs',
  'reconciled-report.mjs',
  'jgitver-adapter.mjs',
  'go-adapter.mjs',
  'standard-adapter.mjs',
  'collect-version-report.mjs',
  'version-bundle.mjs',
  'git-inputs.mjs',
  'git-port.mjs',
  'github-port.mjs',
  'annotated-publish.mjs',
  'standard-precomputed.mjs',
  'typescript-build.mjs',
  'type-contracts.mjs',
  'dist-integrity.mjs',
  'native-workflows.mjs',
  'jgitver-report.mjs',
];

export function runFixtures(fixtures, execute = file => spawnSync(process.execPath, [join(directory, file)], {
  stdio: 'inherit', env: process.env,
})) {
  for (const fixture of [...fixtures].sort()) {
    console.log(`\n==> ${fixture}`);
    const result = execute(fixture);
    if (result.status !== 0) {
      console.error(`Fixture failed: ${fixture}`);
      return result.status ?? 1;
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode === '--local') process.exitCode = runFixtures(localFixtures);
  else if (mode === '--real-go') process.exitCode = runFixtures(['real-go-gitsemver.mjs']);
  else if (mode === '--real-release-please') process.exitCode = runFixtures(['real-release-please.mjs']);
  else {
    console.error('Usage: node tests/versioning/run.mjs --local|--real-go|--real-release-please');
    process.exitCode = 2;
  }
}
