export { parseVersionPr, validateHumanReview, verifyVersionFiles } from './dist/compat/version-pr.js';
import { main } from './dist/compat/version-pr.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
