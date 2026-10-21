# Changesets/Turbo coordinated release validation

**Date**: 2026-10-15
**Spec**: `.specs/features/changesets-turbo/spec.md`
**Diff range**: `fcf31e08165156a5938eec7577bbf1be945f365f..324b78d74fbdc33e7d90778f8fa4ed93e94f4227`
**Verifier**: independent sub-agent (author ≠ verifier)
**Overall**: PASS — ready for review as the PR #13 stack over PR #12.

## Task completion

| Task | Result | Evidence |
| --- | --- | --- |
| T1 | PASS | `tests/versioning/real-changesets.mjs:50` checks the native two-package plan. |
| T2 | PASS | `tests/versioning/changesets-flow.mjs:146` checks one technical PR and its plan digest. |
| T3 | PASS | `tests/versioning/changesets-publish.mjs:29` checks publication and reconciliation. |
| T4 | PASS | `tests/versioning/workflow-contract.mjs:109` checks the called and pinned monorepo caller. |
| T5 | PASS | `docs/versioning.md:229` explains adoption; hosted CI passed the complete versioning job at the PR head. |

## Spec-anchored acceptance criteria

| Criterion | Expected outcome from spec | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| CST-01: native preview | Preserve every Changesets release, including a dependent package; no replacement SemVer. | `tests/versioning/real-changesets.mjs:53` asserts `[['@lab/cli', '1.0.1'], ['@lab/core', '3.0.0']]` from the real CLI report. `scripts/versioning/version-report.mjs:116` maps the CLI releases. | PASS |
| CST-02: functional merge | One technical PR with all manifests and lockfile; no tag on the functional SHA. | `tests/versioning/changesets-flow.mjs:146` asserts the single `versioning/changesets/<SHA>` branch; `:153` asserts both tags in the plan, `:157`–`:161` assert both manifests and the dependent lockfile range, and `:156` asserts no tag. | PASS |
| CST-03: reviewed technical merge | Reject unreviewed or altered plan before writes; verify manifests, changelogs, lockfile and file scope. | `tests/versioning/changesets-flow.mjs:177`–`:185` assert bot-only review and changed digest fail with zero tags. `tests/versioning/real-changesets.mjs:63`–`:82` assert native versions, dependent range, changelogs, unrelated-file rejection and lockfile rejection. | PASS |
| CST-04: immutable package releases | Tags and Releases point to the technical merge SHA; identical reruns reconcile, conflicts do not move tags. | `tests/versioning/changesets-flow.mjs:190`–`:214` assert both tags, exact integrated SHA, partial recovery and conflict preservation. `tests/versioning/changesets-publish.mjs:41`–`:60` assert ten write-free reruns, stale complete reconciliation, stale partial rejection and conflict preflight. | PASS |
| CST-05: batch outputs | Multi-package release returns complete `releases_json`; scalar version/tag/URL empty; `published_sha` is the technical merge SHA after complete publication. | `tests/versioning/changesets-publish.mjs:31`–`:39` assert empty scalars and both package identities. `tests/versioning/changesets-flow.mjs:193`–`:199` assert `published_sha` and idempotent outcome. `tests/versioning/workflow-contract.mjs:31`–`:32` assert both called workflows expose `releases_json`. | PASS |
| CST-06: adoption | One copyable npm-workspaces/Turborepo caller, configuration guidance, and a hosted gate using real Changesets. | `tests/versioning/workflow-contract.mjs:109`–`:130` assert one monorepo caller, same-SHA pins and a pinned publisher with batch output. `.github/workflows/ci.yml:69`–`:74` runs the deterministic and real Changesets fixtures; `docs/versioning.md:229`–`:269` documents setup, options, limitations and outputs. | PASS |

## Discrimination sensor

The real worktree was clean before and after the sensor. In a detached temporary worktree, I replaced the stale-partial guard at `scripts/versioning/publish-changesets.mjs:60` with an always-false condition. `node tests/versioning/changesets-publish.mjs` failed at its `:54` assertion that an old incomplete batch must be rejected. The temporary worktree was removed; `git status --porcelain` remained empty.

| Mutation | Expected detection | Result |
| --- | --- | --- |
| Disable stale incomplete-batch rejection | Test must fail instead of allowing publication | KILLED (exit 1) |

**Sensor depth**: lightweight, one high-risk behavior-level mutation. **Survivors**: 0.

## Gates and quality

- **Hosted complete gate**: [PR #13 CI run](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38449601227), `Validate centralized versioning` SUCCESS at head `324b78d74fbdc33e7d90778f8fa4ed93e94f4227`. `.github/workflows/ci.yml:69`–`:74` runs `node tests/versioning/run.mjs --local` and `node tests/versioning/real-changesets.mjs`, among the other real adapter fixtures.
- **Independent focused checks**: real Changesets fixture PASS; `tests/versioning/workflow-contract.mjs` PASS with 79 assertions; 7/7 changed Git shell blobs parsed with `bash -n`; 7 workflow YAML files parsed; spec and tasks validators returned zero errors and warnings; `git diff --check` PASS.
- **Fixture count**: the local runner grew from 13 fixture programs at the base commit to 15 at the PR head. No runner fixture was removed. The hosted run had no failed or skipped versioning steps.
- **Windows diagnostic**: an independent local `--local` repeat passed the new Changesets flow and publisher fixtures, then spent several minutes in the existing `post-merge.mjs` fixture and was interrupted. The complete hosted execution of that exact command passed at the same head; this is a local timing limitation, not a claimed additional pass.
- **Code review**: scope is confined to the versioning contract, workflows, caller, docs, specs and tests. The package plan is obtained from Changesets; the central code checks identities and coordinates GitHub writes. Tests assert behavior from CST-01–06. There are no pilot repository changes in this diff.

## Limits and traceability

All CST-01–06 criteria are supported by file-and-line evidence above, and the spec marks them Verified. The hosted gate validates the real Changesets CLI and simulated GitHub write paths; it does not establish a live consumer publication. npm registry publishing and pnpm/Yarn support remain outside the specified first profile. No surviving mutation, uncovered acceptance criterion, or spec-precision gap was found, so no lesson was added.
