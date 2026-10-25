# Callers de publicação por consumidor

Cada pasta contém um caller completo e os dois arquivos de manifest para um projeto na raiz. Copie release.yml para .github/workflows/release.yml e os JSONs para a raiz do consumidor.

Substitua SHA_CENTRAL_REVISADO pelo mesmo SHA completo em todas as referências uses e central-ref. Esta entrega depende dos recursos preparados no PR #19; não use uma revisão anterior que não os contém. Substitua os seeds 0.0.1 pelas versões reais. Não altere manualmente um manifest para simular publicação.

| Pasta | Pré-requisitos do consumidor |
| --- | --- |
| node | package publicável no scope configurado, scripts test/build, arquivos dist, publishConfig e acesso a dependências privadas |
| maven | Wrapper executável, JDK compatível, POM e distributionManagement com id github; extra-file revision apenas se existir essa propriedade |
| gradle | Wrapper executável, JDK compatível, maven-publish/publications/repositories, gradle.properties e leitura da property version |
| go | go.mod/go.sum, testes e .goreleaser.yml v2; CLI na raiz e tags vX.Y.Z |
| simple | docs/package.json e lockfile com scripts docs:build; nenhuma distribuição a registry |

Node, Maven e Gradle publicam no GitHub Packages nestes exemplos. Node usa NODE_AUTH_TOKEN; os projetos JVM usam MAVEN_USERNAME/MAVEN_TOKEN. GITHUB_TOKEN precisa de acesso aos pacotes. Nos jobs verify, configure autenticação de leitura se a instalação das dependências do projeto exigir pacotes privados; em forks, secrets podem não estar disponíveis.

O caller aguarda Verify consumer antes de acionar a central após merge e valida novamente a revisão da tag antes de distribuir. O preview deve ser obrigatório junto à CI. Não defina o publicador pós-merge como check obrigatório do PR.

Os exemplos usam manifest mesmo com um só projeto para obter releases_created e lista de releases por tag. Os publicadores legados permanecem desabilitados. O caller Gradle solicita o novo publicador central com project-type gradle e publish-artifacts true; ele concede packages: write e não contém um publicador duplicado. Não adicione outro fluxo release/publish concorrente para a mesma versão.

Gradle usa a estratégia simple com updater genérico, sem pressupor release-type gradle no SDK. Não crie version.txt para esse exemplo. O nome da ferramenta de build não precisa coincidir com a estratégia de atualização do manifest.

Exemplos de raiz não são publicadores genéricos para monorepos: adapte a seleção de módulo/workspace e a instalação na raiz antes de usar matrix.path em comandos.
