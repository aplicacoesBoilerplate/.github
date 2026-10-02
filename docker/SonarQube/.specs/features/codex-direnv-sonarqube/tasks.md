# Codex CLI por projeto com direnv e SonarQube Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implementar com a skill `tlc-spec-driven`: ativá-la pelo nome e seguir Execute, o gate de cada tarefa, um commit atômico por tarefa e a verificação independente final. Se a skill não estiver disponível, interromper Execute. Este documento é um **plano em rascunho**, não autorização para alterar configurações globais agora.

**Design**: `.specs/features/codex-direnv-sonarqube/design.md`
**Status**: Draft

## Preconditions and Decision Gates

1. Decidir como criar histórico Git local para este stack, hoje sem `.git`; o TLC exige commit por tarefa. Não inicializar Git automaticamente durante o planejamento.
2. Confirmar o corte aditivo: o perfil `direnv` desabilita `sonarqube-k6-local`, `MCP_DOCKER` e `context7` apenas no processo CLI, preservando suas definições globais e todo o `opencode.json`.
   Depois do piloto, decidir o corte global: o header Context7 contém hoje um valor literal e as entradas Sonar/Docker continuam ligadas ao k6. A proposta é migrar apenas o Codex global para referências ao ambiente, preservando OpenCode e direnv. Sem esse corte, o perfil resolve o uso CLI, mas não torna todo o `config.toml` genérico.
3. O `.envrc` do k6 é ignorado e contém referências locais; acrescentar `PROFILE_TOOLKIT` nele durante a ativação local, sem incluí-lo num commit. Decidir se o valor será literal não secreto (`k6_mcps`) ou mapeado de outra variável externa.
4. Preservar as mudanças já existentes no repositório k6; nenhum `git reset`, limpeza ou commit de alterações alheias a esta feature.

## Test Coverage Matrix

> Gerada do inventário de `AGENTS.md`, `README.md`, `docker-compose.yml` e scripts atuais. Não há suíte de testes neste stack; gates abaixo são propostos para esta integração, a confirmar antes de Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Instalação local do CLI / documentação | integration | Resolução do binário estável, versão e saída 0 em Git Bash. | PATH local e `README.md` | `command -v codex && codex --version` no Git Bash |
| Exemplo `.envrc` | integration | Carregamento por direnv sem token literal e variáveis do consumidor presentes. | `examples/consumer.envrc.example` | `direnv exec <consumidor> bash -c 'test -n "$SONAR_PROJECT_PATH"'` |
| Perfil TOML MCP | integration | TOML válido, MCPs dinâmicos visíveis só no perfil, credenciais não literais. | `examples/codex.direnv.config.toml.example` | `python -c 'import pathlib,tomllib; tomllib.loads(pathlib.Path("examples/codex.direnv.config.toml.example").read_text())'` e `codex --profile direnv mcp list` |
| Lançador Bash | integration | Ambientes distintos selecionam MCPs diferentes; variável parcial falha; saída nunca contém token. | `scripts/codex-project.sh`, `scripts/tests/codex-project-smoke.sh` | `bash scripts/tests/codex-project-smoke.sh` |
| Fluxo SonarQube/IDE | integration | Scanner registra k6; IDE mostra binding ativo; MCP lê quality gate com projeto k6. | `README.md` | Smoke local: Compose, painel Connected Mode e consulta MCP |

## Gate Check Commands

> Gerados do stack e dos testes propostos; confirmar antes de Execute. Os comandos que envolvem credenciais não devem imprimir valores.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após mudança do lançador | `bash scripts/tests/codex-project-smoke.sh` |
| Full | Após perfil ou fluxo Sonar | Parser TOML + `codex --profile direnv mcp list` + consulta MCP somente leitura no k6 |
| Build | Após fase ou configuração/documentação | `docker compose config --quiet` + validação TOML + smoke do lançador + `command -v codex && codex --version` |

## Execution Plan

