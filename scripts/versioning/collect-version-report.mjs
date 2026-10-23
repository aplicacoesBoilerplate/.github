import { main } from './dist/compat/adapters.js';
import { runIfMain } from './dist/compat/cli.js';
runIfMain(import.meta.url, main);
