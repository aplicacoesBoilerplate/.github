# Validation: piloto local de agentes — PASS

**Result**: PASS

Os oito critérios do piloto local foram atendidos. As duas respostas reais foram inspecionadas, os hashes foram recomputados e a fonte original permaneceu intacta. A aprovação cobre este recorte local; SonarQube e gh-aw permanecem `not-run`.

**Data:** 2026-10-26. **Verifier:** subagente independente, autor ≠ verificador.

**Escopo:** próprio `.github`, OpenCode/OpenRouter local. O verificador não executou inferência, não leu valores de credenciais, não publicou e não instalou componentes globalmente.

**Diff:** `4176883e69cf32fe36d1b893e246bbdc03885cf9..d1c6aefe723f79da39c614135eac0f12ea74479a`. Revisão inicial em e6eb518; correções em 6ae585d; anexos e inferência final em d1c6aef. SHA-256 finais revalidados: runtime `f60107c610bea66403008e9133402ad68f841f61a432aa623e76589568da002d`; teste `ed66db63e5058725823bbc66d5be4c096244bdb443d57190c9d80d088ea255f7`.

## Task Completion

| Tarefa | Estado verificado | Evidência |
| --- | --- | --- |
| T1 | Concluída | Configuração e recusas contratuais aprovadas. |
| T2 | Concluída após correções | Ambiente fechado, descoberta de configuração bloqueada, limites separados e término da árvore testados. |
| T3 | Concluída | Caller preserva snapshot, identificadores, hashes e estados not-run. |
| T4 | Concluída | Duas respostas úteis inspecionadas; gate, revisão independente e sensor aprovados. |

## Spec-Anchored Acceptance Criteria

