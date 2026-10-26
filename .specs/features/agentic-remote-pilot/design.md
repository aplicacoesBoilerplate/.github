# Desenho do piloto remoto

**Status:** preparação do próximo piloto autorizada; execução remota ainda pendente.

## Architecture Overview

Config do consumidor → gerador TypeScript → dois calleds Markdown + callers YAML manuais → gh-aw0.93.5 → locks versionados → workflow_dispatch → AWF/OpenCode → verificação de integridade + artefatos.

O gerador reutiliza CAgenticConfiguration e o JSON examples/agentic/self-pilot/config.json. Cada consumidor mantém suas escolhas e secrets; a biblioteca central não armazena autenticação. As diretrizes globais integrais, AGENTS do consumidor, prompt e dados selecionados entram no prompt compilado com hashes. Conteúdo de dados não pode introduzir expressões Actions/macros.

## Approaches

Escolhida a continuação OpenCode/gh-aw pedida pelo usuário. Pi continua alternativa; usar Actions comum com o executor local não validaria o novo sandbox. Não duplicar o harness: usar o sample upstream fixado, com alteração mínima da política de ferramentas para o piloto somente leitura.

## Components

- shared/agentic-opencode.md: definição upstream do engine, pin32ecafbc061c9af57e9361942099e381102ae304, versão2.0.26. Exigir AWF e remover chaves reais do filho; adaptar política nativa de ferramentas; preservar AWF/reflection/protocolo/contabilidade.
- CGhAwPilot.ts: renderizador de callers e manifesto de fingerprints, com modo check para CI. Sem acesso a valores de ambiente para credenciais.
- remote-pilot.ts: guard pre/post no runner, compara hashes e workspace e escreve proveniência no RUNNER_TEMP.
- agentic-triage.md e agentic-review.md: consumidores gerados com engine/model/auth explícitos e todos os handlers de publicação desativados.
- CI: reproduzir geração/compilação com ferramenta fixada e verificar ausência de drift. Não chamar LLM na CI de PR.

## Authentication and publication

O caller YAML mapeia explicitamente sua secret para o secret requerido OPENAI_API_KEY do workflow_call; engine.env contém somente OPENAI_BASE_URL para OpenRouter. Não usar secrets: inherit. A família técnica openai permite ao AWF selecionar a API compatível; o provedor continua OpenRouter. O agente recebe awf-proxy, não a chave real. Nenhuma secret Copilot é exigida: create-issue, report-missing-data, report-missing-tool, report-incomplete, report-failure-as-issue, report-failed-jobs e threat-detection estão explicitamente false. O pin injeta publicação quando o bloco é omitido. O detector só permanece fora deste piloto sem escrita; habilitar publicação exige novo contrato. Antes de habilitar escrita futura, especificar detector compatível e gates próprios.

## Risks & Concerns

O pin exige um terminal mesmo quando a resposta textual existe e o processo retorna zero. Habilitar apenas noop com max1 e report-as-issue:false. A política nativa permite exatamente safeoutputs_noop nos níveis global/build, mantendo shell/escrita e outras ferramentas MCP negadas. O prompt exige produzir o JSON e depois chamar o terminal; o harness não fabrica completion. Nenhum job safe_outputs, detector ou permissão write é acrescentado. A conclusão continua falhando se o terminal faltar.

O env técnico remoto OPENAI_BASE_URL usa https://openrouter.ai/api como prefixo upstream do AWF0.28.70. O harness descobre /v1 via /reflect e o proxy concatena os caminhos: /api + /v1/chat/completions resulta em /api/v1/chat/completions. Usar /api/v1 nesse env duplica /v1 e causa404. A URL pública direta continua https://openrouter.ai/api/v1; o executor local não muda. O fetch inicial de catálogo do pin pode consultar /api/models sem abortar; o helper recupera por /v1/models, encaminhado corretamente a /api/v1/models.

| Concern | Mitigation |
| --- | --- |
| Sample experimental permite shell/escrita por padrão | Política deny por padrão, somente leitura; teste executa o harness contra fronteiras simuladas |
| Prova compilada não equivale a AWF rodando | Marcar runtime remoto pendente; registrar Docker local indisponível |
| Novos workflows manuais dependem de registro na branch padrão | PR revisável e instrução de integração humana; não mergear automaticamente |
| Modelos gratuitos podem retornar429 e gerar respostas imprecisas | Falha explícita, limites e inspeção humana de artefatos; nenhuma ação automática |
| Mudança de config/contexto sem recompilar | Hashes e check de reprodução na CI; guard antes da inferência |
| Workflow reutilizável tradicional não é a unidade principal do gh-aw | Compartilhar engine/componentes e gerador; cada consumidor mantém seus Markdown/locks |

## References

Correção do primeiro run: pricing opcional em cada processo do JSON do consumidor, com input/output em USD por token. Renderizar models.providers.openai.models[modelo].cost, compatível com a família técnica do proxy. Ausência mantém o catálogo upstream; não adotar fallback global. A API pública OpenRouter confirmou preço zero para o modelo gratuito selecionado em 2026-10-26. Limites de turnos/tempo e credenciais não mudam.

- https://github.com/github/gh-aw/tree/32ecafbc061c9af57e9361942099e381102ae304
- https://github.github.com/gh-aw/reference/third-party-agent/
- https://github.github.com/gh-aw/reference/imports/
- https://github.github.com/gh-aw/reference/threat-detection/

O pin requer ao menos um MCP para AWF: usar GitHub local/read-only, somente get_file_contents, allowed-repos do consumidor e min-integrity merged. A política nativa continua negando ferramentas que não sejam read/glob/grep. O job conclusion permanece para diagnóstico, com actions read. O timeout de oito minutos limita a etapa de inferência; o job gerado mantém o orçamento de infraestrutura de sessenta minutos. max-turns=4 chega ao harness.
