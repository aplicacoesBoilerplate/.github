# Pipeline Centralizada de Versionamento Validation

## Validation: PASS

**Verdict**: PASS
**Date**: 2026-10-03
**Spec**: `.specs/features/centralized-versioning-pipeline/spec.md`
**Diff range**: primary `e744a92..a476b8f`; full feature audit `59663cd..a476b8f`.
**Verifier**: independent TLC verifier (author != verifier), user-authorized SHA-only follow-up after round 3.

The SHA correction passes independent local verification. Preview binds the adapter report to the PR head; publication binds it to the integrated merge commit. Override approval always binds to the reviewed PR head. The real local non-fast-forward fixture has distinct commits and successfully publishes the merge SHA, then completes ten retries without new writes.

## Task completion

T1-T24 implementation and test outcomes are verified for the specified central Go MVP. T23 closes the four previously failed publication ACs. T24 pins both caller jobs to production commit `be8fff51d92c10bb00fa8188184117130621a2bb`, whose scripts and workflows match HEAD exactly. Historical pending traceability in spec/tasks is left for the orchestrator to reconcile after this verdict.

## Spec-anchored acceptance criteria

Assertions were read against the 41 spec-defined outcomes and independently rerun. No precision gap or uncovered acceptance criterion remains. Workflow claims use static contracts; behavior claims use local fixtures.

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
| VER-02.5 | Blocked divergence records all four comparison values. | `tests/versioning/release-policy.mjs:43` through :46 assert `3.0.0/2.0.0/major/major`; :53 through :56 assert `1.3.0/1.3.0/minor/patch`; :20 and :52 assert blocked. | PASS |
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
| VER-05.1 | Successful CI after integrated master push can publish integrated SHA. | `tests/versioning/workflow-contract.mjs:77`, :80 assert master push and needs go-ci; `tests/versioning/post-merge.mjs:32` asserts distinct real commits; :99 accepts gate; :136 asserts successful publication. | PASS |
| VER-05.2 | Invalid event/ref/nonunique merged develop PR provenance is refused. | `tests/versioning/post-merge.mjs:115` rejects invalid provenance/authorization modes; :116 asserts absent writes; `tests/versioning/pr-policy.mjs:85-93` rejects zero/two associated PRs with diagnostics and no snapshot. | PASS |
| VER-05.3 | Recalculate integrated SHA and revalidate integrated PR before writes. | `tests/versioning/post-merge.mjs:89` checks calculated report SHA == integrated GITHUB_SHA; :104 accepts head-reviewed override; :115-116 reject merge/stale/dismissed reviews before writes; :144 asserts exactly one integrated calculation. | PASS |
| VER-05.4 | Named environment gates write job. | `tests/versioning/workflow-contract.mjs:48` asserts named conditional gate; :50 asserts needs and successful gate requirement through publishMatches(:14). | PASS |
| VER-05.5 | Empty environment proceeds after CI/checks. | `tests/versioning/workflow-contract.mjs:44` asserts empty environment default; :50 accepts skipped environment; :80 asserts CI dependency; `tests/versioning/post-merge.mjs:136` publication succeeds. | PASS |
| VER-05.6 | Gates create immutable tag/release on integrated SHA using native notes. | `tests/versioning/post-merge.mjs:138-143` asserts published, version 0.0.1, tag v0.0.1, tagSha == integrated sha, release.target_commitish == integrated sha and native notes. :32 confirms PR head differs. | PASS |
| VER-05.7 | Same version/SHA rerun returns already-published without writes. | `tests/versioning/post-merge.mjs:149-152` asserts ten successful already-published retries and unchanged write log on distinct-head merge; `tests/versioning/real-go-gitsemver.mjs:91` asserts tagged real-adapter retry. | PASS |
| VER-05.8 | Tag/release version/SHA conflicts fail without overwrite. | `tests/versioning/post-merge.mjs:161`, :165, :169 reject tag/release SHA conflicts; :176 rejects wrong tag_name at same SHA; :178 and :180 assert unchanged remote state and writes. | PASS |
| VER-05.9 | Serialize repository/branch publications without cancellation. | `tests/versioning/workflow-contract.mjs:52` matches concurrency group and cancel-in-progress false. | PASS |
| VER-05.10 | Only publisher gets contents write. | `tests/versioning/workflow-contract.mjs:54` matches publisher permissions; :29 excludes preview write permissions; production workflow has contents read on environment gate. | PASS |
| VER-06.1 | Central monitored PR/push CI preserves Maven/npm and runs versioning. | `tests/versioning/workflow-contract.mjs:64`, :65 local/real invocation; :66 monitored branches; :68 Maven verify; :70 npm install/test. | PASS |
| VER-06.2 | Positive/negative milestone, override, guide, retry and publication scenarios run. | `tests/versioning/release-policy.mjs:20`, `tests/versioning/pr-check.mjs:64`, :84, `tests/versioning/post-merge.mjs:136`, :149, :176 assert positive/negative policy, guide, publication, retries and conflicts. | PASS |
| VER-06.3 | Pinned real Go proves bootstrap/patch/minor/major/combined sprint. | `tests/versioning/workflow-contract.mjs:62` matches install pin; `tests/versioning/real-go-gitsemver.mjs:49`, :126, :130, :134, :139 assert `0.0.1/0.0.2/0.1.0/2.0.0/2.1.0`. Installed binary build metadata confirms revision suffix `680c1c12d9a4`. | PASS |
| VER-06.4 | Child versioning failure fails CI. | `tests/versioning/runner-self-test.mjs:18` exact status 7; :19 exact broken fixture diagnostic; `tests/versioning/workflow-contract.mjs:64` direct runner invocation without failure suppression. | PASS |
| VER-06.5 | Copyable caller delegates configuration using actual current central implementation. | `tests/versioning/workflow-contract.mjs:83-85` asserts two immutable same-revision refs and no bypass inputs. Independent git diff of scripts/versioning and .github/workflows between caller pin be8fff51d92c10bb00fa8188184117130621a2bb and HEAD is empty; git show confirms phase SHA split and head authorization at that revision. | PASS |
| VER-06.6 | Docs specify required checks and direct-push protections on develop/master. | `tests/versioning/workflow-contract.mjs:89` asserts force-push/deletion/direct-update protections; :91 required preview check; `docs/versioning.md:121` targets both branches. | PASS |


