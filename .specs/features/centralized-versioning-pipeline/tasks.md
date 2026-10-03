# Pipeline Centralizada de Versionamento Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/centralized-versioning-pipeline/design.md`
**Status**: Complete - independent local MVP validation PASS on 2026-10-03

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `.github/workflows/ci.yml`, `docs/versioning.md`; no numeric coverage threshold exists, so the TLC strong default applies.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| SemVer and normalized report logic | unit | All branches; 1:1 to VER-01 and its edge cases | `tests/versioning/*report*.mjs`, `tests/versioning/go-version.mjs` | `node tests/versioning/version-report.mjs && node tests/versioning/go-version.mjs` |
| Milestone and override policy | unit | Every acceptance criterion in VER-02 and VER-03, including unauthorized and stale sequences | `tests/versioning/release-policy.mjs` | `node tests/versioning/release-policy.mjs` |
| GitHub snapshot collection | integration with deterministic `gh` mock | Timeline pagination, role lookup, reviews, commit association and every failure path | `tests/versioning/pr-policy.mjs` | `node tests/versioning/pr-policy.mjs` |
| Homologation renderer | unit/integration | Every field in VER-04; untrusted text; clean working tree; missing native report | `tests/versioning/homologation-guide.mjs` | `node tests/versioning/homologation-guide.mjs` |
| Preview orchestration | integration with deterministic `gh` and adapter mocks | PRs to develop/master, milestone states, override invalidation and no write effects | `tests/versioning/pr-check.mjs` | `node tests/versioning/pr-check.mjs` |
| Post-merge publication | integration with local Git and deterministic `gh` mock | Happy, edge, API error, partial failure, collision and ten idempotent retries | `tests/versioning/post-merge.mjs` | `node tests/versioning/post-merge.mjs` |
| Real Go adapter | hosted integration | Bootstrap, patch, minor, major, combined sprint, native JSON/explain and SHA identity | `tests/versioning/real-go-gitsemver.mjs` | `node tests/versioning/real-go-gitsemver.mjs` |
| Workflow and caller contracts | static integration | YAML syntax, workflow_call inputs/outputs, permissions, event types, needs CI and optional environment | `tests/versioning/workflow-contract.mjs` | `node tests/versioning/workflow-contract.mjs` |
| Documentation and TLC artifacts | none | Build gate and deterministic TLC validators | `.specs/**`, `docs/versioning.md`, `examples/callers/go/**` | build gate only |

## Gate Check Commands

> Generated from the codebase and existing fixtures - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After a pure Node policy, renderer or report task | `node <task-specific-test>.mjs` |
| Full | After shell orchestration, workflow or publication tasks | `node tests/versioning/run.mjs --local` |
| Build | After each phase and before verification | `node tests/versioning/run.mjs --local && python -c "import glob,yaml; [yaml.safe_load(open(p,encoding='utf-8')) for p in glob.glob('.github/workflows/*.yml')]"` |
| Hosted Go | Before final verification in a compatible runner | `node tests/versioning/real-go-gitsemver.mjs` |

---

## Execution Plan

Phases are ordered and run sequentially. Each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Normalized calculation and policy

```text
T1 → T2 → T3 → T4
```

### Phase 2: Preview and homologation

```text
T5 → T6 → T7
```

### Phase 3: Protected publication

```text
T8 → T9 → T10
```

### Phase 4: Central verification and adoption package

```text
T11 → T12 → T13
```

### Phase 5: Independent-verifier fixes

```text
T14 → T15 → T16 → T17 → T18
```

### Phase 6: Discrimination-sensor fixes

```text
T19 → T20 → T21 → T22
```

---

## Task Breakdown

### T1: Create the normalized version report model

**Status**: Complete

**What**: Implement schema validation, reachable stable-tag selection, bootstrap `v0.0.1` and Go native-result normalization.
**Where**: `scripts/versioning/version-report.mjs`
**Depends on**: None
**Reuses**: `scripts/versioning/version.mjs`, parsing patterns from `scripts/versioning/prepare-release.sh`
**Requirement**: VER-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `VersionReport` schema version 1 is emitted deterministically.
- [x] Stable tags outside the evaluated SHA history are ignored.
- [x] No stable tag accepts only candidate `0.0.1`.
- [x] Invalid SemVer, native JSON and mismatched SHA fail.
- [x] Gate passes with 14 assertions recorded before commit.

