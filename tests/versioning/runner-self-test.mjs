import assert from 'node:assert/strict';
import { runFixtures } from './run.mjs';

const calls = [];
const ok = runFixtures(['zeta.mjs', 'alpha.mjs'], file => {
  calls.push(file);
  return { status: 0 };
});
assert.equal(ok, 0);
assert.deepEqual(calls, ['alpha.mjs', 'zeta.mjs'], 'fixtures run in stable lexical order');

const errors = [];
const originalError = console.error;
console.error = message => errors.push(String(message));
try {
  const failed = runFixtures(['alpha.mjs', 'broken.mjs', 'zeta.mjs'], file =>
    ({ status: file === 'broken.mjs' ? 7 : 0 }));
  assert.equal(failed, 7, 'child failure propagates its nonzero status');
  assert.deepEqual(errors, ['Fixture failed: broken.mjs'], 'failure identifies the fixture');
} finally {
  console.error = originalError;
}

console.log('Runner: 5 assertions passed');
