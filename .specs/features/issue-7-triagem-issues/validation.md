# Validation: Triagem reutilizável de issues — FAIL

**Date:** 2026-10-14  
**Diff range:** `5332bd2..f3448a197c92ce728ecf5487b13ff559f8e46acc`  
**Verifier:** agente independente, author != verifier.  
**Escopo:** T1–T7; scripts/triage, extensões scripts/llm, workflows e caller. T8 não executada.

O gate funcional local passa, mas a validação independente local é **FAIL**: a suíte não detecta a perda da vinculação do inspector ao run atual (M5). A implementação atual faz a checagem; não foi confirmado defeito de execução nesse caminho. A feature inteira permanece **não concluída**, também por TRI-24/25 e piloto real obrigatório pendentes. Fixtures, Docker simulado e lint Windows não homologam GitHub Actions, inferência ou refresh reais.

## Gates e integridade

| Gate executado | Evidência observada |
| --- | --- |
| `npm --prefix scripts/llm test` na árvore real | exit 0; 141 passaram, 0 falharam, 0 skipped |
| `npm --prefix scripts/llm run check` | exit 0; syntax/check dos scripts e testes descobertos |
| `npx --yes --package=node@22.23.3 node --test tests/llm/*.test.mjs tests/triage/*.test.mjs` | exit 0; 141 passaram, 0 falharam, 0 skipped |
| actionlint 1.7.12 Windows | exit 0 nos seis arquivos de `scripts/llm/lint-workflow.mjs` |
| Baseline scratch, histórico disponível | 141 passaram, 0 falharam, 0 skipped |
| Gate de conclusão TLC | FAIL esperado, feature não pronta; relatório contém verdict FAIL e evidências |

Actionlint usado: `C:/Users/gerso/AppData/Local/Temp/issue-7-actionlint-64a4bed43382473b893691269320484d/actionlint.exe`. Argumentos: `-shellcheck=`, `-pyflakes=`, `-ignore 'unexpected key "queue" for "concurrency" section'`, `-ignore 'property "workflow_(repository|sha)" is not defined'`. Nenhuma outra exceção. Arquivos: `.github/workflows/{llm-execute,issue-triage,ci}.yml`, `examples/callers/llm/.github/workflows/llm.yml`, `examples/callers/llm/variants/llm-api-key.yml`, `examples/callers/triage/.github/workflows/triage.yml`.

O script npm `lint:workflow` exige Linux amd64; não executado no Windows. A execução direta do binário Windows cobre os mesmos seis workflows. Duas tentativas iniciais de seleção de arquivos foram inválidas: uma glob de caller não expandida e uma descoberta ampla que incluiu GitVersion/Go fora do gate. Ambas foram corrigidas pela lista exata acima; não são falhas dos workflows da feature.

Integridade dos testes: 91 casos centrais existentes preservados (baseline registrado em `.specs/features/issue-9-llm-centralizado/validation.md:60`), mais 50 da triagem observados no runner. O diff dos testes antigos muda somente as listas fechadas de inputs/secrets em `tests/llm/workflow.test.mjs:114`, para a extensão compatível aprovada. Nenhuma assertion de evento, auth, SHA, persistência ou falha foi removida. Contagem é observação, não meta.

## Critérios rederivados da spec

As conclusões abaixo vêm dos resultados exigidos pela spec e das assertions, sem usar o ledger como prova. “Conforme local” significa código/contratos/API simulada, não execução remota.

