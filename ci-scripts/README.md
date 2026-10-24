# Scripts das pipelines

O workflow define eventos, permissões, checkout, runtime e sequência dos passos. Os scripts TypeScript mantêm regras compartilhadas e usam o motor oficial do Release Please; os callers pertencem às aplicações.

## Como run executa TypeScript

O checkout da aplicação fica na raiz do runner. Um segundo checkout baixa este repositório em .ci-scripts. O projeto Node dentro dele chama-se ci-scripts, resultando em .ci-scripts/ci-scripts/package.json.

Após setup-node e npm ci --prefix .ci-scripts/ci-scripts --omit=dev --ignore-scripts, o passo run executa:

```text
node .ci-scripts/ci-scripts/node_modules/tsx/dist/cli.mjs .ci-scripts/ci-scripts/scripts/release-orchestrator.ts
```

Node inicia o CLI do tsx instalado pelo lockfile; tsx carrega o entrypoint TS. Os argumentos são caminhos no runner, sem pacote global ou shell de domínio. O prefixo repetido representa dois diretórios distintos. O checkout dos scripts usa central-ref, que precisa ser o mesmo SHA do called referenciado pelo consumidor.

## Responsabilidades

| Arquivo | Papel |
| --- | --- |
| scripts/release-orchestrator.ts | Factory do tipo de projeto, milestone nos dois momentos e outputs para selecionar o motor |
| scripts/release-configuration.ts | Contrato dos configs versionados, seeds SemVer, política e caminhos confinados ao consumidor |
| scripts/configured-release.ts | Ponte pela API pública GitHub/Manifest para raiz configurada com override transitório; cria releases e depois recarrega para preparar PRs |
| tests/release-please.test.ts | Fluxo central com SDK real, transporte isolado, YAMLs e fixtures Maven/workspace |
| tests/conventional-commit.test.ts | Contrato Commitlint existente |

GITHUB_OUTPUT transporta valores entre passos. Um JSON local não configura automaticamente a Action; single usa seus inputs oficiais, manifest usa arquivos remotos e raiz configurada usa a ponte SDK. O config estático do consumidor é preservado e release-as não fica persistido para a entrega seguinte.

O runtime instala release-please 17.3.0, semver e tsx com --omit=dev --ignore-scripts. Testes acrescentam TypeScript, YAML e tipos; imports internos do SDK estão limitados ao teste e presos à versão exata. Atualizações do SDK precisam passar a suíte completa e o typecheck.

## Verificar

```text
npm ci --ignore-scripts
npm ci --prefix ci-scripts --ignore-scripts
npm test --prefix ci-scripts
npm run typecheck --prefix ci-scripts
```

O teste usa eventos e transporte isolados, mas cálculo/changelog/updaters são reais. Não cria PRs, tags ou releases no GitHub. O ciclo hospedado de cada consumidor continua sendo a evidência final após merge humano. Na etapa 1 publish-artifacts=false impede distribuição de pacotes e binários.

Consulte o [README dos workflows](../.github/workflows/README.md) e o [guia de contrato, políticas e pilotos](../docs/pipelines/versionamento-release-please.md).
