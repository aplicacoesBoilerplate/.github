import { installNpmDependencies } from './dist/adapters/npm-project.js';

try {
  if (process.env.NODE_PACKAGE_MANAGER !== 'npm') {
    throw new Error('Gerenciador Node ainda não migrado: use npm para standard-version');
  }
  installNpmDependencies({ workspace: process.env.GITHUB_WORKSPACE,
    projectPath: process.env.PROJECT_PATH ?? '.' });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
