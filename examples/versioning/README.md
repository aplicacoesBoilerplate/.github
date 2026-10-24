# Exemplos de versionamento

Estes arquivos são modelos para copiar e revisar, não workflows ativos deste catálogo.

- `node-docs.yml`: copie para `.github/workflows/release.yml` de um consumidor com `docs/package.json`; usa o adaptador Node sem publicar npm.
- `packages-vue/release-please-config.json`: copie para a raiz do monorepo.
- `packages-vue/.release-please-manifest.json`: copie para a raiz e confira versões contra o histórico real.
- `packages-vue/release.yml`: copie para `.github/workflows/release.yml` do monorepo; gerencia metadados.
- `packages-vue/publish-job.yml`: fragmento opcional; adicione `publish` sob `jobs` no mesmo caller para publicar no GitHub Packages.

O exemplo PackagesVue não migra o repositório remoto. A referência atual `release/v0.0.1` usa Changesets, GitHub Packages e npm workspaces. Uma eventual migração precisa remover ou desativar o publicador Changesets concorrente, revisar tags anteriores, permissões do registro, scripts de build e `npm run verify` antes de ativar a publicação.

As chamadas usam `@master` e `central-ref: master` porque os novos recursos precisam estar disponíveis na revisão central. Depois de revisar uma revisão publicada, fixe o mesmo SHA em ambos os campos. Não referencie uma futura `v0.0.2` antes de ela existir.

Configure o job de validação como check obrigatório na proteção de `master`. A CI de testes do consumidor pode continuar em um workflow separado com permissões de leitura.

Consulte a documentação em `docs/pipelines/versionamento-release-please.md` e `docs/pipelines/release-please/` para o contrato e as limitações.


## Publicação por adaptador

A pasta [consumers](./consumers/README.md) contém exemplos completos de node, maven, gradle, go e simple. Eles usam manifest e publicadores no caller. Consulte os pré-requisitos, substitua o SHA central e ajuste os seeds e nomes do projeto antes de copiar os arquivos.

O exemplo Gradle usa simple + extra-file genérico; não pressupõe uma estratégia gradle no SDK nem um publicador Gradle implementado na central. Os exemplos não executaram uploads reais de pacotes nesta validação.
