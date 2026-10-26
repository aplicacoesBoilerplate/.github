# Monorepos com versões independentes

O modo manifest mantém uma versão para cada caminho configurado. Cada pacote tem sua estratégia, seu changelog e seu namespace de tags. Um PR técnico combinado pode conter bumps diferentes; isso não obriga os pacotes a usarem a mesma versão.

## Exemplo PackagesVue

Este é um **exemplo de migração**, sem alteração do repositório remoto. A referência atual `release/v0.0.1` do PackagesVue usa Changesets, GitHub Packages e npm workspaces. Antes de ativar este modelo, revise o histórico de tags e desative o fluxo de release/publicação Changesets concorrente.

| Caminho | Pacote npm | Base do manifest | Exemplo de tag nessa base |
| --- | --- | --- | --- |
| `packages/composables` | `@aplicacoesboilerplate/composables` | `0.0.1` | `composables-v0.0.1` |
| `packages/utils` | `@aplicacoesboilerplate/utils` | `0.0.1` | `utils-v0.0.1` |
| `packages/ui/core` | `@aplicacoesboilerplate/ui-core` | `0.0.1` | `ui-core-v0.0.1` |
| `packages/ui/prime-vue` | `@aplicacoesboilerplate/ui-prime-vue` | `0.0.1` | `ui-prime-vue-v0.0.1` |
| `packages/ui/vuetify` | `@aplicacoesboilerplate/ui-vuetify` | `1.1.1` | `ui-vuetify-v1.1.1` |

As tags da tabela ilustram o namespace escolhido, não afirmam que essas tags existem no remoto. Confira a base e o histórico antes da primeira execução; o manifest, sozinho, não cria releases retroativas.

## Configuração nativa

Copie para `release-please-config.json` na raiz:

<<< ../../../examples/versioning/packages-vue/release-please-config.json

`include-component-in-tag: true` e os cinco nomes explícitos evitam que dois pacotes tentem criar `v0.0.2` no mesmo namespace. Este exemplo usa nomes curtos separados para as tags. O piloto já aberto do PackagesVue usa nomes completos, como `@aplicacoesboilerplate/ui-vuetify`, com `tag-separator: "@"` e `include-v-in-tag: false`; esse formato também é suportado. Preserve a identidade escolhida e o histórico de tags na aplicação ao adotar o caller.

O exemplo fixa `separate-pull-requests: false`: o padrão de PR combinado mantém versões independentes e facilita revisar uma entrega conjunta. Se sua equipe preferir um PR técnico por pacote, altere para `true`; isso muda o agrupamento dos PRs, não a independência das versões.

Copie o estado inicial para `.release-please-manifest.json` na raiz:

<<< ../../../examples/versioning/packages-vue/.release-please-manifest.json

Os cinco tipos `node` vêm da configuração; o caller não precisa de `project-type`. Sem override, o SDK decide o bump de cada pacote a partir dos commits que lhe pertencem. Um `fix:` em utils e um `feat:` em vuetify podem resultar em versões diferentes. Uma milestone escalar que alcance os dois é rejeitada; consulte [versões explícitas por pacote](./versoes-conflitos#regras-em-manifest).

### Dependências internas e lockfile

Npm workspaces podem precisar atualizar dependências internas e o lockfile da raiz junto com os bumps. O SDK oferece o plugin oficial `node-workspace`, ativado na configuração nativa com `"plugins": ["node-workspace"]`. Revise suas opções de atualização de dependências para o layout real; o plugin não impõe uma versão única aos pacotes.

O exemplo ativa `node-workspace` para atualizar o lockfile da raiz com os pacotes liberados. A suíte verifica que um bump de ui-core atualiza essa entrada sem incrementar ui-vuetify ou utils. Dependências internas podem exigir bumps transitivos: revise o PR técnico e execute `npm ci` na raiz para o projeto real. Para layouts e opções do plugin, consulte a [documentação oficial](https://github.com/googleapis/release-please/blob/v17.3.0/docs/manifest-releaser.md#plugins).

## Caller do consumidor

Copie para `.github/workflows/release.yml` na raiz do consumidor:

<<< ../../../examples/versioning/packages-vue/release.yml

O preview é de leitura e deve ser um check obrigatório na proteção de `master`. O job de release só roda após merge verdadeiro e recebe as permissões necessárias para PR, tag e GitHub Release. A CI de testes do consumidor pode continuar separada, com permissões de leitura, e também deve ser exigida conforme a política da equipe.

Omitir `project-path` equivale a `.`: todos os pacotes configurados participam. Para operar um único pacote, use, por exemplo, `project-path: packages/ui/vuetify` **nas duas chamadas**. Uma versão escalar, então, tem um alvo explícito.

Use a mesma revisão em `uses` e `central-ref`; substitua `master` pelo mesmo SHA revisado assim que estiver disponível. Os recursos deste modelo não devem ser apontados para uma tag anterior que não os contém.

## Publicação é uma etapa do consumidor

O manifest central gerencia PRs, versões, changelogs, tags e releases. Ele não publica npm para todos os pacotes. O caller recebe somente as releases efetivamente criadas em `releases` e pode gerar uma matriz com essa lista. Veja o [job opcional de GitHub Packages](./publicacao#github-packages-com-workspaces).
