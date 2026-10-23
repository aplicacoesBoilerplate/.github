import { verifyFilesMain as main } from './dist/compat/version-pr.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
