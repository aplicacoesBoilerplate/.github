# Pipeline Centralizada de Versionamento Validation

## Validation: FAIL ❌

**Verdict**: FAIL ❌
**Date**: 2026-10-01
**Spec**: `.specs/features/centralized-versioning-pipeline/spec.md`
**Diff range**: `59663cd..39ddb38` (`59663cd..HEAD`)
**Verifier**: independent TLC Verifier, round 2 (author ≠ verifier)

The implementation passes every requested execution gate, and the fixes for tagged Go commits, malformed milestones, caller events/permissions, dismissed approvals, and oversized artifacts are observable. The feature is still not ready under evidence-or-zero: three high-risk mutants survive, and three additional acceptance outcomes lack exact assertion-level evidence.

---

## Task Completion

| Task | Declared | Verifier status | Notes |
| ---- | -------- | --------------- | ----- |
| T1 | Complete | ✅ Verified | Normalization, reachable tags, bootstrap, and invalid report inputs have exact assertions. |
| T2 | Complete | ⚠️ Partial | Safe adapter/path rejection is asserted, but its required diagnostic is not. |
| T3 | Complete | ⚠️ Partial | Core milestone/override decisions pass; blocked divergence payload and unauthorized-attempt audit are not fully asserted. |
| T4 | Complete | ⚠️ Partial | Current review-state fixes pass; zero matching merged PRs and endpoint-specific evidence failures lack discriminating tests. |
| T5 | Complete | ✅ Verified | Markdown/JSON values, escaping, facts/suggestions, and clean tree are asserted. |
| T6 | Complete | ✅ Verified | Develop/master preview paths, summary, no-write behavior, and artifact limit are asserted. |
| T7 | Complete | ✅ Verified | Read-only reusable preview contract and artifact upload are asserted. |
| T8 | Complete | ⚠️ Partial | Revalidation rejects tested provenance/policy failures, but zero-PR association survives the sensor. |
| T9 | Complete | ⚠️ Partial | Idempotency and SHA conflicts pass; release tag/version mismatch is not discriminated. |
| T10 | Complete | ✅ Verified | Optional environment, serialization, and permissions are asserted. |
| T11 | Complete | ✅ Verified | Local and pinned real-Go runners are wired and pass. |
| T12 | Complete | ✅ Verified | Caller events, permissions, CI dependency, and immutable workflow refs are asserted. |
| T13 | Complete | ✅ Verified | Required checks and direct-push protection documentation are asserted. |
| T14 | Complete | ✅ Verified | Empty native SHA is accepted only through exact tag-to-SHA reconciliation; real rerun reaches `already-published`. |
| T15 | Complete | ✅ Verified | Malformed milestones remain blocked with a complete valid override. |
| T16 | Complete | ✅ Verified | `milestoned`, `demilestoned`, and `checks: read` are asserted. |
| T17 | Complete | ✅ Verified | Dismissed, changes-requested, relabeled, and stale approvals are invalidated. |
| T18 | Complete | ❌ Incomplete evidence | Several prior gaps closed, but three surviving mutants remain. |

---

## Spec-Anchored Acceptance Criteria

Every row cites an executable assertion. A criterion is PASS only when the cited assertion observes the complete spec outcome.

