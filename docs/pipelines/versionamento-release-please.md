# Versionamento Centralizado (Release Please)

Nossa arquitetura de versionamento utiliza o **Release Please** combinado com um **Orquestrador em TypeScript (POO)**. A versão planejada vem da **Milestone** do PR funcional integrado em `master`; o motor prepara o PR técnico e, depois do merge dele, a tag e a GitHub Release. A integração real de publicação ainda precisa ser comprovada pelo piloto descrito abaixo.

## Como o Fluxo Funciona

1. **Merge de Feature (`feat/* -> master`):**
   - A pipeline valida se o PR possui uma Milestone no formato `vX.Y.Z` (ex: `v1.2.0`).
   - O Orquestrador TS extrai a versão sem o prefixo `v` (`1.2.0`) e gera o `release-please-config.json` para inspeção.
   - O canal efetivo de configuração é `GITHUB_OUTPUT`: `release_type` e `release_as` alimentam os inputs oficiais `release-type` e `release-as` da Action. Um JSON apenas gerado no workspace não configura o manifest-mode remoto da Action.
   - O Release Please abre ou atualiza um **Pull Request de Release** contendo o `CHANGELOG.md` e o bump de versão no manifesto da linguagem (`package.json`, `pom.xml`, etc.).
2. **Merge do PR de Release (`release-please--branches--master -> master`):**
   - O Orquestrador TS identifica a branch do robô e libera a exigência de Milestone.
   - O Release Please cria a **Tag oficial** e publica a **GitHub Release**.
   - Os **Adaptadores Pós-Tag** são selecionados pelo tipo do projeto. No piloto `simple`, nenhum publicador de pacotes ou binários é selecionado.

A exigência de milestone vale também para hotfixes funcionais. A dispensa do segundo momento não autoriza uma nova entrega sem milestone. Hoje a identificação técnica no orquestrador usa o prefixo da branch `release-please`; isso não comprova a identidade do robô. O teste usa a branch gerada pelo motor real, mas não elimina essa limitação de governança.

## Piloto funcional no próprio repositório

O workflow **Release Please Functional Pilot**, em `.github/workflows/version-release-please-test-caller.yml`, é um caller de teste. Ele chama a CI existente por `uses: ./.github/workflows/ci.yml`: caller e CI vêm do mesmo commit. Não é uma cópia da implementação de versionamento.

```text
push na branch codex/release-please-self-pilot
  -> caller de teste (contents:read, sem secrets herdados)
  -> CI reutilizável no runner Ubuntu / Node 22
  -> npm test + npm run typecheck
  -> teste funcional TS lê caller de exemplo e called reais
  -> executa o mesmo comando TS no layout de checkout temporário
  -> outputs efetivos -> estratégia Simple real do Release Please
  -> versão, changelog, proposta de PR e dados de tag/Release em memória
```

O caller hospedado **não chama `googleapis/release-please-action` nem cria PR, tag ou Release**. Ele executa o teste funcional com o SDK real no runner do GitHub. É evidência de execução hospedada desse contrato; não é a validação ponta a ponta de publicação. O checkout central da produção foi corrigido para `.ci-scripts/ci-scripts/...`, e o teste executa esse caminho declarado, em vez de usar um atalho corrigido só na fixture.

### Um fluxo funcional, sem multiplicar arquivos de teste

O fluxo foi ampliado no arquivo existente `ci-scripts/tests/release-please.test.ts`. Permanecem os sete casos superiores da suíte: um fluxo funcional, quatro contratos dos tipos já suportados, um contrato do called e um teste de Commitlint. Nenhuma asserção anterior foi removida ou desativada.

No mesmo fluxo:

1. Lê os YAMLs reais, verifica a referência ao called, o entrypoint, o binding da Action e o caller hospedado com permissão de leitura.
2. Simula uma entrega funcional com milestone `v0.0.1`; executa o orquestrador real e entrega seus outputs à estratégia real `Simple`.
3. Aplica os updaters nativos no diretório temporário e confere `version.txt` em `0.0.1` e o conteúdo do `CHANGELOG.md`.
4. Simula o merge do PR técnico gerado pelo motor, sem milestone; confirma que não existe `release-as` residual e confere a proposta nativa de tag `v0.0.1`, notas e SHA alvo.
5. Rejeita milestone ausente/inválida e tipo não suportado. Caminhos ou bindings quebrados fazem o próprio teste falhar.

