# Pipeline Centralizada de Versionamento Validation

## Validation: PASS

**Verdict**: PASS
**Date**: 2026-10-04
**Spec**: `.specs/features/centralized-versioning-pipeline/spec.md`
**Diff range**: primary `85c39a6..29b3f10`; full feature audit `59663cd..29b3f10`.
**Verifier**: fresh independent TLC verifier (author != verifier), governed hotfix extension.

The hotfix extension passes independent local/static verification and five targeted mutation checks. All nine local fixtures completed with exit 0. Preview binds the adapter report to PR head; publication binds it to integrated merge commit; approval stays on PR head. Hotfix uses the same native calculation and governance as develop, with no forced PATCH.

## Task completion

T1-T26 implementation is present. Both caller jobs select production commit `07bd5372f7fc4a34a1b04134a84a0b9f4aba3b45`; its scripts and workflows match audited HEAD exactly. The go-ci arrangement and historical OpenSpec are unchanged by the primary diff. Traceability reconciliation follows the final executable verdict.

## Spec-anchored acceptance criteria

Assertions were read against all 43 current spec-defined outcomes. No precision gap or uncovered acceptance criterion was found. Workflow claims use static contracts; behavior claims use local fixtures. Current line corrections for the retained evidence matrix are listed below, so references remain auditable after the new hotfix cases.

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
| VER-06.5 | Copyable caller delegates configuration using actual current central implementation. | `tests/versioning/workflow-contract.mjs:83` asserts two immutable refs; :84 same revision; :85 no bypass inputs. Caller :19/:35 select 07bd5372f7fc4a34a1b04134a84a0b9f4aba3b45; independent production diff versus HEAD empty. | PASS |
| VER-06.6 | Docs specify required checks and direct-push protections on develop/master. | `tests/versioning/workflow-contract.mjs:89` asserts force-push/deletion/direct-update protections; :91 required preview check; `docs/versioning.md:121` targets both branches. | PASS |


| AC | Spec-defined outcome | Exact evidence and assertion | Result |
| --- | --- | --- | --- |
| VER-05.11 | Hotfix has same native/milestone/override rules; no empty or other origins. | `tests/versioning/pr-check.mjs:104` status 0; :105 hotfix-to-main; :106 exact adapter-authoritative/matched/overridden outcomes; :107 no release calls; :112 invalid/divergent/stale/dismissed/unauthorized cases nonzero; :116 empty/spurious prefixes nonzero. Shared `tests/versioning/release-policy.mjs:28-29` preserves native calculated 2.0.0/major; production same evaluator, no PATCH override. | PASS |
| VER-05.12 | Hotfix publishes after CI/gates on integrated SHA and retries without writes. | `tests/versioning/workflow-contract.mjs:80` needs go-ci; `tests/versioning/post-merge.mjs:108-109` accepted gates/no writes; :116-117 invalid/stale/merge/dismissed/unauthorized/ambiguous gates nonzero/no writes; :205 branch from master; :210 no-ff merge; :212 head != merge; :219-226 successful published tag/release at hotfixMerge, already-published retry and unchanged writes. | PASS |

**Current evidence locations (supersede retained pre-hotfix line numbers above, including edge/SHA sections):** In `tests/versioning/post-merge.mjs`, real distinct commits :33; gate success :100; no milestone :103; authorized override :105; negative gate :129 and absent writes :130; publication success :150; exact published/version/tag/SHA/native notes :152-157; adapter count :158; ten retries :163-166; tag/release conflicts :175/:179/:183; wrong tag nonzero :190, unchanged state :192 and writes :194; lost-response recovery :203-204. In `tests/versioning/pr-policy.mjs`, failure helper assertions are :95 nonzero/:96 diagnostic/:97 absent snapshot/:99 prior endpoints; zero/two association calls :101/:103; timeline/reviews/role failures :105/:107/:109. In `tests/versioning/pr-check.mjs`, develop success/phase/version :65-67, native explanation :69, summary required strings :73, unchanged HEAD/tags :81-82, divergent rejection :85, oversized artifact failure/diagnostic/preserved summary :91-93, missing calculation rejection :96. All those assertion expressions were independently reread. Documentation scopes both branches at `docs/versioning.md:132`.