**Tests**: unit in `tests/versioning/version-report.mjs`, covering every VER-01 branch and edge case
**Gate**: quick, `node tests/versioning/version-report.mjs`
**Commit**: `feat(versioning): normalize adapter version reports`

### T2: Collect the native adapter report

**Status**: Complete

**What**: Execute the selected adapter once, capture stdout and explanation separately, and persist the normalized report without shell evaluation.
**Where**: `scripts/versioning/collect-version-report.sh`
**Depends on**: T1
**Reuses**: `scripts/versioning/resolve-adapter.sh`, Go command from `scripts/versioning/prepare-release.sh`
**Requirement**: VER-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Go runs with branch, SHA, JSON output and `--explain` at the pinned caller revision.
- [x] Native JSON and explanation remain distinguishable in `VersionReport`.
- [x] Unknown adapter and unsafe project path fail before command execution.
- [x] Gate passes with 17 assertions recorded before commit.

**Tests**: integration additions in `tests/versioning/go-version.mjs`, including stderr explanation and no working-tree mutation
**Gate**: quick, `node tests/versioning/go-version.mjs`
**Commit**: `feat(versioning): collect native adapter reports`

### T3: Evaluate milestone and override policy

**Status**: Complete

**What**: Implement the pure policy decision for optional milestone, exact version, bump type and two-maintainer override ordering.
**Where**: `scripts/versioning/release-policy.mjs`
**Depends on**: T2
**Reuses**: SemVer comparison from `scripts/versioning/version.mjs`
**Requirement**: VER-02, VER-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] No milestone returns `adapter-authoritative` without override requirements.
- [x] Valid matching milestone returns `matched` for version and bump.
- [x] Invalid or divergent milestone returns `blocked` unless the complete override is current.
- [x] Labeler and approver must be distinct Maintain/Admin actors in chronological order and on the current SHA.
- [x] Gate passes with 24 assertions recorded before commit.

**Tests**: unit in `tests/versioning/release-policy.mjs`, 1:1 with every VER-02 and VER-03 criterion
**Gate**: quick, `node tests/versioning/release-policy.mjs`
**Commit**: `feat(versioning): enforce release milestone policy`

### T4: Collect an auditable pull-request policy snapshot

**Status**: Complete

**What**: Fetch the current PR, active label event, later reviews, current roles and unique PR associated with a merge SHA into one JSON snapshot.
**Where**: `scripts/versioning/collect-pr-policy.sh`
**Depends on**: T3
**Reuses**: API helpers and commit association in `scripts/versioning/release-gates.sh`
**Requirement**: VER-02, VER-03, VER-05

**Tools**:

- MCP: Context7 for GitHub API verification
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Timeline and reviews are paginated and filtered to the current label and SHA.
- [x] Role checks use current `role_name`, accepting only Maintain/Admin.
- [x] Commit lookup requires exactly one integrated `develop → master` PR matching the SHA.
- [x] API errors, incomplete pagination and ambiguous association fail closed.
- [x] Gate passes with 16 assertions recorded before commit.

**Tests**: integration in `tests/versioning/pr-policy.mjs` using a deterministic `gh` mock for all success and failure paths
**Gate**: quick, `node tests/versioning/pr-policy.mjs`
**Commit**: `feat(versioning): collect pull request policy evidence`

### T5: Render structured homologation guides

**Status**: Complete

**What**: Generate Markdown and JSON from the normalized report, PR facts, known checks and suggested validation items.
**Where**: `scripts/versioning/homologation-guide.mjs`
**Depends on**: T4
**Reuses**: Intent of `scripts/versioning/homologation-guide.sh`
**Requirement**: VER-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] `homologation.md` and `homologation.json` contain every field from the design.
- [x] JSON separates collected facts from pending suggestions.
- [x] Untrusted PR, commit and native text is rendered without shell evaluation or unsafe Markdown interpretation.
- [x] Missing report fails and generation leaves the consumer working tree unchanged.
- [x] Gate passes with 17 assertions recorded before commit.