Somente as entradas e os metadados dos eventos são simulados. Não existe implementação nossa de cálculo de versão, changelog ou dados de release. O cliente GitHub do SDK tem `fetch` proibido; qualquer tentativa dele de acessar a rede falha. Os subprocessos recebem um ambiente filtrado, sem tokens herdados.

O teste usa `release-please@17.3.0` e `yaml@2.9.1`, travados no lockfile e somente como dependências de desenvolvimento. Os imports internos da estratégia exigem essa versão exata; sua atualização precisa passar pelo teste funcional. Na produção, o called instala apenas o runtime com `npm ci --omit=dev --ignore-scripts`; quem executa o motor é a Action oficial. O `tsx` continua sendo uma dependência do runtime TS.

### Reproduzir e inspecionar

Na raiz do checkout, instale e execute:

```text
npm ci --ignore-scripts
npm ci --prefix ci-scripts --ignore-scripts
npm test --prefix ci-scripts
npm run typecheck --prefix ci-scripts
```

Para iterar apenas no fluxo principal: `npm run test:functional --prefix ci-scripts`. O gate de entrega continua sendo a suíte integral, sem seleção ou skip.

No GitHub, abra **Actions → Release Please Functional Pilot → execução do commit publicado → Caller to real release engine / Validate repository**. Em **Run TypeScript tests**, confira sete testes aprovados e o diagnóstico `Motor real`, com versão, tag proposta e SHA da fixture. Em **Check TypeScript types**, confira o término com sucesso. O SHA alvo impresso pelo teste é um dado simulado, **não** o SHA de uma tag persistida no repositório. O SHA real da execução aparece nos metadados do run.

O primeiro run é disparado por push somente na branch de teste. O botão **Run workflow** depende de o arquivo com `workflow_dispatch` existir na default branch; não é preciso fazer merge em master só para obter essa primeira evidência. Para repetir o mesmo commit sem novas mudanças, use **Re-run all jobs** na execução existente. Não altere secrets nem habilite permissões de escrita para esse teste.

### Próxima etapa: publicação real, ainda pendente

A execução hospedada acima não fecha a issue de versionamento. O ciclo de publicação precisa de autorização separada e de um caller de produção ativo, usando `project-type: simple`. Esse tipo atualiza `version.txt` e `CHANGELOG.md`, sem npm, Maven ou GoReleaser. O arquivo `version.txt` precisa existir no repositório consumidor antes do piloto real; no teste ele é criado somente na fixture temporária com base `0.0.0`, nunca como tag publicada.

No piloto futuro deste mesmo repositório, a referência local ao called deve executar a mesma revisão da CI, e `central-ref: ${{ github.sha }}` deve fixar também o checkout dos scripts. Para consumidores externos, fixe **o mesmo SHA revisado** em `uses: aplicacoesBoilerplate/.github/.github/workflows/version-release-please-called.yml@SHA` e em `with.central-ref`. O default `master` preserva compatibilidade, mas é mutável e não é uma garantia de revisão imutável.

Roteiro posterior, não executado pelo teste:

1. Preparar `version.txt` e o caller de produção após autorização; confirmar permissões de Actions e criação de PRs com `GITHUB_TOKEN`.
2. Abrir entrega funcional com `fix:` ou `feat:` e milestone `v0.0.1`; preservar Conventional Commits no squash merge.
3. Após CI/revisão e merge humano, inspecionar o PR real do Release Please, sua versão e changelog. Não deve haver tag/Release dessa candidata antes do merge do PR técnico.
4. Aprovar a execução da CI do PR automatizado, se o GitHub solicitar. Não dispensar a CI.
5. Integrar o PR técnico por decisão humana, sem exigir outra milestone; conferir tag no SHA integrado, versão, notas e GitHub Release, sem publicação de pacote.
6. Registrar links do PR, do run e da Release, versão e SHA. Enquanto essas evidências não existirem, o E2E de publicação continua **PENDENTE**.

Conclusão de milestones em 100%, fechamento automático, concorrência, rejeição de versões conflitantes e identificação mais forte do PR técnico permanecem evoluções futuras. Nenhuma aplicação piloto externa foi modificada.

Referências: [inputs oficiais da Action](https://github.com/googleapis/release-please-action/blob/v4/README.md#action-inputs), [estratégia Simple usada pelo teste](https://github.com/googleapis/release-please/blob/v17.3.0/src/strategies/simple.ts), [referências locais de workflows no mesmo commit](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#calling-a-reusable-workflow), [requisito da default branch para workflow_dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

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