| AC | Resultado exigido | file:line + assertion/evidência | Veredicto |
| --- | --- | --- | --- |
| TRI-01 | Origem issue.opened e identidade repo/issue única com serialização | `tests/triage/caller.test.mjs:23`: issues.types = ['opened']; `tests/triage/collect.test.mjs:40`: snapshot.issue.number = 7; `tests/triage/workflow.test.mjs:115`: cancel-in-progress false, queue max; `:116`: grupo contém repo/issue | Conforme contrato local; fila real em T8 |
| TRI-02 | Dispatch reconsulta issue real no repo atual | `tests/triage/collect.test.mjs:58`: body novo da API; `:59`: duas consultas ['issue','owner/app',7], ignorando body forjado | Conforme local |
| TRI-03 | Recusar origem/ator inelegível antes de auth | `tests/triage/collect.test.mjs:74`: reject UNTRUSTED_CONTEXT para público/fork/read/PR/branch; `tests/triage/central.test.mjs:92`: rejeição; `:93`: authUsed = false; `:94`: artefatos [] | Conforme local; M1 killed |
| TRI-04 | Modalidade/credenciais/modelo/effort/template próprios | `tests/triage/caller.test.mjs:26`: chatgpt-session/CLI_CODEX_SESSION; `:28`: secrets explícitos; `tests/triage/central.test.mjs:62`: consumer-patch; `:63`: high; `:64`: Own patch prompt; `:68`: read token ausente do processo LLM | Conforme local |
| TRI-05 | Body <=16 KiB, contexto <=32 KiB, sem truncar | `tests/triage/collect.test.mjs:101`: body de 16384 aceito; `:104`: excesso de body/context rejeita INVALID_TRIAGE_INPUT; `:105`: fonte intacta; `tests/triage/workflow.test.mjs:157`: outputs <8192; `:158`: sem body/token | Conforme local |
| TRI-06 | Evento real/default config/repo validados; dispatch v1 preservado | `tests/triage/central.test.mjs:179`: phases reais do runner recusam plataforma/config Git SHA divergentes; `:115`: schema v1 manual; `:116`: sem config_source_sha no legado; `tests/llm/preflight.test.mjs:29`: repo/fork rejeitados | Conforme local |
| TRI-07 | Base SHA e config SHA separados, artefato na identidade correta | `tests/triage/central.test.mjs:60`: source b*40; `:61`: config a*40; `tests/triage/collect.test.mjs:42`: release SHA; `tests/triage/caller.test.mjs:61`: issue/source/config/fingerprint forjados rejeitados. `examples/callers/triage/.github/triage/inspect-result.mjs:28` vincula repo/run/attempt, mas M5 sobrevive | **GAP de discriminação da identidade do run** |
| TRI-08 | Dados API-backed com proveniência/paginação | `tests/triage/collect.test.mjs:45`: epic 3; `:46`: source project; `:47`: field F0; `:95`: source issue/id100/value Team; `:118`: blocker 101; `:154`: item ITEM; `:156`: quatro campos; `:157`: valores exatos | Conforme local |
| TRI-09 | MAJOR/High/Team e não simples completos geram plan | `tests/triage/policy.test.mjs:34`: deepEqual plan/SDD_REQUIRED; `:43`: blocker aberto = plan/BLOCKED; `:57`: High incompleto ainda planeja | Conforme local |
| TRI-10 | Somente Bug/Task Low XS/1 ou S/2 com base habilita patch | `tests/triage/policy.test.mjs:41`: deepEqual propose-patch/SIMPLE_ELIGIBLE; `:44`: blocker fechado permite; `:51`: combinações incoerentes/base ausente não permitem | Conforme local |
| TRI-11 | Ausência/ambiguidade = needs-human, sem código | `tests/triage/collect.test.mjs:85`: needs-human; `:86`: complete false; `tests/triage/workflow.test.mjs:79`: needs-human, pr null, motivo METADATA_INCOMPLETE | Conforme local |
| TRI-12 | Comentário SDD rascunho com contexto/proposta/riscos/próximos passos, sem patch | `tests/triage/publish.test.mjs:68`: headings exigidos; `:69`: summary/base; `:70`: apenas comment, zero PR; `tests/triage/central.test.mjs:102`: patch no plan rejeitado | Conforme local |
| TRI-13 | Validar envelope/identidade/hashes/paths/aplicabilidade antes de escrever | `tests/triage/patch.test.mjs:35`: conteúdo aplicado new; `:36`: fonte old; `:38`: parent SHA; `:51`: inválidos rejeitados; `tests/triage/publish.test.mjs:126`: patch substituído rejeitado; `:127`: writes []; `tests/triage/caller.test.mjs:63`: instruction hash alterado rejeitado. M5 testa identidade inspector | **GAP de teste de run do inspector**, demais caminhos conformes |
| TRI-14 | Base release/milestone ou empilhamento confiável; body não autoriza | `tests/triage/policy.test.mjs:63`: body master resulta release/v1.0.0; `:65`: stacking feature/dependency; `:66`: sem milestone null; `:67`: traversal null; `tests/triage/collect.test.mjs:41`: branch release real | Conforme local; M2 killed |
| TRI-15 | Branch dedicada, PR draft, base/Refs/milestone/reviewer, sem fechar issue | `tests/triage/publish.test.mjs:85`: draft true/base release/SHA; `:86`: head dedicado/milestone1/reviewer; `:87`: Refs #7 e sem closes/fixes/resolves; `tests/triage/publication-api.test.mjs:30`: parent/tree/message exatos no payload | Conforme local |
| TRI-16 | Patch vazio/proibido/inaplicável/base avançada não gera PR | `tests/triage/patch.test.mjs:51`: rejects casos; `tests/triage/publish.test.mjs:77`: needs-human/zero PR sem preparado; `:141`: late base = STALE_TRIAGE_INPUT e writes [] | Conforme local |
| TRI-17 | Checks confiáveis sem sessão/PAT/escrita e isolamento produto | `tests/triage/verify.test.mjs:20`: flags de rede/caps/readonly; `:22`: um mount; `:23`: sem socket/PID/env auth; `:24`: imagem e comando go/test/./... exatos; `:25`: env somente PATH/SystemRoot/DOCKER_CONFIG; `tests/triage/patch.test.mjs:64`: Codex auth undefined | Conforme contrato simulado; M4 killed; Docker real pendente |
| TRI-18 | Checks falhos mantêm PR draft com falha rastreável | `tests/triage/verify.test.mjs:34`: failed e CHECK_TIMEOUT/CHECK_FAILED; `tests/triage/publish.test.mjs:83`: draft-checks-failed; `:85`: draft true; `:87`: body contém failed | Conforme local |
| TRI-19 | Serializar/reutilizar próprios sem sobrescrever humano | `tests/triage/workflow.test.mjs:115`: fila sem cancelamento; `tests/triage/publish.test.mjs:67`: mesmo comment_id, um comentário; `:84`: um PR/ref, writes inalterados; `:116`: edição humana permanece e conflito; `:131`: marcador copiado humano preservado | Conforme local; M3 killed |
| TRI-20 | Revalidar entrada/base/config/open, STALE_TRIAGE_INPUT antes de publicar | `tests/triage/publish.test.mjs:97`: fingerprint/source/config alterados reject STALE_TRIAGE_INPUT e writes []; `:141`: mudança tardia sem escrita; `scripts/triage/publish.mjs:48`: exige issue aberta | Conforme local; encerramento tem guard explícito |
| TRI-21 | Erro parcial reconsulta recurso, sem retry cego/inferência duplicada | `tests/triage/publish.test.mjs:108`: recuperação planned/draft após timeout; `:109`: um comentário/PR; `:110`: uma criação por tipo; `tests/triage/publication-api.test.mjs:50`: POST único na falha | Conforme local; M6 killed |
| TRI-22 | Erros sanitizados, sem falso sucesso/interação | `tests/triage/central.test.mjs:140`: AUTH_PERSIST_FAILED; `:142`: artefatos []; `:143`: auth ENOENT; `tests/triage/publish.test.mjs:133`: erro/message TRIAGE_PUBLISH_FAILED; `tests/triage/workflow.test.mjs:138`: runner status1/ARTIFACT_FAILED/outputs failed | Conforme local |
| TRI-23 | Caller adotável com contrato explícito | `tests/triage/caller.test.mjs:23`: eventos/inputs; `:28`: secrets; `:30`: permissões; `:31`: pin existe e contém workflow; `:34`: config SHA; `:35`: source SHA; revisão manual de YAML/config/prompts em `examples/callers/triage/` | Conforme escopo local aprovado; instruções de adoção extensas adiadas expressamente, ativação remota pendente |
| TRI-24 | Duas execuções reais novas/saída válida/secrets ausentes; refresh real ou pendente explícito | **Sem evidência real**; T8 unchecked em `tasks.md` | Pendente obrigatório, fora do verdict funcional local |
| TRI-25 | Piloto recusa snapshot/conflito/persistência, recupera nova execução/sessão | **Sem evidência real**; testes centrais são simulados e não satisfazem AC | Pendente obrigatório |

