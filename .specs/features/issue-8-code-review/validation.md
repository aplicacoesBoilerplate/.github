# Validation: issue-8-code-review — FAIL

Veredito atual, rodada 2: **PASS LOCAL** em `1d2230ea27f55841b6cda38c7b2e01613ffff8b6`. F1 corrigido e pins conferidos. **GLOBAL FAIL / não concluída**, exclusivamente pelo piloto T9/REV-22/23/TRI-24/25 sem evidência real. O fechamento global permanece bloqueado por validate_state. Detalhes da rodada 2 ao final.

## Rodada 1 histórica, preservada

Veredito local T1–T8 + T10: **FAIL**, um defeito P2 em REV-05. A implementação aceita diff com decodificação destrutiva de UTF-8. Os gates existentes passaram; o probe independente expôs o caso ausente.

Feature inteira: **FAIL / não concluída**. Além do defeito local, T9 e REV-22/23 (incluindo TRI-24/25) continuam pendentes. O piloto não é um defeito do código local e fixtures não constituem homologação.

- Data: 2026-10-16, America/Sao_Paulo.
- Verifier: agente independente `/root/issue8_local_verifier`, autor diferente do verificador.
- Workspace exclusivo: `C:/Users/gerso/.codex/worktrees/issue-8-code-review/.github`.
- Branch: `feature/issue-8-code-review`.
- HEAD auditado: `f2c12cc8db3071a79622035272771464717444da`.
- Diff: `745023c..f2c12cc8db3071a79622035272771464717444da`.
- Fontes lidas: spec/context/design/tasks desta feature; constituição `.specify/memory/constitution.md`; código e testes do diff; referências validate/coding-principles/sub-agents/lessons do TLC. Evidência rederivada, sem usar o ledger do autor como prova.

## Gates e integridade

| Gate executado na árvore real | Evidência |
| --- | --- |
| `npx --yes --package=node@22.23.3 node --test --test-reporter=spec tests/llm/*.test.mjs tests/triage/*.test.mjs tests/review/*.test.mjs` | Exit 0; 194 testes, 194 pass, 0 fail, 0 skip, 0 cancelled; 62925 ms |
| `npm --prefix scripts/llm run check` | Exit 0 |
| actionlint Windows 1.7.12 | Exit 0 nos dez YAML; binário `C:/Users/gerso/AppData/Local/Temp/review-actionlint-9e482284f513447183c17c298e019f76/actionlint.exe` |

Actionlint recebeu somente `-shellcheck= -pyflakes= -ignore 'unexpected key "queue" for "concurrency" section' -ignore 'property "workflow_(repository|sha)" is not defined'`. Arquivos: `.github/workflows/{llm-execute,issue-triage,pr-code-review,ci}.yml`, `examples/callers/llm/.github/workflows/llm.yml`, `examples/callers/llm/variants/llm-api-key.yml`, `examples/callers/triage/.github/workflows/triage.yml` e `examples/callers/review/.github/workflows/{triage,review,review-bridge}.yml`.

Integridade: 53 testes novos em `tests/review`, 141 casos legados no gate atual, total 194. O diff não remove testes. A única edição em teste legado atualiza as listas fechadas de inputs/secrets para o perfil novo (`tests/llm/workflow.test.mjs:114`), mantendo assertions de permissões, fila e publicação. A contagem anterior de 141 é rederivada pelo conjunto legado preservado, não uma alegação de execução separada da revisão base.

## Critérios e outcomes confrontados

23 dos 24 critérios locais atendidos; REV-05 falha em um edge case. Dois critérios de piloto sem evidência real. Nenhum gap de precisão da spec foi necessário para explicar o defeito.

