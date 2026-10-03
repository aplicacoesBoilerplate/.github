# Pipeline Centralizada de Versionamento Validation

## Validation: FAIL

**Verdict**: FAIL
**Date**: 2026-10-03
**Spec**: `.specs/features/centralized-versioning-pipeline/spec.md`
**Diff range**: `59663cd..009e72b56ebc61caacd0441ea695a082aca2cfaf`, plus audited caller-ref and preview-comment overlay.
**Verifier**: fresh independent TLC Verifier, round 3 (author != verifier).

The prior six gaps are closed and all six repeated mutants are killed. A separate realistic merge fixture exposes a publication blocker: PR head SHA and integrated merge SHA are treated as the same commit. Normal merged PRs therefore fail before publication. The existing passing publication fixtures assign identical values to both fields and conceal the problem.

## Task completion

T1-T22 are declared Complete. T19 adapter diagnostics, T20 blocked payload/audit, T21 zero association and endpoint failures, and T22 release tag identity have exact discriminating evidence below. T8/T9 remain incomplete at the feature level because a real merged PR with distinct head and merge commits cannot pass. The earlier Complete labels and traceability are implementation declarations, not independent verification.

## Spec-anchored acceptance criteria

Each citation names an executable assertion and its expected value. PASS rows concern the stated behavior; the four affected publication rows remain GAP even though the equal-SHA fixture passes.