Precisão: resultados locais têm estados/limites/identidades definidos pela spec/design. Nenhum gap de precisão local identificado. As pendências TRI-24/25 são evidência real ausente, não imprecisão da spec.

## Sensor crítico

Scratch: clone local detached de f3448a1, `C:/Users/gerso/AppData/Local/Temp/triage-verifier-55dfc5863faa4f66933770955d694a00`. Histórico completo permitiu `git show` dos pins dos callers. Baseline completo passou antes das mutações; cada mutação foi aplicada sozinha e revertida por patch antes da próxima. Nenhum stash/reset, alteração de branch de implementação ou mutação na árvore real.

| Mutação | Falha comportamental injetada | Gate e resultado |
| --- | --- | --- |
| M1 | `scripts/triage/collect.mjs:49`: aceitar permission read | collect.test: 8 pass/1 fail, Missing expected rejection em `:74`; killed |
| M2 | `scripts/triage/collect.mjs:88`: sourceSha = config_source_sha, perdendo base release | collect.test: 8 pass/1 fail, a*40 != b*40 em `:42`; killed |
| M3 | `scripts/triage/publish.mjs:60`: own sempre true, tratar recurso humano como próprio | publish.test: 7 pass/1 fail, 1 comentário != 2 em `:131`; killed |
| M4 | `scripts/triage/verify-product.mjs:29`: --network=host em vez de none | verify.test: 1 pass/1 fail, flag obrigatória ausente em `:20`; killed |
| M5 | `examples/callers/triage/.github/triage/inspect-result.mjs:28`: run_id esperado = envelope.run_id, confiando no artefato | caller.test: 2/2 pass; **full npm gate: 141/141 pass**, zero skips; survived |
| M6 | `scripts/triage/publish.mjs:68`: não recuperar após criação ambígua | `node --test --test-name-pattern='timeouts after' tests/triage/publish.test.mjs`: 1 fail, TRIAGE_PUBLISH_FAILED em `:108`; killed |