| AC | Outcome exigido e evidência `file:line` + assertion | Parecer |
| --- | --- | --- |
| REV-01 | PR atual via API, independentemente da branch de negócio: `tests/review/collect.test.mjs:82` `snapshot.pull.number === 9`, `snapshot.source_sha === f.head`; fixture base release em :43. `tests/review/dispatch.test.mjs:76` status dispatched/recovered e um POST; bridge tipos opened/reopened/synchronize em `tests/review/caller.test.mjs:41`. | Atendido local |
| REV-02 | Origem pública/fork/cross-repo e usuário read recusados: `tests/review/collect.test.mjs:94`–:100 `assert.rejects(...UNTRUSTED_CONTEXT)`; `tests/review/central.test.mjs:87` `authUsed === false`, diretório vazio. | Atendido local |
| REV-03 | Config/default separado do head, instruções confiáveis: `tests/review/collect.test.mjs:83` SHAs exatos; `tests/review/central.test.mjs:73` instrução confiável presente e :74 head instruction ausente. | Atendido local |
| REV-04 | Modelo/esforço/prompt próprios na central: `tests/review/central.test.mjs:66` summary `own-review|high|OWN REVIEW PROMPT`, :69 stage model e task exatos, :96 skip executa somente decisão. | Atendido local |
| REV-05 | Diff incompleto, excesso e bytes não representáveis devem ser inconclusivos: `tests/review/policy.test.mjs:48` rejects truncado/binary; :54 limite 101 arquivos; `tests/review/collect.test.mjs:109`–:116 needs-human/REVIEW_INCONCLUSIVE. Falta UTF-8 inválido no lado antigo/deletado; probe abaixo falhou. | **Falha P2** |
| REV-06 | Identidades e hashes exatos: `tests/review/result.test.mjs:28`–:36 assertions repo/PR/run/attempt/head/base/merge/config/automation/hashes e findings; :61 rejeita identidade divergente. | Atendido local |
| REV-07 | Até 20 achados, severity válida e somente linha adicionada: `tests/review/policy.test.mjs:35` linhas `[2,3,9]`; `tests/review/result.test.mjs:47` rejeita linha inventada e :48 rejeita 21 itens. | Atendido local |
| REV-08 | Resultado inteiro inválido recusado e sanitizado: `tests/review/result.test.mjs:47` INVALID_RESULT, :63–:66 sidecar/patch/extra rejeitados; `tests/review/publish.test.mjs:52` zero writes. | Atendido local |
| REV-09 | Comentário automático, severidades, SHAs e nenhum achado explícitos: `tests/review/publish.test.mjs:13` body inclui valores; :16 `Nenhum achado`; :121 inconclusivo não afirma revisão completa. | Atendido local |
| REV-10 | Sem aprovação/merge/fechamento/Project/Sonar: `tests/review/publish.test.mjs:10` writes somente comment; :14/:31 closing keywords false; inspeção de `scripts/review/publish.mjs:25` e adapter não expõe operações proibidas. | Atendido local |
| REV-11 | Patch interseção diff/allowlist e paths sensíveis recusados: `tests/review/patch.test.mjs:68`–:72 `assert.rejects` INVALID_RESULT/INVALID_REVIEW_PATCH; symlink/submodule :97. | Atendido local |
| REV-12 | Filho do head, fonte intacta, sem hooks/scripts: `tests/review/patch.test.mjs:44` HEAD^ exato, :45 fixed, :46 fonte new, :47 fonte limpa; :86 hook marker ENOENT. | Atendido local |
| REV-13 | Checks container por digest, sem rede/secrets/socket/mount da automação: `tests/review/workflow.test.mjs:55`–:59 flags, mount único, env fechado, root isolado; `tests/triage/verify.test.mjs:20`–:25 flags/env. Docker real não executado. | Contrato local atendido |
| REV-14 | PR complementar draft, base original e pai/árvore exatos: `tests/review/publish.test.mjs:25`–:28 assertions draft/base/ref/parents/tree/message; `tests/review/workflow.test.mjs:70` conteúdo publicado fixed, apesar de mutação no workspace de checks. | Atendido local |
| REV-15 | Checks falhos mantêm draft-checks-failed: `tests/review/publish.test.mjs:22` status exato e :29 body; `tests/review/workflow.test.mjs:68` resultado exato. | Atendido local |
| REV-16 | Integração/branch não corrigível só achados: `tests/review/policy.test.mjs:26` review-only para master/develop/release/unknown; `tests/review/publish.test.mjs:38` nenhuma pull e somente comment. | Atendido local |
| REV-17 | Handoff triagem com origem/run/finish próprios antes de LLM: `tests/review/collect.test.mjs:131` triage/correction e :133 finish failure recusada; `tests/review/dispatch.test.mjs:85` self-run recusado pelo coletor e :87 novo run aceito; `tests/review/caller-integration.test.mjs:130`–:131 review no draft publicado. | Atendido local |
| REV-18 | Reutilizar comentário/PR próprios íntegros: `tests/review/publish.test.mjs:9` mesmo comment ID/um comentário; :22 segundo PR igual/sem writes novos; `tests/review/dispatch.test.mjs:102` correlação exata, :104 run falho não repete POST. | Atendido local |
| REV-19 | Complementar comprovado não gera cadeia; triagem aceita: `tests/review/collect.test.mjs:131` triage correction, :151 skip-correction e :152 ancestry inválida rejeitada; `tests/review/dispatch.test.mjs:155` skipped-correction e posts vazios. | Atendido local |
| REV-20 | Filas por PR/sessão, sem cancelar, novo run após persistência: `tests/review/workflow.test.mjs:93` cancel false/queue max, :97 child sem mesma fila; `tests/review/central.test.mjs:143` chave llm-session; `tests/review/caller-integration.test.mjs:113` sessão renovada capturada, :135 AUTH_SNAPSHOT_STALE. Concorrência real pendente do piloto. | Contrato local atendido |
| REV-21 | Callers copiáveis/secrets/pins/inspector: `tests/review/caller.test.mjs:30` secrets explícitos, :35 dependências de sucesso, :51–:52 pin contém helper e workflow; :78 inspector aceita e :82 recusa identidades alteradas; :85 fonte intacta. Revisão manual README/config: valores genéricos, publicação dos pins ainda necessária. | Atendido local |
| REV-22 | Ciclo real e duas execuções reais da central | **Pendente T9, nenhuma evidência real** |
| REV-23 | Fila/persistência/recuperação/refresh reais TRI-24/25 | **Pendente T9, nenhuma evidência real** |
| REV-24 | Entrada alterada/PR fechado impede escrita obsoleta: `tests/review/collect.test.mjs:101`–:104 STALE_REVIEW_INPUT; `tests/review/publish.test.mjs:43`/:47 código exato e writes vazios; :94 mudança tardia sem escrita. | Atendido local |
| REV-25 | Escrita ambígua reconsulta recursos próprios e preserva humanos: `tests/review/publish.test.mjs:62`–:64 mesmos IDs/um write; :71/:74 corpo humano intacto e zero writes novos; :111 conflito após edição concorrente. | Atendido local |
| REV-26 | API/provider/persistência/upload/cleanup falham explicitamente e sanitizados: `tests/review/central.test.mjs:111`–:115 falha de persistência sem artefato/auth; `tests/review/workflow.test.mjs:81` CHECK_CLEANUP_FAILED, :87 ARTIFACT_FAILED por etapa, :106 upload estrito/retention; `tests/review/publish.test.mjs:96`/:98 erro sanitizado. | Atendido local |

