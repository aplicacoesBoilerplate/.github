# Projeto em subdiretório

Use `project-path` quando o manifesto da linguagem está dentro de um diretório. O caminho é relativo à raiz do consumidor, usa `/` e não aceita `..` ou caminhos absolutos. O padrão `.` preserva os callers existentes que trabalham na raiz.

## Exemplo: documentação com package.json

Neste exemplo, o adaptador `node` atualiza `docs/package.json` e os arquivos nativos correspondentes. `publish-artifacts: false` desativa o publicador npm; a tag e a GitHub Release continuam sendo criadas pelo ciclo de release.

Copie o arquivo para `.github/workflows/release.yml` no consumidor:

<<< ../../../examples/versioning/node-docs.yml

Cadastre o check do job `version-policy` como obrigatório em `master`. O PR funcional precisa de milestone ou footer explícito, pois esse exemplo usa o modo de projeto único. Preserve sua CI normal de build e testes; a validação de versão não a substitui.

As referências `@master` e `central-ref: master` precisam apontar para uma revisão que já contenha esses recursos. Após a revisão, fixe o mesmo SHA nos dois campos.

## Efeito do caminho

| Item | Comportamento |
| --- | --- |
| Action oficial no modo único | Recebe `project-path` no input `path`. |
| npm e Maven legados | Publicação executa com `working-directory` no projeto. |
| GoReleaser legado | Recebe o projeto como `workdir`. |
| Manifest com `project-path: .` | Seleciona todos os pacotes configurados. |
| Manifest com caminho explícito | Seleciona exatamente a entrada de `packages` correspondente. |

O adaptador determina os arquivos nativos; o caminho determina onde está o projeto. Para adicionar arquivos externos à versão do componente, use os `extra-files` da configuração nativa e revise seus caminhos conforme o SDK.

No modo único, o namespace é `vX.Y.Z`; chamadas independentes para dois subdiretórios não criam automaticamente namespaces independentes. Para vários pacotes no mesmo repositório, use [manifest com componentes distintos](./monorepos).

## Diferença em relação a este catálogo

O exemplo acima versiona um componente em `docs/`. O próprio catálogo central usa o alvo raiz `.` com estratégia `simple` e `extra-files` para atualizar os JSONs da documentação. Essa configuração inclui alterações nas pipelines e em todos os demais diretórios no ciclo da release do catálogo.
