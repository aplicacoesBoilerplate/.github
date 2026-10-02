# Codex CLI por projeto com direnv e SonarQube Context

**Gathered:** 2026-10-02
**Spec:** `.specs/features/codex-direnv-sonarqube/spec.md`
**Status:** Decisões do usuário registradas; conflitos pendentes no spec.

## Feature Boundary

Adicionar um fluxo local de Codex CLI por consumidor, com ambiente carregado pelo direnv, MCPs adaptativos e conclusão do piloto SonarQube no k6 Runner.

## Implementation Decisions

### Ambiente por projeto

- Usar Git Bash e `direnv allow` antes de iniciar uma nova sessão Codex CLI.
- Não apagar nem substituir as configurações existentes de OpenCode e direnv.
- O `.envrc` contém referências a tokens externos, nunca seus valores literais.
- `SONAR_TOKEN` continua reservado ao scanner do consumidor; o MCP e a IDE usam User Token separado.

### SonarQube

- Um Compose central atende vários consumidores; o scanner é efêmero e cada consumidor mantém seu `sonar-project.properties`.
- O k6 Runner é o piloto atual; o usuário quer SonarQube MCP no VS Code e no Codex.

### Agent's Discretion

- Nomes de novos arquivos de exemplo e comandos de checagem, desde que não sobrescrevam os arquivos existentes.

### Declined / Undiscussed Gray Areas → Assumptions

- O tratamento das entradas globais fixas, o Git ausente e o alcance da paridade MCP estão registrados como defaults pendentes em `spec.md`.

## Deferred Ideas

- Usar a sessão do App Desktop para alternar o destino de MCP durante a execução.
- Migrar automaticamente todas as entradas de MCP do OpenCode sem conferir compatibilidade do cliente.
