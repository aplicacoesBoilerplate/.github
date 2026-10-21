import { synchronizeNpmLock } from './dist/adapters/npm-project.js';

try {
  const [lockPath, projectPath, packagePath] = process.argv.slice(2);
  synchronizeNpmLock({ lockPath, projectPath, packagePath });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
