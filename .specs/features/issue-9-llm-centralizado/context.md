# Contexto: acionamento centralizado de LLM

**Gathered:** 2026-10-12
**Status:** planejamento para revisão; implementação não iniciada.
**Issue:** https://github.com/aplicacoesBoilerplate/.github/issues/9

## Feature Boundary

Entregar um workflow reutilizável que executa Codex CLI com configurações e credenciais do consumidor, scripts auxiliares, contrato de resultado, caller de exemplo e documentação de ambos. Esta iteração entrega a especificação TLC e organiza o workspace; os arquivos executáveis abaixo são destinos planejados.

## Evidência de escopo e workspace

- Issue aberta, título `[PIPELINE] - Acionamento de LLM centralizado`, tipo remoto `Task`, label `Pipelines`, milestone `v1.0.0`, épica #3.
- A consulta de dependências não retornou bloqueantes para #9; #9 bloqueia #7 (triagem) e #8 (code review).
- `gh issue view` retornou `projectItems: []`. Isso não comprova a inexistência de associação sob outras permissões; nenhum Status foi alterado.
- Worktree existente e inicialmente limpo: `C:/Users/gerso/.codex/worktrees/issue-9-llm-centralizado/.github`.
- Branch reutilizada: `feature/issue-9-llm-centralizado`, upstream `origin/feature/issue-9-llm-centralizado`, ambos inicialmente em `6901ff4371f5b100f392d7a8d078318ebdf5904c`.
- Base confirmada: `origin/release/v1.0.0`, SHA `59663cd1517dddd477cca2fe2435d8c81a6c52d7`, ancestral de HEAD. A branch contém dois commits prévios de planejamento. Não depende das branches de triagem ou review.
- Fluxo de entrega: feature desta issue → release/v1.0.0 → develop → master. Não houve rebase, renomeação ou criação de worktree duplicado.
- O checkout principal em `develop` contém alterações alheias a esta entrega, preservadas.
- Repositório central confirmado público; consumidores de sessão ChatGPT serão privados. Compartilhamento entre organizações usa o código público, nunca uma identidade global.

## Implementation Decisions

### Decisões expressas pelo usuário

- Caller escolhe como acionar a LLM, modelo, esforço, prompt, evento e credenciais da aplicação.
- O central compartilha a lógica executável e os templates; não mantém autenticação global para várias aplicações.
- Histórico preservado: primeiro adaptador é Codex CLI; assinatura ChatGPT existente é a rota do piloto, sem exigir faturamento de API.
- PAT do consumidor pode preservar a sessão que o CLI renovar. Ele não cria nem renova uma sessão OpenAI por conta própria.
- Diretrizes comuns partem do conteúdo integral do AGENTS.md global; diretrizes específicas permanecem no consumidor.
- Ações de negócio, alterações de código e PRs pertencem aos consumidores de triagem/review.

### Supersessão do planejamento anterior

`openspec/changes/codex-cli-auth-persistence/` fica como histórico. Este conjunto TLC é a fonte corrente para #9. A alteração principal é tornar a configuração de invocação explícita no caller, retirar o roteamento global de modelos e corrigir a hipótese de que a fila atualiza snapshots de secrets.

### Assumptions para revisão

- A responsabilidade pela credencial inclui escolha, provisionamento, escopo, rotação, revogação e recuperação no consumidor. O central pode executar um adaptador genérico de autenticação durante o job desse consumidor, exclusivamente com os secrets recebidos.
- O MVP suporta `chatgpt-session`; o contrato documenta `api-key` como alternativa opt-in, sem ativá-la no piloto e sem fallback que gere cobrança.
- O caller oferece modos `single` e `decision-then-prompt`, até duas invocações por chamada; seleção é determinística a partir da configuração versionada.
- Persistência de sessão usa repository secrets já disponíveis ao usuário. Snapshot antigo é recusado; o mantenedor dispara um novo workflow. Um cofre com leitura tardia ou environment secrets é evolução separada.
- Primeira adoção real por `workflow_dispatch` na branch padrão confiável. #7/#8 depois acrescentam seus triggers e contexto, com revisão do mesmo limite de confiança.

## Análise de necessidade de SDD

SDD completo é necessário mesmo com tipo remoto `Task`: há API pública de reuso, credenciais, estado renovável, concorrência, execução externa e dois consumidores dependentes. Size/Effort não foram obtidos; não foram inventados. Profundidade TLC: Large/Complex, com spec, design, tarefas, cenários de teste e memória. Aprovação anterior do OpenSpec não aprova automaticamente esta revisão TLC.

## Deferred Ideas

Harness dentro da pipeline: sugestão do mantenedor em 2026-10-13, para extensão posterior ao MVP. Não habilitar execução de ferramentas/scripts arbitrários nesta entrega; preservar contrato e propriedade das credenciais ao discutir a evolução.

Outros provedores, autenticação global, broker de sessões, runners persistentes, invocação arbitrária de shell, edição de código no job com credenciais, serviços HTTP adicionais e implementação de #7/#8 não fazem parte desta entrega.
