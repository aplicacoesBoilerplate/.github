# Pipeline Centralizada de Versionamento Validation

**Verdict**: FAIL ❌
**Date**: 2026-10-01
**Spec**: `.specs/features/centralized-versioning-pipeline/spec.md`
**Diff range**: `59663cd..eeda55e` (`59663cd..HEAD`)
**Verifier**: independent TLC Verifier (author ≠ verifier)

O gate local e a fixture real do Go passam, mas a entrega não atende o contrato completo. A reexecução real após uma tag falha antes da reconciliação idempotente. Uma milestone inválida pode ser autorizada por override. O caller não reexecuta em `milestoned`/`demilestoned` e não concede `checks: read` ao workflow reutilizável. Há também critérios sem assertion-level evidence.

---

## Task Completion

| Task | Declared | Verifier status | Notes |
| ---- | -------- | --------------- | ----- |
| T1 | Complete | ✅ Verified | Modelo, bootstrap e seleção de tag alcançável têm assertions exatas. |
| T2 | Complete | ❌ Needs fix | O collector rejeita o `Sha` vazio emitido pelo binário real em commit já tagueado. |
| T3 | Complete | ❌ Needs fix | Milestone inválida aceita override; payload auditável não é integralmente testado. |
| T4 | Complete | ❌ Needs fix | Review `APPROVED` depois invalidado por dismissal pode continuar selecionado. |
| T5 | Complete | ⚠️ Partial | Campos JSON são cobertos; equivalência completa do Markdown e limite de artifact não são. |
| T6 | Complete | ⚠️ Partial | Fluxos básicos passam; reavaliação por milestone/review não está completa. |
| T7 | Complete | ❌ Needs fix | Contrato documenta eventos incompletos e depende de permissão não concedida pelo caller. |
| T8 | Complete | ❌ Needs fix | Revalidação herda as falhas de policy e review corrente. |
| T9 | Complete | ❌ Needs fix | Mock prova idempotência, mas o adaptador real não alcança a reconciliação. |
| T10 | Complete | ✅ Verified | Environment opcional, serialização e permissão de escrita têm assertions exatas. |
| T11 | Complete | ❌ Needs fix | A fixture real testa `prepare-release.sh`, não o collector/publicador usado pelo workflow final. |
| T12 | Complete | ❌ Needs fix | Caller omite eventos de milestone e `checks: read`. |
| T13 | Complete | ❌ Needs fix | A documentação repete a lista incompleta de eventos e não fecha os gaps de adoção. |

---

## Spec-Anchored Acceptance Criteria

Evidence-or-zero foi aplicado. Uma assertion precisa observar o estado/valor definido na spec; presença de código ou regex parcial não substitui o outcome.