| AC | Spec-defined outcome | Exact evidence and assertion | Result |
| --- | --- | --- | --- |
| VER-01.1 | Pinned native Go evaluates the requested SHA and emits JSON. | `tests/versioning/workflow-contract.mjs:32` matches install revision `680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6`; `tests/versioning/go-version.mjs:79` asserts `normalized.sha === commit`; the mock at :22 rejects missing JSON/explain/SHA flags. | PASS |
| VER-01.2 | Normalize native candidate, SHA, bump and explanation without recomputing candidate. | `tests/versioning/version-report.mjs:39` asserts schema 1; :42 candidate `0.2.1`, :43 tag `v0.2.1`, :44 bump `patch`, :45 native explanation; `tests/versioning/go-version.mjs:79` asserts SHA identity. | PASS |
| VER-01.3 | Bad SemVer/SHA/JSON or adapter execution fails before writes. | `tests/versioning/version-report.mjs:75` throws /JSON nativo inválido/; :77 /SemVer estável inválido/; :80 /SHA calculado diverge/; `tests/versioning/go-version.mjs:56` rejects prerelease; `tests/versioning/real-go-gitsemver.mjs:144` asserts invalid native configuration throws. | PASS |
| VER-01.4 | Bootstrap publishes only v0.0.1 with internal base v0.0.0. | `tests/versioning/version-report.mjs:67` asserts base `0.0.0`; :70 rejects native `0.1.0`; `tests/versioning/real-go-gitsemver.mjs:49` asserts bootstrap `0.0.1`. | PASS |
| VER-01.5 | Unknown adapter/path escapes fail with diagnostics before execution. | `tests/versioning/go-version.mjs:86` nonzero; :87 exact `Adapter não suportado: shell-from-pr`; :88 marker absent; :90 nonzero; :91 exact `project_path deve ser relativo e não pode conter ..`; :92 marker absent. | PASS |
| VER-02.1 | No milestone accepts adapter values without extra approval. | `tests/versioning/release-policy.mjs:24` via :20 asserts `adapter-authoritative`; :26-29 assert null planned fields, calculated `2.0.0` and `major`. | PASS |
| VER-02.2 | Strict milestone compares exact candidate. | `tests/versioning/release-policy.mjs:30` asserts matched; :32 planned `2.0.0`; :41 blocked exact mismatch; :43-44 assert planned `3.0.0` versus calculated `2.0.0`. | PASS |
| VER-02.3 | Compare planned and native increment. | `tests/versioning/release-policy.mjs:33` planned `major`; :52 blocked; :55-56 planned `minor` versus calculated `patch`. | PASS |
| VER-02.4 | Invalid milestone blocks with title and expected syntax. | `tests/versioning/release-policy.mjs:35` and :37 assert blocked, including valid override; :39 received `release-2`; :40 expected `vMAJOR.MINOR.PATCH`. | PASS |
| VER-02.5 | Blocked divergence records all four comparison values. | `tests/versioning/release-policy.mjs:43` through :46 assert `3.0.0/2.0.0/major/major`; :53 through :56 assert `1.3.0/1.3.0/minor/patch`; :20 and :52 assert blocked. M6 kills loss of this payload. | PASS |
| VER-02.6 | Milestone changes rerun current policy. | `tests/versioning/workflow-contract.mjs:73` through callerMatches(:17) asserts milestone events; `tests/versioning/pr-policy.mjs:56` asserts current API milestone `v2.0.0`. | PASS |
| VER-03.1 | No override label leaves divergence blocked. | `tests/versioning/release-policy.mjs:70` uses :20 to assert blocked with `labelPresent:false`. | PASS |
| VER-03.2 | Timeline identifies current label actor. | `tests/versioning/pr-policy.mjs:57` true active label; :58 `alice`; :59 `maintain`; :64 asserts paginated timeline after old label/unlabel events. | PASS |
| VER-03.3 | Unauthorized labeler blocks and is audited. | `tests/versioning/release-policy.mjs:71` uses :20 for blocked; :74 actor `maintainer-one`; :75 role `triage`; :76 exact reasons include identity/current role. | PASS |
| VER-03.4 | Missing later distinct authorized approval blocks. | `tests/versioning/release-policy.mjs:80` through :86 use :20 to assert blocked for write role, same actor, earlier/invalid timestamp, old commit, absent label time. | PASS |
| VER-03.5 | Two authorized distinct actors allow audited divergence. | `tests/versioning/release-policy.mjs:59` uses :20 for overridden; :61-64 assert four values; :65-68 actors and exact timestamps. | PASS |
| VER-03.6 | Same actor cannot label and approve. | `tests/versioning/release-policy.mjs:81` uses :20 for blocked with approvalBy `maintainer-one`. | PASS |
| VER-03.7 | Relevant commit/label/review/milestone changes invalidate and reevaluate. | `tests/versioning/release-policy.mjs:70`, :85 block removed label/stale SHA; `tests/versioning/pr-policy.mjs:71` and :73 assert null approver/review SHA for dismissed, changes-requested, relabel, stale; `tests/versioning/workflow-contract.mjs:73` and :75 assert milestone/review event types. | PASS |
| VER-03.8 | Timeline/review/current-role API failures fail closed. | `tests/versioning/pr-policy.mjs:85` asserts nonzero, :86 diagnostic, :87 absent snapshot, :89 prior endpoint calls; :95-100 invoke separately timeline, reviews, role failures after earlier evidence succeeds. | PASS |
| VER-04.1 | Develop PR calculates PR SHA read-only. | `tests/versioning/pr-check.mjs:64` success; :65 phase; :66 candidate; :80-81 unchanged HEAD/tags; `tests/versioning/go-version.mjs:79` exact evaluated SHA and :82 unchanged consumer porcelain. | PASS |
| VER-04.2 | Native report is source of versioning guide. | `tests/versioning/pr-check.mjs:68` native preview explanation preserved; `tests/versioning/homologation-guide.mjs:37` JSON native text and :51 escaped Markdown explanation. | PASS |
| VER-04.3 | Both formats contain version/explanation/SHA/PR/changes/CI/checklist. | `tests/versioning/homologation-guide.mjs:32` through :42 assert exact JSON fields/arrays and pending status; :44 through :53 assert corresponding Markdown values. | PASS |
| VER-04.4 | Summary and both artifacts appear without commits. | `tests/versioning/pr-check.mjs:72` asserts all required summary strings; :80-81 unchanged HEAD/tags; `tests/versioning/workflow-contract.mjs:36`, :37, :38 assert upload action, both files, missing-file failure. | PASS |
| VER-04.5 | Missing native report fails. | `tests/versioning/homologation-guide.mjs:59` asserts nonzero for missing report file; `tests/versioning/pr-check.mjs:95` asserts failed calculation blocks preview. | PASS |
| VER-04.6 | Facts differ from suggested pending checks. | `tests/versioning/homologation-guide.mjs:38` and :39 exact changes/checks; :40 exact pending suggestions; :42 suggestions absent from facts. | PASS |
| VER-05.1 | Successful CI after integrated master push can publish integrated SHA. | `tests/versioning/workflow-contract.mjs:77` and :80 assert master push and needs go-ci. The equal-SHA success at `tests/versioning/post-merge.mjs:92` fails with status 1 when PR head differs from merge commit; F1 below. | GAP |
| VER-05.2 | Invalid event/ref/nonunique merged develop PR provenance is refused. | `tests/versioning/post-merge.mjs:105` nonzero for all invalid provenance modes and :106 no writes; `tests/versioning/pr-policy.mjs:91` and :93 invoke zero/two PR checks via :85 nonzero/:86 exact cardinality diagnostic/:87 absent snapshot. M4 killed. | PASS |
| VER-05.3 | Recalculate integrated SHA and revalidate integrated PR before writes. | `tests/versioning/post-merge.mjs:134` asserts one calculation and :106 no writes on failed policy. Realistic distinct head/merge case never reaches a valid integrated policy because `scripts/versioning/release-policy.mjs:47` rejects it. | GAP |
| VER-05.4 | Named environment gates write job. | `tests/versioning/workflow-contract.mjs:48` asserts named conditional gate; :50 asserts needs and successful gate requirement through publishMatches(:14). | PASS |
| VER-05.5 | Empty environment proceeds after CI/checks. | `tests/versioning/workflow-contract.mjs:44` asserts empty default; :50 accepts skipped environment; :80 asserts consumer CI dependency. This workflow condition passes; publication defect tracked separately. | PASS |
| VER-05.6 | Gates create immutable tag/release on integrated SHA using native notes. | `tests/versioning/post-merge.mjs:128` through :133 assert published/version/tag/SHAs/native notes only with head==merge. F1 makes a normal distinct-head merge fail before any tag/release. | GAP |
| VER-05.7 | Same version/SHA rerun returns already-published without writes. | `tests/versioning/post-merge.mjs:139`, :140, :142 assert ten successful identical-SHA retries and unchanged writes; `tests/versioning/real-go-gitsemver.mjs:91` asserts tagged rerun. Both mocks equate PR head and merge SHA, so normal merge retries fail under F1. | GAP |
| VER-05.8 | Tag/release version/SHA conflicts fail without overwrite. | `tests/versioning/post-merge.mjs:151`, :155, :159 reject existing conflicts; :166 wrong release tag with same SHA is nonzero; :168 and :170 assert unchanged byte-for-byte remote state/writes. M5 killed. | PASS |
| VER-05.9 | Serialize repository/branch publications without cancellation. | `tests/versioning/workflow-contract.mjs:52` matches concurrency group and cancel-in-progress false. | PASS |
| VER-05.10 | Only publisher gets contents write. | `tests/versioning/workflow-contract.mjs:54` matches publisher permissions; :29 excludes preview write permissions; production workflow has contents read on environment gate. | PASS |
| VER-06.1 | Central monitored PR/push CI preserves Maven/npm and runs versioning. | `tests/versioning/workflow-contract.mjs:64`, :65 local/real invocation; :66 monitored branches; :68 Maven verify; :70 npm install/test. | PASS |
| VER-06.2 | Positive/negative milestone, override, guide, retry and publication scenarios run. | `tests/versioning/release-policy.mjs:20`, `tests/versioning/pr-check.mjs:64`, :84, `tests/versioning/post-merge.mjs:126`, :139, :166 assert scenario families. Missing realistic merge scenario is F1. | PASS |
| VER-06.3 | Pinned real Go proves bootstrap/patch/minor/major/combined sprint. | `tests/versioning/workflow-contract.mjs:62` matches install pin; `tests/versioning/real-go-gitsemver.mjs:49`, :126, :130, :134, :139 assert `0.0.1/0.0.2/0.1.0/2.0.0/2.1.0`. Installed binary build metadata confirms revision suffix `680c1c12d9a4`. | PASS |
| VER-06.4 | Child versioning failure fails CI. | `tests/versioning/runner-self-test.mjs:18` exact status 7; :19 exact broken fixture diagnostic; `tests/versioning/workflow-contract.mjs:64` direct runner invocation without failure suppression. | PASS |
| VER-06.5 | Copyable caller delegates configuration using actual current central implementation. | `tests/versioning/workflow-contract.mjs:83` exactly two immutable refs; :84 one revision; :85 excludes bypass inputs. Independent parity assertion confirms both overlay refs equal `009e72b56ebc61caacd0441ea695a082aca2cfaf`, all 18 production script/publisher files match that revision, and preview differs only by its event comment. | PASS |
| VER-06.6 | Docs specify required checks and direct-push protections on develop/master. | `tests/versioning/workflow-contract.mjs:89` asserts force-push/deletion/direct-update protections; :91 required preview check; `docs/versioning.md:121` targets both branches. | PASS |