| Critério | Resultado definido na spec | `file:line` e asserção/evidência | Avaliação |
| --- | --- | --- | --- |
| AGP-01: configuração por processo | Preservar engine, provider, modelo e prompt na chamada/evidência | `ci-scripts/tests/agentic-config.test.ts:17`: `assert.equal(RESULT.processes.triage.model, 'a/model:free')`; linhas 18–20 conferem modelo de review, prompt e variável. `ci-scripts/tests/agentic-runtime.test.ts:36`: `assert.ok(OBSERVED.args.includes('openrouter/test/model:free'))`. `ci-scripts/scripts/agentic/run-pilot.ts:51` encaminha PROCESS/PROMPT; linhas 55–58 registram identidade/hashes. Evidências reais em `.specs/features/agentic-local-pilot/pilot-evidence.json:6` e linha 26. | Aprovado. O modelo registrado é o solicitado, sem alegar observação independente do roteamento interno do provedor. |
| AGP-02: entradas inválidas | Recusar chave ausente, engine não implementada e caminho que escape antes da execução | `ci-scripts/tests/agentic-runtime.test.ts:13`: `assert.rejects(..., /Credencial ausente/)`; `ci-scripts/tests/agentic-config.test.ts:26`: `assert.throws(...engine: 'codex'..., /engine.*implementada/i)`; linha 32 rejeita traversal/absolutos. | Aprovado. |
| AGP-03: snapshot/diretrizes | Workspace temporário com arquivos selecionados e diretrizes fornecidas | `ci-scripts/tests/agentic-caller.test.ts:22`: `assert.equal(FILES['source.ts'], 'original do commit')`; linhas 23–24 conferem ambas as diretrizes; linha 37 preserva alteração local. `ci-scripts/tests/agentic-runtime.test.ts:33` exige config explícita; linha 37 exige exatamente os anexos input/contexto. Preflight sem chave confirmou fontes internas ao scratch e instructions AGENTS explícito. Hashes reais recomputados em `.specs/features/agentic-local-pilot/pilot-evidence.json:12` e linha 32. | Aprovado após correções. |
| AGP-04: ambiente/permissões | Somente credencial escolhida/variáveis permitidas; shell, escrita e MCP desabilitados | `ci-scripts/tests/agentic-runtime.test.ts:29`: chave escolhida presente; linhas 30–31 exigem PAT/outro provedor ausentes; linhas 32–35 conferem isolamento; linhas 39–40 conferem deny global e MCP vazio. Metadata real confirmou fontes fechadas e nenhuma configuração de plugin externo. | Aprovado no contrato do harness. Não equivale a isolamento do SO. |
| AGP-05: falhas e limpeza | Timeout/erro/vazio recusam sucesso e removem temporários | `ci-scripts/tests/agentic-runtime.test.ts:51`: `assert.rejects(..., /OpenCode falhou|timeout/i)`; linha 52 exige cwd removido; linha 66 rejeita texto parcial/erro/vazio. Linhas 74–75 e 90–91 exigem diagnóstico útil e sem sentinel. Linha 105 exige ausência do marcador de descendente após timeout. `ci-scripts/scripts/agentic/COpenCodePilot.ts:66` executa limpeza em finally. | Aprovado nos cenários controlados, incluindo descendente Windows. |
| AGP-06: evidência | JSON local com repo/SHA/engine/versão/provider/modelo/hashes/resposta, sem autenticação | `ci-scripts/tests/agentic-caller.test.ts:28`: dois resultados; linhas 29–35 conferem identidade/hashes; linha 36 exige ausência de sentinel. `ci-scripts/scripts/agentic/run-pilot.ts:54` constrói campos; linhas 63–64 persistem com rename. `.specs/features/agentic-local-pilot/pilot-evidence.json:3` e linha 23 preservam os dois resultados reais. SHA, configHash e todos os hashes de inputs foram recomputados e conferem. O autor confirmou credentialPresent=false em ambos e no agregado sem revelar o valor. | Aprovado. |
| AGP-07: qualidade real | Triagem pede confirmação quando metadados faltam; review identifica traversal controlado | `.specs/features/agentic-local-pilot/pilot-evidence.json:37`: action=needs-human, missingFields inclui Milestone/Epic/Branch e nextStep pede confirmação ao proprietário. Linha 17: verdict=changes-required, finding high no arquivo correto, remoção da guarda de componentes '..' e exemplo '../'. Inspeção independente confirmou ambos os resultados. | Aprovado por inferência real. |
| AGP-08: limite de homologação | Sonar desabilitado registra not-run; não afirmar Quality Gate ou gh-aw aprovados | `ci-scripts/tests/agentic-caller.test.ts:33`: `assert.equal(RESULTS[1].sonarqube, 'not-run')`; linha 34 exige ghAw not-run. `ci-scripts/tests/agentic-config.test.ts:38` recusa enabled=true; linha 39 recusa gate opcional. Evidência real `.specs/features/agentic-local-pilot/pilot-evidence.json:19` e linhas 20/39/40 confirma not-run. | Aprovado. |

**Spec-anchored check:** 8/8 critérios atendidos, sem lacuna de precisão da spec. Contratos foram testados com doubles e o resultado de AGP-07 foi verificado nas duas respostas reais.

## Prova real e limites da resposta

As duas evidências usam repositório aplicacoesBoilerplate/.github, revisão `d1c6aefe723f79da39c614135eac0f12ea74479a`, engine opencode 2.0.26, provider openrouter e modelo configurado `openrouter/liquid/lfm-2.5-2.6b:free`. A triagem levou 30128 ms e a revisão 12908 ms. O configHash de ambas é `6be6c88de4b1aa1dc29bd12196a4f9ece66ccefa4cf203c1fd19f09dbac6c8ef`.

O verificador recomputou os hashes a partir de git show da revisão citada: configuração, diretrizes globais combinadas com AGENTS do consumidor, input específico, contexto e prompt. Todos conferem nos dois arquivos. A fonte CReleaseProjectConfig.ts está idêntica à master 4176883 e ao worktree; a guarda de componentes '..' permanece presente. O patch controlado não foi aplicado.

O autor comparou, em memória, os dois JSONs e o agregado com a variável de credencial antes de persistir pilot-evidence.json. Retornou credentialPresent=false/credentialCheck=absent; nenhum valor foi revelado ao verificador. O verificador inspecionou respostas e campos permitidos, sem acessar a credencial.