Resultado: **5 killed, 1 survived; FAIL do sensor**. M6 usa filtro de teste pertinente, não altera nem desabilita testes. M5 é uma alteração válida de semântica, sem erro sintático/infraestrutura; todos os testes continuam verdes apesar da retirada da proteção de identidade.

Isolamento: porcelain da árvore real antes e após sensor = vazio; HEAD preservado f3448a1. Scratch restaurado com porcelain vazio. A revisão automática bloqueou duas tentativas de remoção recursiva da cópia, incluindo caminho literal validado; a cópia limpa permaneceu no Temp. Sem credenciais reais nesse scratch. Únicas alterações reais permitidas nesta verificação: este relatório e lessons produzidas pelo script. Nenhum código/teste/tasks/STATE modificado, commit/push/PR/merge/API real/auth pessoal/Docker real.

## Gaps ranqueados e encaminhamento

1. **P2 — T7, TRI-07/13: teste do inspector não discrimina run incorreto.** `tests/triage/caller.test.mjs:60` varia issue/source/config/fingerprint, mas não run_id. M5 retirou a garantia de `inspect-result.mjs:28` e sobreviveu até ao full gate. Acrescentar caso negativo com envelope válido pertencente a outro run (ou GITHUB_RUN_ID esperado diferente), exigir exit1/INVALID_RESULT, e reexecutar esse sensor. Também conferir run_attempt/repository/invocation_id com assertions de identidade pertinentes, sem meta numérica ou testes de prosa. Não alterar a proteção correta para fazer o teste passar.
2. **Pendência de entrega total — T8, TRI-24/25.** Seleção/provisionamento do consumidor, publicação autorizada do pin e duas execuções reais usando o caller entregue, com conflito/falha/fila/recuperação e logs sanitizados. Docker/Actions reais e refresh permanecem explicitamente não homologados. Não converter esta pendência em aprovação local nem em fixture substituta.

Revisão de qualidade: mudanças coesas aos componentes declarados; reuso do executor e bibliotecas já fixadas; sem novo harness/framework; código de produto não executa no publisher. Diretrizes aplicadas: AGENTS de Context7 (revisão de código é exceção, nenhuma consulta de uso de biblioteca necessária), `.specify/memory/constitution.md` e AD-001–004 em `.specs/STATE.md`. Documentação adiada por autorização explícita registrada em tasks/context; não considerada um defeito novo. Per-layer coverage inclui política, API, runner, publicação stateful e contratos do workflow; o ponto fraco empírico é o consumer inspector. A ausência de infraestrutura real delimita o que este relatório comprova.

Lessons: sinal grounded M5 destilado via `lessons.py` como surviving_mutant, source M5, scope caller-inspector. Script registrou **L-003**, candidate, recurrence 1. Nenhum registro de opinião de metodologia. T1–T6 têm evidência local, T7 aguarda fechar esse gap; T8 continua pendente. Não editar traceability/tasks/STATE durante a revisão.
