# Central Gradle publication

## Problem Statement
The called workflow lacks a Gradle publisher even though Gradle consumer documentation exists.

## Goals
Provide central opt-in Gradle artifact publication for a single selected manifest project and keep existing callers unchanged.

## Out of Scope
Native SDK Gradle strategy, signing infrastructure, publishing mixed manifests or all Gradle modules, and real registry uploads during validation.

## Assumptions & Open Questions
Use manifest simple plus gradle.properties updater. The caller maintains Wrapper and registry build configuration. Gradle job inherits caller permissions; existing callers do not gain packages:write.
Open questions: None for this scoped publisher.

## User Stories
As a Gradle consumer maintainer, I want the called workflow to publish the released project so that my caller does not duplicate the publisher.

## Acceptance Criteria
- AC-1: WHEN publish-artifacts is false or project-type is not gradle or no new release exists, THE workflow SHALL not run the Gradle publisher.
- AC-2: WHEN one simple release matches project-path, THE publisher SHALL check out its tag and run Wrapper check publish in that path with the configured JDK.
- AC-3: WHEN release selection is empty, ambiguous, incompatible or has no tag, THE selector SHALL fail before any checkout/build/publication.
- AC-4: WHEN a Gradle caller enables central publication, THE example SHALL grant registry permissions and remove duplicate consumer publication.
- AC-5: WHEN existing callers do not publish Gradle, THE called SHALL not require new permissions from them.

## Requirement Traceability
| Criterion | Evidence | Gate |
| --- | --- | --- |
| AC-1 | Gradle workflow condition truth table | Existing release-please.test.ts |
| AC-2 | Tag/path/task/JDK assertions and selector outputs | Existing release-please.test.ts |
| AC-3 | Selector executed with invalid native outputs | Existing release-please.test.ts |
| AC-4 | Gradle example and documentation | YAML lint + docs build + independent review |
| AC-5 | No job-level permission expansion | Contract assertion + caller validation |

## Validation
Two targeted regressions failed for missing publisher before implementation. Full npm test, typecheck, actionlint, VitePress build and independent review must pass. No real Gradle project or registry is published by these checks.
