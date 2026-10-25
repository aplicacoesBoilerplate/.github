# Versionamento com Release Please

## Seção de versionamento e publicação

Comece pelas três páginas principais:

| Página | O que você configura e acompanha |
| --- | --- |
| [Artefatos publicados](./release-please/artefatos-publicados) | Tags, Releases, npm, Maven, Gradle, GoReleaser e os arquivos mantidos pelo consumidor |
| [Atuação da central](./release-please/pipeline-central) | Dois momentos da release, adaptadores, estratégias, versões, guardas e outputs |
| [Callers por adaptador](./release-please/callers) | Configs e workflows completos para node, maven, gradle, go e simple |

As páginas de [inputs](./release-please/artefatos), [conflitos](./release-please/versoes-conflitos), [subdiretórios](./release-please/subdiretorios) e [monorepos](./release-please/monorepos) aprofundam o contrato. Para administração e operação, consulte [quality gates da master](./release-please/quality-gates) e [conexão GitHub](./release-please/conexao-github).


O workflow central prepara versões, changelogs, tags e GitHub Releases com o Release Please. O consumidor escolhe entre **um projeto por chamada**, com `project-type`, e **manifest nativo**, com `config-file` e versões independentes por diretório.

## Ciclo de uma entrega

1. O PR funcional recebe validação antes do merge. No modo de projeto único, informe uma milestone `vX.Y.Z` ou um footer `Release-As: X.Y.Z`. No manifest, a versão também pode ser calculada por Conventional Commits.
2. Após o merge em `master`, o workflow valida novamente e o motor abre ou atualiza um **PR técnico de release** com versões e changelogs. Esse primeiro merge ainda não publica a versão.
3. A equipe revisa e integra o PR técnico. O motor cria a tag e a GitHub Release. O publicador de artefatos, quando configurado, executa depois dessa etapa.

Uma milestone organiza a entrega; ela não cria uma tag. O PR técnico propõe a alteração versionada. A tag identifica o commit publicado, a GitHub Release apresenta suas notas e o registro de pacotes distribui o artefato compilado.

## Escolher a configuração

| Necessidade | Configuração | Próximo passo |
| --- | --- | --- |
| Um projeto na raiz | `project-type: node`, `go`, `maven`, `gradle` ou `simple` | [Artefatos e inputs](./release-please/artefatos) |
| Um projeto dentro de `docs/` ou outro diretório | `project-type` + `project-path` | [Subdiretórios](./release-please/subdiretorios) |
| Vários pacotes com versões independentes | `config-file` + manifest de versões | [Monorepos e PackagesVue](./release-please/monorepos) |
| Definir ou corrigir uma versão planejada | Milestone, footer ou `release-as` por pacote | [Versões e conflitos](./release-please/versoes-conflitos) |
| Publicar pacotes ou investigar uma falha | Publicadores e resultados do workflow | [Publicação e diagnóstico](./release-please/publicacao) |

## Ativar a proteção antes do merge

O caller deve ouvir `opened`, `reopened`, `synchronize`, `edited`, `milestoned` e `demilestoned` para executar a validação de leitura. Cadastre o status gerado por esse job como **obrigatório** no ruleset ou na proteção da branch `master`. Sem essa configuração do repositório, um check vermelho informa a falha, mas não impede o merge.

O evento `closed`, condicionado a `pull_request.merged == true`, executa o workflow de release. A verificação após o merge reduz a janela de corrida; a publicação é serializada por repositório e branch. Nenhum workflow impede que uma pessoa crie uma milestone ou abra um PR na interface do GitHub.

Os [exemplos completos](./release-please/monorepos#caller-do-consumidor) usam `@master` para demonstrar recursos novos. Quando a revisão estiver disponível, fixe **o mesmo SHA revisado** na referência `uses` e em `central-ref` de cada chamada. Não use uma tag futura como se ela já existisse.

## Como este catálogo se versiona

O catálogo usa um manifest com um único alvo `.` e estratégia `simple`. Isso mantém todos os commits do catálogo no escopo da release. Os `extra-files` atualizam `docs/package.json` e os dois campos correspondentes de `docs/package-lock.json`; o menu da documentação lê a versão de `docs/package.json`. `CHANGELOG.md`, na raiz, continua sendo a fonte das [notas de versão](../releases).

Configurar somente um componente `docs/` mudaria o escopo: alterações nas pipelines fora desse diretório deixariam de compor esse componente. Por isso, o alvo do catálogo permanece na raiz, mesmo que a versão visual esteja em `docs/package.json`. O antigo `version.txt` foi removido; o updater `simple` não recria um arquivo ausente (`createIfMissing: false`).

A release histórica [v0.0.1](https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1) é a base do manifest e da documentação. Uma próxima `v0.0.2` deve ser produzida pelo ciclo de PR técnico, tag e release; esta documentação não anuncia sua publicação.

## Referências

- [Release Please: configuração manifest](https://github.com/googleapis/release-please/blob/v17.3.0/docs/manifest-releaser.md)
- [Opções nativas de configuração](https://github.com/googleapis/release-please/blob/v17.3.0/docs/customizing.md)
- [Inputs da Action oficial](https://github.com/googleapis/release-please-action/tree/v4#action-inputs)
- [Workflows reutilizáveis no GitHub Actions](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)


## Pilotos Java, Vue e Go

A entrega do PR #19 mantém os contratos das aplicações consumidoras:

- **PackagesJava:** versão única de parent, BOM, core e starter; estratégia Maven com `skip-snapshot: true` e updater XML de `revision`.
- **PackagesVue:** cinco bibliotecas independentes; tags com nome completo do pacote e `@`, plugin `node-workspace`, ranges e lockfile. O app privado de docs participa como dependente e usa `skip-github-release` e `skip-changelog`.
- **boilerplate-cli:** estratégia Go para changelog, tag e Release; a distribuição por GoReleaser pertence à etapa seguinte.

Os pilotos usam os aliases documentados em [artefatos e inputs](./release-please/artefatos#compatibilidade-com-os-três-pilotos). Publicação em registry é opt-in e permanece desligada por padrão. Cada caller aguarda a CI da aplicação e fixa o mesmo SHA revisado em `uses` e `central-ref`.

O piloto interno completou o ciclo anterior nos [PR #17](https://github.com/aplicacoesBoilerplate/.github/pull/17), [PR #18](https://github.com/aplicacoesBoilerplate/.github/pull/18) e [Release v0.0.1](https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1). A próxima versão pretendida é `0.0.2`; ela será refletida na documentação após o ciclo de release. Os ciclos reais das aplicações continuam dependendo de revisão e merges humanos.
