# Validação T4: release-please-self-pilot

**Result: PASS no recorte T4.** Seguro publicar a branch e abrir o PR de entrega para master com milestone v0.0.1, mantendo v1.0.0. Este parecer não aprova merge, não encerra a issue #4 e não comprova publicação real.

**Data:** 2026-10-23.  
**Verifier:** subagente independente, autor diferente do implementador.  
**Diff imutável:** `fbc7c31c96369106c78a733bd1b6ee01401a5f89..133f8968149838c8ae69c3fb1c9ff482983e5607`.  
**HEAD testado:** `133f8968149838c8ae69c3fb1c9ff482983e5607`.  
**Ambiente:** Windows, Node v24.19.0, npm 11.17.0.  
**Base de requisitos:** `.specs/features/release-please-self-pilot/spec.md:197`, `tasks.md:116` e `design.md:7`.

## Escopo e tarefas

T1-T3 já têm revisão independente em `validation-sdk.md` e evidência hospedada registrada em `implementation-log.md:55`. Este relatório revê somente a extensão T4 e roda a suíte integral como não regressão. O diff acrescenta o caller de produção e version.txt, amplia o mesmo teste funcional e atualiza os registros/roteiro. Não altera o motor, o called central, a CI ou os adaptadores existentes.

| Tarefa | Resultado | Limite |
| --- | --- | --- |
| T1-T3 | Evidência anterior preservada; suíte integral novamente aprovada | Não reabre o projeto anterior de adaptadores |
| T4, implementação local | PASS | Caller pronto para revisão no PR de entrega |
| Push, PR e CI dessa entrega | Próxima etapa autorizada, não executada pelo Verifier | Conferir a CI do SHA publicado |
| Merges e ciclo de publicação RPSP-05 | PENDENTE | Merges humanos; PR técnico/tag/Release pela Action |

## Critérios T4 rederivados

Os nove critérios abaixo vêm da preparação aprovada em `spec.md:199` e `spec.md:201`, não da forma acidental da implementação. PASS de contrato não equivale a execução do runner com escrita.

| Critério e requisito | Resultado esperado | Evidência `file:line` e asserção/inspeção | Resultado |
| --- | --- | --- | --- |
| C1, gatilho restrito, RPSP-03 | Somente PR closed para master | `.github/workflows/version-release-please-self-caller.yml:4`; `ci-scripts/tests/release-please.test.ts:80`: `deepEqual(selfCaller.on, {pull_request:{types:['closed'],branches:['master']}})` | PASS contrato |
| C2, fechamento sem merge, RPSP-03.AC3 | Os dois jobs exigem `merged == true` | Caller `:14` e `:21`; teste `:83` e `:88`: igualdade exata da guarda. Called mantém a mesma guarda em `.github/workflows/version-release-please-called.yml:18` | PASS contrato; zero escritas externas ainda PENDENTE |
| C3, CI da revisão com leitura, RPSP-02/RPSP-04 | validate reutiliza CI local com contents:read e sem secrets herdados | Caller `:15` e `:17`; teste `:84`, `:85`, `:86`: referência local, mapa exato de permissões e secrets undefined; CI declara leitura em `.github/workflows/ci.yml:13` | PASS contrato |
| C4, precedência da CI, RPSP-03 | release só roda depois do sucesso de validate | Caller `:22`; teste `:89`: `equal(selfCall.needs, 'validate')`; sensor M1 remove a dependência e falha nessa asserção | PASS contrato e sensor |
| C5, called compartilhado e SHA, RPSP-01/RPSP-02.AC5-6 | Called local, simple, scripts presos ao SHA do evento integrado | Caller `:27`, `:29`, `:30`; teste `:90`, `:91`: referência e inputs exatos; `:101`: mesmo called do exemplo externo; `:117`: checkout recebe inputs.central-ref; called `:37`. M2 detecta troca para master | PASS contrato; checkout remoto ainda PENDENTE |
| C6, permissões e distribuição, RPSP-01.AC4/RPSP-04 | CI só lê; release usa somente contents/issues/PR:write, sem secrets de registry nem publicador simple | Teste `:81`, `:85`, `:92`, `:93`: mapas exatos e ausência de secrets; `:119` a `:122`: três adaptadores exclusivos go/node/maven; called `:20`, `:74`, `:82`, `:88` | PASS contrato |
| C7, arquivo de versão evolutivo, RPSP-01 | version.txt começa em 0.0.0 sem tag e aceita o futuro bump para 0.0.1 | `version.txt:1`: 0.0.0; teste `:95`: formato de versão, sem fixar o seed; cópia positiva com 0.0.1 passou. Fixture continua independente em `:179` e updater real exige 0.0.1 em `:185` | PASS local e controle positivo |
| C8, inputs reais e integridade da suíte, RPSP-02/RPSP-04 | Mesmo fluxo usa inputs do caller de produção, motor nativo e sete casos/asserções anteriores | Teste `:134`, `:136`: selfCall.with alimenta subprocesso; `:160`, `:161`: outputs/inputs exatos simple/0.0.1; `:170`: valor entregue a Simple; `:177`, `:185`, `:202`, `:203`: versão, arquivo, tag e SHA da fixture. Diff preserva asserções antigas `:44`, `:45`, `:56`, `:57`, `:243`, `:258`; conventional-commit.test.ts sem alteração; gate 7/7 | PASS local |
| C9, roteiro e limites, preparação RPSP-05 | Dois PRs, milestone separada v0.0.1, merges humanos, publicação pendente e sem encerramento da issue | `docs/pipelines/versionamento-release-please.md:71`, `:75`, `:83`, `:85`, `:88`, `:90`; `spec.md:201`; `tasks.md:152` | PASS documental; PR remoto ainda PENDENTE |