**Outcome**: 41/41 ACs matched; 0 gaps and 0 spec-precision gaps.

## SHA-specific adversarial evidence

`tests/versioning/release-policy.mjs:94` asserts a publication override reviewed on PR head is `overridden`; :96-98 asserts merge/stale reviews are `blocked`; :100-103 rejects report identities from the wrong phase; :104-110 rejects absent mergedAt, mergeCommitSha or headSha; :112 rejects invalid phase. `tests/versioning/post-merge.mjs:32` proves distinct real commits, :99 accepts matching milestone, :102 accepts no milestone, :104 accepts valid override, and :115-116 rejects stale/merge/dismissed approvals before writes. The report collector separately rejects foreign native SHA at `tests/versioning/version-report.mjs:80`.

## Edge cases

| Edge | Exact assertion evidence | Result |
| --- | --- | --- |
| Highest stable reachable SemVer | `tests/versioning/version-report.mjs:31`: selectReachableStableTag(...) equals `0.2.0` with two reachable tags. | PASS |
| Unreachable larger global tag | `tests/versioning/version-report.mjs:29` creates unrelated `v9.0.0`; :31 still equals `0.2.0`. | PASS |
| Missing/ambiguous associated PR | `tests/versioning/pr-policy.mjs:91`, :93 invoke zero/two via :85 nonzero/:86 diagnostics/:87 absent snapshot. | PASS |
| Removed label invalidates | `tests/versioning/release-policy.mjs:70` asserts blocked via :20. | PASS |
| Downgraded current actor role | `tests/versioning/release-policy.mjs:71` and :80 assert blocked for triage labeler/write approver; :75 exact role audit. | PASS |
| Lost release API response reconciles | `tests/versioning/post-merge.mjs:189` success and :190 already-published after mock stores release then returns API failure. | PASS |
| Oversized artifact fails while summary remains | `tests/versioning/pr-check.mjs:90` nonzero; :91 exact 100-byte diagnostic; :92 preserved summary text. | PASS |


**Outcome**: 7/7 enumerated edges covered. Distinct-head/merge integration additionally covered.

## Gates and integrity

Commands run from the feature worktree with explicit PowerShell PATH:
`$env:PATH='C:\\Program Files\\Git\\bin;C:\\Program Files\\Git\\usr\\bin;C:\\Users\\gerso\\go\\bin;'+$env:PATH`.