**Tests**: unit/integration in `tests/versioning/homologation-guide.mjs`, covering all VER-04 criteria and malicious-looking text
**Gate**: quick, `node tests/versioning/homologation-guide.mjs`
**Commit**: `feat(versioning): generate homologation artifacts`

### T6: Integrate report and policy into preview orchestration

**Status**: Complete

**What**: Replace epic/body-based final validation with adapter report, PR milestone policy and required guide generation by PR phase.
**Where**: `scripts/versioning/preview.sh`
**Depends on**: T5
**Reuses**: Existing event parsing and output conventions
**Requirement**: VER-01, VER-02, VER-03, VER-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] PR to `develop` emits version outputs and both guide files.
- [x] PR `develop → master` evaluates current milestone and override evidence.
- [x] No preview path creates tag, release or commit.
- [x] Failure to calculate or render fails the check rather than continuing.
- [x] Gate passes with 32 assertions across the declared fixtures recorded before commit.

**Tests**: integration updates in `tests/versioning/pr-check.mjs`, covering both phases and policy re-evaluation
**Gate**: full, `node tests/versioning/pr-check.mjs && node tests/versioning/homologation-guide.mjs`
**Commit**: `feat(versioning): enforce policy during pull request preview`

### T7: Expose preview artifacts through the reusable workflow

**Status**: Complete

**What**: Install the pinned Go adapter, upload homologation artifacts, expose normalized outputs and run for all policy-changing PR/review events.
**Where**: `.github/workflows/version-preview.yml`
**Depends on**: T6
**Reuses**: Pinned checkout pattern from the current reusable workflow
**Requirement**: VER-04, VER-06

**Tools**:

- MCP: Context7 for GitHub Actions syntax
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] The workflow supports Go calculation in read-only jobs.
- [x] Artifact upload is mandatory for PRs to `develop`.
- [x] Outputs include version, bump and policy outcome.
- [x] Permissions contain no write capability.
- [x] Contract test proves required events and artifact handling with 37 assertions across the declared fixtures.

**Tests**: static integration additions in `tests/versioning/workflow-contract.mjs`
**Gate**: full, `node tests/versioning/workflow-contract.mjs && node tests/versioning/pr-check.mjs`
**Commit**: `feat(versioning): publish preview and homologation outputs`

### T8: Revalidate integrated policy before publication

**Status**: Complete

**What**: Replace legacy epic/homologation-text gates with commit-associated PR snapshot and the same release policy used during preview.
**Where**: `scripts/versioning/release-gates.sh`
**Depends on**: T7
**Reuses**: Event, ref, remote SHA and API error validation already present
**Requirement**: VER-02, VER-03, VER-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Only a push in the configured target branch and current remote SHA proceeds.
- [x] The associated merged PR must uniquely be `develop → master`.
- [x] Milestone and override policy is recalculated from current API evidence.
- [x] Direct pushes, ambiguous PRs, stale override and API errors fail before write.
- [x] Gate passes with 24 assertions recorded before commit.

**Tests**: integration updates in `tests/versioning/post-merge.mjs` for every provenance and policy failure
**Gate**: full, `node tests/versioning/post-merge.mjs`
**Commit**: `feat(versioning): revalidate release policy after merge`

### T9: Publish from the normalized report idempotently

**Status**: Complete

**What**: Make publication consume `VersionReport`, generate release notes from the normalized/native report and preserve reconcile-before-write behavior.
**Where**: `scripts/versioning/publish.sh`
**Depends on**: T8
**Reuses**: Existing tag/release lookup, conflict handling and race recovery
**Requirement**: VER-01, VER-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] The integrated SHA is recalculated once and used for tag and release.
- [x] Matching tag/release returns `already-published`.
- [x] Correct tag with missing release recovers by creating only the release.
- [x] Conflicting tag/release never moves or overwrites state.
- [x] Ten retries and simulated partial/racing writes meet VER-05.
- [x] Gate passes with 62 assertions recorded before commit.

**Tests**: integration updates in `tests/versioning/post-merge.mjs`, including notes, ten retries, partial state and collision
**Gate**: full, `node tests/versioning/post-merge.mjs`
**Commit**: `feat(versioning): publish normalized releases idempotently`