| AC | Spec-defined outcome | `file:line` + exact assertion | Result |
| -- | -------------------- | ----------------------------- | ------ |
| VER-01.1 | `go-gitsemver` fixado, SHA avaliado, JSON nativo | `tests/versioning/workflow-contract.mjs:29-31` - `matches(actions/setup-go@SHA)` e `matches(go install ...@680c...)`; `tests/versioning/go-version.mjs:76-81` - `status === 0`, candidate/SHA/native/explanation exatos | ✅ PASS |
| VER-01.2 | Envelope preserva candidate, SHA, bump e explicação nativa | `tests/versioning/version-report.mjs:39-45` - `schemaVersion === 1`, adapter/base/candidate/tag/bump/explanation exatos | ✅ PASS |
| VER-01.3 | SemVer/SHA/JSON/execução inválidos falham antes de publicar | `tests/versioning/version-report.mjs:61-70` - `assert.throws` para JSON, SemVer, SHA e schema; `tests/versioning/real-go-gitsemver.mjs:109` - config inválida lança | ✅ PASS |
| VER-01.4 | Bootstrap publica somente `v0.0.1`; base interna `v0.0.0` | `tests/versioning/version-report.mjs:53-58` - base `0.0.0` e outro candidate lança `/0\.0\.1/`; `tests/versioning/real-go-gitsemver.mjs:49` - `calculate() === '0.0.1'` | ✅ PASS |
| VER-01.5 | Adapter desconhecido/path inseguro falham antes de executar | `tests/versioning/go-version.mjs:86-90` - status não zero e execution marker ausente | ✅ PASS |
| VER-02.1 | Sem milestone aceita versão e bump do adapter sem revisão | `tests/versioning/release-policy.mjs:24-25` - outcome `adapter-authoritative` e `plannedVersion === null`; não há assertion de `calculatedVersion` e `calculatedBump` | ⚠️ EVIDENCE GAP |
| VER-02.2 | Milestone estrita compara versão exata | `tests/versioning/release-policy.mjs:26-29` - outcome `matched`, `plannedVersion === '2.0.0'` | ✅ PASS |
| VER-02.3 | Milestone compara bump entre base e versão planejada | `tests/versioning/release-policy.mjs:26-29` - `plannedBump === 'major'`; `tests/versioning/release-policy.mjs:35-40` - mismatch minor/patch bloqueia | ✅ PASS |
| VER-02.4 | Milestone não estrita sempre falha e informa recebido/esperado | `tests/versioning/release-policy.mjs:31-32` só testa bloqueio sem override e apenas `/vMAJOR.MINOR.PATCH/`. Em produção, `scripts/versioning/release-policy.mjs:63-84` permite converter esse erro em `overridden`; probe retornou `outcome: "overridden"` para `release-2` | ❌ FAIL |
| VER-02.5 | Divergência bloqueia e registra quatro valores | `tests/versioning/release-policy.mjs:33-40` divide versão e bump em casos distintos; nenhuma assertion verifica planned/calculated version+bump no mesmo diagnóstico | ⚠️ EVIDENCE GAP |
| VER-02.6 | Add/remove/replace de milestone reexecuta com metadados atuais | `examples/callers/go/.github/workflows/go-publish.yml:5` omite `milestoned` e `demilestoned`; `tests/versioning/workflow-contract.mjs:65-66` chama a lista incompleta de “every PR policy change” | ❌ FAIL |
| VER-03.1 | Divergência sem label permanece bloqueada | `tests/versioning/release-policy.mjs:49` - expected outcome `blocked` com `labelPresent: false` | ✅ PASS |
| VER-03.2 | Timeline identifica autor da aplicação vigente | `tests/versioning/pr-policy.mjs:53-60` - label presente, `labeledBy === 'alice'`, role atual e paginação da timeline | ✅ PASS |
| VER-03.3 | Labeler abaixo de Maintain bloqueia e registra tentativa | `tests/versioning/release-policy.mjs:50` prova somente outcome `blocked`; não há assertion da identidade/role/diagnóstico registrado | ⚠️ EVIDENCE GAP |
| VER-03.4 | Falta de aprovação posterior, distinta e autorizada bloqueia | `tests/versioning/release-policy.mjs:51-55` - role `write`, mesma pessoa, aprovação anterior e timestamp inválido resultam `blocked` | ✅ PASS |
| VER-03.5 | Dois autorizadores válidos aceitam e registram identidades, horários e valores | `tests/versioning/release-policy.mjs:42-47` - outcome e quatro campos de audit; não há assertion dos quatro valores comparados no payload overridden | ⚠️ EVIDENCE GAP |
| VER-03.6 | Mesma pessoa não pode aplicar e aprovar | `tests/versioning/release-policy.mjs:52` - expected outcome `blocked` | ✅ PASS |
| VER-03.7 | Commit/milestone/label/review novo invalida autorização anterior | `tests/versioning/release-policy.mjs:49,56` cobre label ausente e SHA de review antigo. `scripts/versioning/collect-pr-policy.sh:84-88` seleciona qualquer review `APPROVED` e não invalida uma aprovação posteriormente dismissed; eventos de milestone também faltam | ❌ FAIL |
| VER-03.8 | Falha em timeline/role/review falha fechado | `tests/versioning/pr-policy.mjs:68-69` - API/incomplete status não zero; `tests/versioning/post-merge.mjs:100-105` - erro de API falha antes de write | ✅ PASS |
| VER-04.1 | PR para develop calcula no SHA em modo somente leitura | `tests/versioning/pr-check.mjs:57-63` - phase/version/bump/guide exatos; `tests/versioning/pr-check.mjs:69-71` - sem release call, HEAD/tag preservados | ✅ PASS |
| VER-04.2 | Relatório nativo é a fonte da seção de versionamento | `tests/versioning/homologation-guide.mjs:37,44-45` - native explanation preservada no JSON e renderizada de forma segura; `tests/versioning/pr-check.mjs:62` - Markdown contém explicação nativa | ✅ PASS |
| VER-04.3 | Markdown e JSON contêm versão, explicação, SHA, PR, mudanças, CI e checklist | `tests/versioning/homologation-guide.mjs:31-46` afirma todos os campos no JSON, mas no Markdown só candidate e seção de sugestões; não afirma SHA/PR/mudanças/checks no Markdown | ⚠️ EVIDENCE GAP |
| VER-04.4 | Summary humano e dois artifacts, sem commit | `tests/versioning/workflow-contract.mjs:32-37` afirma upload obrigatório dos dois arquivos; `tests/versioning/pr-check.mjs:69-71` afirma ausência de release/alteração de HEAD/tag. Nenhum teste define `GITHUB_STEP_SUMMARY` e afirma seu conteúdo | ⚠️ EVIDENCE GAP |
| VER-04.5 | Falta de relatório nativo falha sem explicação inventada | `tests/versioning/homologation-guide.mjs:49-52` - arquivo ausente retorna status não zero | ✅ PASS |
| VER-04.6 | Facts e sugestões permanecem separados | `tests/versioning/homologation-guide.mjs:38-42,46` - arrays exatos, `suggestedChecks` ausente em facts e status pending | ✅ PASS |
| VER-05.1 | Push mergeado em master publica somente após CI do consumidor | `tests/versioning/workflow-contract.mjs:69-71` - push master e `needs: go-ci`; `tests/versioning/post-merge.mjs:92-95` - gate válido/no-milestone passa | ✅ PASS |
| VER-05.2 | Evento fora de push/master/PR único develop→master é recusado | `tests/versioning/post-merge.mjs:96-105` - evento, ref, SHA, remoto, head, ambiguidade e API falham antes de writes | ✅ PASS |
| VER-05.3 | Publicação recalcula uma vez e revalida policy atual | `tests/versioning/post-merge.mjs:99-105,125-131` - policy inválida bloqueia; primeira publicação chama adapter exatamente uma vez | ✅ PASS |
| VER-05.4 | Environment informado bloqueia o write job até aprovação | `tests/versioning/workflow-contract.mjs:42-49` - input não vazio cria job com environment e publish exige result success/skipped | ✅ PASS |
| VER-05.5 | Environment omitido permite publicação depois de CI/checks | `tests/versioning/workflow-contract.mjs:42-49,69-71` - default vazio, skipped aceito e caller exige CI | ✅ PASS |
| VER-05.6 | Tag/release no SHA integrado e notas do report | `tests/versioning/post-merge.mjs:125-130` - outcome, tag SHA, release target SHA, explicação e cálculo único; não há assertion de `tag_name/version` na primeira publicação | ⚠️ EVIDENCE GAP |
| VER-05.7 | Mesmo version/SHA retorna `already-published` sem duplicar | `tests/versioning/post-merge.mjs:133-138` afirma dez reruns no mock. Porém o mock sempre devolve `Sha` (`tests/versioning/post-merge.mjs:34`). O binário real omite `Sha` em commit tagueado; `scripts/versioning/version-report.mjs:68-70` rejeita antes de reconciliar. Probe real de `collect-version-report.sh` saiu 1 com `SHA calculado diverge ...: <vazio>` | ❌ FAIL |
| VER-05.8 | Conflito de tag ou release não move/sobrescreve nem cria efeito parcial | `tests/versioning/post-merge.mjs:145-152` cobre tag em outro SHA e release sem tag; não cobre release existente com a tag correta e `target_commitish` divergente | ⚠️ EVIDENCE GAP |
| VER-05.9 | Publicações concorrentes serializam sem cancelamento | `tests/versioning/workflow-contract.mjs:50-51` - group por repository/branch e `cancel-in-progress: false` | ✅ PASS |
| VER-05.10 | Escrita limitada a `contents: write` no job publicador | `tests/versioning/workflow-contract.mjs:52-55` - permission block exato e write job sem environment dinâmico | ✅ PASS |
| VER-06.1 | PR/push monitorado executa versioning além de Maven/npm | `tests/versioning/workflow-contract.mjs:56-63` afirma setup e comandos versioning, mas não afirma triggers monitorados nem preservação dos jobs Maven/npm | ⚠️ EVIDENCE GAP |
| VER-06.2 | Suíte cobre positivos e negativos de milestone, override, guia, idempotência e publicação | Existem fixtures, mas faltam invalid-milestone+valid-override, review dismissed, evento real de milestone, release divergente e artifact oversized | ❌ FAIL |
| VER-06.3 | Hosted Go instala revisão fixa e prova bootstrap/patch/minor/major/sprint | `tests/versioning/workflow-contract.mjs:59-63`; `tests/versioning/real-go-gitsemver.mjs:49,91,95,99,104-105` - versões exatas | ✅ PASS |
| VER-06.4 | Qualquer falha da suíte faz o check falhar | `tests/versioning/runner-self-test.mjs:16-19` - child status 7 propagado e fixture identificada; CI executa runner sem bypass | ✅ PASS |
| VER-06.5 | Caller Go copiável só repassa configuração | `tests/versioning/workflow-contract.mjs:69-76` afirma refs imutáveis e ausência de bypass, mas `examples/callers/go/.github/workflows/go-publish.yml:14-17` não concede `checks: read`. O callee exige a permissão em `.github/workflows/version-preview.yml:42-46` e chama check-runs em `scripts/versioning/preview.sh:47-48`; reusable workflows não elevam permissões do caller | ❌ FAIL |
| VER-06.6 | Docs identificam checks e proteção contra push direto | `docs/versioning.md:112-128` contém a orientação, mas nenhum teste em escopo afirma esses outcomes documentais | ⚠️ EVIDENCE GAP |

