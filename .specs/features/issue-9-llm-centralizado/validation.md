# Validation: issue-9-llm-centralizado — PASS local

**Result**: PASS para o MVP local e a correção LLM-11, após reverificação independente (iteração 1). **Objetivo completo: INCOMPLETE**: homologação real LLM-24 e publicação permanecem pendentes; fixtures não comprovam autenticação real.

**Date**: 2026-10-13. **Verifier**: agente independente, autor ≠ verificador.
**Workspace**: `C:/Users/gerso/.codex/worktrees/issue-9-llm-centralizado/.github`.
**Branch/HEAD**: `feature/issue-9-llm-centralizado`, `46f4fba26e179b3b9ff58d78f75b85341ebd98ad`.
**Diff range**: `15dc8b9..46f4fba26e179b3b9ff58d78f75b85341ebd98ad`; reverificação cirúrgica `80e6586..46f4fba`.
**Spec**: `.specs/features/issue-9-llm-centralizado/spec.md`.

## Veredictos e tarefas

Implementação local: **PASS**, sem defeitos locais reproduzidos pendentes. T1–T11 constam entregues; correção T6/T9 revalidada. T12/manual central extenso é Deferred e não bloqueia este MVP. T13/piloto não foi realizado. Evidência anterior não afetada foi reutilizada; esta revisão se concentra no único gap original, LLM-11.

Objetivo completo: **INCOMPLETE**. Ainda faltam publicação autorizada da revisão central, provisionamento do consumidor e homologação real. Ambos os callers e inspectors fixam `4d635f25e1f41f179d1dece8c20d77be21cb62b2`, contendo a correção e existente localmente (`git cat-file -t` retorna `commit`), ainda não publicado, conforme `examples/callers/llm/README.md:5`. Não houve publicação, PR, login ou inferência real nesta auditoria. Nenhum requisito foi marcado Verified globalmente.

## Falha original corrigida e reverificação

**Gap original LLM-11, agora corrigido.** No HEAD inicial `80e6586`, o retorno sem refresh antecedia a consulta de metadata. A correção `4d635f2` consulta metadata também nesse ramo (`scripts/llm/persist-session.mjs:17`–`:20`), preservando zero PUT. Comparação de timestamps é uma detecção conservadora: GitHub não fornece CAS; não garante atomicidade nem detecta necessariamente alterações externas dentro do mesmo segundo.

Reprodução em scratch, usando a implementação original: metadata inicial `2026-10-13T12:00:00Z`, criação do run `12:00:01Z`, serviço simulado preparado para devolver metadata posterior `12:00:02Z`, execução retorna resposta válida sem alterar `auth.json`. Resultado observado: `{"status":"succeeded","secretMetadataReads":1}` e pacote de resultado criado. Esperado: `AUTH_STATE_CONFLICT`, sem pacote. Todas as credenciais eram fixtures.

Nova evidência: `tests/llm/persistence.test.mjs:56` exige ausência de PUT, `:57` exige GET exato da metadata; `:63` exige AUTH_STATE_CONFLICT para rotação sem refresh e `:65`–`:67` exige AUTH_PERSIST_FAILED para 403. `tests/llm/workflow.test.mjs:86`–`:88` exercita persistência verdadeira com API simulada: conflito rejeitado, output vazio e auth ENOENT. Nenhum stub de persistência nesse teste.

Probe independente em scratch (`tests/llm/reverify-probe.test.mjs:31`–`:35`) chamou runInvocation com persistIfChanged verdadeiro, resposta válida e sessão inalterada. Três cenários aprovados: metadata estável libera sucesso; metadata posterior rejeita AUTH_STATE_CONFLICT; segundo GET 403 rejeita AUTH_PERSIST_FAILED. Todos exigem duas leituras de metadata, zero PUT e auth removida; falhas exigem output vazio. Nenhuma implementação ou teste real foi editado pelo Verifier.

## Critérios de aceitação, resultados esperados e evidência

Resultados "local" abaixo comprovam somente o contrato offline indicado. Não demonstram comportamento do serviço Codex ou GitHub Actions em produção.