### T10: Make the publication environment optional

**Status**: Complete

**What**: Add a conditional environment gate, keep one write job and expose the finalized reusable-workflow contract.
**Where**: `.github/workflows/version-publish.yml`
**Depends on**: T9
**Reuses**: Current concurrency, pinned setup actions and job outputs
**Requirement**: VER-05

**Tools**:

- MCP: Context7 for GitHub Actions syntax
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] `publication_environment` is optional and defaults to empty.
- [x] A non-empty value gates the write job through the named environment.
- [x] An empty value skips only the gate and still permits publication after CI.
- [x] The write job keeps concurrency without cancellation and minimal permissions.
- [x] Contract test rejects approval/force/skip boolean inputs with 29 workflow assertions.

**Tests**: static integration additions in `tests/versioning/workflow-contract.mjs` plus publication integration gate
**Gate**: full, `node tests/versioning/workflow-contract.mjs && node tests/versioning/post-merge.mjs`
**Commit**: `feat(versioning): support optional publication environments`

### T11: Run the full versioning suite in central CI

**Status**: Complete

**What**: Add a deterministic local test runner and a CI job that executes local fixtures plus the real pinned Go adapter test.
**Where**: `tests/versioning/run.mjs`
**Depends on**: T10
**Reuses**: Existing standalone Node fixtures
**Requirement**: VER-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`, `entregas`

**Done when**:

- [x] `--local` executes every deterministic fixture in a stable order.
- [x] `--real-go` executes the real Go fixture separately.
- [x] Any child failure returns a nonzero status and identifies the fixture.
- [x] `.github/workflows/ci.yml` invokes both modes with pinned actions and installs pinned `go-gitsemver`.
- [x] The final build gate passes with 9 deterministic fixtures, 5 runner assertions and 35 workflow assertions recorded.

**Tests**: integration self-check of the runner plus complete existing suite; CI YAML checked by contract test
**Gate**: build, `node tests/versioning/run.mjs --local && node tests/versioning/workflow-contract.mjs`
**Commit**: `ci(versioning): run the centralized release suite`

### T12: Update the copyable Go caller

**Status**: Complete

**What**: Provide a caller that chains consumer CI, preview and post-merge publication while only passing configuration to central workflows.
**Where**: `examples/callers/go/`
**Depends on**: T11
**Reuses**: Existing Go caller, CI example and `GitVersion.yml`
**Requirement**: VER-06

**Tools**:

- MCP: Context7 for reusable workflow caller syntax
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Preview responds to all required PR and review changes.
- [x] Publish is reachable only on push to `master` and depends on Go CI.
- [x] Environment is optional and no business rule is duplicated in the caller.
- [x] References to central workflows are immutable and consistent.
- [x] The contract test validates the example with 42 assertions without touching `boilerplate-cli`.

**Tests**: static integration additions in `tests/versioning/workflow-contract.mjs`
**Gate**: full, `node tests/versioning/workflow-contract.mjs`
**Commit**: `docs(versioning): update the Go caller example`

### T13: Document adoption and branch protection

**Status**: Complete

**What**: Document the lifecycle, milestone rules, secure override, optional environment, required checks, direct-push protection and Go adoption steps.
**Where**: `docs/versioning.md`
**Depends on**: T12
**Reuses**: Existing migration, adapter and troubleshooting sections
**Requirement**: VER-02, VER-03, VER-04, VER-05, VER-06

**Tools**:

- MCP: Context7 for links to current GitHub documentation
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Documentation matches every finalized workflow input and output.
- [x] Maintainers can configure required checks and block direct pushes on `develop` and `master`.
- [x] The override explains why the label alone is insufficient.
- [x] Migration from `homologation_environment` to `publication_environment` is explicit.
- [x] Commands for local and hosted verification are copyable.
- [x] Build gate and TLC validators pass with no stale contract references.

**Tests**: none - documentation layer; contract search and build gate only
**Gate**: build, `node tests/versioning/run.mjs --local && node tests/versioning/workflow-contract.mjs`
**Commit**: `docs(versioning): document centralized release governance`

### T14: Reconcile real tagged Go commits

**Status**: Complete

**What**: Accept an empty native SHA only when the exact candidate tag resolves to the evaluated commit, preserving fail-closed behavior otherwise.
**Where**: `scripts/versioning/version-report.mjs`
**Depends on**: T13
**Reuses**: Tagged-commit reconciliation from `scripts/versioning/prepare-release.sh`
**Requirement**: VER-01, VER-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] The pinned real Go adapter normalizes an already-tagged commit with empty native SHA.
- [x] The candidate tag resolves exactly to the evaluated SHA.
- [x] Missing, wrong or conflicting tags remain rejected.
- [x] The collector-to-publication rerun reaches `already-published`.

**Tests**: integration and real-adapter additions in `tests/versioning/version-report.mjs` and `tests/versioning/real-go-gitsemver.mjs`
**Gate**: hosted Go, `node tests/versioning/real-go-gitsemver.mjs`
**Commit**: `fix(versioning): reconcile tagged Go release reports`

### T15: Make malformed milestones non-overridable

**Status**: Complete

**What**: Separate invalid contract input from intentional version or bump divergence so override applies only to a valid milestone.
**Where**: `scripts/versioning/release-policy.mjs`
**Depends on**: T14
**Reuses**: Existing strict milestone parser and audit diagnostics
**Requirement**: VER-02, VER-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Invalid milestone always returns `blocked`, even with two valid maintainers.
- [x] The diagnostic includes the received title and expected strict format.
- [x] Valid version or bump divergence remains overridable.
- [x] The four compared values and full override audit payload have exact assertions.

**Tests**: unit additions in `tests/versioning/release-policy.mjs`
**Gate**: quick, `node tests/versioning/release-policy.mjs`
**Commit**: `fix(versioning): reject overrides for malformed milestones`

### T16: Complete caller events and permissions

**Status**: Complete

**What**: Re-run policy on milestone assignment/removal and grant the read permission required to collect check runs.
**Where**: `examples/callers/go/.github/workflows/go-publish.yml`
**Depends on**: T15
**Reuses**: Existing caller event and permission blocks
**Requirement**: VER-02, VER-04, VER-06

**Tools**:

- MCP: Context7 for GitHub Actions events and permission inheritance
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] Pull-request types include `milestoned` and `demilestoned`.
- [x] Preview caller permissions include `checks: read`.
- [x] Contract tests fail when either event or permission is absent.
- [x] CI workflow triggers and Maven/npm jobs remain asserted.

**Tests**: static integration additions in `tests/versioning/workflow-contract.mjs`
**Gate**: full, `node tests/versioning/workflow-contract.mjs`
**Commit**: `fix(versioning): revalidate milestone changes in Go caller`

### T17: Reject dismissed or stale approvals

**Status**: Complete

**What**: Derive each reviewer's current effective review state and accept only a current approval after the active label for the current SHA.
**Where**: `scripts/versioning/collect-pr-policy.sh`
**Depends on**: T16
**Reuses**: Paginated review and role collection already implemented
**Requirement**: VER-03, VER-05

**Tools**:

- MCP: Context7 for review-state semantics
- Skill: `tlc-spec-driven`, `cicd`

**Done when**:

- [x] A later dismissed or changes-requested review invalidates an older approval by that reviewer.
- [x] Relabeling requires a new later approval.
- [x] Approval for an older SHA remains invalid.
- [x] Preview and post-merge gates fail closed for invalidated approvals.

**Tests**: integration additions in `tests/versioning/pr-policy.mjs`, `tests/versioning/pr-check.mjs`, and `tests/versioning/post-merge.mjs`
**Gate**: full, `node tests/versioning/run.mjs --local`
**Commit**: `fix(versioning): honor current pull request review state`

### T18: Close verifier evidence and artifact-limit gaps

**Status**: Complete

**What**: Add exact conjunction assertions and enforce an artifact-size failure that preserves the already-written step summary.
**Where**: `tests/versioning/`
**Depends on**: T17
**Reuses**: Existing fixtures and homologation renderer
**Requirement**: VER-02, VER-03, VER-04, VER-05, VER-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`, `entregas`

