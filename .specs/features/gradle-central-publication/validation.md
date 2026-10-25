# Central Gradle publication validation

Verdict: PASS

## Contract correction
The user rejected the Gradle-only job. This revision keeps one jobs.release-please and places all four publishers in its post-tag adapter stage. A common release step normalizes Action/manifest into release_created, project_path and tag_name. The external workflow_call inputs, secrets and outputs are byte-equivalent as parsed YAML to the previous revision. The Gradle caller file is unchanged.

## Acceptance evidence
- AC-1: ci-scripts/tests/release-please.test.ts:470 executes the Gradle adapter condition for opt-in, disabled publication, no new release and another type.
- AC-2: that test asserts checkout by steps.release.outputs.tag_name, publication in project_path, configured JDK and the Wrapper check publish command.
- AC-3: the common-normalizer test executes the actual workflow script with invalid cardinality, wrong path, wrong strategy and missing tag, rejecting an invalid created Gradle release before any publication.
- AC-4: the existing Gradle caller retains its permissions, project-type, config and opt-in; no extra call or Gradle-only job is required.
- AC-5: the common job inherits only the caller's permission grants, including packages:write when explicitly granted. Existing callers do not need a new permission for disabled publication.
- AC-6: the contract test asserts exactly one release-please job; the existing functional test now requires four adapter steps and retains the legacy checks.
- AC-7: the common-normalizer test asserts outputs for Action, manifest, absent release and non-publishing multi-project contexts.

## Executed gates
- The two architectural regressions failed before implementation: a Gradle-only job existed and the release normalizer did not cover both engines.
- npm test: 63/63 passed, no skips, same seven files. Existing tests were aligned to the explicitly requested common contract; test count did not grow.
- npm run typecheck: passed.
- actionlint: passed for called, self-caller and Gradle caller.
- Parsed workflow_call comparison against 7acf120: identical public inputs, secrets and outputs.
- VitePress 1.6.4 build: passed in 5.60s with the previously recorded cached runtime.
- validate_spec: passed; git diff --check: passed.
- Independent /root/verify_common_publication: PASS. Root/subdirectory, Action/no release and manifest cases inspected and executed. Three isolated in-memory mutations removing cardinality, path and strategy validation were discriminated. Real sources were not mutated.

## Limits
No real Gradle build or registry upload was executed by repository checks. Consumer build configuration, Wrapper, runtime compatibility and registry credentials remain consumer responsibilities. The SDK still uses simple plus a generic gradle.properties updater for Gradle versioning; the publication pattern is shared.

The earlier report described the previous separate-job implementation and is superseded by this contract correction. Hosted CI and real consumer publication remain integration evidence after remote delivery.
