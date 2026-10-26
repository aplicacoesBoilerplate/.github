# Workflows centralizados

version-release-please-called.yml recebe o contrato do consumidor e orquestra os scripts TS e o motor oficial. O caller real fica na aplicação, aguarda sua CI e fixa a mesma revisão em uses e central-ref. Há um único exemplo genérico em examples/.

O passo run é um comando do runner: executa Node/tsx com os arquivos instalados do checkout central. Não é necessário distribuir uma CLI. Veja o [README dos scripts](../../ci-scripts/README.md) e o [guia completo de versionamento](../../docs/pipelines/versionamento-release-please.md).

Etapa 1 mantém publish-artifacts=false. Tag/GitHub Release e publicação em registry são operações separadas. A CI central é reutilizável e executa a suíte funcional com o motor real, além do typecheck.
