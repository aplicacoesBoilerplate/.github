# Validation: issue-9-llm-centralizado — FAIL

**Result**: FAIL. A implementação local viola LLM-11 quando a secret muda externamente e o CLI não modifica a sessão local. A homologação real LLM-24 permanece incompleta por decisão do mantenedor; fixtures não comprovam autenticação real.

**Date**: 2026-10-13. **Verifier**: agente independente, autor ≠ verificador.
**Workspace**: `C:/Users/gerso/.codex/worktrees/issue-9-llm-centralizado/.github`.
**Branch/HEAD**: `feature/issue-9-llm-centralizado`, `80e658659ab3350cb1b5bdf47d39a2912c758a9c`.
**Diff range**: `15dc8b9..80e658659ab3350cb1b5bdf47d39a2912c758a9c`.
**Spec**: `.specs/features/issue-9-llm-centralizado/spec.md`.

## Veredictos e tarefas

Implementação local: **FAIL**, com um defeito confirmado. Gates existentes passam, mas não cobrem o conflito sem refresh. T1–T11 constam entregues; T6/T9 precisam da correção de LLM-11. T12/manual central extenso é Deferred e não bloqueia este MVP. T13/piloto não foi realizado.

Objetivo completo: **FAIL/incomplete**. Ainda faltam publicação autorizada da revisão central, provisionamento do consumidor e homologação real. O caller fixa `4301c87e422bee521e2dbe0ccd1283b40c76e499`, existente localmente (`git cat-file -t` retorna `commit`), mas ainda não publicado, como declarado em `examples/callers/llm/README.md:5`. Não houve publicação, PR, login ou inferência real nesta auditoria. Nenhum requisito foi marcado Verified globalmente.

## Falha confirmada e ação necessária

**[P1] Revalidar conflito mesmo quando a sessão local não mudou (LLM-11).** `scripts/llm/persist-session.mjs:16` retorna `{ persisted: false }` antes da consulta de metadata em `scripts/llm/persist-session.mjs:25`. Assim, uma intervenção externa ocorrida após o preflight não invalida o resultado se Codex não renovou o arquivo local. `scripts/llm/orchestrate.mjs:47` então empacota o resultado como utilizável. O requisito exige falha quando a secret mudar externamente durante o job, independentemente de haver PUT.

Reprodução em scratch, usando a implementação original: metadata inicial `2026-10-13T12:00:00Z`, criação do run `12:00:01Z`, serviço simulado preparado para devolver metadata posterior `12:00:02Z`, execução retorna resposta válida sem alterar `auth.json`. Resultado observado: `{"status":"succeeded","secretMetadataReads":1}` e pacote de resultado criado. Esperado: `AUTH_STATE_CONFLICT`, sem pacote. Todas as credenciais eram fixtures.

`tests/llm/persistence.test.mjs:56` exige `assert.deepEqual(transport.requests, [])` para sessão inalterada, em vez de exigir somente ausência de PUT. Essa assertion codifica a lacuna. O caso de conflito em `tests/llm/persistence.test.mjs:67` usa sessão renovada e não cobre este ramo. O teste de orquestração em `tests/llm/workflow.test.mjs:68` substitui persistência por uma função que já lança erro, por isso não comprova a detecção real desse conflito.