**Acceptance-criterion status**: 25/41 matched the exact spec outcome; 16 failed or lack precise assertion evidence; 0 spec-precision gaps (the spec is precise enough).

---

## Edge Cases

| Edge case | Evidence | Result |
| --------- | -------- | ------ |
| Maior tag SemVer alcançável é a base | `tests/versioning/version-report.mjs:22-32` - `selectReachableStableTag(...) === '0.2.0'` | ✅ PASS |
| Maior tag global fora do histórico é ignorada | `tests/versioning/version-report.mjs:27-32` - `v9.0.0` em branch não alcançável e resultado `0.2.0` | ✅ PASS |
| Associação ausente/ambígua ao SHA bloqueia | `tests/versioning/pr-policy.mjs:63-69`; `tests/versioning/post-merge.mjs:99-105` | ✅ PASS |
| Remoção do override invalida exceção | `tests/versioning/release-policy.mjs:49` - `labelPresent: false` resulta `blocked` | ✅ PASS |
| Papel rebaixado antes da avaliação bloqueia | `tests/versioning/release-policy.mjs:50-51` - `triage`/`write` resultam `blocked` | ✅ PASS |
| Resposta perdida depois de criar release reconcilia | `tests/versioning/post-merge.mjs:158-161` - race-release retorna `already-published` | ✅ PASS |
| Artifact acima do limite falha com diagnóstico e mantém summary | Nenhuma fixture cria artifact oversized, verifica diagnóstico ou preservação de `GITHUB_STEP_SUMMARY` | ❌ GAP |