As fases são sequenciais e cada tarefa termina com seu gate e commit de arquivos versionáveis. A ativação de arquivos locais ignorados é documentada e verificada separadamente.

### Phase 1: Foundation

```text
T1 → T2
```

### Phase 2: Codex MCP Configuration

```text
T3 → T4
```

### Phase 3: Pilot and Documentation

```text
T5
```

## Task Breakdown

### T1: Estabilizar o comando Codex CLI no Git Bash

**What**: Documentar e executar a instalação autônoma oficial do Codex CLI para Windows, priorizando `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin` no PATH do Git Bash.
**Where**: `README.md`
**Depends on**: None
**Reuses**: Instalação atual de autenticação do Codex; não toca no binário do App Desktop.
**Requirement**: CDX-01

**Tools**:

- MCP: Context7 para sintaxe atual do CLI.
- Skill: `openai-docs`, `tlc-spec-driven`.

**Done when**:

- [ ] `command -v codex` resolve para o diretório estável e `codex --version` retorna código 0 no Git Bash.
- [ ] O README explica a ordem do PATH e como reconhecer o binário versionado anterior.
- [ ] Gate Build passa e a alteração versionável é registrada em um commit próprio.

**Tests**: integration
**Gate**: build

### T2: Completar o contrato de ambiente dos consumidores

**What**: Acrescentar ao exemplo os mapeamentos opcionais de `PROFILE_TOOLKIT`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `API_KEY_CONTEXT7` e User Token, preservando as linhas de scanner existentes.
**Where**: `examples/consumer.envrc.example`
**Depends on**: T1
**Reuses**: `.envrc` atual do k6 e regras de `AGENTS.md`.
**Requirement**: CDX-09, CDX-10

**Tools**:

- MCP: Context7 para direnv.
- Skill: `tlc-spec-driven`.

**Done when**:

- [ ] O exemplo não contém token literal e distingue Project Analysis token de User Token.
- [ ] O valor do perfil Docker fica sob controle de cada consumidor.
- [ ] Um diretório de ensaio com variáveis fictícias carrega o exemplo por `direnv` sem depender do k6.
- [ ] Gate Build passa e há um commit próprio.

**Tests**: integration
**Gate**: build

### T3: Definir o perfil Codex aditivo para MCPs dinâmicos

**What**: Criar um modelo TOML de `~/.codex/direnv.config.toml` com SonarQube, Docker Gateway, GitHub e Context7 dinâmicos e entradas globais fixas desabilitadas somente nesse perfil.
**Where**: `examples/codex.direnv.config.toml.example`
**Depends on**: T2
**Reuses**: Nomes dos MCPs globais atuais e os recursos nativos `env_vars`, `bearer_token_env_var`, `env_http_headers`.
**Requirement**: CDX-03, CDX-04, CDX-05, CDX-06

**Tools**:

- MCP: Context7 para Codex, Docker MCP e SonarQube MCP.
- Skill: `openai-docs`, `sonarqube`, `tlc-spec-driven`.

**Done when**:

- [ ] O TOML é válido e não contém caminhos ou tokens do k6 nos novos MCPs.
- [ ] Docker Gateway expande `PROFILE_TOOLKIT` no Bash; GitHub usa bearer token por nome de variável; Context7 usa header por nome de variável.
- [ ] Sonar MCP recebe User Token, URL, chave padrão e `SONARQUBE_READ_ONLY=true`.
- [ ] Uma cópia local do perfil permite `codex --profile direnv mcp list` sem remover definições globais.
- [ ] Gate Full passa e há um commit próprio.

**Tests**: integration
**Gate**: full

### T4: Criar lançador de sessão por projeto