**Done when**:

- [x] Exact assertions cover no-milestone calculated values, all divergence values and full override audit.
- [x] Markdown and step summary assertions cover SHA, PR, changes, checks and native explanation.
- [x] First publication asserts version/tag and divergent existing release fails.
- [x] Oversized guide fails with a diagnostic while the summary remains present.
- [x] Documentation outcomes and assertion counts are checked without hard-coded drift.
- [x] Full local and real-Go gates pass.

**Tests**: unit, integration and static contract additions across existing `tests/versioning` fixtures; production change only for the artifact-size guard required by the spec
**Gate**: build, `node tests/versioning/run.mjs --local && node tests/versioning/real-go-gitsemver.mjs`
**Commit**: `test(versioning): close release governance coverage gaps`

### T19: Assert adapter rejection diagnostics

**Status**: Complete

**What**: Prove unknown adapters and unsafe project paths fail with their required diagnostics before any adapter execution.
**Where**: `tests/versioning/go-version.mjs`
**Depends on**: T18
**Reuses**: Existing no-execution marker cases
**Requirement**: VER-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `entregas`

**Done when**:

- [x] Unknown adapter stderr identifies the unsupported adapter.
- [x] Unsafe project path stderr identifies checkout confinement.
- [x] Both cases remain nonzero and leave the execution marker absent.