As respostas contêm JSON dentro de cercas Markdown. Isso satisfaz o piloto de persistência textual com inspeção humana; não é homologação de um parser automático estrito. O review identifica corretamente a regressão com '../', mas cita também './', que já normaliza para '.' e é aceito na base. Esse segundo exemplo é inexato e não fundamenta a aprovação; a identificação de traversal por '..' fundamenta AGP-07. Não há aprovação para publicar ou aplicar saídas automaticamente.

## Histórico de achados e correções

### Descoberta de configuração pessoal: corrigida

No commit inicial, HOME/USERPROFILE/XDG eram redirecionados, mas o workspace estava no TEMP abaixo do usuário. Metadata sem chave retornou fontes adicionais `C:/Users/gerso/.opencode/opencode.json` e `C:/Users/gerso/.opencode`. O próprio OpenCode revelou os caminhos; não abri o perfil pessoal e não reproduzo seu conteúdo.

A documentação oficial [Config — Locations](https://opencode.ai/v2/docs/config#locations) descreve descoberta de configurações nos ancestrais até a raiz do filesystem. Isso explica por que redirecionar HOME/USERPROFILE não bastou.

O autor adicionou config explícita, bloqueio de descoberta e diretórios/home específicos do OpenCode em `ci-scripts/scripts/agentic/COpenCodePilot.ts:49`, mais instructions AGENTS na linha 35. Preflight independente sem chave retornou código 0, três fontes, todas dentro do scratch; plugin externo configurado=false; instructions AGENTS=true; pilot na configuração=true. Scratch removido com caminho verificado.

agent.list retornou registry vazio, inclusive com location[directory] correspondente ao cwd. A fonte embutida mostra registry inicialmente vazio e registro por plugins. Não foi classificado como defeito da configuração; as execuções reais posteriores confirmaram funcionamento. A forma deepObject está no [OpenAPI oficial](https://opencode.ai/v2/openapi.json).

### Limite de contexto agregado: corrigido

A cópia inicial aceitou input 40000 bytes mais contexto 40000 bytes, contrariando `.specs/features/agentic-local-pilot/spec.md:98`. Agora diretrizes e contexto têm limites separados em `ci-scripts/scripts/agentic/COpenCodePilot.ts:17` e linha 18; o prompt entra na soma do contexto. `ci-scripts/tests/agentic-runtime.test.ts:82` e linha 83 recusam os excessos antes do spawn. Teste e sensor confirmaram a correção.

### Encerramento, diagnóstico e anexos: corrigidos

O autor reproduziu falha de descendente na limpeza e implementou término da árvore Windows/grupo POSIX em `ci-scripts/scripts/agentic/COpenCodePilot.ts:78`. O verificador aprovou o teste Windows da linha 105. POSIX foi revisado estaticamente, sem alegar execução nessa plataforma.

Diagnóstico limitado redige credenciais em `ci-scripts/scripts/agentic/COpenCodePilot.ts:94`; testes conferem causa e ausência da sentinela. Input/contexto são anexados por --file em linhas 55–56, com asserção exata em `ci-scripts/tests/agentic-runtime.test.ts:37`. A retirada dos anexos foi detectada pelo sensor final.

Tentativas anteriores com Gemma retornaram HTTP 429 upstream, sem sucesso falso. O consumidor foi alterado explicitamente para Liquid nos dois processos, sem fallback no executor ou mudança dos ACs. Os testes continuam provando configuração de IDs diferentes por processo. Probes HTTP diretos não foram usados como aprovação do harness.

## Gate Check

- **Build gate independente:** npm test, seguido de npm run typecheck após sucesso dos testes, em ci-scripts.
- **Inicial:** 74 aprovados, zero falhas/skips; typecheck código 0.
- **Final d1c6aef:** 78 aprovados, zero falhas, zero cancelados, zero skipped; typecheck código 0.
- **Integridade:** nenhum teste existente deletado ou enfraquecido; treze novos casos no piloto, de 65 para 78 testes totais.
- **Quick em scratch:** 9/9 inicialmente; 13/13 nas rodadas de correção e anexos.
- **Full real:** duas chamadas pelo harness concluídas e respostas inspecionadas. O verificador não repetiu inferência.

## Discrimination Sensor

Mutações em cópias temporárias, sem modificar produto ou testes reais. Runner já instalado; nenhuma instalação necessária.

| Rodada | Mutação | Local final correspondente | Detecção |
| --- | --- | --- | --- |
| Inicial | Herdar todo pEnvironment | `ci-scripts/scripts/agentic/COpenCodePilot.ts:43` | AGP-03/04 falhou; 3/4 testes de runtime passaram. |
| Inicial | Deny global para allow | `ci-scripts/scripts/agentic/COpenCodePilot.ts:31` | AGP-03/04 falhou; 3/4 passaram. |
| Inicial | Remover recusa de eco da chave | `ci-scripts/scripts/agentic/COpenCodePilot.ts:64` | AGP-05/06 falhou; 3/4 passaram. |
| Correção | Flag de descoberta de 1 para 0 | `ci-scripts/scripts/agentic/COpenCodePilot.ts:49` | AGP-03/04 falhou; 7/8 passaram. |
| Correção | Contexto agregado até 128 KiB | `ci-scripts/scripts/agentic/COpenCodePilot.ts:18` | Teste de limite falhou; 7/8 passaram. |
| Final | Remover anexos da invocação | `ci-scripts/scripts/agentic/COpenCodePilot.ts:56` | AGP-03/04 falhou; 7/8 passaram. |

**Sensor:** 6 injetadas, 6 mortas, 0 sobreviventes. Profundidade leve em três rodadas proporcionais às mudanças.

**Isolamento:** porcelain vazio antes/depois da rodada inicial; idêntico antes/depois de cada revalidação. Na rodada final havia somente alterações documentais do autor e deste relatório: LESSONS.md, lessons.json, validation.md e pilot-evidence.json. Scratch sempre removido após conferir caminho sob TEMP e prefixo exclusivo. Nenhum stash utilizado.

## Edge Cases e qualidade

- Chave ausente, engine incompatível, traversal e absolutos: testes aprovados.
- Chave no texto/diagnóstico, texto parcial com erro e resposta vazia: testes aprovados.
- Arquivo não versionado: `ci-scripts/tests/agentic-caller.test.ts:40` exige erro `/versionado/`.
- Symlink versionado: fixture com blob Git modo 120000 foi recusada por readSnapshot; scratch descartado.
- Falha de provedor não produz modelo alternativo nem evidência de sucesso. JSON por processo não representa aprovação global.
- Mudanças limitadas ao piloto, padrões Node test/TypeScript preservados, sem modificar workflows de publicação.
- Cada um dos treze testes do piloto mapeia requisito, erro ou limite especificado; seis mutantes confirmam discriminação.
- Diretriz local `AGENTS.md:16`: testes reais e review independente além de validadores estruturais, atendida.

## Requirement Traceability proposta ao autor

| Requisito | Estado verificado |
| --- | --- |
| AGP-01 | Verified: configuração independente preservada. |
| AGP-02 | Verified: recusas antes da execução. |
| AGP-03 | Verified após correções: snapshot, diretrizes, limites e anexos. |
| AGP-04 | Verified no contrato do harness: ambiente e fontes fechados. |
| AGP-05 | Verified nos cenários controlados Windows. |
| AGP-06 | Verified: metadados, hashes e ausência de chave. |
| AGP-07 | Verified: duas respostas reais úteis. |
| AGP-08 | Verified: Sonar/gh-aw not-run. |

O verificador escreveu somente este relatório. Atualizar spec/tasks e destilar lições cabe ao autor, conforme escopo recebido. As falhas iniciais geraram sinal concreto: conferir fontes efetivas do harness, incluindo ancestrais, e testar limites agregados. Nenhum gap bloqueante permanece no recorte local aprovado.
