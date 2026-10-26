# Desenho do piloto remoto

**Status:** preparação do próximo piloto autorizada; execução remota ainda pendente.

## Architecture Overview

Config do consumidor → gerador TypeScript → dois callers Markdown → gh-aw0.93.5 → locks versionados → workflow_dispatch → AWF/OpenCode → verificação de integridade + artefatos.

O gerador reutiliza CAgenticConfiguration e o JSON examples/agentic/self-pilot/config.json. Cada consumidor mantém suas escolhas e secrets; a biblioteca central não armazena autenticação. As diretrizes globais integrais, AGENTS do consumidor, prompt e dados selecionados entram no prompt compilado com hashes. Conteúdo de dados não pode introduzir expressões Actions/macros.

## Approaches

Escolhida a continuação OpenCode/gh-aw pedida pelo usuário. Pi continua alternativa; usar Actions comum com o executor local não validaria o novo sandbox. Não duplicar o harness: usar o sample upstream fixado, com alteração mínima da política de ferramentas para o piloto somente leitura.

## Components

- shared/agentic-opencode.md: definição upstream do engine, pin32ecafbc061c9af57e9361942099e381102ae304, versão2.0.26. Adaptar apenas política nativa de ferramentas; preservar AWF/reflection/protocolo/contabilidade.
- CGhAwPilot.ts: renderizador de callers e manifesto de fingerprints, com modo check para CI. Sem acesso a valores de ambiente para credenciais.
- remote-pilot.ts: guard pre/post no runner, compara hashes e workspace e escreve proveniência no RUNNER_TEMP.
- agentic-triage.md e agentic-review.md: consumidores gerados com engine/model/auth explícitos e nenhum safe-outputs.
- CI: reproduzir geração/compilação com ferramenta fixada e verificar ausência de drift. Não chamar LLM na CI de PR.

## Authentication and publication

engine.env mapeia OPENAI_API_KEY e CODEX_API_KEY para a secret do consumidor, e OPENAI_BASE_URL para OpenRouter. A família técnica openai permite ao AWF selecionar a API compatível; o provedor continua OpenRouter. O agente recebe awf-proxy, não a chave real. Nenhuma secret Copilot é exigida porque safe-outputs está completamente ausente. Antes de habilitar escrita futura, especificar detector compatível e gates próprios.

## Risks & Concerns

| Concern | Mitigation |
| --- | --- |
| Sample experimental permite shell/escrita por padrão | Política deny por padrão, somente leitura; teste executa o harness contra fronteiras simuladas |
| Prova compilada não equivale a AWF rodando | Marcar runtime remoto pendente; registrar Docker local indisponível |
| Novos workflows manuais dependem de registro na branch padrão | PR revisável e instrução de integração humana; não mergear automaticamente |
| Modelos gratuitos podem retornar429 e gerar respostas imprecisas | Falha explícita, limites e inspeção humana de artefatos; nenhuma ação automática |
| Mudança de config/contexto sem recompilar | Hashes e check de reprodução na CI; guard antes da inferência |
| Workflow reutilizável tradicional não é a unidade principal do gh-aw | Compartilhar engine/componentes e gerador; cada consumidor mantém seus Markdown/locks |

## References

- https://github.com/github/gh-aw/tree/32ecafbc061c9af57e9361942099e381102ae304
- https://github.github.com/gh-aw/reference/third-party-agent/
- https://github.github.com/gh-aw/reference/imports/
- https://github.github.com/gh-aw/reference/threat-detection/
