export { evaluateReleasePolicy } from './dist/services/release-policy.js';
import { policyMain as main } from './dist/compat/operations.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
