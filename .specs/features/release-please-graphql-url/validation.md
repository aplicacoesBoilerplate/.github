# Validation

Result: PASS

Independent reviewer: verify_graphql_fix.
Surface: working-tree diff against 1bd925d599f51a1a4d60bae57fee44c9b49c436d, limited to CManifestRelease.ts and manifest-release.test.ts.

## Acceptance evidence

- Actions endpoint produces exactly https://api.github.com/graphql: ci-scripts/tests/manifest-release.test.ts:194 defines expected endpoint; :209 invokes the public SDK releaseIterator; :210 asserts assert.equal(REQUEST_URL, EXPECTED).
- Enterprise endpoint preserves /api/graphql: ci-scripts/tests/manifest-release.test.ts:195 supplies enterprise endpoint and exact expected result, asserted at :210.
- Base URL and omitted URL preserve SDK defaults: ci-scripts/tests/manifest-release.test.ts:196 and :197 supply inputs and exact expected URLs, asserted at :210.
- Production entry point uses normalization: ci-scripts/scripts/CManifestRelease.ts:70 calls createGitHub with Actions endpoint at :73; :14 removes one final /graphql before SDK construction.
- Workflow and adapter contracts remain unchanged: diff modifies only SDK initialization and one focused regression test.

## Executed checks

Command: node --import tsx --test --test-name-pattern='Cliente manifest' tests/manifest-release.test.ts
Result: 1 passed, 0 failed.

Discrimination sensor: copied scripts and focused test into a temporary directory inside ci-scripts. Replaced normalization with GitHub.create(pOptions). The actual SDK emitted https://api.github.com/graphql/graphql and the exact URL assertion failed. Mutant killed; scratch removed after checking its resolved parent. Real source was never mutated.

Limit: mocked HTTP transport verifies actual SDK request construction. This review does not claim a hosted Actions rerun or remote PR creation succeeded.
