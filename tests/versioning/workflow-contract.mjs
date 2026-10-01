import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const preview = readFileSync(resolve(root, '.github/workflows/version-preview.yml'), 'utf8');
const publish = readFileSync(resolve(root, '.github/workflows/version-publish.yml'), 'utf8');
const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
const goCaller = readFileSync(resolve(root, 'examples/callers/go/.github/workflows/go-publish.yml'), 'utf8');
let assertions = 0;
const matches = (pattern, message) => { assertions += 1; assert.match(preview, pattern, message); };
const excludes = (pattern, message) => { assertions += 1; assert.doesNotMatch(preview, pattern, message); };
const publishMatches = (pattern, message) => { assertions += 1; assert.match(publish, pattern, message); };
const publishExcludes = (pattern, message) => { assertions += 1; assert.doesNotMatch(publish, pattern, message); };
const ciMatches = (pattern, message) => { assertions += 1; assert.match(ci, pattern, message); };
const callerMatches = (pattern, message) => { assertions += 1; assert.match(goCaller, pattern, message); };
const callerExcludes = (pattern, message) => { assertions += 1; assert.doesNotMatch(goCaller, pattern, message); };

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

publishMatches(/publication_environment:\s*\n\s+description:[^\n]*\n\s+required: false\s*\n\s+default: ''\s*\n\s+type: string/,
  'publication environment must be an optional empty string');
publishExcludes(/homologation_environment:|\b(?:approved|force|skip_validation):/,
  'caller-controlled approval and bypass inputs are forbidden');
publishMatches(/environment-gate:\s*\n\s+if: inputs\.publication_environment != ''[\s\S]*?environment:\s*\n\s+name: \$\{\{ inputs\.publication_environment \}\}/,
  'a named environment must gate publication');
publishMatches(/publish:\s*\n\s+needs: environment-gate\s*\n\s+if: >-\s*\n\s+\$\{\{ always\(\)[\s\S]*needs\.environment-gate\.result == 'success'[\s\S]*needs\.environment-gate\.result == 'skipped'/,
  'publish must accept only a successful or skipped environment gate');
publishMatches(/concurrency:\s*\n\s+group: version-publish-[^\n]+\n\s+cancel-in-progress: false/,
  'publication concurrency must serialize without cancellation');
publishMatches(/permissions:\s*\n\s+contents: write\s*\n\s+pull-requests: read\s*\n\s+issues: read/,
  'the sole publication job must keep minimal permissions');
publishExcludes(/environment:\s*\$\{\{ inputs\./,
  'the write job must not bind an empty environment dynamically');
ciMatches(/actions\/checkout@[0-9a-f]{40}/, 'central CI checkout must be SHA pinned');
ciMatches(/actions\/setup-node@[0-9a-f]{40}[\s\S]*node-version: '24'/,
  'central CI must use pinned Node 24');
ciMatches(/actions\/setup-go@[0-9a-f]{40}/, 'central CI Go setup must be SHA pinned');
ciMatches(/go install github\.com\/MyCarrier-DevOps\/go-gitsemver@680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6/,
  'central CI must install the immutable adapter revision');
ciMatches(/node tests\/versioning\/run\.mjs --local/, 'central CI must run deterministic fixtures');
ciMatches(/node tests\/versioning\/run\.mjs --real-go/, 'central CI must run the real Go fixture separately');

callerMatches(/pull_request:\s*\n\s+types: \[opened, reopened, synchronize, edited, labeled, unlabeled\]/,
  'Go caller must react to every PR policy change');
callerMatches(/pull_request_review:\s*\n\s+types: \[submitted, dismissed\]/,
  'Go caller must react to review changes');
callerMatches(/push:\s*\n\s+branches: \[master\]/, 'Go caller publication trigger must be master push only');
callerMatches(/publish:\s*\n\s+if: github\.event_name == 'push' && github\.ref_name == 'master'\s*\n\s+needs: go-ci/,
  'Go publication must depend on consumer CI');
const references = [...goCaller.matchAll(/uses: aplicacoesBoilerplate\/\.github\/\.github\/workflows\/(?:version-preview|version-publish)\.yml@([0-9a-f]{40})/g)];
assert.equal(references.length, 2, 'caller must reference both centralized workflows immutably'); assertions += 1;
assert.equal(new Set(references.map(match => match[1])).size, 1, 'central workflow revisions must be consistent'); assertions += 1;
callerExcludes(/release_branch:|homologation_environment:|approved:|force:|skip_validation:/,
  'caller must pass configuration only and contain no legacy or bypass policy');

console.log(`Workflow contract: ${assertions} assertions passed`);
