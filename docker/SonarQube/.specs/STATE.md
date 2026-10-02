# STATE

## Decisions

### AD-001
- **Decision**: O Compose central guarda apenas credenciais do stack; cada consumidor mantém `sonar-project.properties` e injeta tokens por seu `.envrc` aprovado no direnv.
- **Reason**: Preserva o limite entre infraestrutura compartilhada e identidade/escopo de cada projeto.
- **Trade-off**: Cada consumidor precisa configurar seu próprio ambiente e arquivo de análise.
- **Scope**: Scanner, SonarQube CLI, SonarQube MCP e exemplos de consumidores.
- **Date**: 2026-10-02
- **Status**: active

### AD-002
- **Decision**: Para MCPs que variam por projeto, iniciar uma nova sessão do Codex CLI no Git Bash após o direnv carregar o `.envrc`.
- **Reason**: O processo do CLI recebe o ambiente do projeto no início da sessão; o App Desktop não oferece a mesma garantia para trocas de projeto já em execução.
- **Trade-off**: A troca de projeto exige uma nova sessão do CLI para recriar as conexões MCP.
- **Scope**: Integrações MCP locais do Codex por projeto.
- **Date**: 2026-10-02
- **Status**: active

### AD-003
- **Decision**: Instalar a CLI independente via npm e usar `~/.codex/direnv.config.toml` na sessao Git Bash; preservar o `config.toml` global usado pelo Desktop.
- **Reason**: O perfil carrega MCPs com credenciais por ambiente sem fazer o Desktop trocar conexoes durante a sessao.
- **Trade-off**: As entradas globais legadas continuam fixas e o header Context7 literal ainda precisa de uma decisao para migracao global.
- **Scope**: Codex CLI e MCPs SonarQube, Docker, GitHub e Context7.
- **Date**: 2026-10-02
- **Status**: active

## Handoff

- **Feature**: `.specs/features/codex-direnv-sonarqube/`
- **Phase / Task**: Piloto local implementado; verificacao visual final da IDE fica para o teste interativo do usuario.
- **Completed**: Codex CLI npm no PATH, perfil `direnv` instalado, lancador Git Bash ativo, k6 `.envrc` com perfil Docker, scanner k6 concluido, MCP SonarQube consultou quality gate `OK`, GitHub e Context7 responderam HTTP 200, Docker MCP dry-run carregou o perfil.
- **In-progress**: Verificacao final dos arquivos e documentacao.
- **Next step**: Usuario testa o codigo temporario no VS Code; decidir separadamente se o `config.toml` global do Desktop deve perder as entradas legadas e o header Context7 literal.
- **Blockers**: Esta pasta nao e repositorio Git, entao o gate de commits por tarefa do plano TLC nao pode ser executado aqui; a extensao SonarQube for IDE nao le tokens do `.envrc` automaticamente.
- **Uncommitted files**: Artefatos de planejamento em `.specs/`, perfil, lancador, smoke e README.
- **Branch**: N/A, sem repositório Git nesta pasta.