| AC | Resultado exigido pela spec | Evidência `file:line` e assertion | Resultado |
| --- | --- | --- | --- |
| LLM-01 | Config/template confiáveis chegam ao prompt escolhido | `tests/llm/request.test.mjs:102`: `assert.equal(prompts.execution, text)`; `tests/llm/execution.test.mjs:76`: `assert.equal(prompt.task, request.prompts.execution)`; `tests/llm/workflow.test.mjs:42`: summary contém modelo/esforço/prompt próprios | Local conforme |
| LLM-02 | Config inválida falha INVALID_CONFIG antes do CLI | `tests/llm/request.test.mjs:12`: `assert.throws(...,{code:'INVALID_CONFIG',message:'INVALID_CONFIG'})`, aplicada a schema/modelo/paths/limites; `scripts/llm/orchestrate.mjs:14` carrega request antes de restoreAuth | Local conforme; disponibilidade de modelo/effort na conta depende do piloto |
| LLM-03 | Single faz exatamente uma chamada | `tests/llm/execution.test.mjs:29`: `assert.equal(f.calls.length,1)` | Local conforme |
| LLM-04 | Proceed inicia segunda etapa configurada; decisão inválida não inicia | `tests/llm/execution.test.mjs:49`: modelos `['decision-model','execution-model']`; `tests/llm/execution.test.mjs:59`: rejeita INVALID_RESULT | Local conforme |
| LLM-05 | Skip/needs-human preservam estado, sem segunda chamada | `tests/llm/execution.test.mjs:47`, `:48`, `:49`: decisão/status exatos e somente modelo de decisão | Local conforme |
| LLM-06 | Credenciais somente do caller/modalidade | `tests/llm/auth.test.mjs:15`, `:16`: bytes/sessão próprios; `:40`: CODEX_API_KEY da fixture; `tests/llm/caller.test.mjs:27`: mapping explícito de secrets | Local conforme |
| LLM-07 | Ausência/conflito falha AUTH_CONFIG_ERROR sem fallback | `tests/llm/auth.test.mjs:56`: `assert.rejects(restoreAuth(...),{code:'AUTH_CONFIG_ERROR',message:'AUTH_CONFIG_ERROR'})`; `tests/llm/workflow.test.mjs:74` | Local conforme |
| LLM-08 | Lock repo/secret, cancel-in-progress false | `tests/llm/workflow.test.mjs:118`, `:119`, `:120`: false, queue max e grupo repo/secret; `.github/workflows/llm-execute.yml:63` | Contrato local conforme; concorrência real pendente |
| LLM-09 | updated_at >= created_at recusa AUTH_SNAPSHOT_STALE | `tests/llm/freshness.test.mjs:9`, `:28`: rejeição exata; `:30`: sessionUsed false; `:37`: igualdade/precisão/timestamp inválido recusados | Local conforme |
| LLM-10 | Refresh persistido somente no repo/secret correntes | `tests/llm/persistence.test.mjs:43`: URL exata; `:49`: `assert.equal(decrypted,refreshed)`; `:96`: preserva refresh mesmo após erro do provider; `:56`, `:57`: metadata sem PUT no ramo inalterado | Local conforme |
| LLM-11 | Falha/conflito invalida resultado | `tests/llm/persistence.test.mjs:63`, `:65`: conflito/403 sem refresh; `tests/llm/workflow.test.mjs:86`, `:87`, `:88`: persistência verdadeira recusa conflito, output vazio, auth ENOENT; probe independente acima | **PASS local** |
| LLM-12 | Credenciais temporárias removidas ao término/erro tratável | `tests/llm/auth.test.mjs:30`, `:31`, `:34`: access rejeita ENOENT; `tests/llm/workflow.test.mjs:58`: diretório removido após erro | Local conforme; modo 0700/0600 condicional Unix não executado no Windows |
| LLM-13 | Fork/evento/revisão não confiável/sessão pública recusados | `tests/llm/preflight.test.mjs:11`: rejeição UNTRUSTED_CONTEXT; aplicada em `:25`, `:30`, `:34`, `:43`, `:45` | Local conforme |
| LLM-14 | Read-only e nenhum token GitHub no processo do modelo | `tests/llm/execution.test.mjs:37`: sandbox read-only; `:40`: GITHUB_TOKEN undefined; `tests/llm/auth.test.mjs:41`: allowlist exclui tokens; `:26`: PAT ausente no filho | Local conforme; sandbox efetivo do CLI real depende do piloto |
| LLM-15 | Global integral e consumer combinados com hashes | `tests/llm/instructions.test.mjs:24`, `:25`, `:29`: conteúdo/fontes/hash exatos; `:92`, `:93`, `:95`: snapshot/proveniência | Local conforme |
| LLM-16 | >64 KiB ou fonte fora da raiz falha INSTRUCTIONS_INVALID | `tests/llm/instructions.test.mjs:56`: 65536 bytes aceitos; `:59`, `:64`, `:73`: helper de `:17` rejeita código exato | Local conforme |
| LLM-17 | Envelope v1 com identidade/proveniência e artefato por tentativa/chamada | `tests/llm/result.test.mjs:17` a `:24`, `:30`: campos exatos; `:38`, `:39`: identidades distintas; `tests/llm/caller.test.mjs:50`, `:51`: inspector rejeita SHA errado | Local conforme |
| LLM-18 | Schema inválido/>1 MiB falha INVALID_RESULT sem sucesso | `tests/llm/result.test.mjs:46`, `:48`: rejeição exata/nenhum pacote; `tests/llm/execution.test.mjs:59`: JSON inválido recusado | Local conforme |
| LLM-19 | Patch é dado vinculado ao SHA; fonte intocada | `tests/llm/result.test.mjs:18`, `:27`: SHA e patch exatos; `:61`: paths perigosos recusados; `tests/llm/execution.test.mjs:32`: fonte intacta | Local conforme |
| LLM-20 | Timeout/provider falha sem retry | `tests/llm/execution.test.mjs:54`, `:55`: PROVIDER_ERROR/uma chamada; `:65`, `:66`: TIMEOUT/uma chamada; executor fixa teto 600000 ms | Local conforme; timeout exercitado com orçamento reduzido |
| LLM-21 | Publicação allowlist, retenção 1 dia, sem secrets/logs | `tests/llm/result.test.mjs:15`: somente result.json/proposal.patch; `:46`: secret leak recusado; `tests/llm/workflow.test.mjs:128`, `:129`, `:145`: retenção 1, overwrite false e falha após upload; `:109`: token renovado recusado | Local conforme |
| LLM-22 | Central/scripts/dependências fixadas/CI e instruções completas do caller | `tests/llm/ci.test.mjs:12` a `:20`: gates/runtime/preservação de CI; `scripts/llm/package.json:13` e lock; revisão manual `examples/callers/llm/README.md:7`, `:17`, `:33`, `:60`, `:72`, `:85` | Entrega local conforme; sem testes de texto; T12 Deferred |
| LLM-23 | Caller ChatGPT e variante API opt-in próprios do consumidor | `tests/llm/caller.test.mjs:25`, `:26`, `:27`: mesma referência/modalidade/mapping; `:47`, `:50`: consumo válido/SHA falso; `examples/callers/llm/.github/workflows/llm.yml:10` | Artefatos locais conformes; publicação/adopção pendentes |
| LLM-24 | Duas execuções reais sequenciais, stale snapshot e persistência recusada | `.specs/features/issue-9-llm-centralizado/spec.md:109`; T13 sem execução e sem `docs/llm-pilot.md`; nenhuma assertion/evidência real | **PENDENTE**, objetivo incompleto |