| AC | Spec-defined outcome | Exact `file:line` assertion evidence | Result |
| -- | -------------------- | ------------------------------------ | ------ |
| VER-01.1 | Run pinned `go-gitsemver` for the evaluated SHA and consume native JSON. | `tests/versioning/workflow-contract.mjs:31-33` asserts pinned setup/tool revision; `tests/versioning/go-version.mjs:76-81` asserts collector success, candidate, SHA, native SemVer, and explanation. | ✅ PASS |
| VER-01.2 | Normalize candidate, SHA, bump, and explanation without a competing release algorithm. | `tests/versioning/version-report.mjs:39-45` asserts schema, adapter, base, candidate, tag, bump, and native explanation values. | ✅ PASS |
| VER-01.3 | Unstable SemVer, wrong SHA, invalid JSON, or adapter execution error fails before publication. | `tests/versioning/version-report.mjs:75-84` asserts malformed JSON, unstable SemVer, wrong SHA, and schema rejection; `tests/versioning/real-go-gitsemver.mjs:141-144` asserts real adapter failure. | ✅ PASS |
| VER-01.4 | With no stable tag, only `v0.0.1` is publishable and `v0.0.0` is internal base only. | `tests/versioning/version-report.mjs:67-72` asserts base `0.0.0` and rejects candidate `0.1.0`; `tests/versioning/real-go-gitsemver.mjs:49` asserts `0.0.1`. | ✅ PASS |
| VER-01.5 | Unknown adapter or unsafe project path fails with a diagnostic before executing PR-controlled commands. | `tests/versioning/go-version.mjs:85-90` asserts nonzero status and absent execution marker, but no assertion checks either required diagnostic. | ❌ EVIDENCE GAP |
| VER-02.1 | No milestone accepts the adapter values without extra version review. | `tests/versioning/release-policy.mjs:24-29` asserts `adapter-authoritative`, null planned values, calculated version `2.0.0`, and bump `major`. | ✅ PASS |
| VER-02.2 | A strict milestone is compared to the exact candidate version. | `tests/versioning/release-policy.mjs:30-33` asserts the matched planned version; `tests/versioning/release-policy.mjs:41-42` asserts exact-version divergence is blocked and diagnosed. | ✅ PASS |
| VER-02.3 | Milestone bump from stable base is compared with adapter bump. | `tests/versioning/release-policy.mjs:32-33,43-48` asserts planned `major` and blocks/diagnoses planned `minor` versus calculated `patch`. | ✅ PASS |
| VER-02.4 | Non-strict milestone always blocks and reports received title plus expected format. | `tests/versioning/release-policy.mjs:35-40` asserts blocked both without and with a valid override, including `release-2` and `vMAJOR.MINOR.PATCH`. | ✅ PASS |
| VER-02.5 | A non-overridden divergence blocks and records planned/calculated version and bump together. | `tests/versioning/release-policy.mjs:41-48` asserts blocking and separate reason strings; the four field assertions at `:52-55` apply only to an `overridden` decision. M6 erased all four fields from blocked decisions and the test still passed. | ❌ SURVIVING MUTANT |
| VER-02.6 | Added, removed, or replaced milestone reruns policy against current PR metadata. | `tests/versioning/workflow-contract.mjs:73-76` asserts `milestoned`, `demilestoned`, `submitted`, and `dismissed` caller events. | ✅ PASS |
| VER-03.1 | Divergence without `versioning:override` remains blocked. | `tests/versioning/release-policy.mjs:20,61` asserts `blocked` when `labelPresent` is false. | ✅ PASS |
| VER-03.2 | Timeline identifies the actor for the currently active label event. | `tests/versioning/pr-policy.mjs:51-62` asserts active label, `alice`, current role, and paginated timeline/review calls after an older label/unlabel pair. | ✅ PASS |
| VER-03.3 | Labeler below Maintain blocks and records the unauthorized attempt. | `tests/versioning/release-policy.mjs:20,62` asserts only `blocked`; no assertion observes the attempted actor, role, audit payload, or unauthorized diagnostic. | ❌ EVIDENCE GAP |
| VER-03.4 | Missing later, distinct, authorized approval remains blocked. | `tests/versioning/release-policy.mjs:63-69` asserts blocking for insufficient role, same actor, early/invalid timestamp, stale SHA, and missing label time. | ✅ PASS |
| VER-03.5 | Two valid maintainers accept divergence and record identities, timestamps, and four compared values. | `tests/versioning/release-policy.mjs:50-59` asserts `overridden`, all four values, both actors, and both timestamps. | ✅ PASS |
| VER-03.6 | One person cannot both label and approve. | `tests/versioning/release-policy.mjs:20,64` asserts `blocked` for identical labeler/approver. | ✅ PASS |
| VER-03.7 | Commit, milestone, label, or review changes invalidate and recalculate authorization. | `tests/versioning/release-policy.mjs:61,68`; `tests/versioning/pr-policy.mjs:64-71`; and `tests/versioning/workflow-contract.mjs:73-76` assert label removal, stale SHA, dismissed/changed/relabelled review, and rerun events. | ✅ PASS |
| VER-03.8 | Failure to confirm timeline, current role, or reviews fails closed. | `tests/versioning/pr-policy.mjs:79-80` asserts generic `api-error`/`incomplete` failure, but its mock fails the first PR request at `:22`; no assertion reaches distinct timeline, role, or review API failure paths. | ❌ EVIDENCE GAP |
| VER-04.1 | Develop PR evaluates the PR SHA read-only. | `tests/versioning/pr-check.mjs:63-69,80-81` asserts phase/version/bump/artifacts and unchanged HEAD/tags. | ✅ PASS |
| VER-04.2 | Native adapter report is the guide's versioning source. | `tests/versioning/homologation-guide.mjs:37,51` and `tests/versioning/pr-check.mjs:68` assert native explanation in JSON, Markdown, and preview. | ✅ PASS |
| VER-04.3 | Markdown and JSON contain version, explanation, SHA, PR, changes, CI, and checklist. | `tests/versioning/homologation-guide.mjs:31-53` asserts every specified JSON and Markdown value. | ✅ PASS |
| VER-04.4 | Human summary and both artifacts are published without consumer commit. | `tests/versioning/pr-check.mjs:70-81` asserts summary fields and unchanged HEAD/tags; `tests/versioning/workflow-contract.mjs:34-38` asserts mandatory upload of both files. | ✅ PASS |
| VER-04.5 | Missing native report fails instead of inventing an explanation. | `tests/versioning/homologation-guide.mjs:56-59` asserts nonzero exit for a missing report. | ✅ PASS |
| VER-04.6 | Collected facts and suggested checks stay distinct. | `tests/versioning/homologation-guide.mjs:38-42` asserts exact arrays, pending status, and absence of suggestions from `facts`. | ✅ PASS |
| VER-05.1 | Successful consumer CI after merged `master` push can invoke publication for integrated SHA. | `tests/versioning/workflow-contract.mjs:77-81` asserts master-push trigger and `needs: go-ci`; `tests/versioning/post-merge.mjs:91-95` asserts accepted integrated gates. | ✅ PASS |
| VER-05.2 | Any non-master/non-push/non-unique merged `develop → master` provenance is refused. | `tests/versioning/post-merge.mjs:96-106` asserts wrong event/ref/SHA/remote/head and two-PR ambiguity. M4 accepted zero matching PRs; `tests/versioning/pr-policy.mjs` still passed because it has no zero-association assertion. | ❌ SURVIVING MUTANT |
| VER-05.3 | Publication recalculates once and revalidates current policy before writing. | `tests/versioning/post-merge.mjs:96-106,134-135` asserts tested policy/provenance failures before writes and exactly one adapter call for a publication. | ✅ PASS |
| VER-05.4 | Non-empty environment gates the write job. | `tests/versioning/workflow-contract.mjs:44-51` asserts optional input, named conditional gate, and publish dependency. | ✅ PASS |
| VER-05.5 | Empty environment skips only that gate and proceeds after CI/checks. | `tests/versioning/workflow-contract.mjs:44-51,80-81` asserts empty default, `skipped` acceptance, and consumer CI dependency. | ✅ PASS |
| VER-05.6 | Successful gates create immutable tag/release at integrated SHA from normalized notes. | `tests/versioning/post-merge.mjs:126-135` asserts published outcome, version, tag, both SHAs, native notes, and one calculation. | ✅ PASS |
| VER-05.7 | Matching version/SHA returns `already-published` without duplicate effects. | `tests/versioning/post-merge.mjs:137-142` asserts ten idempotent reruns and unchanged writes; `tests/versioning/real-go-gitsemver.mjs:91-92` asserts real tagged rerun reconciliation. | ✅ PASS |
| VER-05.8 | Existing tag/release with different version or SHA fails without move/overwrite/partial effect. | `tests/versioning/post-merge.mjs:150-160` asserts tag-SHA, missing-tag, and release-target-SHA conflicts. M5 removed both `tag_name` checks from `publish.sh`; the full post-merge test still passed, so different release version/tag is unproved. | ❌ SURVIVING MUTANT |
| VER-05.9 | Concurrent publication serializes per repository/branch without cancellation. | `tests/versioning/workflow-contract.mjs:52-53` asserts concurrency group and `cancel-in-progress: false`. | ✅ PASS |
| VER-05.10 | Repository write permission is limited to `contents: write` on publisher. | `tests/versioning/workflow-contract.mjs:54-57` asserts the publish permission block and no dynamic environment on the write job. | ✅ PASS |
| VER-06.1 | Central PR/push CI runs versioning alongside preserved Maven/npm validation. | `tests/versioning/workflow-contract.mjs:58-71` asserts monitored triggers, local/real runners, Maven verify, and npm install/test. | ✅ PASS |
| VER-06.2 | Suite covers positive and negative milestone, override, guide, idempotency, and publication paths. | `tests/versioning/release-policy.mjs:24-69`, `tests/versioning/pr-check.mjs:63-97`, and `tests/versioning/post-merge.mjs:91-169` assert the required scenario families. | ✅ PASS |
| VER-06.3 | Real Go installs pinned revision and proves bootstrap, patch, minor, major, and combined sprint. | `tests/versioning/workflow-contract.mjs:61-65` asserts revision/install; `tests/versioning/real-go-gitsemver.mjs:49,126,130,134,139-140` asserts exact versions. | ✅ PASS |
| VER-06.4 | Any versioning child failure fails the required CI check. | `tests/versioning/runner-self-test.mjs:16-19` asserts status `7` propagation and fixture identity; `tests/versioning/workflow-contract.mjs:64-65` asserts direct runner invocation. | ✅ PASS |
| VER-06.5 | Copyable Go caller passes configuration only, with immutable central refs. | `tests/versioning/workflow-contract.mjs:73-86` asserts events, permissions, CI dependency, two consistent SHA refs, and absence of legacy/bypass inputs. | ✅ PASS |
| VER-06.6 | Documentation identifies required checks and direct-push protection for `develop`/`master`. | `tests/versioning/workflow-contract.mjs:87-91` asserts milestone/check permission guidance, force-push/deletion/direct-update protection, and required preview check. | ✅ PASS |

