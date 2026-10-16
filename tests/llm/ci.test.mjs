import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../scripts/llm/package.json', import.meta.url));
const { parse } = require('yaml');

test('T10: central feature gate runs with its own lockfile even without a root Node project', async () => {
  const ci = parse(await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'));
  const steps = ci.jobs.llm.steps;
  const commands = steps.filter(step => step.run).map(step => step.run);
  assert.equal(commands.includes('npm ci --prefix scripts/llm --ignore-scripts --no-fund --no-audit'), true);
  assert.equal(commands.includes('npm --prefix scripts/llm test'), true);
  assert.equal(commands.includes('npm --prefix scripts/llm run check'), true);
  assert.equal(commands.includes('npm --prefix scripts/llm run lint:workflow'), true);
  assert.equal(steps.some(step => step.if), false);
  assert.equal(steps.find(step => step.uses.startsWith('actions/setup-node@')).with['node-version'], '22.23.3');
  assert.equal(ci.jobs.validate.steps.find(step => step.run === 'mvn -B verify').if, "${{ hashFiles('pom.xml') != '' }}");
  assert.equal(ci.jobs.validate.steps.find(step => step.run === 'npm run test --if-present').if, "${{ hashFiles('package.json') != '' }}");
  assert.deepEqual(ci.permissions, { contents: 'read' });
});
