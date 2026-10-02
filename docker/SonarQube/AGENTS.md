# Responsabilidades deste workspace

- O `.env` na raiz pertence somente ao stack central do Compose: senha do PostgreSQL e porta local. Nao colocar tokens de projeto nele.
- Cada projeto consumidor possui seu proprio `.envrc` local, carregado por direnv no Git Bash. Ele mapeia `SONAR_TOKEN` para uma variavel de ambiente externa especifica do projeto (ex.: `export SONAR_TOKEN="$SQP_K6"`) e fornece `SONAR_PROJECT_PATH`. O valor literal do token nao deve ser copiado para `.envrc`.
- Para SonarQube CLI e MCP, use um User Token externo separado do Project Analysis token. O `.envrc` do consumidor pode mapear essa variavel para `SONARQUBE_CLI_TOKEN` e `SONARQUBE_TOKEN`; nunca substitua `SONAR_TOKEN` do scanner pelo User Token por conveniencia.
- Cada consumidor possui seu `sonar-project.properties` na raiz do codigo. A chave, o escopo, os testes e os relatorios pertencem ao consumidor, nao a este stack.
- O Compose deste workspace hospeda um SonarQube compartilhado e define um scanner efemero. A invocacao de cada analise usa as variaveis do consumidor atual.
- Arquivos de exemplo em `examples/` nunca devem conter tokens ou senhas reais. Preserve essa separacao em alteracoes futuras.
