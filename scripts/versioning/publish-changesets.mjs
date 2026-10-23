export { publishChangesets, githubApi } from './dist/compat/publish-changesets.js';
import { main } from './dist/compat/publish-changesets.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
