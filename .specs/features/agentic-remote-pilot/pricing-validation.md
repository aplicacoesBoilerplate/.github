# Pricing validation: PASS — ARP-07 / T6

**Verdict: PASS**

**Date:** 2026-10-26. **Spec:** `.specs/features/agentic-remote-pilot/spec.md:48`. **Task:** T6. **Diff:** `6020169..94745c5ce114067f591d8e9d49d4d6a669aeef35`. **Branch:** `codex/issue-9-awf-pricing`. **Verifier:** independent agent `/root/pricing_verification_final`, different from the author; static policy comparison independently checked by `/root/pricing_verification_final/pricing_policy_check`.

The consumer's explicit per-process prices reach the exact-model AWF catalog. Zero remains explicit, nonzero values remain unchanged, absent pricing adds no catalog, and invalid prices are rejected. No defects or spec-precision gaps found in this patch. This is a local pricing-contract review; remote inference remains pending assessment.

## Spec-anchored outcomes

| ARP-07 outcome / T6 done-when | Evidence and assertion | Result |
| --- | --- | --- |
| Explicit zero is accepted and preserved | `ci-scripts/tests/agentic-config.test.ts:45`: `assert.deepEqual(RESULT.processes.triage.pricing, { input: 0, output: 0 })`; `ci-scripts/tests/agentic-remote-workflows.test.ts:56` checks the generated exact-model overlay. | PASS |
| The compiled AWF configuration receives the selected model's zero prices | `ci-scripts/tests/agentic-remote-workflows.test.ts:29` parses the JSON actually written for AWF; line30 asserts `providers.openai.models['liquid/lfm-2.5-2.6b:free'].cost` equals `{ input: 0, output: 0 }` for both locks. `.github/workflows/agentic-triage.lock.yml:1033` and `.github/workflows/agentic-review.lock.yml:1033` contain that catalog. | PASS |
| Nonzero prices follow a changed exact model without conversion | `ci-scripts/tests/agentic-remote-workflows.test.ts:85` sets `{ input: 0.000003, output: 0.000015 }`; line92 asserts those exact values at `models.providers.openai.models['provider/another-model'].cost`. `ci-scripts/scripts/agentic/CGhAwPilot.ts:61` copies `PROCESS.pricing` directly under `[PROCESS.model]`; no unit conversion or model inference. | PASS |
| Absence remains compatible and does not infer free prices | `ci-scripts/tests/agentic-config.test.ts:46`: `assert.equal(RESULT.processes.review.pricing, undefined)`. `ci-scripts/scripts/agentic/CAgenticConfiguration.ts:29` makes only pricing optional. An additional isolated check removed pricing from both fixture processes, rendered both called workflows, and asserted `called.models === undefined`. | PASS |
| Prices must be finite nonnegative numbers, with both fields present | `ci-scripts/tests/agentic-config.test.ts:48` asserts parser rejection for negative, NaN, Infinity, string and missing-field cases. `ci-scripts/scripts/agentic/CAgenticConfiguration.ts:39` requires exactly input/output; line41 checks numeric type, finiteness and nonnegative value. An additional independent check rejected14 malformed values, including missing either field, null/array/scalar, both nonfinite positions, negative minimum positive magnitude, wrong types and unknown field. | PASS |
| No global fallback is introduced | `ci-scripts/tests/agentic-remote-workflows.test.ts:31`: `assert.equal(FIREWALL.apiProxy.defaultAiCreditsPricing, undefined)`. Semantic lock comparison confirms the only AWF change is the exact-model providers overlay. | PASS |

The pricing-specific diff adds one test and strengthens existing workflow assertions; no previous test or assertion was removed or weakened. Existing tests in the focused files also continue covering consumer model/secret propagation, permissions, read-only tools and credential exclusion.

## Gates and commands

Commands below ran from `ci-scripts` unless stated otherwise:

- `node --version`: `v24.19.0`.
- `node --import tsx --test --test-concurrency=1 tests/agentic-config.test.ts tests/agentic-remote-workflows.test.ts`: **8 passed, 0 failed, 0 skipped**.
- `npm run typecheck`: **exit0**.
- From the repository root, `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py agentic-remote-pilot`: **0 errors**. This structural check reads the existing feature validation report; the pricing assertions and sensor above provide the current behavioral evidence.
- The principal supplied separate evidence: the complete serial Node22 suite passed **87/87**, typecheck and strict/validate lock reproduction passed, and PR28 CI run **40418152607** passed. These are supplied results, not reruns by this verifier; the global suite was deliberately not repeated.

For policy preservation, the independent static check used Node with `yaml.parse`, `git show 6020169:<lock>` and `git show 94745c5:<lock>`. It extracted the JSON from the AWF `printf` line, asserted the new catalog is exactly `{openai:{models:{'liquid/lfm-2.5-2.6b:free':{cost:{input:0,output:0}}}}}`, removed only that providers overlay, and deep-compared the entire AWF configuration with the baseline. It then normalized only that `printf` line and removed the added `GH_AW_INFO_MODEL_COSTS` metadata before deep-comparing each complete parsed lock. All comparisons passed, exit0.

The metadata at `.github/workflows/agentic-triage.lock.yml:185` and `.github/workflows/agentic-review.lock.yml:185` matches the same catalog. No changes remain in credentials, permissions, native policy, network, endpoint, model fallback, turn/time/credit limits, containers or other job behavior after accounting for pricing.

## Discrimination sensor

A Node inline runner copied only relevant source/test/fixture/workflow files into a fresh `os.tmpdir()/agentic-pricing-verifier-*` directory. A removable node_modules junction supplied existing dependencies. Each mutation ran the same focused8-test command above in the scratch's ci-scripts directory; no real source was modified and no stash was used.

| Mutation in scratch | Location | Observed result |
| --- | --- | --- |
| M1: remove the generated exact-model catalog entirely | `ci-scripts/scripts/agentic/CGhAwPilot.ts:61` | **Killed**, exit1:6 passed/2 failed; zero and nonzero generated catalog assertions observed undefined instead of the required costs. |
| M2: replace `cost: PROCESS.pricing` with `{ input: 0, output: 0 }` | `ci-scripts/scripts/agentic/CGhAwPilot.ts:61` | **Killed**, exit1:7 passed/1 failed; changed-model assertion observed zero instead of `{ input: 0.000003, output: 0.000015 }`. |
| M3: remove providers from the compiled AWF JSON in both lock copies | `.github/workflows/agentic-triage.lock.yml:1033`, `.github/workflows/agentic-review.lock.yml:1033` | **Killed**, exit1:7 passed/1 failed; compiled-catalog assertion observed undefined instead of `{ input: 0, output: 0 }`. |

**Sensor:** lightweight, **3 injected / 3 killed / 0 survived**. Scratch baseline passed8/8. The runner removed the junction, verified the resolved scratch path stayed under the temporary directory with the expected prefix, and removed the scratch. Real-tree `git status --porcelain` was empty before and identical after sensor cleanup. No credentials, inference or remote execution were used by the verifier.

## Scope and disposition

T6 / ARP-07 passes independent local review. No fix tasks or grounded lesson signals arose. This report is the verifier's only repository write; spec/task traceability updates remain with the principal. Real triage40421313262 and review40421333266 on SHA94745c5 were reported as running by the principal; their outcomes were not inspected or approved here.
