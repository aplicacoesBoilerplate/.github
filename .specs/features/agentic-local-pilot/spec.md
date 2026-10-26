# Piloto local de agentes no próprio .github

**Status:** recorte local autorizado em 2026-10-26; implementação em andamento.

## Problem Statement

As issues #7, #8 e #9 precisam validar um harness com vários provedores antes da migração para GitHub Agentic Workflows. A master atual usa helpers TypeScript em ci-scripts. O próprio aplicacoesBoilerplate/.github será consumidor e caso real deste piloto.

## Goals

- [ ] Executar triagem e revisão reais com OpenCode e a chave OpenRouter fornecida pelo consumidor.
- [ ] Preservar modelo e prompt próprios por processo e gerar evidências locais verificáveis.
- [ ] Preparar o contrato SonarQube sem declarar homologação de um servidor ainda indisponível.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Ativação no Actions, comentários, commits do agente, PRs e alterações de Project | O usuário aprovou validar localmente primeiro. |
| Substituir os PRs anteriores ou concluir as issues #7–#9 | Este piloto informa a migração; não comprova todos os contratos existentes. |
| Adaptadores Codex/Claude implementados, instalação de MCP e execução de SonarScanner | Credenciais/infraestrutura e homologação próprias ficam para a próxima etapa. |
| Testes de documentação e framework de execução próprio | Priorizar chamadas reais e contratos que detectam falhas. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Consumidor | O próprio .github | Correção explícita do usuário; demo-repository externo excluído | Sim |
| Execução inicial | Local, resultados locais | Escolha explícita do usuário no esclarecimento | Sim |
| Harness e provedor | OpenCode 2.0.26 e OpenRouter | Usuário escolheu engine com vários provedores e disponibilizou API key | Sim |
| Uso de credencial | API_KEY_OPENROUTER mapeada apenas para OPENROUTER_API_KEY no processo filho | A chave pertence ao consumidor; não entra em arquivo | Sim |
| Modelos iniciais | liquid/lfm-2.5-2.6b:free declarado separadamente nos dois processos | Gemma gratuito retornou429; Liquid respondeu ao probe direto. IDs distintos já são testados no contrato; não há fallback automático | Decisão técnica do piloto |
| Entrada de triagem | Caso controlado sobre caminho de pacote no código real da master | Exercitar decisão e contexto sem criar issue remota | Proposta técnica |
| Entrada de revisão | Patch controlado de regressão na validação de caminhos | Permitir avaliar a resposta contra uma falha conhecida no código real | Proposta técnica |
| SonarQube | enabled=false; mainBranch=develop; scanner=cli; gate obrigatório quando habilitado | Servidor em preparação; preservar fluxo corretivo aprovado | Sim quanto ao fluxo; nomes de campos são proposta |
| Base Git | Worktree separado, branch criada da release existente e atualizada por fast-forward até master 4176883 | release/v1.0.0 é ancestral da master; não modificar branches remotas ou antigas | Proposta técnica |

**Open questions:** none — decisões restantes estão registradas como defaults explícitos.

## User Stories

### P1: Configuração por processo

**Acceptance Criteria**:

1. WHEN o consumidor configurar triage e review THEN o piloto SHALL preservar engine, provider, model e prompt de cada processo na invocação e na evidência. (AGP-01)
2. IF faltar credencial, a engine não estiver implementada ou o caminho escapar do repositório THEN o piloto SHALL falhar antes de iniciar o harness. (AGP-02)

**Independent Test:** carregar configuração com modelos diferentes e rejeitar configurações inválidas sem iniciar processo.

### P1: Harness temporário

**Acceptance Criteria**:

1. WHEN uma chamada começar THEN o piloto SHALL montar um workspace temporário apenas com arquivos versionados explicitamente selecionados e diretrizes globais completas mais AGENTS.md do consumidor. (AGP-03)
2. WHILE o harness executar the piloto SHALL fornecer somente a credencial do provedor escolhido e variáveis operacionais permitidas, com shell, escrita e MCP desabilitados. (AGP-04)
3. IF ocorrer timeout, erro do harness ou ausência de resposta THEN o piloto SHALL falhar sem produzir evidência de sucesso e remover os arquivos temporários. (AGP-05)

**Independent Test:** processo simulado inspeciona ambiente e workspace; falha e timeout confirmam limpeza.

### P1: Evidência real e limite do piloto

**Acceptance Criteria**:

1. WHEN triagem e revisão terminarem THEN o piloto SHALL persistir JSON local com repositório, SHA, engine, versão, provider, modelo, hashes das entradas/diretrizes e resposta não vazia, sem chave de autenticação. (AGP-06)
2. WHEN o piloto real for validado THEN a triagem SHALL identificar necessidade de confirmação humana quando faltarem metadados da issue e a revisão SHALL identificar a regressão controlada de traversal. (AGP-07)
3. WHERE SonarQube estiver desabilitado the piloto SHALL registrar not-run; nenhuma execução local SHALL afirmar aprovação de Quality Gate ou homologação de gh-aw. (AGP-08)

**Independent Test:** duas inferências reais com resultados inspecionados; arquivos-fonte originais permanecem intactos.

## Edge Cases

- IF a API não autorizar o modelo ou limitar requisições THEN o piloto SHALL falhar explicitamente sem trocar silenciosamente de modelo.
- IF uma resposta contiver a credencial em texto THEN o piloto SHALL rejeitar sua persistência.
- IF uma configuração apontar para symlink ou arquivo não versionado THEN o piloto SHALL recusar esse arquivo.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AGP-01 | Configuração por processo | Execute | Implementing |
| AGP-02 | Configuração por processo | Execute | Implementing |
| AGP-03 | Harness temporário | Execute | Pending |
| AGP-04 | Harness temporário | Execute | Pending |
| AGP-05 | Harness temporário | Execute | Pending |
| AGP-06 | Evidência real | Execute | Pending |
| AGP-07 | Evidência real | Execute | Pending |
| AGP-08 | Evidência real | Execute | Pending |

## Success Criteria

- [ ] Duas chamadas reais aprovadas por inspeção de resultado, com modelos configurados separadamente.
- [ ] Testes relevantes de isolamento, configuração, timeout e falha aprovados; typecheck e regressões existentes preservados.
- [ ] Revisão independente e sensor de discriminação concluídos antes da entrega local.

## Implicit requirements

Limites: até 64 KiB de diretrizes, 64 KiB de contexto e 120 s por chamada. Falhas: não publicar resultado parcial como sucesso. Idempotência: resultado identificado por hash e processo, sem retries automáticos. Autenticação: ambiente fechado por provedor. Concorrência: chamadas locais sequenciais, sem sessão compartilhada. Ciclo de vida: workspace descartado em finally. Observabilidade: metadados e resposta final, sem stdout bruto ou secrets. Dependências externas: falha explícita, sem fallback. Estados: Sonar e Actions permanecem not-run; nenhum recurso remoto é escrito.
