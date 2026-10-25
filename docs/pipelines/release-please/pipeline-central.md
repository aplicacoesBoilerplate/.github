# Atuação da pipeline central

A central transforma commits e declarações de versão em PR técnico, changelog, tag e GitHub Release. O consumidor fornece seus arquivos e sua configuração. A distribuição em um registry ou o upload de binários é outra operação, com build e credenciais próprios.

## Responsabilidades e dois momentos

| Momento | Central | Consumidor e equipe |
| --- | --- | --- |
| PR funcional aberto | Preview de versão, conflitos e disponibilidade das tags | Rodar CI, revisar código e tornar os checks obrigatórios |
| Merge funcional | Revalidar a versão e pedir ao SDK oficial que prepare o PR técnico | Preservar Conventional Commits e informar milestone ou Release-As quando necessário |
| PR técnico aberto | Propor versões, changelogs e manifest | Conferir os arquivos gerados e validar o projeto |
| Merge técnico | Validar identidade, criar tag e GitHub Release | Publicar apenas os artefatos correspondentes às releases criadas |
| Falha de distribuição | Preservar identidade da release já criada | Recuperar o publicador, sem mover tags ou publicar outra versão com a mesma identidade |

O PR funcional não publica imediatamente uma release. Ele prepara uma proposta. O segundo merge é a aprovação da versão proposta.

O caminho completo é: validar o PR funcional, integrar a entrega, revisar o PR técnico, integrar a proposta de versão e distribuir os artefatos da tag. Os primeiros dois passos validam intenção e código; os seguintes aprovam a versão e sua distribuição.

## Contrato disponível e limites

| Adaptador do projeto | Estratégia do motor | Arquivos de versão | Distribuição |
| --- | --- | --- | --- |
| node | node | package.json, lockfile e changelog | npm publish; em manifest, job do caller |
| maven | maven | pom.xml, módulos e changelog; XML extra para revision quando usado | mvn deploy; em manifest, job do caller |
| gradle | O nome legado não tem estratégia nativa no SDK 17.3.0 | Exemplo suportado usa simple + updater genérico de gradle.properties | check publish no publicador Gradle central, por opt-in |
| go | go | Changelog e tags; go.mod não é um manifesto de versão do binário | GoReleaser no caller ou publicador legado |
| simple | simple | Changelog e arquivo de versão configurado ou extra-files | Nenhum publicador de pacotes automático |

