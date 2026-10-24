# Release versioning tasks

## Test Coverage Matrix
| Layer | Requirements | Evidence |
| --- | --- | --- |
| Policy and GitHub boundary | RV-01 | release-version-policy.test.ts, release-version-validator.test.ts, release-tag-guard.test.ts |
| Native motor and workflow | RV-02 | manifest-release.test.ts, release-project-config.test.ts, release-please.test.ts |
| Documentation and examples | RV-03 | VitePress build, SDK tests reading PackagesVue example JSON |

## Gate Check Commands
**Quick:** node --import tsx --test tests/release-version-policy.test.ts tests/release-version-validator.test.ts
**Full:** node --import tsx --test tests/*.test.ts
**Build:** Full + node node_modules/typescript/bin/tsc --noEmit + VitePress build
Commands run from ci-scripts except VitePress, which uses the isolated validation-runtime/docs project with cached dependencies.

## Execution Plan
1. T1 implements one complete release contract across policy, GitHub validation, SDK and workflows.
2. T2 documents that contract and supplies executable examples, depending on T1.
3. Independent verifier checks the final diff, native outcomes and fault discrimination.

## Task Breakdown
### T1: Implement scoped release contract and duplicate-version protection
**Depends on**: None
**Files**: ci-scripts/scripts, ci-scripts/tests, workflows, package JSONs, root release configuration and state.
**Tests**: Scalar and scoped declaration conflicts; both duplicate-origin orders; API failure; annotated tag SHA; automatic candidate collision; final SDK write interception; real native docs updater and five independent packages.
**Gate**: Build
**Done when**: Full tests and typecheck pass; default root behavior persists; native manifest applies per-package override without broadcast or tag overwrite.
**Status**: Complete: 59 tests passed, typecheck passed, SDK sensor passed.

### T2: Document artifacts, conflicts, directories and monorepo operation
**Depends on**: T1
**Files**: docs/pipelines, docs/.vitepress/config.mts, docs/releases.md, examples/versioning.
**Tests**: Parse example JSON/YAML; native engine reads actual five-package examples; build all VitePress pages; verify generated content and links.
**Gate**: Build
**Done when**: Guide contains all artifacts and conflict cases; examples use initial published versions and separate publication; no remote migration is claimed.
**Status**: Complete: VitePress build and seven rendered HTML pages passed.
