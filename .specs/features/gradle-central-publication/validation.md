# Central Gradle publication validation

Verdict: PASS

## Acceptance evidence
- AC-1: ci-scripts/tests/release-please.test.ts:470 executes the real workflow condition with Gradle enabled, publication disabled, no release and another adapter.
- AC-2: the same test asserts the tag checkout output, selected working-directory, Wrapper check publish command and configured JDK. The selector test at line 498 executes the workflow JavaScript and asserts the exact path/tag outputs.
- AC-3: the selector test rejects empty/multiple releases, another path, another strategy and an empty tag before any output.
- AC-4: examples/versioning/consumers/gradle/release.yml:42 grants packages:write; lines 47-49 enable the central Gradle publisher. The old duplicate publish job was removed. Documentation explains the manifest simple updater and central/caller responsibilities.
- AC-5: the publisher has no permission override and inherits only the caller's grants. Existing non-publishing callers do not acquire or need packages:write.

## Executed gates
- Two regressions failed before implementation because the central publisher did not exist.
- npm test passed 63/63 cases in the same seven test files, with no skipped cases; only two new cases were added to the existing release-please.test.ts.
- npm run typecheck passed.
- actionlint passed for the called workflow, existing self-caller and Gradle example. Explicit optional NPM_TOKEN was declared to preserve the legacy publisher when declaring Gradle secrets.
- VitePress 1.6.4 build passed in 13.94 seconds using the previously recorded cached runtime.
- validate_spec passed without errors or warnings; git diff --check passed.
- Independent review /root/review_gradle_publisher: PASS. It executed root and subdirectory selection and invalid cases. Three isolated in-memory mutations removing cardinality, path or strategy checks were discriminated; no real source was mutated.

## Behavior and limits
Gradle versioning still uses the official simple strategy and generic gradle.properties updater. The central publisher is a separate post-release job: it selects one compatible release, checks out its tag, prepares the configured JDK and runs the executable consumer Wrapper.

The no-config Gradle contract fails explicitly before invoking the unsupported native gradle release type. Other adapters keep their existing behavior. Registry configuration, wrapper, artifact coordinates, signing and specialized multi-project publication remain in the consumer.

No real Gradle build or registry upload was executed by these repository checks. CI hosted on GitHub and actual consumer publication remain the final integration evidence. Default publication remains disabled.