## Defeito e plano de correção

### F1 — P2: recusar UTF-8 inválido no diff antes da inferência (REV-05, T2/T4)

`scripts/review/collect.mjs:140` usa `encoding: 'utf8'` no execFile de Git. Isso substitui sequências inválidas por U+FFFD sem lançar erro. `scripts/review/collect.mjs:144` entrega o texto já alterado ao índice. O decode fatal de blobs em `scripts/review/source.mjs:25` protege apenas arquivos presentes no head; o caminho de deleção em :20 pula o blob ausente. Portanto um diff corrompido no lado antigo pode alcançar a LLM como revisão completa.

Probe executado somente na cópia: reaproveitar `fixture(t)` de `tests/review/collect.test.mjs:19`; gravar `Buffer.from([0xff,10])` em main.go do configRoot, commitar; fetch local no sourceRoot, checkout desse base, `git rm main.go`, commit; atualizar state.branch, state.pull.base.sha, event.sha/workflow_sha para o base e head/expected_source_sha para o novo head; chamar collectReview e prepareReviewSource.

Resultado observado: `{"route":"correction","error_code":"","replacement":true,"source_files":[]}`. Assertion spec-anchored `assert.equal(snapshot.route, 'needs-human')` falhou, actual correction. O `assert.equal(snapshot.error_code, 'REVIEW_INCONCLUSIVE')` esperado também não é satisfeito. Nenhum patch de implementação foi aplicado no probe.

