# Versionamento Centralizado (Release Please)

Nossa arquitetura de versionamento utiliza o **Release Please** combinado com um **Orquestrador em TypeScript (POO)** para garantir que toda versão lançada reflita exatamente a **Milestone** associada ao Pull Request na branch `master`.

## Como o Fluxo Funciona

1. **Merge de Feature (`feat/* -> master`):**
   - A pipeline valida se o PR possui uma Milestone no formato `vX.Y.Z` (ex: `v1.2.0`).
   - O Orquestrador TS extrai a versão sem o prefixo `v` (`1.2.0`) e gera o `release-please-config.json` dinâmico com `"release-as": "1.2.0"`.
   - O Release Please abre ou atualiza um **Pull Request de Release** contendo o `CHANGELOG.md` e o bump de versão no manifesto da linguagem (`package.json`, `pom.xml`, etc.).
2. **Merge do PR de Release (`release-please--branches--master -> master`):**
   - O Orquestrador TS identifica a branch do robô e libera a exigência de Milestone.
   - O Release Please cria a **Tag oficial** e publica a **GitHub Release**.
   - Os **Adaptadores Pós-Tag** são acionados automaticamente para publicar o pacote ou binário.

---

## Exemplos de Callers por Ecossistema

Em cada aplicação consumidora, crie o arquivo `.github/workflows/version-release-please-caller.yml` usando o `project-type` correspondente:

### Node.js / Vue / TypeScript (`node`)

Atualiza o `package.json`, gera o `CHANGELOG.md` e executa `npm publish` após a criação da tag.

```yaml
name: Release Please Caller Node

on:
  pull_request:
    types: [closed]
    branches: [master]

jobs:
  call-central-versioning:
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-release-please-called.yml@master
    with:
      project-type: 'node'
    secrets: inherit
```

### Go (`go`)

Gerencia o CHANGELOG.md e a Tag via Release Please e, em seguida, aciona o GoReleaser (goreleaser/goreleaser-action@v6) para compilar e anexar os binários à release.

```yaml
name: Release Please Caller Go

on:
  pull_request:
    types: [closed]
    branches: [master]

jobs:
  call-central-versioning:
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-release-please-called.yml@master
    with:
      project-type: 'go'
    secrets: inherit
```

### Java com Maven (`maven`)

Atualiza a versão no pom.xml no PR de release e executa mvn deploy -DskipTests quando a tag é publicada.

```yaml
name: Release Please Caller Maven

on:
  pull_request:
    types: [closed]
    branches: [master]

jobs:
  call-central-versioning:
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-release-please-called.yml@master
    with:
      project-type: 'maven'
    secrets: inherit
```

### Kotlin / Java com Gradle (`gradle`)

Atualiza o build.gradle / gradle.properties durante o ciclo de release.

```yaml
name: Release Please Caller Gradle

on:
  pull_request:
    types: [closed]
    branches: [master]

jobs:
  call-central-versioning:
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-release-please-called.yml@master
    with:
      project-type: 'gradle'
    secrets: inherit
```
