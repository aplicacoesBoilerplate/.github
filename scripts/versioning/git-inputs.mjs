export { captureGitInputs, verifyGitInputs } from './dist/ports/git.js';
import { gitInputsMain as main } from './dist/compat/operations.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
