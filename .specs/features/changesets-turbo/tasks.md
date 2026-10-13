# Tasks

## Execution Plan

### Phase 1: Coordinated release support

```text
T1 → T2 → T3 → T4 → T5
```

## Test Coverage Matrix

| Requirement | Layer | Test |
| --- | --- | --- |
| CST-01 | Native integration | `real-changesets.mjs` |
| CST-02, CST-03 | Workflow integration | `changesets-flow.mjs` |
| CST-04, CST-05 | Publisher integration | `changesets-flow.mjs` |
| CST-06 | Static contract | `workflow-contract.mjs` |

## Gate Check Commands

| Gate | Command |
| --- | --- |
| Native | `node tests/versioning/real-changesets.mjs` |
| Local | `node tests/versioning/run.mjs --local` |
| Full | Both commands plus shell/YAML parsing |

## Task Breakdown

### T1: Native release report

**Status**: Complete — real CLI fixture confirms a major release and dependent patch in one report.
**Depends on**: none
**What**: Normalize a real multi-package Changesets status and reject unstable or empty plans.
**Tests**: Real CLI fixture plus report validation assertions.
**Gate**: `node tests/versioning/real-changesets.mjs`
**Commit**: `feat(versioning): normalize coordinated changesets plans`

### T2: Coordinated technical PR

**Depends on**: T1
**What**: Prepare and verify manifests, dependency ranges, changelogs and npm lockfile in one PR.
**Tests**: Local integration flow and invalid-file/version cases.
**Gate**: `node tests/versioning/run.mjs --local`
**Commit**: `feat(versioning): prepare changesets version pull requests`

### T3: Package publication

**Depends on**: T2
**What**: Reconcile package tags/releases on the reviewed technical SHA, with partial recovery.
**Tests**: Fake GitHub API batch publication and conflict/idempotency cases.
**Gate**: `node tests/versioning/run.mjs --local`
**Commit**: `feat(versioning): publish immutable changesets package releases`

### T4: Called and caller

**Depends on**: T3
**What**: Wire Node setup and outputs, and provide one copyable monorepo caller.
**Tests**: Workflow contract assertions and YAML parse.
**Gate**: `node tests/versioning/run.mjs --local`
**Commit**: `feat(versioning): add changesets called and monorepo caller`

### T5: Documentation and verification

**Depends on**: T4
**What**: Document configuration, limitations and downstream output usage; run full gates and independent verifier.
**Tests**: Local suite, real Changesets, shell/YAML checks and hosted CI.
**Gate**: `node tests/versioning/run.mjs --local && node tests/versioning/real-changesets.mjs`
**Commit**: `docs(versioning): document coordinated changesets releases`