Não use `project-type: gradle` no modo legado esperando suporte completo: esse input é reconhecido pelo orquestrador, mas não há estratégia nativa `gradle`. A publicação agora existe na central e exige manifest com estratégia simple. O [exemplo Gradle](./callers#gradle) demonstra a composição com mecanismos existentes.

O SDK permanece responsável pelo cálculo da versão e geração dos arquivos. A central acrescenta seleção de caminho, resolução de declarações e guardas de tags.

## Projeto único sem configuração

Use `project-type` para selecionar o adaptador e `project-path` para indicar onde seus arquivos estão. O padrão é `.`. O orquestrador repassa `release-type`, `release-as` e `path` para a Action oficial.

~~~yaml
with:
  project-type: node
  project-path: docs
  publish-artifacts: false
  central-ref: SHA_CENTRAL_REVISADO
~~~

Nesse caminho, milestone ou footer define a versão solicitada. O diretório não muda o namespace automaticamente: no contrato legado a tag continua sendo `vX.Y.Z`. Para vários projetos independentes, use manifest e componentes explícitos.

## Manifest nativo e monorepos

O consumidor mantém dois arquivos distintos:

~~~json
{
  "include-component-in-tag": true,
  "packages": {
    "packages/ui": { "release-type": "node", "component": "ui" },
    "services/api": { "release-type": "maven", "component": "api", "skip-snapshot": true }
  }
}
~~~

~~~json
{
  "packages/ui": "0.0.1",
  "services/api": "1.2.0"
}
~~~

O primeiro conteúdo pertence a `release-please-config.json`; o segundo a `.release-please-manifest.json`. As versões são seeds ilustrativos: substitua pelas versões reais e confira as tags existentes.

O caller passa `config-file` e `manifest-file`. Omitir `project-path` seleciona todos os caminhos; informá-lo seleciona um pacote configurado. O adaptador de cada pacote vem do JSON. `project-type` não sobrescreve as estratégias do manifest.

Nesse modo, a central usa o SDK oficial `release-please@17.3.0`, aplica overrides por pacote e protege cada criação real de release. Os publicadores legados Node/Maven/Go não rodam em manifest. A exceção explícita é Gradle: `project-type: gradle` + `publish-artifacts: true` aciona o step pós-tag no mesmo job release-please após uma release simple no caminho selecionado. Os demais publicadores manifest pertencem ao caller.

## Milestone, Release-As e conflito

No modo único, `v0.0.2` na milestone ou um footer `Release-As: 0.0.2` no corpo do PR/commit declara o alvo. O footer deve estar fora de exemplos cercados por blocos de código. Se as fontes divergirem, a validação falha.

Em manifest, o SDK pode calcular incrementos sem override. Uma versão escalar precisa identificar um único alvo; se afetar vários pacotes, selecione o caminho ou configure `release-as` individualmente. No contrato legado `release-config-file` + `version-policy: native`, a milestone de agrupamento é ignorada, preservando versões independentes.

A mesma tag existente bloqueia uma nova entrega, independentemente de a origem anterior ser milestone, footer ou criação manual. Tags anotadas são resolvidas antes da comparação. Uma reexecução técnica só pode reutilizar a identidade do mesmo commit; não pode mover uma tag para outro SHA.

Veja [versões e conflitos](./versoes-conflitos), [subdiretórios](./subdiretorios), [monorepos](./monorepos) e [inputs e aliases](./artefatos).

## Outputs para publicação no caller

Os outputs `releases_created` e `releases` pertencem ao modo manifest. `releases_created` é uma string; compare com `'true'`. `releases` é JSON:

~~~json
[
  {
    "path": "packages/ui",
    "version": "0.0.2",
    "tag_name": "ui-v0.0.2",
    "release_type": "node"
  }
]
~~~

A lista contém apenas releases efetivamente criadas. Não é a lista de todos os pacotes configurados. Um pacote privado pode participar de atualizações de dependência sem ser distribuído; configure skip-github-release e a política do publicador de acordo com o projeto.

O publicador deve fazer checkout da tag retornada. Em monorepo, construa na raiz quando houver workspace ou reactor, mas publique o componente correto. Não use um `git checkout master` posterior: a branch pode avançar.

## Permissões e revisão central

O preview usa leitura de conteúdo e PRs. A criação de PR/tag/Release precisa de `contents: write`, `pull-requests: write` e `issues: write`. Publicar no GitHub Packages precisa de `packages: write` no job consumidor; anexar binários à Release precisa de `contents: write`.

Os exemplos fixam `uses` e `central-ref` no mesmo placeholder `SHA_CENTRAL_REVISADO`. Substitua ambos pelo SHA completo que contém esta entrega. As alterações pendentes do PR #19 não existem em tags anteriores da central.

A central instala seu runtime travado em `.ci-scripts/ci-scripts`. O primeiro segmento é a pasta do checkout central; o segundo é o projeto Node do catálogo. A autenticação do terminal do desenvolvedor é independente do GITHUB_TOKEN de cada workflow.


## Um job e um contrato pós-release

A called mantém um único job, release-please. Node, Maven, Gradle e Go são steps adaptadores na mesma etapa pós-tag; simple não tem publicador de pacotes.

O step release normaliza o resultado da Action ou do SDK manifest em release_created, project_path e tag_name. Cada publicador usa esse resultado, o tipo de projeto e publish-artifacts. A diferença de motor fica na normalização, sem criar outro job ou outra chamada só para Gradle.

Gradle prepara checkout da tag e JDK por steps condicionais e executa o Wrapper no diretório normalizado. O caller mantém o mesmo contrato e concede os escopos necessários ao seu registry. O job herda esses escopos; a central não adiciona permissões que o caller não concedeu.