**Spec-anchored check:** 9/9 critérios do recorte têm evidência; nenhum gap de precisão ou critério falho. O teste afirma valores previstos pelo contrato, não apenas presença de campos. As novas asserções pertencem aos critérios T4/RPSP-01 a RPSP-04; não há testes novos sem requisito.

## Permissões, referência e riscos de borda

A sintaxe das chamadas locais e a dependência needs são válidas. Referências locais reutilizam o mesmo commit do caller; github.sha é um contexto permitido em jobs.with. O job release concede as mesmas três permissões pedidas pelo called. O nível contents:read do workflow não impede o mapa específico do job. GITHUB_TOKEN é disponibilizado automaticamente ao reusable workflow, portanto não exige secrets:inherit. Essas conclusões usam a [referência oficial de reutilização](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#calling-a-reusable-workflow), a [sintaxe de jobs, needs e permissões](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) e o [contexto/token do reusable workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#github-context), consultados nesta revisão. Context7 não foi disponibilizado entre as ferramentas da sessão.

O [evento closed com guarda merged](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#running-your-pull_request-workflow-when-a-pull_request-merges) corresponde ao padrão documentado pelo GitHub. Abrir o PR não satisfaz esse gatilho; fechar sem merge não satisfaz as guardas. Um validate falho ou ignorado bloqueia release, pois não existe always() para contornar needs. A comprovação hospedada dessas decisões e do checkout no SHA integrado continua pendente do merge humano.

Políticas da organização/repositório ainda podem impedir a criação de PR com GITHUB_TOKEN; o YAML não prova essa autorização administrativa (`docs/pipelines/versionamento-release-please.md:83`). Não foi feita alteração de política, secret ou credencial. Forks e Dependabot podem receber token restrito pelo GitHub; esta revisão não declara suporte de publicação para esses cenários. Identidade forte do robô, concorrência, versões regressivas/conflitantes e governança de milestones foram explicitamente adiadas, conforme `spec.md:34` e documentação `:90`.

## Gates independentes

| Comando | Resultado |
| --- | --- |
| `npm test --prefix ci-scripts` | Exit 0: 7 testes, 7 aprovados, 0 falhas/cancelados/skips/todo |
| `npm run typecheck --prefix ci-scripts` | Exit 0 |
| `validate_spec.py .specs/features/release-please-self-pilot/spec.md` | Exit 0, 0 erros e 0 avisos |
| `validate_tasks.py .specs/features/release-please-self-pilot/tasks.md` | Exit 0, 0 erros e 0 avisos |
| `check_commit.py --message 'feat(versioning): prepare real self-pilot delivery'` | Exit 0 |
| `git diff --check` no range e no checkout | Exit 0 |
| `validate_state.py release-please-self-pilot` | Exit 0, 0 erros após gravar este relatório; confirma formato/evidência, não publicação |

Contagem da base T4: 7. Contagem atual: 7. Nenhum arquivo de teste novo, skip, asserção removida ou enfraquecida. O único fluxo ampliado continua exercitando domínio, contrato e SDK real. O cliente do SDK proíbe fetch em `ci-scripts/tests/release-please.test.ts:166`; subprocessos recebem ambiente sem tokens em `:17` e `:144`. Isso não comprova a Action em produção.

## Sensor em cópia temporária

**Result: PASS, 2 mutações injetadas, 2 detectadas, 0 sobreviventes.** Profundidade leve, proporcional à extensão de wiring de T4.

Foi extraído um git archive do HEAD testado para uma cópia em Temp, com junction somente para dependências existentes. Nenhum worktree, stash, commit ou operação remota foi criado. Cada falha foi aplicada por patch na cópia e revertida antes da próxima.

| Ensaio | Alteração somente na cópia | Resultado observado |
| --- | --- | --- |
| Baseline | Sem falhas injetadas, version.txt 0.0.0 | 1/1 fluxo funcional aprovado, exit 0, zero skips |
| M1 | Remover needs:validate do caller `:22` | Detectado, exit 1; teste `:89` recebeu undefined em vez de validate. Mensagem: A publicação deve aguardar a CI do commit integrado |
| M2 | Trocar central-ref github.sha por master no caller `:30` | Detectado, exit 1; teste `:91` recebeu central-ref master em vez da expressão github.sha |
| Controle positivo | Restaurar caller e trocar somente version.txt para 0.0.1 | 1/1 fluxo funcional aprovado, exit 0, zero skips; motor continuou produzindo a versão/tag 0.0.1 da fixture |
| Baseline restaurada | Restaurar também version.txt 0.0.0 | 1/1 fluxo funcional aprovado, exit 0, zero skips |

Porcelain real antes e depois do sensor: vazio. HEAD permaneceu 133f8968149838c8ae69c3fb1c9ff482983e5607. Na conferência final, somente `?? .specs/features/release-please-self-pilot/validation.md` apareceu; excluído esse caminho, a baseline permanece vazia. Nenhuma mutação atingiu a implementação real.

**Limpeza bloqueada:** a revisão automática rejeitou o comando que removeria a junction e a cópia temporária antes de executá-lo, com a razão `blocked by policy`. Não houve nova tentativa nem mecanismo alternativo. A cópia restaurada permanece em `C:/Users/gerso/AppData/Local/Temp/rpsp-t4-verifier-63bbf4b574844130ad45b91bf4aa09f3`, incluindo source.zip e a junction para as dependências reais. A existência de ambos os diretórios foi conferida depois da rejeição. Nenhum arquivo material foi removido.

## Qualidade e conclusão

Alterações cirúrgicas, padrões existentes e nenhum publicador/algoritmo paralelo. Diretrizes: AGENTS.md, spec/design/tasks da feature e validação TLC. T4 não ampliou o número de testes superiores nem reabriu governança ou consumidores externos. Todos os critérios locais têm o resultado exigido; nenhum achado ranqueado ou tarefa de correção no recorte.

Nenhuma lição nova foi registrada: não houve critério falho, mutante sobrevivente, gate falho, SPEC_DEVIATION ou gap de precisão. O bloqueio de limpeza é operacional, não um defeito de implementação da feature.

RPSP-05 permanece PENDENTE: falta abrir/conferir o PR de entrega, executar a Action após merge humano, inspecionar o PR técnico, obter a CI aprovada e comprovar tag/Release com versão, links e SHA integrado. RPSP-06 continua futuro. RPSP-01 a RPSP-03 recebem apenas PASS local/contrato nos pontos citados, sem promoção indevida para publicação verificada. A revisão autoriza tecnicamente o próximo push/PR de entrega já aprovado pelo usuário; o agente deve parar antes de qualquer merge.
