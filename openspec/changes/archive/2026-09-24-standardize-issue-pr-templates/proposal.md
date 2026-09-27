# Proposal

## Why

A issue #4 pede um catálogo coerente para épicas, releases, features, tasks, hotfixes e PRs. Hoje há apenas dois formulários piloto, um deles com configuração inválida, e o planejamento existente supõe que nenhum metadado de tipo ou Project pode ser preenchido por formulário, embora o GitHub já suporte ambos.

## What Changes

- Disponibilizar formulários distintos para os cinco tipos solicitados, preservando o formulário especializado de bug da CLI e transformando `issuePai.yml` na única entrada de épica.
- Padronizar títulos, contexto, entrega, premissas, relação com milestone/épica e escala de valor; usar metadados nativos do formulário apenas quando forem seguros para repositórios da organização.
- Disponibilizar template de PR com realização, fontes modificados, instruções de teste, novidades, vínculo com issue e revisão dos metadados.
- Documentar herança do repositório público `.github`, limites de automação de Issue Fields/Project Fields e procedimento de complementação manual ou conciliação opt-in quando necessário.

## Capabilities

### New Capabilities

- `collaboration-templates`: seleção e preenchimento orientado dos formulários de issues e PRs, metadados seguros, relação com a entrega e herança organizacional.

### Modified Capabilities

Nenhuma; não há especificações principais existentes.

## Impact

- `.github/ISSUE_TEMPLATE/issuePai.yml` e `issueCLI.yml`, novos formulários em `.github/ISSUE_TEMPLATE/` e `.github/PULL_REQUEST_TEMPLATE.md`.
- Documentação de adoção e validação da configuração no repositório `ModulosTestesAutomatizados/.github`; repositórios da organização sem templates locais poderão herdar os defaults após merge em `master`.
- Metadados externos (milestone, parent/sub-issue, Issue Fields e valores de Projects) continuam dependentes das permissões e configuração da organização; nenhum ID de outro Project deve ser presumido.