**Tests**: integration assertions in `tests/versioning/go-version.mjs`
**Gate**: quick, `node tests/versioning/go-version.mjs`
**Commit**: `test(versioning): assert adapter rejection diagnostics`

### T20: Preserve blocked-policy evidence

**Status**: Complete

**What**: Assert all four comparison values and unauthorized-attempt identity/role evidence on blocked policy decisions.
**Where**: `tests/versioning/release-policy.mjs`
**Depends on**: T19
**Reuses**: Existing version, bump and unauthorized-role fixtures
**Requirement**: VER-02, VER-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `entregas`

**Done when**:

- [x] Exact-version and bump mismatches each assert planned/calculated version and bump together.
- [x] Unauthorized labeler case asserts identity, current role and exact diagnostic/audit values.
- [x] A mutation removing any required field fails the focused gate.

**Tests**: unit assertions in `tests/versioning/release-policy.mjs`
**Gate**: quick, `node tests/versioning/release-policy.mjs`
**Commit**: `test(versioning): assert blocked release policy evidence`

### T21: Cover pull-request evidence cardinality and endpoints

**Status**: Complete

**What**: Prove zero and multiple associated PRs fail, and independently exercise timeline, review and collaborator-role API failures.
**Where**: `tests/versioning/pr-policy.mjs`
**Depends on**: T20
**Reuses**: Existing deterministic `gh` mock and association fixture
**Requirement**: VER-03, VER-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`, `entregas`

**Done when**:

- [x] Zero and multiple matching merged PRs each fail with cardinality diagnostics.
- [x] Timeline, reviews and permission endpoint failures are injected after earlier requests succeed.
- [x] Every failure returns nonzero and no policy snapshot.
- [x] A mutation accepting zero associations fails the focused gate.

**Tests**: integration assertions in `tests/versioning/pr-policy.mjs`
**Gate**: full, `node tests/versioning/pr-policy.mjs`
**Commit**: `test(versioning): cover pull request evidence failures`

### T22: Assert release tag identity conflicts

**Status**: Complete

**What**: Prove a release with matching target SHA but different tag/version fails without modifying remote state.
**Where**: `tests/versioning/post-merge.mjs`
**Depends on**: T21
**Reuses**: Existing release conflict and write-counter fixture
**Requirement**: VER-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `cicd`, `entregas`

**Done when**:

- [x] Existing release with wrong `tag_name` and matching SHA fails.
- [x] Tag and release state remain byte-for-byte unchanged after rejection.
- [x] A mutation removing release tag-name validation fails the focused gate.
- [x] Full local and real-Go gates pass.

**Tests**: integration assertions in `tests/versioning/post-merge.mjs`
**Gate**: build, `node tests/versioning/run.mjs --local && node tests/versioning/real-go-gitsemver.mjs`
**Commit**: `test(versioning): assert release tag identity conflicts`

---

## Phase Execution Map

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1: T1 → T2 → T3 → T4
Boundary: T4 → T5
Phase 2: T5 → T6 → T7
Boundary: T7 → T8
Phase 3: T8 → T9 → T10
Boundary: T10 → T11
Phase 4: T11 → T12 → T13
Boundary: T13 → T14
Phase 5: T14 → T15 → T16 → T17 → T18
Boundary: T18 → T19
Phase 6: T19 → T20 → T21 → T22
Boundary: T22 → T23
Phase 7: T23 → T24
```

