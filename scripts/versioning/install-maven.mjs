import { installPinnedMaven } from './dist/adapters/maven-installer.js';

try {
  installPinnedMaven({ runnerTemp: process.env.RUNNER_TEMP,
    githubPath: process.env.GITHUB_PATH });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