**Edge-case status**: 6/7 covered.

---

## Gate Check

- **Build command**: `node tests/versioning/run.mjs --local && python -c "import glob,yaml; [yaml.safe_load(open(p,encoding='utf-8')) for p in glob.glob('.github/workflows/*.yml')]"` executado com Git Bash para os fixtures.
- **Result**: PASS. 9 deterministic fixtures passed; 0 failed; 0 skipped. Todos os workflows YAML foram carregados pelo PyYAML.
- **Observed assertion evaluations**: 210. Os textos hard-coded reportam 212, mas `post-merge.mjs` executa 61 (não 62) e `runner-self-test.mjs` executa 4 (não 5).
- **Hosted Go command**: binário instalado em `GOBIN` temporário na revisão `680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6`; `node tests/versioning/real-go-gitsemver.mjs` PASS com 20 assertion evaluations, 0 failures, 0 skips.
- **Before feature**: 6 fixture files existed at `59663cd`; 13 exist after the feature (`+7`). A dynamic baseline assertion total was not recorded. The three deterministic baseline files contain 51 static assertion sites.
- **Diff hygiene**: `git diff --check 59663cd..HEAD` PASS.

---

## Discrimination Sensor

Temporary detached worktree: `HEAD=eeda55e`. The real-tree porcelain baseline was empty and remained byte-for-byte empty after sensor cleanup. No stash was used.

