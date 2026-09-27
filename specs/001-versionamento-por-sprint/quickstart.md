# Guia de validação: Versionamento por sprint

Pré-requisitos: LocalLabs com `develop`, quatro rodadas `release/vX.Y.Z` distintas,
milestone/épica/sub-issues por rodada, branch principal protegida, ambiente de homologação
com aprovação, identidade de automação que dispare checks, ferramentas instaladas
e SHA/tag revisada **existente** do compartilhado. Não ativar publicação antes do
check de PR estar corrigido e de as prévias serem ensaiadas.
Ver [contrato](contracts/versioning.md) e [modelo](data-model.md).

1. Mover a fixture de caller para `.github/workflows/` no LocalLabs com revisão fixa;
   executar CI própria (TypeScript e Spring Boot) e configurar o check de PR como
   obrigatório. Abrir feature → release, release → develop e develop → principal,
   primeiro com metadados válidos, depois inválidos. **Esperado**: três checks válidos
   passam sem SemVer obrigatório, transições inválidas falham; nenhuma tag criada.
2. Para release → develop, observar changelog guia se houver; indisponibilidade não
   pode bloquear o PR. Homologar em ambiente protegido e aprovar o PR final.
3. Uma rodada por `standard-version`, `changesets`, `jgitver`, `go-gitsemver`: usar
   versões/commits diferentes para que tags `vX.Y.Z` não colidam. Em Node, observar
   PR de versão criado após merge funcional, seus checks/review e merge, então tag no
   SHA versionado; em Java/Go, confirmar tag no SHA integrado quando derivado do Git.
4. Para `standard-version`, incluir vários PRs na mesma release sem tag intermediária:
   **esperado** um só incremento sobre as alterações acumuladas.
5. Reexecutar publicação dez vezes, testar duas tentativas concorrentes, tag igual
   apontando a outro commit e falha após criação da tag. **Esperado**: resultados
   idempotentes, nenhuma tag movida, retomada somente do estado íntegro.
6. Registrar URLs de checks, PRs de versão, tags/releases, SHAs e diagnósticos para
   cada rodada em `LocalLabs/tests/versioning/validation-results.md`.