Execution is strictly sequential. Cross-phase dependencies are the final task of the previous phase.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One pure report model | ✅ Granular |
| T2 | One adapter collector | ✅ Granular |
| T3 | One pure policy evaluator | ✅ Granular |
| T4 | One GitHub snapshot collector | ✅ Granular |
| T5 | One artifact renderer | ✅ Granular |
| T6 | One preview orchestrator | ✅ Granular |
| T7 | One reusable preview workflow | ✅ Granular |
| T8 | One post-merge gate | ✅ Granular |
| T9 | One publisher | ✅ Granular |
| T10 | One reusable publish workflow | ✅ Granular |
| T11 | One suite runner plus its CI wiring | ✅ Cohesive integration task |
| T12 | One caller example directory | ✅ Cohesive copyable artifact |
| T13 | One adoption document | ✅ Granular |
| T14 | One tagged-report reconciliation rule | ✅ Granular |
| T15 | One malformed-milestone policy rule | ✅ Granular |
| T16 | One caller event/permission contract | ✅ Granular |
| T17 | One effective-review-state collector rule | ✅ Granular |
| T18 | One verifier evidence closure | ✅ Cohesive verification task |
| T19 | One adapter diagnostic assertion set | ✅ Granular |
| T20 | One policy payload assertion set | ✅ Granular |
| T21 | One GitHub evidence failure matrix | ✅ Granular |
| T22 | One release identity conflict | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start at T1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | Phase 1 → Phase 2; T5 first | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | Phase 2 → Phase 3; T8 first | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | Phase 3 → Phase 4; T11 first | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |
| T19 | T18 | T18 → T19 | ✅ Match |
| T20 | T19 | T19 → T20 | ✅ Match |
| T21 | T20 | T20 → T21 | ✅ Match |
| T22 | T21 | T21 → T22 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Report domain logic | unit | unit | ✅ OK |
| T2 | Adapter integration | integration | integration | ✅ OK |
| T3 | Policy domain logic | unit | unit | ✅ OK |
| T4 | GitHub data integration | integration | integration | ✅ OK |
| T5 | Renderer | unit/integration | unit/integration | ✅ OK |
| T6 | Preview orchestration | integration | integration | ✅ OK |
| T7 | Workflow contract | static integration | static integration | ✅ OK |
| T8 | Release gate integration | integration | integration | ✅ OK |
| T9 | Publisher integration | integration | integration | ✅ OK |
| T10 | Workflow contract | static/integration | static/integration | ✅ OK |
| T11 | Test runner and CI | integration | integration | ✅ OK |
| T12 | Caller contract | static integration | static integration | ✅ OK |
| T13 | Documentation | none | none | ✅ OK |
| T14 | Report and real adapter integration | integration | integration | ✅ OK |
| T15 | Policy domain logic | unit | unit | ✅ OK |
| T16 | Caller contract | static integration | static integration | ✅ OK |
| T17 | GitHub review-state integration | integration | integration | ✅ OK |
| T18 | Cross-cutting verifier gaps | unit/integration/static | unit/integration/static | ✅ OK |
| T19 | Adapter integration | integration | integration | ✅ OK |
| T20 | Policy domain logic | unit | unit | ✅ OK |
| T21 | GitHub data integration | integration | integration | ✅ OK |
| T22 | Publisher integration | integration | integration | ✅ OK |

---

## Requirement-to-Task Traceability

| Requirement | Tasks | Status |
| ----------- | ----- | ------ |
| VER-01 | T1, T2, T6, T9, T14, T19 | Complete |
| VER-02 | T3, T4, T6, T8, T13, T15, T18, T20 | Complete |
| VER-03 | T3, T4, T6, T8, T13, T15, T17, T18, T20, T21 | Complete |
| VER-04 | T5, T6, T7, T13, T16, T18 | Complete |
| VER-05 | T4, T8, T9, T10, T13, T14, T17, T18, T21, T22, T23 | Verified |
| VER-06 | T7, T11, T12, T13, T16, T18, T24 | Verified |