**What**: Criar `codex-project`, que carrega o `.envrc` aprovado por `direnv export bash`, valida o ambiente, seleciona MCPs opcionais por presença de variáveis e executa `codex --profile direnv` sem registrar credenciais em argumentos.
**Where**: `scripts/codex-project.sh`
**Test file**: `scripts/tests/codex-project-smoke.sh` (mesmo commit da implementação)
**Depends on**: T3
**Reuses**: Contrato de `.envrc` e perfil de T3.
**Requirement**: CDX-02, CDX-03, CDX-04, CDX-05, CDX-06

**Tools**:

- MCP: nenhum obrigatório para o código Bash.
- Skill: `tlc-spec-driven`.

**Done when**:

- [ ] Dois ambientes fictícios com chaves/perfis distintos geram argumentos de ativação diferentes para o Codex.
- [ ] Token Sonar presente com URL/chave ausente falha antes de iniciar o CLI e informa apenas o nome faltante.
- [ ] MCPs opcionais sem variáveis ficam desabilitados e nenhuma saída de `--check` contém valores de token.
- [ ] O teste de integração co-localizado e Gate Build passam; código e teste entram no mesmo commit.

**Tests**: integration
**Gate**: build

### T5: Fechar o piloto SonarQube e o guia operacional

**What**: Documentar a instalação local do perfil/lançador, o fluxo k6, as verificações da IDE, o scanner e a consulta MCP, com instruções para um segundo consumidor.
**Where**: `README.md`
**Depends on**: T4
**Reuses**: Compose, `sonar-project.properties`, scripts MCP já existentes e binding VS Code do k6.
**Requirement**: CDX-07, CDX-08, CDX-09, CDX-10

**Tools**:

- MCP: SonarQube para leitura do quality gate, se disponível no cliente de execução.
- Skill: `sonarqube`, `tlc-spec-driven`.

**Done when**:

- [ ] A ativação local adiciona `PROFILE_TOOLKIT` ao `.envrc` ignorado do k6 sem tocar nas linhas atuais e após novo `direnv allow`.
- [ ] O scanner publica análise de `K6-Runner` com `SONAR_TOKEN` de projeto; o MCP consulta o quality gate com User Token.
- [ ] A extensão mostra conexão e binding ativo em `K6-Runner` e analisa um arquivo aberto.
- [ ] O README registra os passos e a limitação de sessão fixa por processo, sem tokens literais.
- [ ] Gate Full/Build passa e a mudança versionável do README tem commit próprio; a configuração local ignorada permanece fora do commit.

**Tests**: integration
**Gate**: full

## Phase Execution Map

```text
Phase 1 → Phase 2 → Phase 3
Phase 1: T1 → T2
Transição: T2 → T3
Phase 2: T3 → T4
Transição: T4 → T5
Phase 3: T5
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Instalação local + seção README da instalação | ✅ Entregável único |
| T2 | Um exemplo `.envrc` | ✅ Entregável único |
| T3 | Um modelo TOML | ✅ Entregável único |
| T4 | Um lançador + seu teste de comportamento | ✅ Teste co-localizado |
| T5 | Uma seção operacional do README + smoke local | ✅ Entregável único |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | Phase 1 → Phase 2 | ✅ Match (entre fases) |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | Phase 2 → Phase 3 | ✅ Match (entre fases) |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Instalação / documentação | integration | integration | ✅ OK |
| T2 | Exemplo `.envrc` | integration | integration | ✅ OK |
| T3 | Perfil TOML | integration | integration | ✅ OK |
| T4 | Lançador Bash | integration | integration | ✅ OK |
| T5 | Fluxo SonarQube/IDE | integration | integration | ✅ OK |

## Execution Handoff

Antes de Execute, confirmar os gates de decisão no início do documento e quais MCPs/skills usar por tarefa. **Após T5**, executar uma revisão do corte global e detalhar uma tarefa TLC separada para migrar `~/.codex/config.toml`, com backup, gate e evidência; a forma exata depende da decisão do usuário sobre manter ou substituir as entradas antigas. O verificador independente final rederiva os resultados dos critérios de aceitação e escreve `validation.md`; não executar push nem deploy sem instrução específica.
