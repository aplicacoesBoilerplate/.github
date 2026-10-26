# Validation: piloto local de agentes — FAIL

**Result**: FAIL

O código e os contratos locais estão aprovados após correções. AGP-07 ainda aguarda duas respostas reais úteis. A aprovação global permanece bloqueada por essa ausência de evidência.

**Data:** 2026-10-26. **Verifier:** subagente independente, autor ≠ verificador.

**Escopo:** próprio `.github`, piloto local OpenCode/OpenRouter. O verificador não executou inferência, não leu valores de credenciais, não publicou e não instalou componentes globalmente.

**Diff:** `4176883e69cf32fe36d1b893e246bbdc03885cf9..e6eb518b50604e8ad5f7104afdf58f4144e3ec8c`, mais correções locais do autor em `COpenCodePilot.ts` e `agentic-runtime.test.ts`. SHA-256 dos arquivos revalidados: runtime `a59a66655d2d2eb5b6be706ae3246d4010050c9a420320058b4943b003b41eee`; teste `8ff12596c58de071c7c31f5beb6f494e298edd0badd7fa7593c9db18bccb2cfd`.

## Task Completion

| Tarefa | Estado verificado | Evidência |
| --- | --- | --- |
| T1 | Concluída | Configuração e recusas contratuais aprovadas. |
| T2 | Concluída após correções | Ambiente fechado, descoberta de configuração bloqueada, limites separados e término da árvore testados. |
| T3 | Contrato aprovado | Caller preserva snapshot, identificadores, hashes e estados `not-run`. |
| T4 | Incompleta | Review independente e sensor concluídos; respostas reais úteis ainda ausentes. |

## Spec-Anchored Acceptance Criteria

| Critério | Resultado definido na spec | `file:line` e asserção/evidência | Avaliação atual |
| --- | --- | --- | --- |
| AGP-01: configuração por processo | Preservar engine, provider, modelo e prompt na chamada/evidência | `ci-scripts/tests/agentic-config.test.ts:17`: `assert.equal(RESULT.processes.triage.model, 'a/model:free')`; linhas 18–20 conferem modelo de review, prompt e variável. `ci-scripts/tests/agentic-runtime.test.ts:36`: `assert.ok(OBSERVED.args.includes('openrouter/test/model:free'))`. `ci-scripts/scripts/agentic/run-pilot.ts:51` encaminha PROCESS/PROMPT; linhas 55–58 registram identidade/hashes. | Contrato aprovado. Modelo registrado é o solicitado, sem afirmar observação do modelo usado pelo servidor. |
| AGP-02: entradas inválidas | Recusar chave ausente, engine não implementada e caminho que escape antes da execução | `ci-scripts/tests/agentic-runtime.test.ts:13`: `assert.rejects(..., /Credencial ausente/)`; `ci-scripts/tests/agentic-config.test.ts:26`: `assert.throws(...engine: 'codex'..., /engine.*implementada/i)`; linha 32 rejeita traversal/absolutos. | Aprovado. |
| AGP-03: snapshot/diretrizes | Workspace temporário com arquivos selecionados e diretrizes fornecidas | `ci-scripts/tests/agentic-caller.test.ts:22`: `assert.equal(FILES['source.ts'], 'original do commit')`; linhas 23–24 conferem ambas as diretrizes; linha 37 preserva alteração local. `ci-scripts/tests/agentic-runtime.test.ts:33` exige config explícita do workspace. Preflight real sem chave confirmou fontes apenas no scratch e instructions AGENTS explícito. | Aprovado após correção da descoberta ancestral. |
| AGP-04: ambiente/permissões | Somente credencial escolhida/variáveis permitidas; shell, escrita e MCP desabilitados | `ci-scripts/tests/agentic-runtime.test.ts:29`: chave escolhida presente; linhas 30–31 exigem PAT/outro provedor ausentes; linhas 32–35 conferem flags de isolamento; linhas 38–39 conferem deny global e MCP vazio. Preflight OpenCode real confirmou fontes fechadas e nenhuma configuração de plugin externo. | Contrato aprovado após correção; permissões normalizadas na configuração real. Sem alegar isolamento do SO. |
| AGP-05: falhas e limpeza | Timeout/erro/vazio recusam sucesso e removem temporários | `ci-scripts/tests/agentic-runtime.test.ts:50`: `assert.rejects(..., /OpenCode falhou|timeout/i)`; linha 51 exige cwd removido; linha 65 rejeita texto parcial/erro/vazio. Linhas 73–74 e 89–90 exigem diagnóstico útil e sem `sentinel`. Linha 104 exige ausência do marcador de descendente após timeout. `ci-scripts/scripts/agentic/COpenCodePilot.ts:65` executa limpeza em finally. | Aprovado nos cenários controlados, incluindo descendente Windows. |
| AGP-06: evidência | JSON local com repo/SHA/engine/versão/provider/modelo/hashes/resposta, sem autenticação | `ci-scripts/tests/agentic-caller.test.ts:28`: dois resultados; linhas 29–35 conferem repo/SHA/processo/modelo/hashes; linha 36 exige ausência de `sentinel`. `ci-scripts/scripts/agentic/run-pilot.ts:54` constrói os campos; linhas 63–64 persistem por arquivo temporário e rename. `ci-scripts/tests/agentic-runtime.test.ts:65` rejeita eco da chave. | Contrato aprovado; JSONs de inferência real útil ainda aguardados. |
| AGP-07: qualidade real | Triagem pede confirmação quando metadados faltam; review identifica traversal controlado | Sem `file:line` de resposta real útil. Verificador não executou inferência. | Pendente, impede aprovação global. |
| AGP-08: limite de homologação | Sonar desabilitado registra `not-run`; não afirmar Quality Gate ou gh-aw aprovados | `ci-scripts/tests/agentic-caller.test.ts:33`: `assert.equal(RESULTS[1].sonarqube, 'not-run')`; linha 34 exige ghAw `not-run`. `ci-scripts/tests/agentic-config.test.ts:38` recusa enabled=true; linha 39 recusa gate opcional. | Aprovado. |