## SHA-only correction (authorized 2026-10-03)

### T23: Separate reviewed PR head from integrated publication SHA

**Status**: Complete - independent verification PASS
**What**: Use an explicit publication phase for merge-SHA calculation identity while keeping override approval anchored to PR head SHA.
**Where**: `scripts/versioning/release-policy.mjs`, `scripts/versioning/release-gates.sh`, `tests/versioning/release-policy.mjs`, `tests/versioning/post-merge.mjs`
**Design note**: `.specs/features/centralized-versioning-pipeline/design.md` documents the explicit phase and separate SHA identities.
**Depends on**: T22
**Requirement**: VER-03.7, VER-05.1, VER-05.3, VER-05.6, VER-05.7
**Done when**:

- [x] Real local non-fast-forward merge has distinct head and merge commits and publishes the integrated SHA.
- [x] A valid override reviewed on PR head succeeds after merge; reviews on merge or stale SHA remain blocked.
- [x] Preview still requires report SHA equal to PR head; publication requires an integrated PR and matching merge SHA.
- [x] Full local and real Go gates pass without weakening existing tests. Independent mutation verification follows this atomic task commit.

**Tests**: unit and integration in the two named test files.
**Gate**: build, `node tests/versioning/run.mjs --local && node tests/versioning/run.mjs --real-go`
**Commit**: `fix(versioning): separate reviewed and integrated commit identities`

**Gate evidence**: all nine local fixtures PASS; 54 policy assertions and 50 workflow-contract assertions; pinned real-Go fixture PASS. Tests added before implementation reproduced the old SHA error. All existing assertions preserved.
**Adequacy**: `tests/versioning/release-policy.mjs:94` asserts merged override succeeds; :96-100 rejects merge/stale reviews; :102-115 reject incorrect calculation SHA, missing integrated metadata and invalid phase. `tests/versioning/post-merge.mjs:34` asserts distinct real commits; publication assertions preserve exact integrated tag/release SHA and ten write-free retries. These map to VER-03.7 and VER-05.1/.3/.6/.7; no unclaimed tests.

### T24: Pin Go example to the SHA correction

**Status**: Complete
**What**: Make the copyable caller consume the production revision containing the SHA fix.
**Where**: `examples/callers/go/.github/workflows/go-publish.yml`
**Depends on**: T23
**Requirement**: VER-06.5
**Done when**:

- [x] Both caller references use `be8fff51d92c10bb00fa8188184117130621a2bb`.
- [x] Existing workflow-contract gate passes (50 assertions).

**Tests**: static integration, `tests/versioning/workflow-contract.mjs`
**Gate**: quick, `node tests/versioning/workflow-contract.mjs`
**Commit**: `fix(versioning): pin go example to commit identity fix`

## Previous caller correction and escalation

- Completed atomic follow-up: pin both Go caller jobs to `009e72b56ebc61caacd0441ea695a082aca2cfaf`, which contains the implemented corrections; document milestone events in the preview contract comment.
- Files: `examples/callers/go/.github/workflows/go-publish.yml`, `.github/workflows/version-preview.yml`.
- Requirement: VER-06.5. Gate: `node tests/versioning/workflow-contract.mjs` (50 assertions PASS); independent round 3 audited referenced production contents.
- Pending proposed correction (not implemented): distinguish PR `headSha`, which anchors approval, from integrated `mergeCommitSha`, which anchors calculation, tag and release. Add realistic merge fixtures with different SHAs and preserve stale-review rejection.
- Round 3: 37/41 acceptance criteria verified, seven listed edges covered, six mutants killed; publication remains blocked. A fourth correction cycle requires escalation under TLC. No push performed.

**Resolved on 2026-10-03**: the user authorized the SHA-only follow-up. T23/T24 close this historical blocker. Fresh independent verification confirms 41/41 ACs, 7/7 edges, 9/9 local fixtures, real pinned Go and 5/5 killed mutants. No hosted execution, pilot adoption or push was performed; these are not claimed by local MVP validation.
