# Codex CLI por projeto com direnv e SonarQube Specification

## Problem Statement

O Codex lê MCPs em `~/.codex/config.toml`, mas duas entradas globais atuais estão presas ao k6 Runner. O fluxo deve usar uma sessão do Codex CLI iniciada no Git Bash após `direnv allow`, com conexões MCP escolhidas pelo ambiente do consumidor, sem alterar as configurações existentes do OpenCode e sem misturar o token de análise do scanner com o User Token.

## Goals

- [ ] `codex` resolve para uma instalação autônoma em caminho estável no PATH do Git Bash.
- [ ] Uma sessão CLI iniciada em cada consumidor seleciona os MCPs e o projeto SonarQube daquele ambiente, sem credenciais literais em arquivos de configuração.
- [ ] O k6 Runner demonstra scanner, SonarQube for IDE conectado e SonarQube MCP no mesmo projeto.
- [ ] As entradas atuais de OpenCode, direnv e Codex permanecem recuperáveis; o novo fluxo é aditivo até decisão explícita de migração.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar ou remover `opencode.json` e entradas globais legadas | Pedido explícito de preservação. |
| Trocar de projeto MCP dentro de uma sessão Codex já iniciada | O processo MCP é criado para a sessão atual. |
| Substituir o SonarScanner do Compose pelo SonarQube CLI ou pelo MCP | São ferramentas com funções diferentes. |
| Publicar, fazer push ou implantar fora desta máquina | Escopo local de testes. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Como tratar as entradas globais fixas do Codex durante a transição? | Primeiro criar um perfil CLI `direnv` que as desabilita somente nessa sessão; após o piloto, migrar o `config.toml` global em um corte separado aprovado pelo usuário. | Permite provar o fluxo adaptativo antes de trocar os registros existentes do Codex; o estado final global depende desse corte. | Não; requer decisão antes do corte. |
| O header Context7 hoje contém valor literal em `config.toml`; como retirá-lo? | No corte global, trocar `http_headers` por `env_http_headers` apontando para `API_KEY_CONTEXT7`, sem tocar no OpenCode. | O perfil novo não corrige o valor já gravado no arquivo global. | Não; requer decisão antes do corte. |
| Como cumprir o commit atômico exigido pelo TLC neste workspace sem `.git`? | Inicializar um repositório Git local para o stack antes da fase Execute; mudanças no k6 terão commit próprio no repositório k6. | O contrato de execução TLC exige um commit por tarefa. | Não; requer decisão antes do Execute. |
| Qual nível de paridade com os MCPs do OpenCode? | Cobrir SonarQube, Docker MCP, GitHub e Context7 no primeiro ciclo; preservar Pencil e agent-skills existentes; acrescentar GitKraken e ApexCharts após verificar comandos e necessidade. | Prioriza o comportamento dinâmico pedido sem trocar integrações estáveis sem teste. | Não; escopo sugerido. |
| Como selecionar o perfil Docker de cada projeto? | Cada `.envrc` exporta `PROFILE_TOOLKIT` explicitamente, podendo mapear uma variável externa; o valor global Windows não define o projeto ativo. | O k6 hoje depende do valor global `k6_mcps`, que pode vazar como seleção para outros projetos. | Não; recomendação. |
| Qual teste automatizado é adequado? | Scripts de configuração têm checagens de contrato e execução seca; conexões reais usam smoke tests locais. | Este stack não tem suíte de testes e a mudança é de configuração/integracão. | Não; revisar antes do Execute. |

**Open questions:** none - as decisões pendentes têm default e justificativa na tabela acima; nenhuma foi aplicada.

---

## User Stories

### P1: Iniciar Codex CLI por consumidor ⭐ MVP

**User Story**: Como desenvolvedor, quero iniciar o Codex no Git Bash do projeto depois do direnv para receber as variáveis daquele projeto.

**Why P1**: É a fronteira que torna o MCP adaptativo por sessão.

**Acceptance Criteria**:

