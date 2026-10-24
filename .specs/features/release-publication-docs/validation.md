# Release publication documentation validation

Verdict: PASS

## Scope and evidence
- AC-1: docs/.vitepress/config.mts:22 and docs/pipelines/versionamento-release-please.md:9 expose the three main pages and keep existing deep dives.
- AC-2: examples/versioning/consumers/node/release.yml:49 and the corresponding Maven/Gradle/Go callers publish only after release outputs and check out tag_name; simple has no publish job. Each directory contains valid JSON config and initial manifest.
- AC-3: examples/versioning/consumers/gradle/release-please-config.json:5 selects simple plus generic gradle.properties. A local exercise with SDK 17.3.0 built the proposed PR, asserted property version=0.0.2, asserted v0.0.2 tag and createIfMissing=false for absent TXT. No remote request was allowed.
- AC-4: docs/pipelines/release-please/quality-gates.md:12 documents the observed Validate repository required check, real caller naming, conditional work versus workflow skipping, and no bot bypass. Current CI does not yet implement an exemption for tool tests on technical PRs.
- AC-5: docs/pipelines/release-please/conexao-github.md:13 uses GH_TOKEN in a child process without logging its value and distinguishes DNS, HTTP 401, HTTP 403, transport and Bash initialization.

## Executed gates
- Parsed all five full caller YAMLs and ten config/state JSONs; confirmed release depends on verify and central publishers remain disabled.
- Native Gradle updater example passed against the pinned SDK with isolated GitHub transport.
- VitePress 1.6.4 build passed in 12.93s using the previously documented cached validation runtime.
- Five generated pages were inspected with an HTML parser to verify headings, expanded caller examples and the gate/connection guidance.
- git diff --check passed.
- Independent review by /root/review_publication_docs: PASS, no blockers; source/example parity and file:line evidence independently inspected.

## Limits
Documentation and example files only. No central runtime or test files changed and no permanent tests added. The existing 61-test suite/typecheck passed before this documentation-only update and was not repeated unnecessarily. The cached docs runtime differs from exact lockfile install as recorded in the earlier release-versioning report.

No Gradle/JDK build, real registry upload, GitHub Release creation or protected-branch write was executed. Consumer source/build files, tokens, registry access and the reviewed central SHA must be configured before adopting the examples. Placeholders intentionally require replacement.

Remote publication remains blocked: the controlled terminal cannot resolve api.github.com. PAT availability is confirmed, token validity is unconfirmed. Local integration repository has artificial snapshot history; do not push its branch directly.