**Outcome**: 37/41 ACs matched; 4 affected publication ACs blocked by one confirmed defect; 0 spec-precision gaps.

## Edge cases

| Edge | Exact assertion evidence | Result |
| --- | --- | --- |
| Highest stable reachable SemVer | `tests/versioning/version-report.mjs:31`: selectReachableStableTag(...) equals `0.2.0` with two reachable tags. | PASS |
| Unreachable larger global tag | `tests/versioning/version-report.mjs:29` creates unrelated `v9.0.0`; :31 still equals `0.2.0`. | PASS |
| Missing/ambiguous associated PR | `tests/versioning/pr-policy.mjs:91`, :93 invoke zero/two via :85 nonzero/:86 diagnostics/:87 absent snapshot. | PASS |
| Removed label invalidates | `tests/versioning/release-policy.mjs:70` asserts blocked via :20. | PASS |
| Downgraded current actor role | `tests/versioning/release-policy.mjs:71` and :80 assert blocked for triage labeler/write approver; :75 exact role audit. | PASS |
| Lost release API response reconciles | `tests/versioning/post-merge.mjs:179` success and :180 already-published after mock stores release then returns API failure. | PASS for isolated reconciliation; F1 still affects real merged-PR retries. |
| Oversized artifact fails while summary remains | `tests/versioning/pr-check.mjs:90` nonzero; :91 exact 100-byte diagnostic; :92 preserved summary text. | PASS |

