# Artefatos publicados e configuração do consumidor

Uma tag identifica um commit. A GitHub Release associa notas e assets a essa tag. Um pacote npm ou Maven é distribuído em um registry. Essas operações têm destinos, permissões e recuperação distintos.

## O que cada adaptador produz

| Projeto | Versionamento e GitHub | Artefato distribuído | Destino do exemplo |
| --- | --- | --- | --- |
| node | Versão do package, changelog, tag e Release | Conteúdo selecionado por files/exports e npm pack | GitHub Packages npm |
| maven | POMs, changelog, tag e Release | JAR, POM e metadados Maven | GitHub Packages Maven |
| gradle | Manifest simple + gradle.properties, changelog, tag e Release | Publicações configuradas pelo maven-publish | GitHub Packages Maven |
| go | Changelog, tag e Release | Executáveis, arquivos compactados e checksums | Assets da GitHub Release |
| simple | Changelog, tag e Release; arquivos extras opcionais | Nenhum pacote por padrão | Próprio GitHub |

Os comandos abaixo pertencem ao consumidor. O [caller](./callers) prepara runtime e autenticação e só os executa após criação da release correspondente.

## Node, Vue e TypeScript

### Configuração no projeto

Mantenha um package publicável. Substitua o scope e os nomes pelos seus:

~~~json
{
  "name": "@aplicacoesboilerplate/minha-lib",
  "version": "0.0.1",
  "files": ["dist"],
  "exports": { ".": "./dist/index.js" },
  "scripts": { "build": "tsc", "test": "node --test" },
  "publishConfig": { "registry": "https://npm.pkg.github.com" }
}
~~~

O exemplo pressupõe TypeScript instalado e uma configuração de compilação que gere dist/index.js. `private: true` impede publicação do próprio pacote; mantenha-o na raiz de monorepos quando apenas os workspaces são publicáveis.

Execute a preparação antes de distribuir:

~~~bash
npm ci
npm test
npm run build
npm pack --dry-run
npm publish
~~~

`npm pack --dry-run` mostra a seleção de arquivos; confira licenças, tipos, exports e arquivos gerados. Não publique um pacote que aponta para um dist ausente.

### Registry e credenciais

O setup-node do job configura `registry-url: https://npm.pkg.github.com` e o scope. `NODE_AUTH_TOKEN` recebe o GITHUB_TOKEN do job com `packages: write`. O repositório precisa ter acesso ao pacote, inclusive para instalar dependências privadas durante o build.

Para npmjs.org, altere registry-url e publishConfig juntos, configure o método de autenticação aceito pelo npm e declare o secret ou a relação de trusted publishing. Não reutilize o GITHUB_TOKEN como credencial do npmjs.org.

Em workspaces, instale e construa pela raiz. Depois use `npm publish --workspace "$WORKSPACE_PATH"` somente para o caminho retornado pela release. Ranges internos e package-lock são atualizados pelo plugin nativo node-workspace quando configurado.

## Maven: Java e Kotlin

### POM e destino

No POM do consumidor, configure o destino e um server ID:

~~~xml
<distributionManagement>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/aplicacoesBoilerplate/SEU_REPOSITORIO</url>
  </repository>
</distributionManagement>
~~~

O setup-java no caller usa `server-id: github` e aponta `server-username` e `server-password` para variáveis de ambiente. O ID precisa coincidir com o POM. Não grave tokens em pom.xml ou settings.xml versionados.

~~~bash
./mvnw -B verify
./mvnw -B deploy -DskipTests
~~~

O segundo comando pressupõe que a verificação da mesma revisão já passou. Para reactor, execute na raiz: parent, BOM e módulos relacionados podem precisar da mesma publicação. Para publicar um subconjunto, configure conscientemente `-pl`/`-am` e suas dependências.

### Versão e reactor

A estratégia maven do Release Please atualiza POMs e pode gerar snapshots. Para uma release estável planejada sem etapa snapshot, o exemplo fixa `skip-snapshot: true`.