- `node tests/versioning/run.mjs --local`: exit 0, 9/9 deterministic fixtures passed, zero skipped; policy 54 assertions, report 18, workflow contract 50. Windows process startup makes the post-merge fixture take several minutes; it completed.
- `node tests/versioning/run.mjs --real-go`: exit 0; real adapter bootstrap 0.0.1, patch 0.0.2, minor 0.1.0, major 2.0.0, combined sprint 2.1.0, tagged normalization/retry and invalid native config all asserted.
- `go version -m C:/Users/gerso/go/bin/go-gitsemver.exe`: Go 1.27.0; module revision `v1.11.1-0.20260831223728-680c1c12d9a4` agrees with immutable install pin.
- Build YAML gate `python -c "import glob,yaml; [yaml.safe_load(open(p,encoding='utf-8')) for p in glob.glob('.github/workflows/*.yml')]"`: exit 0; recursive pathlib parse also confirms 18/18 YAML files.
- `git diff --check 59663cd..HEAD` and `git diff --check e744a92..HEAD`: exit 0.
- `git diff be8fff51d92c10bb00fa8188184117130621a2bb HEAD -- scripts/versioning .github/workflows`: empty. Caller references at `examples/callers/go/.github/workflows/go-publish.yml:19` and :35 are exactly this commit. `git show` confirms that pin includes calculated phase identity and PR-head override authorization.
- `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_spec.py centralized-versioning-pipeline`: zero errors/warnings.
- `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_tasks.py centralized-versioning-pipeline`: zero errors; two advisory warnings for documentation Tests:none and cohesive multi-file T23.
- Tests increase from 6 files at 59663cd to 13 at HEAD. SHA follow-up preserves every existing assertion and adds phase/merge scenarios. No weakened, deleted or skipped tests.

## Discrimination sensor

Five behavior faults were injected sequentially into disposable copies of scripts/tests under an explicit Temp scratch, using `node sensor.mjs` to run `node tests/versioning/release-policy.mjs` after each mutation. Production and original tests were read-only. Auth/integrity sensitivity justifies five faults.

| Mutant | Fault location | Killing assertion | Result |
| --- | --- | --- | --- |
| M1 | `scripts/versioning/release-policy.mjs:51`: restore head SHA for publication calculation | `tests/versioning/release-policy.mjs:92` throws wrong calculated SHA before accepted merged override :94. | KILLED, exit 1 |
| M2 | `scripts/versioning/release-policy.mjs:90`: authorize review using calculated merge SHA | `tests/versioning/release-policy.mjs:94` sees blocked instead of overridden. | KILLED, exit 1 |
| M3 | `scripts/versioning/release-policy.mjs:52`: remove calculated SHA match | `tests/versioning/release-policy.mjs:100` fails missing expected exception. | KILLED, exit 1 |
| M4 | `scripts/versioning/release-policy.mjs:28`: permit same labeler and approver | `tests/versioning/release-policy.mjs:81` via :20 sees overridden instead of blocked. | KILLED, exit 1 |
| M5 | `scripts/versioning/release-policy.mjs:20`: permit Triage labeler | `tests/versioning/release-policy.mjs:71` via :20 sees overridden instead of blocked. | KILLED, exit 1 |

**Sensor outcome**: 5/5 killed, zero survived. Real-tree porcelain was empty before and after sensor cleanup. The explicit verified scratch directory was removed; only this report is changed after sensor completion. PowerShell cleanup was rejected by command policy; equivalent exact-target Node cleanup succeeded. No stash, production mutation or remote write.

## Code quality, traceability and limits

SHA production changes are confined to two existing policy/gate files and caller pin. Tests target the specified identity contract without alternate SemVer logic or caller-controlled bypasses. Existing shell/Node boundaries and style are preserved. Evidence matches domain ACs, preview/publish happy and failure paths, and specified edges. Project guidance `AGENTS.md:19` requires real tests and independent review, both satisfied. No new grounded failure remains, so TLC lesson distillation records nothing.

All six requirement groups are independently verified for this local MVP scope. No hosted GitHub Actions/environment execution, pilot integration or remote publication was executed. Static workflow contracts and mocked API behavior do not claim deployment proof. No push or pilot/OpenSpec edit occurred.

**Completion gate**: `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py centralized-versioning-pipeline` passes with zero errors on the persisted PASS report.