**Outcome**: 7/7 enumerated edges covered. A distinct-head/merge integration edge was absent from the plan and exposes F1.

## Gates and integrity

- `node tests/versioning/run.mjs --local`: exit 0; 9/9 fixtures, zero failed/skipped. Policy reports 45 assertions, report fixture 18, workflow contract 50.
- Build YAML gate: exit 0; recursive all-YAML load also parses 18/18 files.
- `node tests/versioning/real-go-gitsemver.mjs`: exit 0. Bootstrap, tagged empty-SHA normalization, collector-to-publication retry, patch/minor/major/combined sprint and invalid native config all execute.
- `go version -m C:/Users/gerso/go/bin/go-gitsemver.exe`: Go 1.27.0, module `v1.11.1-0.20260831223728-680c1c12d9a4`, matches workflow install pin.
- `git diff --check 59663cd..HEAD` and overlay diff check: exit 0.
- Test files grow from 6 at baseline to 13 at HEAD (+7). No test deletion or weakened assertion found. Existing non-Go hosted profiles are outside MVP and not selected by local/real-Go gates.
- Infrastructure feature: human interactive UAT is not required.

## Discrimination sensor

Six faults were applied only to disposable file-copy scratches. No stash or real production edit was used. The first run killed all six but its initial clean porcelain changed due to the orchestrator's two authorized caller/comment edits; that run is excluded as isolation evidence. All six were repeated after capturing the corrected two-file porcelain baseline, with no further concurrent edits.