1. WHEN `codex-project` é iniciado em um diretório com `.envrc` aprovado THEN o fluxo SHALL iniciar o Codex CLI herdando as variáveis exportadas naquele terminal sem imprimir seus valores.
2. IF `SONARQUBE_TOKEN` estiver definido mas `SONARQUBE_URL` ou `SONARQUBE_PROJECT_KEY` estiver ausente THEN o fluxo SHALL encerrar antes de iniciar o MCP e nomear apenas as variáveis ausentes.
3. WHEN duas sessões são iniciadas com valores diferentes de `SONARQUBE_PROJECT_KEY` e `PROFILE_TOOLKIT` THEN cada sessão SHALL carregar seus próprios valores sem alterar os da outra.
4. WHEN o Git Bash resolve `codex` THEN o comando SHALL apontar para o binário autônomo em `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`, e `codex --version` SHALL retornar código 0.

**Independent Test**: Abrir duas sessões Git Bash com ambientes distintos, usar o modo de verificação do lançador e conferir `command -v codex`.

### P1: MCPs dinâmicos sem credenciais literais

**User Story**: Como desenvolvedor, quero que SonarQube, Docker MCP, GitHub e Context7 leiam variáveis do ambiente atual, preservando os registros existentes.

**Why P1**: Os registros estáticos atuais não acompanham a troca de consumidor.

**Acceptance Criteria**:

1. WHEN a sessão CLI possui `SONARQUBE_TOKEN`, `SONARQUBE_URL` e `SONARQUBE_PROJECT_KEY` THEN o MCP SonarQube SHALL iniciar em modo somente leitura e usar a chave como projeto padrão.
2. WHEN a sessão CLI possui `PROFILE_TOOLKIT` THEN o Docker MCP Gateway SHALL receber esse valor como argumento de `--profile`.
3. WHEN a sessão CLI possui `GITHUB_PERSONAL_ACCESS_TOKEN` THEN o MCP GitHub SHALL usar esse valor como bearer token sem gravá-lo no TOML.
4. WHEN a sessão CLI possui `API_KEY_CONTEXT7` THEN o MCP Context7 SHALL preencher o header a partir dessa variável sem gravá-la no TOML.
5. IF uma variável opcional de um MCP estiver ausente THEN o lançador SHALL desabilitar esse MCP na sessão e preservar os demais MCPs elegíveis.
6. The system SHALL preservar o conteúdo atual de `opencode.json`, das linhas existentes de `.envrc` e das entradas globais atuais do Codex.

**Independent Test**: Conferir o TOML efetivo e a lista de MCPs numa sessão com variáveis presentes e noutra sem variáveis opcionais; comparar hashes de arquivos preservados.

### P1: Concluir integração SonarQube do k6

**User Story**: Como desenvolvedor do k6 Runner, quero confirmar a análise completa, o modo conectado da IDE e as consultas MCP no mesmo projeto.

**Why P1**: Fecha a demanda original do SonarQube com evidência operacional.

**Acceptance Criteria**:

1. WHEN o scanner efêmero executa no k6 THEN o SonarQube SHALL registrar uma análise para `K6-Runner` sem usar o User Token do MCP.
2. WHEN a pasta k6 é aberta no VS Code THEN o SonarQube for IDE SHALL mostrar conexão ativa e binding com `K6-Runner` usando User Token.
3. WHEN o Codex CLI chama o MCP SonarQube na sessão k6 THEN a consulta ao quality gate SHALL retornar o projeto `K6-Runner` sem alterar dados no servidor.
4. The system SHALL manter `SONAR_TOKEN` como Project Analysis token e `SONARQUBE_TOKEN`/`SONARQUBE_CLI_TOKEN` como User Token.

**Independent Test**: Conferir a última análise na UI/API, o Connected Mode na IDE e uma consulta MCP de leitura.

### P2: Documentar e repetir o fluxo

