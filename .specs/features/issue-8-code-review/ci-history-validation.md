# Validation F2: PASS LOCAL

A CI passa a disponibilizar os commits históricos usados pelos contratos dos callers. O ajuste é suficiente e proporcional à falha de checkout raso relatada. Nenhum gap encontrado nesta revisão focada.

**Limite global:** este parecer valida somente F2/TRI-23 e sua integração na #8. T9/REV-22/23/TRI-24/25 continuam pendentes do piloto real. Não conclui as features, não demonstra nova CI remota e não autoriza ativação/publicação.

- Data: 2026-10-19, America/Sao_Paulo.
- Verifier independente: `/root/issue8_local_verifier`, sem autoria do fix.
- #7: `C:/Users/gerso/.codex/worktrees/issue-7-triagem-issues/.github`, HEAD `549d1dccf872ad016dd99f88cd4d296eeb605eb1`.
- #8: `C:/Users/gerso/.codex/worktrees/issue-8-code-review/.github`, HEAD `076d18a73dfe64a461bad20eaaa08e5368f34041`.
- Diff F2: `549d1dcc^..549d1dcc`; integração #8: `076d18a^1..076d18a`, merge preservando histórico.

## Contrato e revisão do diff

A tarefa F2 em `.specs/features/issue-7-triagem-issues/tasks.md:222` exige que a CI resolva pins históricos preservando testes, credenciais e empilhamento. Ela dá suporte ao caller de TRI-23 (`.specs/features/issue-7-triagem-issues/spec.md:98`) e REV-21 (`.specs/features/issue-8-code-review/spec.md:99`).

O delta executável é uma linha de configuração e três linhas de teste:

| Outcome | Evidência `file:line` e assertion | Parecer |
| --- | --- | --- |
| Histórico disponível no job dos contratos | `.github/workflows/ci.yml:23` fixa `fetch-depth: 0` no checkout do job llm. `tests/llm/ci.test.mjs:12` exige `checkout.with['fetch-depth'] === 0`. | Atendido |
| Credencial de checkout não persistida | `.github/workflows/ci.yml:24` mantém `persist-credentials: false`; `tests/llm/ci.test.mjs:13` exige exatamente false. `tests/llm/ci.test.mjs:23` mantém permissões contents read. | Atendido |
| Pins reais continuam consultados, sem skip/fallback | `tests/triage/caller.test.mjs:31` executa git show no pin `3f7ec89a9e2457e1e839a22d6db6f9dc1c4784f6` e exige workflow_call. `tests/review/caller.test.mjs:51` exige dispatchReview no pin `907c00b3f1202ddf811cd7d5578fdeb2b1aed939`; :52 exige expected_head_sha no workflow desse SHA. Assertions passaram. `git merge-base --is-ancestor` para ambos os pins no HEAD da #8 retornou exit 0. | Atendido |
| Gates anteriores permanecem obrigatórios | `tests/llm/ci.test.mjs:15`–:18 mantém npm ci/test/check/lint:workflow; :19 impede if nos steps; :20 mantém Node 22.23.3. O diff acrescenta assertions, sem remover/relaxar as anteriores. | Atendido |
| Escopo mínimo | `git show 549d1dcc` e diff do merge #8 mostram somente ci.yml +1, ci.test.mjs +3, tasks da #7 +16. Runtime, pins, modelos/prompts, secrets, permissões e jobs de produto inalterados. | Atendido |

Fonte oficial verificada: [README de actions/checkout no SHA fixado](https://github.com/actions/checkout/blob/11d5960a326750d5838078e36cf38b85af677262/README.md#fetch-all-history-for-all-tags-and-branches), consultado em 2026-10-19. O padrão busca um commit; profundidade zero busca histórico completo. O mesmo documento descreve persist-credentials false como opt-out. Context7 indisponível nesta sessão; usada a fonte primária da revisão efetivamente executada.

Os runs remotos anteriores 38881461059 (PR #15) e 38881522449 (PR #16) constam do contexto do autor/tarefa como origem de F2. Não foram reexecutados nem inspecionados remotamente pelo Verifier; o parecer se baseia no delta, fonte oficial e gates locais abaixo. A nova CI remota deverá ser observada pelo responsável após publicação autorizada.

## Gates

Esperei o autor concluir seu Full #8 antes de iniciar os testes focados. O autor informou Full #8 196 pass/0 fail/0 skip, 131174 ms; Full #7 141 pass/0 fail/0 skip e check/actionlint verdes são evidências do autor, não execuções minhas nesta rodada.

Gate independente efetivamente executado na árvore real da #8:

`npx --yes --package=node@22.23.3 node --test --test-reporter=spec tests/llm/ci.test.mjs tests/triage/caller.test.mjs tests/review/caller.test.mjs`

Exit 0; **5 pass, 0 fail, 0 skip, 0 cancelled**, 24393 ms. Inclui contrato da CI, consultas aos pins históricos e inspectors dos callers de triagem/review. Não iniciei outro Full concorrente ou duplicado para esta mudança de wiring.

## Sensor de discriminação

Scratch novo e exclusivo: `C:/Users/gerso/AppData/Local/Temp/ci-history-verifier-076d18a`, clone local sem hardlinks, checkout do HEAD #8, sem worktree gerenciada/stash. Node_modules existente acessado via junction somente para leitura; nenhum install ou alteração de dependência.

Mutação única, proporcional ao delta: `.github/workflows/ci.yml:23`, `fetch-depth: 0` → `fetch-depth: 1`. Comando no scratch: `npx --yes --package=node@22.23.3 node --test --test-reporter=spec tests/llm/ci.test.mjs`. Exit 1, 0 pass/1 fail; `tests/llm/ci.test.mjs:12` falhou com `1 !== 0`, identificando que os contratos precisam resolver revisões imutáveis do histórico. **1 killed, 0 survived.**

Mutação revertida via apply_patch. Porcelain do scratch após restauração: vazio. Porcelain real #8 antes do sensor: vazio; depois do sensor/restauração e antes deste relatório: vazio; HEAD permaneceu 076d18a73dfe64a461bad20eaaa08e5368f34041. #7 foi somente inspecionada e estava limpa no início. Nenhum código/teste real foi modificado.

Cleanup: após validar o caminho absoluto do novo scratch no Temp e o target exato da junction, a única tentativa PowerShell de remover essa junction foi rejeitada pela aprovação automática por policy antes de executar. Não repeti nem contornei. Scratch novo retido, sem mutações; junction ainda aponta para node_modules real. Nenhum scratch de rodadas anteriores com cleanup negado foi acessado/reutilizado/removido.

## Encaminhamento

**PASS LOCAL F2.** Pode persistir este relatório e prosseguir com a publicação já autorizada sob responsabilidade do agente principal. Não houve commit, push, escrita remota, credencial real ou execução de produto pelo Verifier. Sem novos gaps, mutantes sobreviventes ou desvios, nenhuma lesson nova. O relatório geral e o piloto T9 permanecem com seus limites anteriores.
