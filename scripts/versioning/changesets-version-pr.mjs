export { planDigest, verifyChangesetsFiles } from './dist/compat/changesets-version-pr.js';
import { main } from './dist/compat/changesets-version-pr.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
