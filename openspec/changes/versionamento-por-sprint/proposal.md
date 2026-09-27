# Proposal

## Why

Os repositórios consumidores precisam prever o impacto semântico das entregas durante a sprint sem publicar versões prematuras e, depois da homologação, publicar uma versão rastreável ao commit integrado. Hoje este repositório não disponibiliza workflows reutilizáveis de versionamento; a especificação de referência é `specs/001-versionamento-por-sprint/`.

## What Changes

- Introduzir prévia de versão por `workflow_call` para PRs de entrega, com identificação da sprint, validação de metadados e commits e saídas semânticas, sem escrita em tags, releases ou arquivos.
- Introduzir publicação por `workflow_call` somente após integração e aprovação/homologação exigidas pelo consumidor; vincular versão, tag e GitHub Release ao commit integrado e aproveitar changelog quando disponível.
- Suportar adaptadores explícitos para `standard-version`, Changesets/Turbo, `jgitver` e `go-gitsemver`, preservando as convenções de cada consumidor.
- Impedir sobrescrita de tags, conciliar reexecuções do mesmo commit e retornar conflitos e falhas parciais com orientação de recuperação.
- Documentar contrato de chamada, permissões, saídas e exemplos de uso e validar os quatro perfis e os cenários de concorrência.

## Capabilities

### New Capabilities

- `versionamento-por-sprint`: prévia sem publicação durante a sprint e publicação pós-integração protegida, com adaptadores por perfil e reconciliação segura.

### Modified Capabilities

Nenhuma; ainda não há capacidades registradas em `openspec/specs/`.

## Impact

- Novos workflows reutilizáveis em `.github/workflows/version-preview.yml` e `.github/workflows/version-publish.yml`, scripts em `scripts/versioning/`, documentação em `docs/versioning.md` e verificações em `tests/versioning/`.
- Repositórios consumidores configuram callers, ferramentas de versionamento, proteção de branch/ambiente e permissões adequadas; somente o fluxo de publicação recebe `contents: write`.
- Novos contratos de entradas/saídas para GitHub Actions e integração com Git tags e GitHub Releases; sem alteração dos templates de issue existentes.
