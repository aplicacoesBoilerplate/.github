export * from './dist/compat/version-report.js';
import { main } from './dist/compat/version-report.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