Comando do probe: `npx --yes --package=node@22.23.3 node --test --test-reporter=spec --test-name-pattern='Verifier probe' tests/review/collect.test.mjs`, scratch abaixo; exit 1, um teste/uma falha.

Tarefa de fix: capturar stdout do diff como bytes; validar UTF-8 com decode fatal antes de indexar ou calcular contexto/fingerprint; preservar limites em bytes e erro REVIEW_INCONCLUSIVE. Acrescentar regressões para remoção e lado antigo inválido com head válido, além de UTF-8 válido contendo U+FFFD literal (não rejeitar por busca do caractere). Done when: casos não representáveis retornam needs-human/REVIEW_INCONCLUSIVE e não autenticam LLM; UTF-8 válido mantém comportamento; Full/Build e novo Verifier passam. Sem alterar expectativas anteriores nem tratar piloto como substituto do fix.

## Sensor de discriminação

Profundidade expandida para auth/integridade: sete mutações semânticas independentes, uma por vez, cada alteração revertida antes da seguinte. Clone local `--no-hardlinks --no-checkout`, checkout do HEAD auditado, sem worktree gerenciada e sem stash. Scratch: `C:/Users/gerso/AppData/Local/Temp/review-verifier-8-f2c12cc8`. Dependências: junction para node_modules existente, usado apenas para leitura, sem npm install/ci no scratch.

| ID | Linha original e mutação | Gate/assertion que matou | Resultado |
| --- | --- | --- | --- |
| M1 | `scripts/review/result.mjs:55`, omitir verificação added_lines | result.test, `tests/review/result.test.mjs:47`, missing expected INVALID_RESULT | Killed, 5 pass/1 fail |
| M2 | `scripts/review/collect.mjs:47`, omitir private true | collect.test, `tests/review/collect.test.mjs:94`, missing rejection | Killed, 6/1 |
| M3 | `scripts/review/collect.mjs:68`, incluir read entre writers | collect.test, `tests/review/collect.test.mjs:97`, missing rejection | Killed, 6/1 |
| M4 | `scripts/review/result.mjs:72`, ignorar run_attempt na comparação do envelope | Full scratch; `tests/review/publish.test.mjs:52`, missing INVALID_RESULT para envelope adulterado | Killed; gate result isolado não bastou, Full detectou |
| M5 | `scripts/review/collect.mjs:94`, não exigir finish conclusion success | collect.test, `tests/review/collect.test.mjs:133`, missing UNTRUSTED_CONTEXT | Killed, 6/1 |
| M6 | `scripts/review/publish.mjs:61`, omitir source_sha na comparação atual | publish.test com name-pattern `integration and complementary reviews`, `tests/review/publish.test.mjs:43`, missing STALE_REVIEW_INPUT | Killed, 0/1 |
| M7 | `scripts/shared/verify-product.mjs:28`, network none → host | triage/verify.test, `tests/triage/verify.test.mjs:20`, flag obrigatório ausente | Killed, 1/1 |

