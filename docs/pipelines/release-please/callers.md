# Callers: CI, versionamento e publicação

O caller vive no repositório consumidor. Ele define eventos e permissões, executa a CI do projeto e chama a central. O publicador conhece registry, build e credenciais do produto.

## Caminho recomendado

Os exemplos desta página usam manifest nativo, inclusive com um projeto único. Isso oferece outputs por release e permite publicar no consumidor com checkout da tag exata. `publish-artifacts: false` desabilita os publicadores centrais; ele não desliga os jobs publish definidos pelo próprio caller. O exemplo Gradle usa true e publica na central.

1. Copie o config e o manifest do adaptador para a raiz.
2. Ajuste o seed para a última versão conhecida e confira o histórico.
3. Prepare os arquivos de build/publicação descritos em [artefatos publicados](./artefatos-publicados).
4. Copie release.yml para .github/workflows/release.yml.
5. Substitua todas as ocorrências de `SHA_CENTRAL_REVISADO` pelo mesmo SHA completo da central.
6. Cadastre a CI e o preview de versão como checks obrigatórios.
7. Integre uma entrega funcional, revise o PR técnico e só então integre a proposta de release.

Os nomes de projeto, scope, registry, versão, entrypoint e JDK são exemplos, não valores universais. Os recursos novos precisam de uma revisão que contenha esta entrega do PR #19.

## Estrutura compartilhada e responsabilidades

Cada caller tem version-policy de leitura, verify para build/testes e release reutilizável após merge. Node/Maven/Go têm publish no consumidor; Gradle usa o step Adaptador Gradle dentro do mesmo job release-please da central. Simple não distribui a registry.

A CI roda em PR e no commit integrado. O release depende da CI do merge. Os publicadores Node/Maven/Go recebem needs.release.outputs.releases, constroem uma matriz e fazem checkout de matrix.tag_name. O Gradle central seleciona uma única release desse output e faz checkout da sua tag. Antes de distribuir, verifica a revisão publicada.

~~~yaml
publish:
  needs: release
  if: needs.release.outputs.releases_created == 'true'
  strategy:
    matrix:
      include: ${{ fromJSON(needs.release.outputs.releases) }}
~~~

Essa é uma parte do job, não um workflow completo. Veja abaixo os arquivos completos de cada stack.

## Node

Config de release:

<<< ../../../examples/versioning/consumers/node/release-please-config.json

Estado inicial:

<<< ../../../examples/versioning/consumers/node/.release-please-manifest.json

Caller completo:

<<< ../../../examples/versioning/consumers/node/release.yml

O projeto precisa de scripts test/build, package publicável e publishConfig. O job configura npm.pkg.github.com e o scope. Para npmjs.org, substitua registry, publishConfig e autenticação juntos. A CI precisa conseguir instalar dependências privadas antes de executar testes.

## Maven

Config para reactor com revision:

<<< ../../../examples/versioning/consumers/maven/release-please-config.json

Estado inicial:

<<< ../../../examples/versioning/consumers/maven/.release-please-manifest.json

Caller completo:

<<< ../../../examples/versioning/consumers/maven/release.yml

O POM usa distributionManagement com `id: github`, igual ao server-id do setup-java. O Wrapper deve ser executável. O exemplo usa JDK 17: ajuste à aplicação e aos plugins. Se o POM não usa revision, remova somente o extra-file dessa propriedade.

A publicação do reactor ocorre na raiz e pode incluir parent/BOM/módulos. Quando versões são independentes, crie componentes por caminho e adapte o publicador para as coordenadas daquele componente.

## Gradle

O nome legado gradle não tem implementação nativa equivalente no SDK 17.3.0. Para publicar sem depender dessa implementação ausente, o exemplo usa manifest simple + extra-file e solicita o publicador Gradle da central.

Config:

<<< ../../../examples/versioning/consumers/gradle/release-please-config.json

Arquivo de versão do consumidor:

<<< ../../../examples/versioning/consumers/gradle/gradle.properties

Estado inicial:

<<< ../../../examples/versioning/consumers/gradle/.release-please-manifest.json

Caller completo:

<<< ../../../examples/versioning/consumers/gradle/release.yml