| Mutation | Fault | Relevant gate | Result |
| -------- | ----- | ------------- | ------ |
| M1 authorization | `scripts/versioning/release-policy.mjs:4` accepted `triage` as authorized | `node tests/versioning/release-policy.mjs` | ✅ KILLED at `tests/versioning/release-policy.mjs:50` (`blocked` became `overridden`) |
| M2 post-merge provenance | Removed both `develop`-source guards in `collect-pr-policy.sh` and `release-gates.sh` | `node tests/versioning/post-merge.mjs` | ✅ KILLED at `tests/versioning/post-merge.mjs:104` for `wrong-head` |
| M3 idempotent publication | Existing identical release reported `published` instead of `already-published` | `node tests/versioning/post-merge.mjs` | ✅ KILLED at `tests/versioning/post-merge.mjs:136` |

**Sensor depth**: proportional, 3 high-risk behavior mutations.
**Result**: 3/3 killed. One preliminary single-layer provenance edit was behaviorally neutral because the second independent guard still enforced the outcome; it was excluded from the mutation count.

---

## Code Quality

| Principle | Status | Evidence |
| --------- | ------ | -------- |
| Minimum code / no unnecessary abstraction | ✅ | Small scripts and pure evaluators stay scoped to the feature. |
| Surgical changes / no unrelated scope | ✅ | `git diff --stat 59663cd..HEAD` is limited to versioning, CI, caller, docs and TLC artifacts. |
| Matches repository patterns | ✅ | Node fixtures, Bash orchestration and pinned Actions match existing conventions. |
| Spec-anchored outcome check | ❌ | 16 ACs fail or lack exact payload assertions. |
| Per-layer coverage expectation | ❌ | Missing real collector retry, review dismissal, milestone events, release-target conflict and artifact-size paths. |
| Payload/conjunction rule | ❌ | Override audit values, no-milestone calculated values and publication tag/version are not asserted as complete conjunctions. |
| Every changed test maps to a requirement/edge/done-when | ✅ | All changed/new tests map to VER-01..VER-06 or listed edge cases. |
| Documented guidelines followed | ✅ | `AGENTS.md` and TLC validation protocol were applied; Build and real-Go gates ran. |