**User Story**: Como mantenedor, quero instruções e modelos para adicionar outro consumidor sem copiar tokens ou caminhos do k6.

**Why P2**: Torna a solução reproduzível além do piloto.

**Acceptance Criteria**:

1. WHEN um segundo consumidor copia os exemplos e aprova seu `.envrc` THEN o fluxo SHALL aceitar sua própria chave, token de análise, User Token, perfil Docker e caminho de projeto sem editar o Compose central.
2. IF o servidor SonarQube estiver indisponível THEN o fluxo SHALL emitir falha identificável e manter a configuração de outros MCPs intacta.
3. The system SHALL documentar que `SONARQUBE_PROJECT_KEY` é um projeto padrão do MCP e não restringe permissões do User Token.

**Independent Test**: Simular dois ambientes sem credenciais reais no modo de verificação e seguir o README do zero para o k6.

## Edge Cases

- IF o `.envrc` não estiver aprovado THEN o fluxo SHALL instruir `direnv allow` e não executar MCPs que dependem das variáveis ausentes.
- IF `PROFILE_TOOLKIT` estiver vazio THEN o fluxo SHALL desabilitar o Docker MCP da sessão em vez de reutilizar `k6_mcps` por omissão.
- WHEN o usuário muda de projeto THEN o fluxo SHALL exigir novo processo Codex para aplicar o novo ambiente aos MCPs.

## Implicit Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Validar variáveis exigidas e caminhos do executável antes de iniciar MCPs. |
| Failure / partial failure | MCP opcional ausente é desabilitado; conjunto Sonar parcial falha com nomes de variáveis. |
| Idempotency / retry | Reexecutar o lançador cria nova sessão sem modificar `.envrc` ou `opencode.json`. |
| Auth boundaries & rate limits | Separar Project Analysis token do User Token; nenhuma mudança em rate limits do servidor. |
| Concurrency / ordering | Cada processo CLI recebe snapshot próprio do ambiente; troca exige nova sessão. |
| Data lifecycle / expiry | Tokens permanecem nas variáveis externas; expiração é tratada por novo token externo, sem atualização em TOML. |
| Observability | Checagens mostram nomes/presença de variáveis e MCPs ativos, sem valores secretos. |
| External-dependency failure | Docker/Sonar indisponível produz erro diagnosticável; nenhum fallback para outro projeto. |
| State-transition integrity | Perfil `direnv` só é usado depois de o `.envrc` estar aprovado e carregado. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CDX-01 | P1: Iniciar Codex CLI | Foundation | Pending |
| CDX-02 | P1: Iniciar Codex CLI | Foundation | Pending |
| CDX-03 | P1: MCPs dinâmicos | Configuration | Pending |
| CDX-04 | P1: MCPs dinâmicos | Configuration | Pending |
| CDX-05 | P1: MCPs dinâmicos | Configuration | Pending |
| CDX-06 | P1: MCPs dinâmicos | Configuration | Pending |
| CDX-07 | P1: Concluir integração SonarQube | Pilot | Pending |
| CDX-08 | P1: Concluir integração SonarQube | Pilot | Pending |
| CDX-09 | P1: Concluir integração SonarQube | Pilot | Pending |
| CDX-10 | P2: Documentar e repetir | Documentation | Pending |

**Coverage:** 10 total, 10 mapeados a tarefas propostas, 0 sem mapeamento.

## Success Criteria

- [ ] `command -v codex` aponta para o diretório estável da instalação autônoma e `codex --version` sai com código 0.
- [ ] Dois ambientes distintos produzem seleções MCP diferentes, sem alterar arquivos de configuração entre sessões.
- [ ] K6 Runner tem scanner, Connected Mode e leitura MCP confirmados com os tokens corretos.
- [ ] `opencode.json` e entradas globais atuais do Codex permanecem preservados.
- [ ] Após decisão de corte, `~/.codex/config.toml` deixa de conter o valor literal do token Context7 e as entradas de projeto fixo são migradas ou desativadas conscientemente.