Mantenha o build.gradle.kts com maven-publish, publications e repositories conforme [configuração Gradle](./artefatos-publicados#gradle-java-e-kotlin). O número deve vir de gradle.properties. A central prepara o JDK no mesmo job release-please por gradle-java-version, faz checkout da tag e executa check publish com o Wrapper.

O caller ativa project-type gradle e publish-artifacts true, concede packages: write para GitHub Packages e não mantém outro job de distribuição. O publicador central exige uma única release simple no project-path selecionado; em monorepo, selecione o pacote nas chamadas de preview e release. Em multi-project builds cujo Wrapper publica vários módulos, adapte o build ou mantenha um publicador especializado no caller.

### Contrato de publicação Gradle central

- `config-file` define a estratégia simple e o updater; `project-type: gradle` define a ferramenta de publicação.
- `publish-artifacts` permanece false por padrão e precisa ser true para distribuir.
- `gradle-java-version` escolhe o JDK (padrão 17).
- O caller mantém Wrapper executável, maven-publish/publications/repositories e leitura de version.
- O único job release-please herda as permissões do caller; não exige packages: write de consumidores que não publicam.
- As credenciais opcionais são passadas em secrets; assinatura e plugins específicos do destino continuam no projeto.
- O step publicador só executa quando o SDK retorna uma release nova. Lista vazia, múltiplos alvos ou alvo incompatível não publicam.
- Se um registry falhar após a tag, recupere a publicação da mesma tag; não recrie a release para forçar um upload.

~~~yaml
# Opcional, no job release do caller, ao lado de with:
secrets:
  GRADLE_PUBLISH_USERNAME: ${{ secrets.MEU_USUARIO_REGISTRY }}
  GRADLE_PUBLISH_TOKEN: ${{ secrets.MEU_TOKEN_REGISTRY }}
~~~

## Go

Config de versão:

<<< ../../../examples/versioning/consumers/go/release-please-config.json

Estado inicial:

<<< ../../../examples/versioning/consumers/go/.release-please-manifest.json

Caller completo:

<<< ../../../examples/versioning/consumers/go/release.yml

O exemplo é uma aplicação CLI na raiz com .goreleaser.yml v2 e tags vX.Y.Z. O checkout baixa histórico e tags. GoReleaser anexa assets à Release existente sem substituir suas notas, conforme configuração do projeto.

Para uma biblioteca Go, tag/Release podem ser suficientes; nesse caso remova o job publish. Um projeto Go em subdiretório ou com namespace de tag diferente precisa adaptar módulos, caminhos e a política de tags do GoReleaser.

## Simple

Config do catálogo com docs:

<<< ../../../examples/versioning/consumers/simple/release-please-config.json

Estado inicial:

<<< ../../../examples/versioning/consumers/simple/.release-please-manifest.json

Caller completo:

<<< ../../../examples/versioning/consumers/simple/release.yml

Não há job publish a registry. Os extra-files mantêm o package e lock da documentação alinhados; o TXT de homologação não é necessário. Ajuste extra-files para outros produtos simple. O deploy do site pertence ao workflow Pages.

## Permissões, secrets e autenticação

| Ação | Permissão/credencial |
| --- | --- |
| Preview de versão | contents: read e pull-requests: read |
| Checkout e CI pública | contents: read |
| Criar PR técnico, tag e Release | contents: write, pull-requests: write e issues: write |
| Publicar GitHub Packages | packages: write e acesso do repositório ao pacote |
| Anexar assets à Release | contents: write |
| Registry externo | Secret/token ou relação de autenticação definida pelo registry |

O GITHUB_TOKEN é do workflow do consumidor. A PAT do terminal não é transferida automaticamente para as Actions. Não copie PATs para arquivos versionados e não use secrets: inherit quando bastar passar secrets específicos.

Node/Maven/Go mantêm credenciais nos jobs publish do caller. O publicador Gradle central usa MAVEN_USERNAME/MAVEN_TOKEN com github.actor/GITHUB_TOKEN como padrão. Para outro registry, passe explicitamente os secrets opcionais GRADLE_PUBLISH_USERNAME e GRADLE_PUBLISH_TOKEN. O build consumidor deve consumir essas variáveis. Se adotar os publicadores legados, confira a declaração dos secrets, o setup do runtime, o build e o contrato de saída antes de ativar publish-artifacts.

## Monorepos e recuperação

O exemplo [PackagesVue](./monorepos) publica só os workspaces da lista de releases. O formato pode ser usado por outros consumidores, mas o comando de publicação precisa refletir a raiz do build, o caminho do pacote e o registry. `release_type` descreve a estratégia do SDK; não é uma descrição universal da ferramenta de build. No exemplo Gradle, ele será simple.

Não configure o job publish como check obrigatório de PR: ele só existe depois do merge técnico e da criação da release. Cadastre checks que rodam antes do merge, conforme [quality gates](./quality-gates).

Se o upload falhar depois de criada a Release, a lista pode estar vazia em uma reexecução integral. Recupere o job de distribuição e confira tag/versão/registry; não tente forçar nova tag ou substituir pacote já publicado.