---

## Ranked Fix Plans

### 1. Restore real idempotent publication

- **Priority**: Blocker
- **Root cause**: the real `go-gitsemver` returns an empty `Sha` on the already-tagged commit; `normalizeGoReport` rejects it before reconcile-before-write.
- **Fix task**: in `scripts/versioning/version-report.mjs`/collector, allow empty native SHA only when the exact native candidate tag resolves to the evaluated SHA. Keep all other empty/mismatched SHAs closed. Extend `tests/versioning/real-go-gitsemver.mjs` through `collect-version-report.sh` and an idempotent publication/reconciliation path.
- **Verify**: pinned real binary; first publish then rerun returns `already-published`; wrong/missing tag still fails.

### 2. Make invalid milestone non-overridable

- **Priority**: Blocker
- **Root cause**: every policy reason, including invalid milestone syntax, flows into the override branch.
- **Fix task**: distinguish non-overridable invalid contract input from overridable version/bump divergence. Add an invalid-title plus otherwise-valid two-maintainer override case that remains `blocked` and asserts received/expected diagnostics.
- **Verify**: `node tests/versioning/release-policy.mjs` plus preview/post-merge integration.

### 3. Repair caller event and permission contracts

- **Priority**: Major
- **Root cause**: caller omits `milestoned`, `demilestoned`, and `checks: read`.
- **Fix task**: add both activity types and caller permission; update reusable-workflow comments/docs. Strengthen `workflow-contract.mjs` to reject their absence and assert CI triggers plus Maven/npm coexistence.
- **Verify**: static contract and a develop preview fixture with check-runs access assumptions represented.

### 4. Invalidate dismissed/stale approvals completely

- **Priority**: Major
- **Root cause**: collector chooses any historical `APPROVED` review after the label and ignores later dismissal/current review state.
- **Fix task**: derive the current effective review state per reviewer (including dismissed/changed reviews), then select only a current approval after the active label for the current SHA. Add dismissal and relabel/reapprove sequences.
- **Verify**: deterministic `gh` pagination fixture plus preview and post-merge policy gates.

### 5. Close assertion and edge-case gaps

- **Priority**: Major
- **Root cause**: several conjunction payloads and failure paths are observed only partially or not at all.
- **Fix task**: assert no-milestone calculated fields; all four divergence values; full override audit payload; all Markdown fields and step summary; first-publication tag/version; existing release with divergent target; oversized artifact failure with retained summary; documentation requirements. Replace inaccurate hard-coded assertion counts with instrumentation or correct counts.
- **Verify**: Build gate reports internally consistent counts and every row above has one exact assertion citation.

---

## Requirement Traceability

| Requirement | Declared status | Verifier status |
| ----------- | --------------- | --------------- |
| VER-01 | Complete | ✅ Verified |
| VER-02 | Complete | ❌ Needs Fix |
| VER-03 | Complete | ❌ Needs Fix |
| VER-04 | Complete | ❌ Needs Fix |
| VER-05 | Complete | ❌ Needs Fix |
| VER-06 | Complete | ❌ Needs Fix |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 25/41 ACs matched; 16 failed or lacked precise assertion evidence; 0 spec-precision gaps.
**Edge cases**: 6/7 covered.
**Sensor**: 3/3 behavior mutants killed.
**Gate**: local Build PASS (9 fixtures, 210 observed assertion evaluations); pinned real-Go fixture PASS (20 assertion evaluations).

The passing gates do not establish the required production outcome because the real tagged-commit path fails in the new collector, invalid milestone syntax is overrideable, and the copyable caller cannot reliably re-evaluate milestone changes or read check runs. Apply the ranked fixes and re-run an independent verifier.
