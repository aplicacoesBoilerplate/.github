export { buildHomologationGuide } from './dist/compat/operations.js';
import { guideMain as main } from './dist/compat/operations.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
