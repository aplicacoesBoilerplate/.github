# Artefatos e inputs

## Quem é responsável por cada arquivo

| Artefato | Papel | Quem mantém |
| --- | --- | --- |
| Caller em `.github/workflows/` do consumidor | Eventos, permissões, escolha de projetos e publicação | Equipe consumidora |
| `version-release-please-validate.yml` central | Validação de leitura antes do merge | Catálogo central |
| `version-release-please-called.yml` central | Revalidação, execução do motor e adaptadores legados | Catálogo central |
| `release-please-config.json` do consumidor | Estratégia, caminhos, componentes, changelogs e arquivos extras | Equipe consumidora |
| `.release-please-manifest.json` | Última versão de cada caminho configurado; não contém regras | Release Please, após inicialização revisada |
| `package.json`, `pom.xml`, arquivos Gradle e equivalentes | Versão consumida pelo ecossistema | Updaters nativos no PR técnico |
| `CHANGELOG.md` de cada componente | Histórico das mudanças publicadas | Release Please |
| PR técnico | Proposta revisável de versões, changelogs e manifest | Release Please; integração pela equipe |
| Tag e GitHub Release | Identidade do commit publicado e notas | Release Please após merge técnico |

O JSON de configuração e o JSON de estado são diferentes: declare regras em `release-please-config.json` e versões conhecidas no manifest. Não edite o manifest para fingir que uma tag já foi publicada.

## Inputs do workflow de release

| Input | Padrão | Uso |
| --- | --- | --- |
| `project-type` | vazio | Obrigatório no modo legado: `node`, `go`, `maven`, `gradle`, `simple`. Em manifest, a estratégia vem do JSON; project-type gradle também seleciona seu publicador central. |
| `project-path` | `.` | Diretório relativo do projeto. Em manifest, `.` seleciona todos os pacotes; outro caminho seleciona um pacote configurado. |
| `config-file` | vazio | Não vazio ativa o manifest nativo e aponta para a configuração no consumidor. |
| `manifest-file` | `.release-please-manifest.json` | Estado de versões do modo manifest. |
| `publish-artifacts` | `false` | Habilita os publicadores legados. Use `false` para versionar sem publicar artefatos. Em manifest, apenas Gradle dispõe de publicador central opt-in; os demais publicam no caller. |
| `release-config-file` | vazio | Alias compatível de `config-file` nos pilotos. |
| `release-manifest-file` | `.release-please-manifest.json` | Alias compatível de `manifest-file`. |
| `version-policy` | `milestone` | No contrato com alias: raiz planejada ou `native` para componentes independentes. |
| `gradle-java-version` | `17` | JDK usado pelo publicador Gradle central; deve ser compatível com o Wrapper. |
| `central-ref` | `master` | Revisão dos scripts centrais; fixe o mesmo SHA usado em `uses`. |

Gradle exige config-file (ou alias), estratégia simple e updater de gradle.properties; o modo sem config falha antes do motor. Seu publicador central roda apenas com opt-in e uma release nova no caminho escolhido. Veja o [caller Gradle](./callers#gradle).

O workflow de validação aceita `project-path`, `config-file` e `central-ref`. Use os mesmos valores nas duas chamadas para verificar o projeto que será publicado.

## Dois caminhos para o mesmo motor

No modo de projeto único, o orquestrador entrega `release-type` e `release-as` à Action oficial `googleapis/release-please-action@v4`. `project-path` chega ao input oficial `path`; a atualização de arquivos e o changelog seguem a estratégia escolhida.

Com `config-file`, a integração usa diretamente o **SDK oficial `release-please@17.3.0`** e sua API `Manifest`. O SDK calcula versões, atualiza arquivos, monta PRs e cria releases. Essa escolha permite aplicar a versão explícita somente ao pacote correto: a Action v4 não repassa seu input `release-as` ao manifest-mode.

Declare `include-component-in-tag` explicitamente. Para um único alvo com tags `vX.Y.Z`, use `false`. Para pacotes independentes, use `true` e um `component` explícito e único por pacote; a tag será `componente-vX.Y.Z`. Também são aceitos componentes npm completos, como `@org/pacote`, `include-v-in-tag: false` e separadores `@`, `_` ou `.`. O bloqueio consulta a identidade exata configurada; `@org/pacote@0.0.2` e `outro-v0.0.2` são namespaces diferentes.

## Resultados do manifest

O called exporta `releases_created` como string `"true"` ou `"false"`, e `releases` como uma string JSON:

```json
[
  {
    "path": "packages/utils",
    "version": "0.0.2",
    "tag_name": "utils-v0.0.2",
    "release_type": "node"
  }
]
```

Esses valores são um exemplo de formato, não uma publicação existente. Sem release criada, a lista é `[]`. Esses outputs descrevem o modo manifest; não use essa lista para presumir releases no modo legado.


## Compatibilidade com os três pilotos

Os inputs `release-config-file` e `release-manifest-file` continuam disponíveis como aliases de `config-file` e `manifest-file`. Use um único par de nomes por caller; os nomes novos têm precedência se ambos forem preenchidos. O arquivo de manifest padrão permanece `.release-please-manifest.json`.

No contrato legado com `release-config-file`, `version-policy: milestone` exige um único componente raiz. Essa política aceita milestone ou `Release-As` como fonte explícita. `version-policy: native` preserva o cálculo independente e ignora a milestone usada apenas para agrupar a entrega. Footers explícitos continuam sujeitos à resolução por pacote e à proteção de tags. Valores de política desconhecidos falham antes de qualquer escrita.

No contrato novo com `config-file`, os caminhos e overrides determinam o alvo; uma declaração escalar ambígua é rejeitada. Tanto o manifest raiz quanto o independente passam pelo SDK oficial com as mesmas proteções. A Action permanece no modo de projeto único sem configuração.

O preview também recebe `release-config-file` e `version-policy`. Repita nesses inputs os valores usados pelo called, para que os checks anteriores e posteriores ao merge apliquem a mesma regra.