| Mutant | Fault location | Gate and killing assertion | Result |
| --- | --- | --- | --- |
| M1 | `scripts/versioning/version-report.mjs:68`: bypass tagged empty-SHA reconciliation. | version-report fixture fails at `tests/versioning/version-report.mjs:47` before tagged-result assertions :51-52. | KILLED |
| M2 | `scripts/versioning/release-policy.mjs:63`: valid override authorizes malformed milestone. | `tests/versioning/release-policy.mjs:20`, called at :37, observes overridden instead of blocked. | KILLED |
| M3 | `scripts/versioning/collect-pr-policy.sh:84`: retain historical approved reviews instead of latest state. | `tests/versioning/pr-policy.mjs:71`: dismissed returns bob instead of null. | KILLED |
| M4 | `scripts/versioning/collect-pr-policy.sh:27`: reject only multiple matches and default zero matches to PR42. | `tests/versioning/pr-policy.mjs:85`, called at :91: zero association exits 0 instead of failing. | KILLED |
| M5 | `scripts/versioning/publish.sh:87`, :105: ignore release tag_name in both reconciliation checks. | `tests/versioning/post-merge.mjs:166`: wrong tag at same SHA exits 0 instead of failing. | KILLED |
| M6 | `scripts/versioning/release-policy.mjs:89`: erase four blocked comparison fields. | `tests/versioning/release-policy.mjs:43`: plannedVersion becomes null instead of 3.0.0. | KILLED |

**Sensor outcome**: 6/6 killed, 0 survived. Repeated-run pre/post porcelain identical; every scratch removed before report write.

## Ranked findings and concrete fix plan

### F1: Blocker, normal merge commits cannot publish

`scripts/versioning/collect-pr-policy.sh:92` preserves PR head SHA and :93 separately preserves merge commit SHA. `scripts/versioning/release-gates.sh:35` recalculates at GITHUB_SHA, and :41 correctly requires mergeCommitSha to equal that integrated SHA. `scripts/versioning/release-policy.mjs:47` then wrongly requires headSha to equal report.sha. Even bypassing that comparison would leave :85 validating override reviews against the merge SHA, although reviews belong to the PR head.

Reproduction: copy scripts/tests to isolated scratch; change only the PR mock's head.sha in `tests/versioning/post-merge.mjs:45` to a different valid 40-character SHA, preserving merge_commit_sha and all event/ref/remote/CI/milestone values. Running that fixture fails its initial accepted-gate assertion at :92 with status 1 and `Snapshot não corresponde ao SHA calculado`. Baseline fixture passes. No production file changed.

The happy publication mocks at `tests/versioning/post-merge.mjs:45` and :46 and `tests/versioning/real-go-gitsemver.mjs:72` explicitly make PR head and merge commit identical, explaining the false confidence from green gates.

**Fix task**: represent evaluation phase or separate publication SHA from review SHA. Preview must still require report SHA == PR head SHA. Publication must require report SHA == associated merged PR's mergeCommitSha, while any override review remains anchored to that PR's approved head SHA. Retain unique merged PR, branch/event/remote identity and fail-closed rules. Add an accepted normal merge with distinct head/merge SHAs, no-milestone and matching milestone cases, authorized override at head SHA, stale-head review rejection, publication at merge SHA, and idempotent retry. Do not just remove SHA validation.

**Affected ACs**: VER-05.1, VER-05.3, VER-05.6, VER-05.7.
**Disposition**: no implementation fix or remote write by this Verifier. Round 3 has reached the bounded fix/reverify limit; escalate to the user before continuing.

### Resolved adoption finding

The initial caller referenced 2a7887c, which did not contain tagged-SHA reconciliation or latest-review fixes. During this audit the orchestrator changed both refs to 009e72b and extended the preview required-event comment. The corrected overlay passes independent production-revision parity and workflow-contract assertions. This resolution does not fix F1.

## Code quality and traceability

Scope remains central scripts/workflows, caller, docs, tests and TLC artifacts; no pilot repository edits. Shell orchestrators and pure Node evaluators follow existing conventions without unrelated abstraction. Changed tests map to spec ACs, listed edges or task Done-when criteria. Project guidelines: `AGENTS.md:19` requires real tests and independent review. Domain policy assertions are exact, including four-field blocked payload and actor/role audit.

Per-layer integrated publication coverage is FAIL because mocks collapse distinct Git commit identities. VER-01/02/03/04/06 are independently Verified for the stated scope; VER-05 Needs Fix. No spec/tasks declarations were edited by the verifier.

**Completion gate**: validate_state must reject this persisted FAIL verdict. This feature is not ready to publish.
