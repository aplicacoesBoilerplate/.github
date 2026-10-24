# Publicação e diagnóstico

## Metadados e artefatos

`publish-artifacts: false` mantém PR técnico, bump de versão, changelog, tag e GitHub Release. Ele apenas desliga os adaptadores de publicação do modo de projeto único. Seu padrão `false` preserva o comportamento dos callers legados.

| Tipo legado | Depois da criação da release |
| --- | --- |
| `node` | `npm publish` no `project-path`; requer registro/autenticação e artefato preparado. |
| `go` | GoReleaser com `workdir` no `project-path`; requer configuração do consumidor. |
| `maven` | `mvn deploy -DskipTests` no `project-path`; requer configuração do destino. |
| `simple` | Sem publicador de pacotes. |
| `gradle` | O input legado é aceito, mas não existe publicador Gradle central; o SDK 17.3.0 não oferece estratégia nativa Gradle validada neste fluxo. Exige adaptação própria. |

A escolha de um tipo não configura automaticamente registro, credenciais, build ou permissões da organização. Para somente versionar uma documentação Node, use o [exemplo com publicação desativada](./subdiretorios).

No modo manifest, os adaptadores legados não são acionados. A publicação fica no consumidor, mesmo que `publish-artifacts` esteja com o valor padrão.

## GitHub Packages com workspaces

O [caller de monorepo](./monorepos#caller-do-consumidor) gera metadados. Para também publicar no GitHub Packages, adicione o fragmento abaixo **sob `jobs:` no mesmo caller**, ao lado do job `release`:

<<< ../../../examples/versioning/packages-vue/publish-job.yml

A matriz usa somente `needs.release.outputs.releases`; não lista todos os cinco pacotes. Cada execução faz checkout de `tag_name`, instala e verifica o monorepo na raiz, e publica o workspace indicado por `path`. A condição compara `releases_created` à string `'true'`.

O exemplo pressupõe que `npm run verify` exista e prepare/verifique os arquivos necessários ao pacote. Confira o script real, `files`, `exports`, dependências internas e `publishConfig` antes de ativá-lo. O registro deve ser `https://npm.pkg.github.com`, o scope deve ser `@aplicacoesboilerplate` e o token precisa ter acesso aos pacotes; o job declara `contents: read` e `packages: write`.

Não execute simultaneamente esse publicador e um fluxo Changesets para a mesma versão. A criação da tag e o upload do pacote são operações distintas: se o registro falhar, a tag já pode existir. Investigue a publicação e recupere somente a etapa necessária, sem apagar tags ou fabricar outra release com a mesma versão.

## Diagnóstico

| Sintoma | Conferir | Correção |
| --- | --- | --- |
| Milestone e footer divergem | Corpo, todos os commits, merge commit e `release-as` do pacote | Faça as declarações concordarem ou remova o override obsoleto. |
| Sem versão no modo único | Milestone e footer fora de bloco de código | Declare uma versão válida. No manifest, o cálculo automático é permitido. |
| Versão global ambígua | Quantos pacotes o PR afeta; `project-path` | Selecione um pacote ou declare `release-as` individualmente. |
| Tag ou Release já existe | Namespace raiz ou componente e versão solicitada | Escolha nova candidata; não sobrescreva a tag existente. |
| Falha HTTP no validador | Permissões, disponibilidade da API e revisão da configuração | Corrija a causa e execute novamente; uma falha de leitura não significa versão livre. |
| Check vermelho permite merge | Ruleset e nome do status obrigatório | Cadastre o status da validação como obrigatório. |
| PR técnico pede milestone | Autor, branch, label e repositório de origem | Verifique se é realmente o PR criado pelo motor; não imite sua identidade num PR funcional. |
| Nenhum pacote publicado em manifest | `releases_created`, JSON `releases` e job do consumidor | Só há matriz após releases novas; adicionar publicação é responsabilidade do caller. |
| Bump inesperado | Conventional Commits preservados no merge e configuração do pacote | Revise o PR técnico antes de integrá-lo. |
| Versionamento Gradle falha | Estratégia suportada pelo SDK | Implemente e valide uma integração específica antes de adotar. |

Antes de integrar o PR técnico, confira os manifestos, changelogs, versões independentes e lockfiles. Depois do merge, confira tag, SHA, notas da GitHub Release e resultado do publicador, quando houver.
