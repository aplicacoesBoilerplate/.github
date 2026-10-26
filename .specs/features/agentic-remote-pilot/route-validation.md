# Route validation: PASS — ARP-03 / T7

**Verdict: PASS for the local route correction. Remote inference remains pending.**

**Date:** 2026-10-26. **Spec:** `.specs/features/agentic-remote-pilot/spec.md:47`. **Task:** `.specs/features/agentic-remote-pilot/tasks.md:97`. **Diff:** `94745c5..0f6cc02`. **Branch:** `codex/issue-9-awf-pricing`. **Verifier:** independent agent `/root/route_fix_verifier`, different from the author.

The corrected AWF upstream prefix produces the two destinations required by T7. No defects, weakened regression assertions, or spec-precision gaps were found in this scoped patch. ARP-03 continues to have the explicit status “Harness contract verified; remote pending” at `spec.md:74`.

## Spec-anchored outcomes

| ARP-03 / T7 outcome | Evidence and assertion | Result |
| --- | --- | --- |
| Preserve `/api/v1/models` and `/api/v1/chat/completions` without duplicate version segments | `ci-scripts/scripts/agentic/CGhAwPilot.ts:60` supplies `https://openrouter.ai/api`. `ci-scripts/tests/agentic-remote-workflows.test.ts:23` checks the compiled environment; line34 asserts `BASE_PATH === '/api'`; lines36–37 assert both exact destination paths for each lock. The pinned upstream helper was also executed independently, as described below. | PASS |
| Preserve the prefix in freshly rendered workflows | `ci-scripts/tests/agentic-remote-workflows.test.ts:61` asserts `HEADER.engine.env.OPENAI_BASE_URL === 'https://openrouter.ai/api'` for both processes. | PASS |
| Continue using reflection and a placeholder credential in the native harness | `.github/workflows/shared/agentic-opencode.md:142` derives the proxy URL from `endpoint.models_url`; line144 selects `awf-proxy`. `ci-scripts/tests/agentic-remote-engine.test.ts:35` asserts `baseURL === 'http://awf.test/v1'`; line36 asserts `apiKey === 'awf-proxy'`; lines37–38 assert the real credential variables are absent from the child environment. | PASS |
| Deny shell, writes and external-directory access | `ci-scripts/tests/agentic-remote-engine.test.ts:41` through line44 assert shell/edit/external_directory `deny` and read `allow`, for both global and build-agent permissions. | PASS |
| Fail closed without AWF | `ci-scripts/tests/agentic-remote-engine.test.ts:50` asserts exit1; line51 asserts the native configuration was never captured; line52 requires the AWF error. | PASS |

The route assertions match T7's precise destinations at `tasks.md:103`, rather than accepting a changed configuration solely because it differs from the previous one. The existing three workflow tests and two engine tests remain present; the patch corrects the old prefix expectations and strengthens the compiled-path assertions. No previous policy, credential, model, pricing or permission assertion was removed.

## Independent upstream and artifact checks

The verifier fetched the pinned AWF v0.28.70 `proxy-utils.js` into memory, extracted its actual `buildUpstreamPath` function and evaluated it with Node's URL implementation. Both inputs passed: `/v1/models` with `/api` returned `/api/v1/models`, and `/v1/chat/completions` returned `/api/v1/chat/completions`. The old `/api/v1` prefix produced `/api/v1/v1/models` and `/api/v1/v1/chat/completions`. This confirms the configuration correction against the [pinned AWF implementation](https://github.com/github/gh-aw-firewall/blob/v0.28.70/containers/api-proxy/proxy-utils.js#L159).

The local harness still delegates URL derivation to the pinned reflection helper, which removes the trailing `/models` while retaining its prefix. The engine test supplies a simulated `/v1/models` reflection response; it does not establish a live AWF network connection. The helper's behavior is supported by the [pinned gh-aw source](https://github.com/github/gh-aw/blob/32ecafbc061c9af57e9361942099e381102ae304/actions/setup/js/awf_reflect.cjs#L757).

For **each** lock, the verifier loaded the previous file with `git show 94745c5:<path>`, normalized only the old environment URL, the old AWF base-path argument, and the frontmatter hash, and asserted equality of the complete raw files and parsed YAML objects. Both comparisons passed. `.github/workflows/agentic-triage.lock.yml:1051` and `.github/workflows/agentic-review.lock.yml:1051` contain `--openai-api-base-path /api`; both environments contain the matching URL at line1067. Both generated Markdown files also equal their previous versions after replacing only that URL.

Consequently, pricing, authentication, credential exclusions, native permissions, firewall configuration, disabled model fallback, model selection, job permissions, limits, containers and all other compiled behavior are unchanged. The exact-model zero prices remain asserted at `ci-scripts/tests/agentic-remote-workflows.test.ts:30`; global fallback remains absent at line31. Both locks retain their AWF configuration at line1033.

## Gates

Commands ran from `ci-scripts` unless stated otherwise:

- `npm exec --yes --package=node@22 -- node --version`: **v22.23.4**.
- `npm exec --yes --package=node@22 -- node --import tsx --test --test-concurrency=1 tests/agentic-remote-workflows.test.ts tests/agentic-remote-engine.test.ts`: **5 passed, 0 failed, 0 skipped**, exit0.
- `npm exec --yes --package=node@22 -- node node_modules/typescript/bin/tsc --noEmit`: **exit0**.
- Independent complete-lock comparisons and execution of the pinned upstream helper: **exit0**.
- From the repository root, `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py agentic-remote-pilot`: **0 errors**. This structural command reads the existing feature `validation.md`; the current route evidence is the independent checks in this report.

The author separately recorded the complete serial Node22 suite **87/87**, typecheck, and strict/validate reproduction of both locks at `.specs/features/agentic-remote-pilot/implementation-log.md:73`. Those aggregate gates were supplied evidence and were deliberately not repeated by this verifier. The focused count remains five before and after this patch; no tests were deleted or skipped.

## Discrimination sensor

A fresh `os.tmpdir()/agentic-route-verifier-*` directory received copies of the relevant source, tests, fixtures and workflows. A removable node_modules junction supplied dependencies. The same five-test command ran with Node **v22.23.4** in the isolated copy. Its baseline passed **5/5**.

| Mutation | Location | Observed result |
| --- | --- | --- |
| M1: restore the old `/api/v1` upstream configuration in the generator and both compiled lock copies | `ci-scripts/scripts/agentic/CGhAwPilot.ts:60`; both locks at lines1051 and1067 | **Killed**, exit1: **3 passed / 2 failed**. The compiled and generated URL assertions at `agentic-remote-workflows.test.ts:23` and line61 observed the old `/api/v1` URL instead of `/api`. |

**Sensor:** lightweight, **1 injected / 1 killed / 0 survived**. The runner removed the dependency junction, checked that the resolved scratch directory remained directly under the temporary directory with the required prefix, and deleted it. Real-tree `git status --porcelain=v1` was empty before the sensor and identical after cleanup. No real source was mutated and no stash was used.

## Disposition and limits

T7 passes independent local review. The change is surgical and follows the existing generator/test patterns and `AGENTS.md` requirement for actual tests plus independent review. No fix tasks or grounded lesson signals arose. This report is the verifier's only repository write; there was no commit or push.

No authentication values were read, no model inference was invoked, and no remote pilot was approved by this review. A new real triage/review run must still demonstrate the provider response before remote homologation or promotion, as required by T7.