Projetos com `${revision}` precisam atualizar também a propriedade revision; veja o extra-file XML no [exemplo de configuração](./callers#maven). Não basta alterar apenas uma ocorrência do número. Confirme parent, BOM, referências entre módulos e coordenadas groupId/artifactId/version antes do merge técnico.

Para Maven Central ou Nexus/Artifactory, mantenha o destino e as credenciais correspondentes no projeto/job. Assinatura, staging e promoção dependem do registry e dos plugins adotados; `mvn deploy` não os configura automaticamente.

## Gradle: Java e Kotlin

### Versionamento com mecanismos disponíveis

O SDK 17.3.0 não possui `release-type: gradle`. O exemplo usa `release-type: simple` no manifest e um extra-file genérico. O arquivo gradle.properties contém:

~~~properties
# x-release-please-start-version
version=0.0.1
# x-release-please-end
~~~

Delimite somente a propriedade desejada. O updater genérico altera números SemVer dentro do bloco; não inclua versões de dependências nesse intervalo. Use comentários em linhas próprias: um comentário anexado ao valor de uma property pode virar parte do valor.

O build usa a property atualizada. Não mantenha uma segunda versão fixa em build.gradle.kts.

### Publicação do consumidor

Exemplo de biblioteca JVM em build.gradle.kts:

~~~kotlin
plugins {
    `java-library`
    `maven-publish`
}

group = "br.com.suaorganizacao"
version = providers.gradleProperty("version").get()

publishing {
    publications {
        create<MavenPublication>("library") {
            from(components["java"])
        }
    }
    repositories {
        maven {
            name = "github"
            url = uri("https://maven.pkg.github.com/aplicacoesBoilerplate/SEU_REPOSITORIO")
            credentials {
                username = System.getenv("MAVEN_USERNAME")
                password = System.getenv("MAVEN_TOKEN")
            }
        }
    }
}
~~~

Mantenha o Wrapper versionado, escolha um JDK compatível com a versão do Gradle e rode:

~~~bash
./gradlew --no-daemon check
./gradlew --no-daemon publish
~~~

`publishToMavenLocal` publica no cache Maven do runner; não distribui para outros projetos. O job de exemplo usa `publish` com GITHUB_TOKEN e `packages: write`.

Em multi-project builds, configure publications por módulo e prefira uma tarefa explícita como `:biblioteca:publish` quando a release atingir apenas esse componente. Um `publish` indiscriminado pode publicar várias coordenadas. Configure assinatura quando exigida pelo destino.

## Go e GoReleaser

### Biblioteca versus aplicação

Uma biblioteca Go normalmente é consumida pela tag do módulo; não existe equivalente obrigatório ao npm publish. O caminho do módulo e o major version precisam respeitar a convenção de módulos Go.

Para aplicações CLI, GoReleaser constrói e anexa binários à GitHub Release criada pelo Release Please. Mantenha go.mod, go.sum e .goreleaser.yml no consumidor:

~~~yaml
version: 2
project_name: minha-cli

builds:
  - id: cli
    main: ./cmd/minha-cli
    binary: minha-cli
    goos: [linux, windows, darwin]
    goarch: [amd64, arm64]
    env: [CGO_ENABLED=0]

checksum:
  name_template: checksums.txt

release:
  mode: keep-existing
~~~

Ajuste main ao pacote executável real. Esse exemplo pressupõe build sem CGO; projetos com dependências nativas precisam de toolchain e matriz apropriadas.

O caller deve fazer checkout da tag com histórico e configurar Go pelo go.mod antes de rodar GoReleaser v2. `release.mode: keep-existing` preserva as notas da Release existente.

~~~bash
go test ./...
goreleaser check
goreleaser release --clean
~~~

O exemplo de caller usa GoReleaser na raiz com tags vX.Y.Z. Monorepos Go com prefixos próprios exigem configuração específica de tags e módulos antes de reutilizar o job.

## Simple: documentação e catálogo de pipelines

Simple não executa npm publish, mvn deploy ou GoReleaser. Ele serve para versionar um produto sem registry, como o catálogo central. Seus extra-files permitem usar o package da documentação como fonte exibida no site, sem restaurar o TXT de homologação.

No catálogo, a proposta do PR técnico atualiza docs/package.json, docs/package-lock.json, manifest e changelog. A documentação é publicada pelo workflow GitHub Pages, não por um publicador npm. `publish-artifacts: false` preserva tags e Releases; apenas desativa os publicadores legados.

## Falhas, reexecução e rastreabilidade

Uma tag/Release pode ser criada e a distribuição falhar depois. Não apague a tag para tentar recuperar um upload. Confira o SHA da release, o pacote/versão no registry e os logs do job.

Os exemplos só disparam quando há uma release nova. Reexecutar o workflow inteiro pode retornar releases vazias e não repetir o upload. Prefira reexecutar o job de distribuição falho quando possível, ou um procedimento manual restrito à tag imutável e às coordenadas conferidas. Não sobrescreva um pacote já publicado com conteúdo diferente.

Registre PR funcional, PR técnico, tag, SHA, versão, run e destino do artefato. A aprovação dos testes e a criação da Release não comprovam, sozinhas, o sucesso de todos os uploads.

## Fontes e exemplos

- [Maven Publish do Gradle](https://docs.gradle.org/current/userguide/publishing_maven.html).
- [Gradle no GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-gradle-registry).
- [GoReleaser e releases existentes](https://goreleaser.com/customization/publish/scm/).
- [Updaters genéricos do Release Please](https://github.com/googleapis/release-please/blob/v17.3.0/docs/customizing.md#updating-arbitrary-files).
- [Callers completos e configuração de cada adaptador](./callers).