**Spec-anchored check:** sete de oito critérios têm evidência contratual aprovada. AGP-07 não tem evidência real útil. Os oito critérios definem resultados observáveis; não foi necessário inventar resultado para requisito vago. Doubles não substituem a prova real exigida.

## Histórico de achados e revalidação

### 1. Descoberta de configuração pessoal: corrigida

No commit inicial, `COpenCodePilot.ts` redirecionava HOME/USERPROFILE/XDG, mas o workspace estava no TEMP abaixo do usuário. Uma chamada de metadata sem chave, com a configuração do adapter, retornou fontes adicionais `C:/Users/gerso/.opencode/opencode.json` e `C:/Users/gerso/.opencode`. O próprio OpenCode revelou os caminhos; não abri o perfil pessoal e não reproduzo seu conteúdo.

A documentação oficial [Config — Locations](https://opencode.ai/v2/docs/config#locations) descreve a descoberta de configurações nos ancestrais até a raiz do filesystem. Isso explica por que redirecionar HOME/USERPROFILE não bastou.

O autor adicionou config explícita, desativou descoberta de projeto e redirecionou diretórios/home específicos do OpenCode em `ci-scripts/scripts/agentic/COpenCodePilot.ts:49`, além de `instructions: ['AGENTS.md']` na linha 35.

**Preflight independente após correção, sem chave nem inferência:** `api --standalone GET /api/config` retornou código 0, três fontes, todas dentro do scratch; plugin externo configurado=false; instructions AGENTS explícito=true; pilot presente na configuração=true. Nenhuma fonte pessoal foi lida no segundo preflight. O scratch foi removido após validar seu caminho.

**Observação de metadata:** `agent.list` retornou `{location,data:[]}`, inclusive com `location[directory]` explícito correspondendo ao cwd; `agent.get` retornou AgentNotFoundError. A fonte embutida do binário inicializa o registry vazio, e plugins registram os agentes/configurações. Portanto a lista vazia pode refletir bootstrap do comando API. Não a classifico como defeito comprovado da configuração nem como prova sobre inferência. A sintaxe deepObject vem do [OpenAPI oficial](https://opencode.ai/v2/openapi.json).

### 2. Contexto agregado acima de 64 KiB: corrigido

Uma cópia do adapter inicial aceitou input de 40000 bytes mais contexto de 40000 bytes. Isso contrariava `.specs/features/agentic-local-pilot/spec.md:98`, embora cada arquivo tivesse menos de 64 KiB.

A implementação corrigida separa diretrizes e contexto em `ci-scripts/scripts/agentic/COpenCodePilot.ts:17` e linha 18. A soma do contexto inclui o prompt. `ci-scripts/tests/agentic-runtime.test.ts:81` recusa diretrizes de 65537 bytes; linha 82 recusa a soma de 80000 bytes antes do spawn. Teste e sensor adicional confirmaram a correção.

### 3. Encerramento e diagnóstico: reforçados e revalidados

O autor reproduziu problema de descendente durante a limpeza e substituiu término isolado por término da árvore Windows/grupo POSIX em `ci-scripts/scripts/agentic/COpenCodePilot.ts:77`. O verificador aprovou o teste Windows da linha 104, além dos testes de falha, timeout e limpeza. POSIX foi revisado estaticamente, sem alegar execução nessa plataforma.

Diagnóstico limitado de stderr ou stdout preserva a causa e redige a credencial em `ci-scripts/scripts/agentic/COpenCodePilot.ts:93`. Os testes das linhas 73–74 e 89–90 conferem causa útil e ausência da sentinela.

### Gap restante: AGP-07

Após o isolamento corrigido, executar e inspecionar os dois processos autorizados. **Done when:** triagem pede confirmação dos metadados ausentes, review identifica a regressão de traversal, hashes/SHA correspondem ao snapshot e não há credencial persistida. Até a chegada dessas evidências, T4 permanece incompleta.

## Gate Check

- **Build gate independente:** `npm test`, seguido de `npm run typecheck` somente após sucesso dos testes, em `ci-scripts`.
- **Inicial:** 74 aprovados, zero falhas/skips; typecheck código 0.
- **Após correções:** 78 aprovados, zero falhas, zero cancelados, zero skipped; typecheck código 0.
- **Integridade:** nenhum teste existente foi deletado ou enfraquecido. Nove testes iniciais e quatro casos adicionais de falha/limite/ciclo de vida: treze novos, de 65 para 78 testes totais.
- **Quick no scratch:** 9/9 antes da primeira rodada e 13/13 antes da revalidação.
- **Full gate real:** conduzido pelo autor para evitar inferência duplicada. A primeira tentativa foi informada como código 1 após aproximadamente 115 s, sem evidência útil; nova tentativa controlada aguardada.

## Discrimination Sensor

Mutações de comportamento em cópias temporárias. O produto e os testes reais não foram alterados pelo verificador. A cópia usou o runner instalado; nenhuma instalação foi necessária.

| Rodada | Mutação | Local | Evidência de detecção |
| --- | --- | --- | --- |
| Inicial | Herdar todo pEnvironment | `ci-scripts/scripts/agentic/COpenCodePilot.ts:43` | AGP-03/04 falhou: 3/4 testes de runtime passaram. |
| Inicial | Trocar deny global por allow | `ci-scripts/scripts/agentic/COpenCodePilot.ts:31` | AGP-03/04 falhou: 3/4 passaram. |
| Inicial | Remover recusa de eco da chave | `ci-scripts/scripts/agentic/COpenCodePilot.ts:63` | AGP-05/06 falhou: 3/4 passaram. |
| Revalidação | OPENCODE_DISABLE_PROJECT_CONFIG de 1 para 0 | `ci-scripts/scripts/agentic/COpenCodePilot.ts:49` | AGP-03/04 falhou: 7/8 passaram; asserção da flag discriminou a regressão. |
| Revalidação | Aceitar contexto agregado até 128 KiB | `ci-scripts/scripts/agentic/COpenCodePilot.ts:18` | Teste de limite agregado falhou: 7/8 passaram. |

**Sensor:** cinco injetadas, cinco mortas, zero sobreviventes. Profundidade leve, em duas rodadas proporcionais às correções.

**Isolamento confirmado:** porcelain real vazio antes/depois da primeira rodada. Na revalidação, antes/depois idênticos: runtime e teste modificados pelo autor, mais este relatório não versionado. Cada scratch foi removido somente após conferir caminho absoluto sob TEMP e prefixo exclusivo do verificador. Nenhum stash foi usado.

## Edge Cases

- Credencial ausente, engine incompatível, traversal e caminhos absolutos: aprovados.
- Credencial no texto, texto parcial seguido de erro e resposta vazia: aprovados.
- Arquivo não versionado: `ci-scripts/tests/agentic-caller.test.ts:40` exige erro `/versionado/`.
- Symlink versionado: fixture adicional com blob Git modo 120000 foi recusada por readSnapshot como arquivo não regular. Scratch descartado.
- API/modelo indisponível: erro não escolhe modelo alternativo no adapter; a prova real do modelo continua pendente.
- CLI real sem chave confirmou suporte a run/standalone/format/agent/model. Isso prova sintaxe, não inferência.
- JSON individual não representa aprovação global. O resumo do caller depende do retorno dos dois processos.

## Code Quality

| Verificação | Avaliação |
| --- | --- |
| Mudanças limitadas ao piloto autorizado | Atendido; sem alterar workflows de publicação. |
| Reuso de Node test/TypeScript e padrões locais | Atendido. |
| Testes novos mapeiam requisitos/casos de falha | Atendido para os treze casos. |
| Nenhum teste existente enfraquecido/deletado | Atendido. |
| Testes discriminam regressões relevantes | Cinco mutantes mortos. |
| Fontes reais correspondem ao ambiente temporário | Confirmado após correção pelo preflight sem chave. |
| Limites correspondem à spec | Confirmado após correção. |
| Diretriz local | `AGENTS.md:16` exige testes reais e review independente além dos validadores estruturais. |

## Requirement Traceability proposta ao autor

| Requisito | Estado verificado |
| --- | --- |
| AGP-01 | Contrato aprovado; sem afirmar modelo efetivo observado. |
| AGP-02 | Verificado. |
| AGP-03 | Verificado após correção da descoberta e do limite. |
| AGP-04 | Contrato/preflight aprovados após correção. |
| AGP-05 | Verificado nos cenários controlados Windows. |
| AGP-06 | Contrato aprovado; evidência de inferência real aguardada. |
| AGP-07 | Pending: sem respostas reais úteis. |
| AGP-08 | Verificado. |

O verificador escreveu somente este relatório. Atualizar spec/tasks e destilar lições cabe ao autor, conforme escopo recebido. Há sinal concreto para lições: validar fontes efetivas do harness, incluindo ancestrais; testar limites agregados além de limites por arquivo.

O gate determinístico de conclusão foi executado e rejeitou o veredicto FAIL, como esperado. Ele deve continuar reprovado até a resolução de AGP-07; testes simulados aprovados não autorizam marcar a feature como concluída.