Sensor: **7 killed, 0 survived**. M4 teve no Full scratch uma falha ambiental adicional em `tests/triage/caller.test.mjs:41`: cp de junction do node_modules tentou criar symlink Windows sem privilégio (EPERM). Ela não é contabilizada como kill nem defeito da feature; a falha semântica independente em publish.test:52 prova o kill. O gate Full da árvore real passou todos os 194 testes.

`git status --porcelain=v1` real antes do sensor: vazio. Depois de todas as mutações/probe e antes de escrever este relatório/lições: vazio. HEAD permaneceu f2c12cc8db3071a79622035272771464717444da. Não houve alteração de implementação, testes, dependências ou estado Git real pelo sensor.

Limpeza: tentativa PowerShell única validava caminho absoluto exato no Temp e target da junction antes de remover link e scratch. A revisão automática de aprovação rejeitou esse comando inteiro por policy antes de executar. Não houve contorno nem segunda tentativa. Scratch permanece com o probe novo; todas as sete mutações de implementação foram revertidas (git diff scratch mostrou somente +18 linhas em tests/review/collect.test.mjs). A junction ainda aponta para dependências reais e não deve ser percorrida em remoção recursiva. O scratch antigo `triage-verifier-55dfc5863faa4f66933770955d694a00` não foi acessado nem alterado.

## Qualidade, limites e fechamento

Reuso coeso dos contratos centrais e do Git/checks da triagem, schemas v1/v2 preservados e v3 opt-in. As extrações shared permanecem estreitas; testes legados mantidos. Assertions inspecionadas verificam payload e estado (SHA, parent/tree, body, refs, env, quantidade de writes), não somente chamadas. Os testes de domínio/integração mapeiam aos ACs; YAML exige contratos estruturais e runners/transportes são exercitados com serviços simulados. Gap remanescente: old-side UTF-8 inválido, conforme F1.

Candidato descartado, sem lesson: seria incorreto afirmar que o bridge filtra PRs destinados a develop/release só por exigir evento/default. A [documentação oficial atual de pull_request_target](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target), consultada em 2026-10-15, define GITHUB_SHA/GITHUB_REF e contexto do workflow na default do base repository. Isso difere da lembrança histórica de execução na base branch. Context7 não está disponível no inventário desta sessão; fonte oficial usada para refutar o falso positivo. Os guards default atuais são coerentes.

T1–T8 + T10 entregues com gates existentes verdes, mas verificação local falhou em F1. T9 permanece explicitamente não executada. Não houve Docker/LLM reais, uso de auth pessoal/global, escrita externa, provisionamento, push ou commit. Não atualizar status para Verified nem considerar a feature inteira concluída.

Fechamento determinístico executado: `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py issue-8-code-review` retornou exit 1 e `validation.md verdict is FAIL`, um erro, impedindo conclusão da feature. Lesson grounded F1 registrada via lessons.py: **L-004**, candidate, recurrence 1, scope review, source `scripts/review/collect.mjs:140 REV-05 F1`. Nenhum aprendizado baseado no candidato refutado ou no piloto ainda não executado.

## Rodada 2: correção F1 e pins

Data: 2026-10-16. Verifier independente original, sem autoria da correção. Workspace e branch iguais à rodada 1. HEAD `1d2230ea27f55841b6cda38c7b2e01613ffff8b6`; delta auditado `f2c12cc8..1d2230e`; commits `907c00b3f1202ddf811cd7d5578fdeb2b1aed939` (T11) e `1d2230ea27f55841b6cda38c7b2e01613ffff8b6` (T12).