**Acceptance-criterion status**: 35/41 match the full spec outcome; 3 evidence gaps and 3 surviving-mutant gaps remain. The spec itself has 0 precision gaps.

---

## Edge Cases

| Edge case | Exact evidence | Result |
| --------- | -------------- | ------ |
| Highest stable reachable SemVer tag is selected. | `tests/versioning/version-report.mjs:22-32` sets `v0.1.0`, reachable `v0.2.0`, and asserts result `0.2.0`. | ✅ PASS |
| Highest global tag outside evaluated history is ignored. | `tests/versioning/version-report.mjs:27-32` creates unreachable `v9.0.0` and still asserts `0.2.0`. | ✅ PASS |
| Missing or ambiguous PR association blocks publication. | `tests/versioning/pr-policy.mjs:77-78` asserts only two-PR ambiguity. M4 accepted zero matches and survived. | ❌ SURVIVING MUTANT |
| Removed override label invalidates the exception. | `tests/versioning/release-policy.mjs:20,61` asserts no active label remains blocked. | ✅ PASS |
| Downgraded current role blocks authorization. | `tests/versioning/release-policy.mjs:20,62-63` asserts `triage` labeler and `write` approver remain blocked. | ✅ PASS |
| Lost response after release creation reconciles on rerun. | `tests/versioning/post-merge.mjs:166-169` asserts simulated release race returns `already-published`. | ✅ PASS |
| Oversized homologation artifact fails with diagnostic while summary remains. | `tests/versioning/pr-check.mjs:87-93` asserts nonzero status, byte-limit diagnostic, and retained summary text. | ✅ PASS |

