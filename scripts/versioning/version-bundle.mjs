export { captureVersionBundle, applyVersionBundle, validateVersionBundle } from './dist/services/legacy-version-bundle.js';
import { main } from './dist/compat/version-bundle.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