**Parecer local: PASS.** F1 resolvido; nenhum novo gap funcional ou mutante sobrevivente. 24/24 AC locais atendidos dentro dos limites dos serviços simulados já registrados. As 23 conclusões locais anteriores permanecem válidas; o runtime fora do decode não mudou. REV-05 passa com as novas provas abaixo. **Parecer global: FAIL, feature incompleta**, porque T9/REV-22/23/TRI-24/25 continuam sem execução/evidência real. Não usar o parecer local como homologação ou autorização de ativação.

### Outcomes rederivados do delta

| Critério | Código e assertion independente confrontada | Conclusão |
| --- | --- | --- |
| REV-05, F1/T11: old-side não representável não chega como revisão completa | `scripts/review/collect.mjs:139` usa `TextDecoder('utf-8', { fatal: true })`; :140 usa `encoding: 'buffer'`. Erro permanece no catch REVIEW_INCONCLUSIVE de :146. `tests/review/collect.test.mjs:128` executa delete, modify e rename com byte 0xff no lado antigo e head ausente/válido; :148 exige needs-human, :149 REVIEW_INCONCLUSIVE, :150 diff vazio/merge-base null e :151 índice vazio. | Atendido |
| REV-05: U+FFFD literal em UTF-8 válido é texto representável | `tests/review/collect.test.mjs:133` cria bytes UTF-8 válidos, :145 exige correction/error_code vazio, :146 exige caractere literal preservado e um arquivo no índice. Não há busca proibitiva de U+FFFD na implementação. | Atendido |
| REV-05/26: falha ocorre antes de auth/inferência/artefatos | `tests/review/central.test.mjs:116` exige rejeição REVIEW_INCONCLUSIVE; :117 exige `authUsed === false`, `f.calls` vazio e outputRoot vazio, usando Git real temporário e central existente com serviços simulados. | Atendido |
| REV-21/T12: exemplos executam a correção revisada | Três callers, checkouts de automation, AUTOMATION_SHA/EXPECTED_AUTOMATION_SHA e README agora fixam `907c00b3f1202ddf811cd7d5578fdeb2b1aed939`. `git cat-file -t` retornou commit; `git merge-base --is-ancestor 907c00b3 HEAD` exit 0; `git show 907c00b3:scripts/review/collect.mjs` contém decode fatal/buffer; `git diff --quiet 907c00b3 HEAD -- scripts .github` exit 0. Portanto o pin contém o runtime corrigido e o helper, sem autorreferência a commit inexistente. `tests/review/caller.test.mjs:27`/ :33/ :47 exigem os mesmos pins em workflows/checkouts; :51/:52 conferem código no SHA. | Atendido local; publicação remota do pin continua não executada |

### Gates executados nesta rodada

Mesmo comando Full Node 22.23.3 da rodada 1, agora com 196 testes. Primeira execução: exit 1, **195 pass/1 fail/0 skip**, 77565 ms. A única falha foi `EBUSY` do Windows no cleanup `t.after` do fixture de `tests/review/central.test.mjs:100`, definido em :21, ao remover `C:/Users/gerso/AppData/Local/Temp/review-central-lkyO4l/consumer-source`. Não houve assertion funcional falha nesse caso. A evidência não foi ocultada nem reinterpretada como um gate aprovado.

Reexecução direcionada sem mudanças: `npx --yes --package=node@22.23.3 node --test --test-reporter=spec --test-name-pattern='selected source exceeding snapshot size' tests/review/central.test.mjs`: exit 0, 1 pass/0 fail/0 skip. Repetição completa sem rodar testes de scratch simultaneamente: **exit 0, 196 pass/0 fail/0 skip/0 cancelled**, 77882 ms. Esse é o gate final desta rodada. A recorrência do EBUSY não foi observada; não há novo fix funcional exigido.

`npm --prefix scripts/llm run check` exit 0. Actionlint 1.7.12 no mesmo binário e dez YAML da rodada 1, com exatamente as mesmas quatro opções/exceções: exit 0. Nenhuma assertion existente foi enfraquecida/removida: +2 testes de integração; teste de caller alterou somente o SHA esperado.