**Edge-case status**: 6/7 covered.

---

## Gate Check

- **Build command**: `node tests/versioning/run.mjs --local && python -c "import glob,yaml; [yaml.safe_load(open(p,encoding='utf-8')) for p in glob.glob('.github/workflows/*.yml')]"`
- **Build outcome**: PASS; 9 deterministic fixtures passed, 0 failed, 0 skipped.
- **All-YAML command**: recursive PyYAML load of every `*.yml` and `*.yaml` under the repository.
- **All-YAML outcome**: PASS; 18 files parsed.
- **Pinned real-Go command**: `node tests/versioning/real-go-gitsemver.mjs`
- **Pinned real-Go outcome**: PASS; bootstrap, tagged empty-SHA reconciliation, collector-to-publication `already-published`, patch, minor, major, combined sprint, and invalid configuration executed.
- **Test files before feature**: 6 at `59663cd`.
- **Test files after feature**: 13 at `39ddb38` (`+7`).
- **Diff hygiene**: `git diff --check 59663cd..HEAD` PASS.
- **Skipped tests**: none.

---

## Discrimination Sensor

Sensor ran in disposable detached worktrees at `39ddb38`; no stash was used. The real-tree porcelain baseline was empty before the sensor and remained byte-for-byte empty after scratch removal. Scratch directories and worktree registrations were removed.