Tarefa de correção: consultar e comparar metadata antes de retornar sucesso também no ramo inalterado; manter zero PUT quando os bytes não mudaram. Substituir a expectativa de zero requests por ausência de PUT e metadata revalidada. Verificar conflito sem refresh e indisponibilidade da consulta com erro explícito, além de uma integração com persistência real simulada que confirme ausência de artefato. Revalidar depois da correção. Nenhuma implementação ou teste real foi editado pelo Verifier.

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
| LLM-08 | Lock repo/secret, cancel-in-progress false | `tests/llm/workflow.test.mjs:98`, `:99`, `:100`: false, queue max e grupo repo/secret; `.github/workflows/llm-execute.yml:63` | Contrato local conforme; concorrência real pendente |
| LLM-09 | updated_at >= created_at recusa AUTH_SNAPSHOT_STALE | `tests/llm/freshness.test.mjs:9`, `:28`: rejeição exata; `:30`: sessionUsed false; `:37`: igualdade/precisão/timestamp inválido recusados | Local conforme |
| LLM-10 | Refresh persistido somente no repo/secret correntes | `tests/llm/persistence.test.mjs:43`: URL exata; `:49`: `assert.equal(decrypted,refreshed)`; `:85`: preserva refresh mesmo após erro do provider | Local conforme |
| LLM-11 | Falha/conflito invalida resultado | `tests/llm/persistence.test.mjs:67`, `:74`: falhas corretas com refresh; `tests/llm/workflow.test.mjs:68`, `:69`: falha/nenhum artefato; reprodução acima contradiz ramo sem refresh em `scripts/llm/persist-session.mjs:16` | **FAIL** |
| LLM-12 | Credenciais temporárias removidas ao término/erro tratável | `tests/llm/auth.test.mjs:30`, `:31`, `:34`: access rejeita ENOENT; `tests/llm/workflow.test.mjs:58`: diretório removido após erro | Local conforme; modo 0700/0600 condicional Unix não executado no Windows |
| LLM-13 | Fork/evento/revisão não confiável/sessão pública recusados | `tests/llm/preflight.test.mjs:11`: rejeição UNTRUSTED_CONTEXT; aplicada em `:25`, `:30`, `:34`, `:43`, `:45` | Local conforme |
| LLM-14 | Read-only e nenhum token GitHub no processo do modelo | `tests/llm/execution.test.mjs:37`: sandbox read-only; `:40`: GITHUB_TOKEN undefined; `tests/llm/auth.test.mjs:41`: allowlist exclui tokens; `:26`: PAT ausente no filho | Local conforme; sandbox efetivo do CLI real depende do piloto |
| LLM-15 | Global integral e consumer combinados com hashes | `tests/llm/instructions.test.mjs:24`, `:25`, `:29`: conteúdo/fontes/hash exatos; `:92`, `:93`, `:95`: snapshot/proveniência | Local conforme |
| LLM-16 | >64 KiB ou fonte fora da raiz falha INSTRUCTIONS_INVALID | `tests/llm/instructions.test.mjs:56`: 65536 bytes aceitos; `:59`, `:64`, `:73`: helper de `:17` rejeita código exato | Local conforme |
| LLM-17 | Envelope v1 com identidade/proveniência e artefato por tentativa/chamada | `tests/llm/result.test.mjs:17` a `:24`, `:30`: campos exatos; `:38`, `:39`: identidades distintas; `tests/llm/caller.test.mjs:50`, `:51`: inspector rejeita SHA errado | Local conforme |
| LLM-18 | Schema inválido/>1 MiB falha INVALID_RESULT sem sucesso | `tests/llm/result.test.mjs:46`, `:48`: rejeição exata/nenhum pacote; `tests/llm/execution.test.mjs:59`: JSON inválido recusado | Local conforme |
| LLM-19 | Patch é dado vinculado ao SHA; fonte intocada | `tests/llm/result.test.mjs:18`, `:27`: SHA e patch exatos; `:61`: paths perigosos recusados; `tests/llm/execution.test.mjs:32`: fonte intacta | Local conforme |
| LLM-20 | Timeout/provider falha sem retry | `tests/llm/execution.test.mjs:54`, `:55`: PROVIDER_ERROR/uma chamada; `:65`, `:66`: TIMEOUT/uma chamada; executor fixa teto 600000 ms | Local conforme; timeout exercitado com orçamento reduzido |
| LLM-21 | Publicação allowlist, retenção 1 dia, sem secrets/logs | `tests/llm/result.test.mjs:15`: somente result.json/proposal.patch; `:46`: secret leak recusado; `tests/llm/workflow.test.mjs:108`, `:109`, `:125`: retenção 1, overwrite false e falha após upload; `:89`: token renovado recusado | Local conforme |
| LLM-22 | Central/scripts/dependências fixadas/CI e instruções completas do caller | `tests/llm/ci.test.mjs:12` a `:20`: gates/runtime/preservação de CI; `scripts/llm/package.json:13` e lock; revisão manual `examples/callers/llm/README.md:7`, `:17`, `:33`, `:60`, `:72`, `:85` | Entrega local conforme; sem testes de texto; T12 Deferred |
| LLM-23 | Caller ChatGPT e variante API opt-in próprios do consumidor | `tests/llm/caller.test.mjs:25`, `:26`, `:27`: mesma referência/modalidade/mapping; `:47`, `:50`: consumo válido/SHA falso; `examples/callers/llm/.github/workflows/llm.yml:10` | Artefatos locais conformes; publicação/adopção pendentes |
| LLM-24 | Duas execuções reais sequenciais, stale snapshot e persistência recusada | `.specs/features/issue-9-llm-centralizado/spec.md:109`; T13 sem execução e sem `docs/llm-pilot.md`; nenhuma assertion/evidência real | **PENDENTE**, objetivo incompleto |