### Sensor focado no delta

Sete mutações killed da rodada 1 preservadas como evidência dos caminhos inalterados; não repetidas. Novo scratch independente `C:/Users/gerso/AppData/Local/Temp/review-verifier-round2-1d2230e`, clone local sem hardlinks e sem worktree gerenciada/stash; checkout do HEAD desta rodada. Dependências existentes via junction somente leitura. Nenhum scratch com cleanup negado anteriormente foi acessado, removido ou reutilizado.

Baseline no scratch sem mutações: os dois novos testes passaram, 2/2, usando `--test-name-pattern='invalid UTF-8 on the old side|a deletion with invalid old-side' tests/review/collect.test.mjs tests/review/central.test.mjs`.

| ID | Mutação independente em cópia | Evidência de discriminação | Resultado |
| --- | --- | --- | --- |
| M8 | `scripts/review/collect.mjs:139`: `fatal: true` → `fatal: false` | Mesmo comando dos dois novos testes: exit 1, 0 pass/2 fail. `collect.test.mjs:148` recebeu correction em vez de needs-human; `central.test.mjs:116` recebeu INVALID_RESULT posterior em vez de REVIEW_INCONCLUSIVE antes da inferência. | Killed |
| M9 | Restaurar M8 e acrescentar `if (diff.includes('\uFFFD')) fail('REVIEW_INCONCLUSIVE')` após diff | `--test-name-pattern='invalid UTF-8 on the old side' tests/review/collect.test.mjs`: exit 1, 0 pass/1 fail. `collect.test.mjs:145` recebeu needs-human em vez de correction para bytes UTF-8 válidos. | Killed |

Sensor rodada 2: **2 killed, 0 survived**; acumulado das duas rodadas **9 killed, 0 survived**. Mutações revertidas por apply_patch; `git status --porcelain=v1` no scratch depois da restauração retornou vazio. Não houve Docker/LLM reais ou mudança em dependências.

`git status --porcelain=v1` real antes do sensor: vazio. Depois das restaurações e antes desta atualização do relatório: vazio. HEAD real permaneceu `1d2230ea27f55841b6cda38c7b2e01613ffff8b6`. Única escrita real desta rodada é este relatório, mais eventual lesson via script TLC. Implementação/testes permaneceram read-only.

Cleanup do scratch novo: após confirmar o caminho absoluto no Temp e a junction apontando exatamente para node_modules real, uma tentativa nativa PowerShell de remover apenas a junction foi rejeitada automaticamente por policy antes de executar. Não foi repetida nem contornada. O scratch novo e sua junction permanecem, limpos de mutações, sem necessidade de acesso futuro para validar o parecer. Nenhuma remoção recursiva foi executada.

### Fechamento da rodada 2

Pode persistir o relatório e o progresso de T11/T12. F1 não está mais aberto. A tabela e os pareceres da rodada 1 acima são históricos; esta seção é o estado vigente. Piloto T9 continua pendente, sem credenciais/provisionamento, autorização de ativação ou evidência real. validate_state deve manter exit 1 pelo veredito global FAIL; não ajustar o relatório para produzir conclusão global artificial.

Fechamento determinístico efetivamente reexecutado: `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py issue-8-code-review` retornou **exit 1**, um erro `validation.md verdict is FAIL`. Lesson via TLC para o gate inicialmente falho: **L-005**, candidate/recurrence 1, scope tests/windows, source `tests/review/central.test.mjs:21 round2 EBUSY cleanup`, orienta retry limitado de cleanup EBUSY em diretórios Git de fixtures próprios no Windows. É guidance candidata de teste, não novo blocker funcional nem autorização para repetir cleanup que recebeu negação de policy. L-004 permanece como evidência histórica de F1; nenhum aprendizado baseado em piloto não executado.
