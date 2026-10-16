import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const run=spawnSync(process.execPath,[join(import.meta.dirname,'standard-flow.mjs')],{
  stdio:'inherit',env:{...process.env,TEST_PRECOMPUTED_MODE:'1'}});
process.exitCode=run.status??1;