## Gates e integridade

`npm --prefix scripts/llm test`: **89 aprovados, 0 falhas, 0 skips**. `npm --prefix scripts/llm run check`: exit 0. Execução local em Node **24.19.0**, aceito pelo engines; a CI declara Node 22.23.3. Este relatório não afirma ter executado a imagem Ubuntu/Node da CI.

Actionlint **1.7.12 Windows**: exit 0 sobre `.github/workflows/llm-execute.yml`, `.github/workflows/ci.yml`, caller principal e variante API. Flags: `-shellcheck= -pyflakes= -ignore 'unexpected key "queue" for "concurrency" section' -ignore 'property "workflow_(repository|sha)" is not defined'`. O script `lint:workflow` é específico de Linux amd64; foi substituído pelo binário Windows disponibilizado, preservando somente essas exceções precisas. Não houve shellcheck/pyflakes nem execução do workflow remoto.

Baseline `15dc8b9` não possui `tests/llm`; a suite da feature foi adicionada. Nenhum teste preexistente foi removido ou enfraquecido no diff. A contagem é observação do runner, não meta de entrega. Testes pertinentes mapeiam para contratos/edge cases/tarefas; não foram adicionados testes documentais pelo Verifier. A única assertion contraditória identificada é o zero requests do caso sem refresh.

## Discrimination sensor

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

Mudanças estão limitadas aos componentes da feature, CI, caller e artefatos de planejamento. O envelope usa autoridade do runtime e publicação fica condicionada à persistência/upload/cleanup; não há ações de domínio, fallback de identidade ou framework extra. A constituição `.specify/memory/constitution.md` exige contratos explícitos, privilégios mínimos e validação do consumo; a revisão observou esses critérios, com a exceção LLM-11 descrita.

Prioridade 1: corrigir o ramo sem refresh e sua assertion, então repetir o gate e revalidar LLM-11. Prioridade 2: manter LLM-24 pendente até o mantenedor autorizar/provisionar adoção e executar o piloto real com evidências sanitizadas. Não pedir secrets nem executar login como parte desta auditoria. Publicação da referência e piloto são ações futuras; sua ausência é declarada, não um bug dos fixtures.

Não foram encontrados outros defeitos locais confirmados nesta revisão. O resultado não comprova elegibilidade da sessão, modelos da conta, rede/sandbox efetivos, permissões reais do PAT, concorrência do GitHub ou recuperação real. UAT visual não se aplica à feature de infraestrutura. Traceabilidade global permanece sem alteração.

## Gate de conclusão e lições

`python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py issue-9-llm-centralizado`: **exit 1**, com diagnóstico `validation.md verdict is FAIL`. A feature não está concluída.

Conforme a skill, `lessons.py add` registrou L-001 (metadata também no ramo sem refresh) e L-002 (separar contratos offline de homologação real), ambas candidates fundamentadas em LLM-11/LLM-24. Arquivos gerados: `.specs/lessons.json` e `.specs/LESSONS.md`. Porcelain final contém somente esses dois arquivos e este relatório, todos untracked; implementação, testes, tasks, spec e HEAD permanecem inalterados.