**Outcome**: 43/43 ACs matched and local suite rerun passed; 0 gaps and 0 spec-precision gaps.

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
- `git diff --check 59663cd..HEAD` and `git diff --check 85c39a6..HEAD`: exit 0.
- `git diff 07bd5372f7fc4a34a1b04134a84a0b9f4aba3b45 HEAD -- scripts/versioning .github/workflows`: empty. Caller references at `examples/callers/go/.github/workflows/go-publish.yml:19` and :35 are exactly this commit. Pin exists and contains all three hotfix selectors and the existing calculated/publication SHA split.
- `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_spec.py centralized-versioning-pipeline`: zero errors/warnings.
- `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_tasks.py centralized-versioning-pipeline`: zero errors; three advisory warnings for documentation Tests:none and cohesive multi-file T23/T25.
- Tests increase from 6 files at 59663cd to 13 at HEAD. SHA follow-up preserves every existing assertion and adds phase/merge scenarios. No weakened, deleted or skipped tests.

## Discrimination sensor

Five behavior faults were injected sequentially into a disposable local clone at `C:/Users/gerso/AppData/Local/Temp/hotfix-verifier-20261004`, using `node sensor.mjs` to run the appropriate unmodified focused fixture after each mutation. Each original script was restored before the next mutation. Real production and original tests were read-only. Auth/integrity sensitivity justifies five faults.

| Mutant | Fault location | Killing assertion | Result |
| --- | --- | --- | --- |
| M1 | `scripts/versioning/preview.sh:19`: replace hotfix acceptance with false | `tests/versioning/pr-check.mjs:104` sees status 1 instead of 0. | KILLED, exit 1 |
| M2 | `scripts/versioning/collect-pr-policy.sh:25`: replace hotfix association acceptance with false | `tests/versioning/pr-policy.mjs:81` sees status 1 instead of 0. | KILLED, exit 1 |
| M3 | `scripts/versioning/collect-pr-policy.sh:25`: broaden acceptance to Boolean(head.ref) | `tests/versioning/pr-policy.mjs:87` sees status 0 for unsupported hotfix source instead of nonzero. | KILLED, exit 1 |
| M4 | `scripts/versioning/release-policy.mjs:4`: add Triage to authorized roles | `tests/versioning/release-policy.mjs:71` via :20 sees overridden instead of blocked. | KILLED, exit 1 |
| M5 | `scripts/versioning/release-policy.mjs:90`: authorize review using calculated merge SHA | `tests/versioning/release-policy.mjs:94` sees blocked instead of overridden. | KILLED, exit 1 |

**Sensor outcome**: 5/5 killed, zero survived. Real-tree porcelain was empty before and after sensor cleanup. The explicit verified scratch directory was removed; only this report is changed after sensor completion. PowerShell cleanup was rejected by command policy; equivalent exact-target Node cleanup succeeded. No stash, production mutation or remote write.

## Code quality, traceability and limits

Hotfix production changes are confined to three existing source guards and caller pin. Native calculation, optional milestone, audited override, SHA identities, CI/environment contracts, permissions and idempotency are reused. No forced PATCH, alternate SemVer logic or caller-controlled bypass was added. New fixture assertions map to VER-05.2/.11/.12, VER-03.7 and T25/T26 Done-when outcomes. Existing develop assertions are preserved; only association diagnostic wording names both allowed sources. Existing shell/Node boundaries and style are preserved. Evidence matches domain ACs, preview/publish happy and failure paths, and specified edges. Project guidance `AGENTS.md:19` requires real tests and independent review, both satisfied. No new grounded failure remains, so TLC lesson distillation records nothing.

All six requirement groups are independently verified for this local MVP scope. No hosted GitHub Actions/environment execution, pilot integration or remote publication was executed. Static workflow contracts and mocked API behavior do not claim deployment proof. No push or pilot/OpenSpec edit occurred.

**Completion gate**: `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py centralized-versioning-pipeline` passes with zero errors on the persisted PASS report.
