import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const preview = readFileSync(resolve(root, '.github/workflows/version-preview.yml'), 'utf8');
let assertions = 0;
const matches = (pattern, message) => { assertions += 1; assert.match(preview, pattern, message); };
const excludes = (pattern, message) => { assertions += 1; assert.doesNotMatch(preview, pattern, message); };

matches(/workflow_call:/, 'preview must remain reusable');
for (const output of ['phase', 'version', 'bump', 'policy_outcome', 'summary']) {
  matches(new RegExp(`^      ${output}:`, 'm'), `missing workflow output ${output}`);
  matches(new RegExp(`^      ${output}: ` + '\\$\\{\\{ steps\\.preview\\.outputs\\.' + output + ' \\}\\}', 'm'),
    `missing job output ${output}`);
}
matches(/permissions:\s*\n\s+contents: read\s*\n\s+pull-requests: read\s*\n\s+issues: read\s*\n\s+checks: read/,
  'preview permissions must be read-only and sufficient for evidence');
excludes(/contents: write|pull-requests: write|issues: write|checks: write/,
  'preview may not request write permissions');
matches(/actions\/setup-go@[0-9a-f]{40}/, 'Go setup must be SHA pinned');
matches(/go install github\.com\/MyCarrier-DevOps\/go-gitsemver@680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6/,
  'go-gitsemver revision must be immutable');
matches(/if: steps\.preview\.outputs\.phase == 'release-to-develop'/,
  'artifacts are mandatory for develop previews');
matches(/actions\/upload-artifact@[0-9a-f]{40}/, 'artifact upload must be SHA pinned');
matches(/homologation\.md[\s\S]*homologation\.json/, 'both guide files must be uploaded');
matches(/if-no-files-found: error/, 'missing guide files must fail upload');
excludes(/continue-on-error:\s*true/, 'required preview operations may not be ignored');
matches(/opened, reopened, synchronize, edited, labeled, unlabeled/,
  'the reusable contract must declare required pull request events for callers');
matches(/submitted, dismissed/, 'the reusable contract must declare required review events for callers');

console.log(`Workflow contract: ${assertions} assertions passed`);