## Gates e integridade

`npm --prefix scripts/llm test`: **91 aprovados, 0 falhas, 0 skips**, Node **24.19.0**. `npm --prefix scripts/llm run check`: exit 0. Gate independente também executou `npx --yes --package=node@22.23.3 node --version` (v22.23.3) e `npx --yes --package=node@22.23.3 node --test --test-reporter=dot tests/llm/*.test.mjs`: exit 0, 91 testes. Este relatório não afirma execução da imagem Ubuntu ou workflow remoto da CI.

Actionlint **1.7.12 Windows**: exit 0 sobre `.github/workflows/llm-execute.yml`, `.github/workflows/ci.yml`, caller principal e variante API. Flags: `-shellcheck= -pyflakes= -ignore 'unexpected key "queue" for "concurrency" section' -ignore 'property "workflow_(repository|sha)" is not defined'`. O script `lint:workflow` é específico de Linux amd64; foi substituído pelo binário Windows disponibilizado, preservando somente essas exceções precisas. Não houve shellcheck/pyflakes nem execução do workflow remoto.

Baseline `15dc8b9` não possui `tests/llm`; a suite da feature foi adicionada. Nenhum teste preexistente foi removido no diff. A assertion zero requests foi corrigida para o resultado exigido pela spec, com autorização registrada em tasks. A contagem é observação do runner, não meta de entrega. Testes pertinentes mapeiam para contratos/edge cases/tarefas; não foram adicionados testes documentais pelo Verifier.

## Discrimination sensor

Reverificação, scratch `C:/Users/gerso/AppData/Local/Temp/issue-9-reverify-session-20261013`: cópias somente de scripts/llm, dependências e testes persistence/workflow/fixture, mais probe independente. Baseline relevante: 10/10 (7 testes persistence + 3 probes), integração existente selecionada 1/1. Mutação M6 em `scripts/llm/persist-session.mjs:18`: remover GET/comparação no ramo inalterado e retornar imediatamente. **Killed**: testes persistence 2 falhas, probe 3 falhas e integração existente 1 falha, todos por metadata ausente ou rejeição esperada ausente. Sensor novo: **1 injetado, 1 killed, 0 survived**. Evidência anterior de cinco mutações abaixo permanece válida para módulos não afetados; total acumulado 6 killed, sem alegação de cobertura exaustiva.