| Mutation | Production fault | Relevant gate | Result |
| -------- | ---------------- | ------------- | ------ |
| M1 tagged Go reconciliation | `scripts/versioning/version-report.mjs:68` bypassed the empty-native-SHA/tag reconciliation branch. | `node tests/versioning/version-report.mjs` | ✅ KILLED at tagged-report assertions `tests/versioning/version-report.mjs:47-59`. |
| M2 malformed milestone | `scripts/versioning/release-policy.mjs:63-65` allowed a valid override to authorize invalid milestone syntax. | `node tests/versioning/release-policy.mjs` | ✅ KILLED at `tests/versioning/release-policy.mjs:20,37-40`. |
| M3 dismissed approval | `scripts/versioning/collect-pr-policy.sh:84-90` retained historical approvals instead of each reviewer's latest state. | `node tests/versioning/pr-policy.mjs` | ✅ KILLED at `tests/versioning/pr-policy.mjs:68-71`. |
| M4 zero PR association | `scripts/versioning/collect-pr-policy.sh:25-28` accepted zero matching merged PRs while still rejecting multiple matches. | `node tests/versioning/pr-policy.mjs` | ❌ SURVIVED; no zero-association fixture exists. |
| M5 release version conflict | `scripts/versioning/publish.sh:87-88,105-106` ignored `release.tag_name` and compared only target SHA. | `node tests/versioning/post-merge.mjs` | ❌ SURVIVED; only target-SHA divergence is asserted. |
| M6 blocked divergence payload | `scripts/versioning/release-policy.mjs:82-87` erased planned/calculated version and bump when divergence remained blocked. | `node tests/versioning/release-policy.mjs` | ❌ SURVIVED; four-value assertions cover only the overridden decision. |

**Sensor depth**: expanded lightweight, 6 high-risk behavior mutations.
**Sensor outcome**: 3/6 killed, 3/6 survived — FAIL ❌.

---

## Code Quality

| Principle | Status | Evidence |
| --------- | ------ | -------- |
| Minimum code / no unnecessary abstraction | ✅ | Changed production modules remain small and responsibility-focused. |
| Surgical scope | ✅ | `59663cd..HEAD` is limited to central versioning, its workflows/caller/docs/tests, and TLC artifacts. |
| Matches project patterns | ✅ | Bash orchestration, pure Node evaluators, pinned Actions, and fixture style match repository conventions. |
| Spec-anchored outcome check | ❌ | 6/41 ACs lack full exact evidence. |
| Per-layer coverage expectation | ❌ | Three high-risk faults survive targeted suites. |
| Payload/conjunction rule | ❌ | Blocked divergence can lose its four-value payload without failure. |
| Every changed test is claimed by spec/edge/done-when | ✅ | No unrelated test scope found. |
| Documented guidelines | ✅ | `AGENTS.md` and TLC validation instructions were followed; real repository gates ran. |

---

## Ranked Gaps

1. **Add a zero-associated-PR fixture** (Blocker): M4 survived. Assert both zero and multiple matching merged `develop → master` PRs fail before adapter execution or writes. Covers VER-05.2 and edge case 3.
2. **Assert release tag/version conflicts independently of SHA** (Blocker): M5 survived. Add an existing release whose `tag_name` differs while `target_commitish` matches; assert failure and no mutation. Covers VER-05.8.
3. **Assert all four comparison fields on the blocked decision** (Major): M6 survived. For both exact-version and bump mismatch without override, assert `plannedVersion`, `calculatedVersion`, `plannedBump`, and `calculatedBump` together. Covers VER-02.5.
4. **Assert unauthorized-attempt audit evidence** (Major): assert the blocked decision records attempted labeler/current role or an exact identity-bearing diagnostic. Covers VER-03.3.
5. **Exercise each GitHub evidence failure point** (Major): independently fail timeline, collaborator-role, and reviews requests after the PR request succeeds. Covers VER-03.8.
6. **Assert adapter/path diagnostics** (Minor): match the unknown-adapter and unsafe-path stderr in addition to nonzero status and absent execution marker. Covers VER-01.5.

---

## Requirement Traceability

| Requirement | Declared | Verifier status |
| ----------- | -------- | --------------- |
| VER-01 | Complete | ❌ Needs exact diagnostic evidence |
| VER-02 | Complete | ❌ Surviving blocked-payload mutant |
| VER-03 | Complete | ❌ Unauthorized/API evidence gaps |
| VER-04 | Complete | ✅ Verified |
| VER-05 | Complete | ❌ Two surviving provenance/release mutants |
| VER-06 | Complete | ✅ Verified |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 35/41 ACs matched; 3 evidence gaps and 3 surviving-mutant gaps; 0 spec-precision gaps.
**Edge cases**: 6/7 covered.
**Sensor**: 3/6 killed, 3/6 survived.
**Gate**: 9/9 local fixtures PASS; 18/18 YAML files parse; pinned real-Go fixture PASS.

The repaired T14-T18 behaviors named in this round are working and their three targeted mutants were killed. Delivery remains blocked because the suite does not discriminate zero-PR provenance, release version/tag mismatch, or loss of the four-field blocked-divergence payload, and three explicit diagnostic/audit outcomes still lack exact assertions.