Scratch restaurado com apply_patch: SHA-256 do módulo idêntico ao real (`D8589649F34053C932B7980C9CEFA75C0CD59B30AF71E033A003DAB4D5D71241`) e baseline repetida 10/10. Porcelain real antes/depois do sensor vazio, HEAD inalterado. Remoção recursiva do caminho absoluto previamente inspecionado foi **rejeitada pela política automática** (blocked by policy); não houve tentativa de contornar. A cópia restaurada/inativa e o probe permanecem nesse caminho, sem credenciais reais. A pendência do scratch anterior abaixo também permanece.

### Evidência histórica da validação inicial (HEAD 80e6586)

Scratch separado: `C:/Users/gerso/AppData/Local/Temp/issue-9-verifier-e1d994d06bae483faf9f79f432cff286`. Foram copiadas as árvores da feature, testes, callers e workflows. Dependências também foram copiadas, sem alteração. Baseline nesse scratch: 89/89. As mutações abaixo foram aplicadas somente com apply_patch no scratch; cada mutação foi depois exercitada individualmente, restaurando as demais.

| Mutação | Código real correspondente | Efeito injetado | Assertion discriminante e resultado individual |
| --- | --- | --- | --- |
| M1 | `scripts/llm/auth.mjs:48` | Herdar GITHUB_TOKEN do runtime | `tests/llm/auth.test.mjs:41`, token fixture ≠ undefined; **killed**, 2 passam/1 falha |
| M2 | `scripts/llm/check-session-freshness.mjs:13` | Trocar >= por >, aceitando timestamps iguais | `tests/llm/freshness.test.mjs:28`, `:37`, faltam rejeições; **killed**, 2 passam/2 falham |
| M3 | `scripts/llm/persist-session.mjs:23` | Criptografar conteúdo errado em vez da sessão renovada | `tests/llm/persistence.test.mjs:49`, `:85`, decrypted ≠ refreshed; **killed**, 4 passam/2 falham |
| M4 | `scripts/llm/orchestrate.mjs:55` | Ignorar falha de upload na finalização | `tests/llm/workflow.test.mjs:114`, `:124`, runner sai 0 em vez de 1; **killed**, 5 passam/2 falham |
| M5 | `scripts/llm/execute.mjs:85` | Usar fallback-model em vez do modelo escolhido | `tests/llm/workflow.test.mjs:42`, summary mostra fallback-model; **killed**, 6 passam/1 falha |

Resultado: **5 killed, 0 survived**. Profundidade manual ampliada por credenciais e integridade de estado; cobre fronteira de ambiente, freshness, bytes persistidos, publicação e escolha do modelo. Não é alegação de mutação exaustiva de todos os ramos. O defeito LLM-11 veio da inspeção/reprodução, apesar dos mutantes acima serem detectados.

Isolamento confirmado antes de escrever este relatório: `git status --porcelain` inicial = vazio; após sensor = vazio; HEAD inalterado. Todos os cinco módulos do scratch foram restaurados e comparados textualmente aos reais, desconsiderando CRLF/LF; probe removido. A política automática rejeitou a remoção recursiva do diretório temporário, mesmo com alvo absoluto validado; a cópia inativa permanece nesse caminho, sem credenciais reais. Nenhum stash, commit ou mutação da implementação/testes reais ocorreu.

## Qualidade, limites e próximas ações

Mudanças estão limitadas aos componentes da feature, CI, caller e artefatos de planejamento. O envelope usa autoridade do runtime e publicação fica condicionada à persistência/upload/cleanup; não há ações de domínio, fallback de identidade ou framework extra. A constituição `.specify/memory/constitution.md` exige contratos explícitos, privilégios mínimos e validação do consumo; a falha original LLM-11 foi corrigida.

LLM-11 corrigido e revalidado; não há nova tarefa de implementação local. Manter LLM-24 pendente até publicação/provisionamento autorizados e execução do piloto real com evidências sanitizadas. Publicação da referência e piloto são ações futuras; sua ausência é declarada, não um bug dos fixtures. A nova TLC de triagem não foi iniciada nesta revisão.

Não foram encontrados outros defeitos locais confirmados nesta revisão. O resultado não comprova elegibilidade da sessão, modelos da conta, rede/sandbox efetivos, permissões reais do PAT, concorrência do GitHub ou recuperação real. UAT visual não se aplica à feature de infraestrutura. Traceabilidade global permanece sem alteração.

## Gate de conclusão e lições

`python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py issue-9-llm-centralizado`: **exit 0**, zero erros. Esse PASS estrutural comprova presença de veredito local e citações; não substitui T13/LLM-24 nem transforma o objetivo completo INCOMPLETE em concluído.

A validação inicial registrou L-001 (metadata também no ramo sem refresh) e L-002 (separar contratos offline de homologação real), candidates fundamentadas em LLM-11/LLM-24. Não houve novo finding nem nova lição nesta reverificação. Única edição real desta iteração: este validation.md; implementação, testes, tasks, spec, lessons e HEAD permanecem inalterados.
