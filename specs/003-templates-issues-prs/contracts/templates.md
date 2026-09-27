# Contrato proposto: templates e metadados

## Issue forms em `.github/ISSUE_TEMPLATE/`

- `issuePai.yml`: única entrada de épica (migrada), `type: Release`, título do milestone e
  campos obrigatórios de contexto/objetivos/premissas; metadados fixos explicados no formulário.
- `release.yml`: release não épica, `type: Release`, escolha PATCH/MINOR/MAJOR e orientação Estimate 7/8/9.
- `feature.yml`, `task.yml`, `hotfix.yml`: tipo organizacional correspondente e prefixo
  `[LABEL]` substituído pelo label em maiúsculas (`[TEMPLATES]` na issue #4);
  contexto/entrega/premissas e orientação de vínculo à épica e escala aplicável.
- `issueCLI.yml`: bug da CLI existente, preservando comando, ecossistema e logs obrigatórios.
- `title`, `labels`, `type` e `projects` são chaves válidas; não fixar `projects` por default
  para consumidores diversos nem inserir `release` como chave desconhecida.

## PR em `.github/PULL_REQUEST_TEMPLATE.md`

Seções por padrão: issue vinculada, `Realização`, `Fontes modificados`, `p/ teste`,
`O que há de novo`, checklist de review/labels/milestone/Project. Distinguir palavra-chave
de fechamento em PR para principal de referência simples em PR para release/develop.

## Complementação de metadados

O guia de adoção identifica quais dados precisam ser inseridos manualmente na issue e no
Project após a abertura: parent, milestone, datas, Release/Hotfix, Estimate, Size, Priority e
Effort. Workflows não são herdados do repositório `.github`; uma automação opcional futura
precisará de contrato e permissões próprios e não faz parte desta entrega.

Esses arquivos são caminhos propostos para a implementação; no estado atual só existem
`issueCLI.yml` e `issuePai.yml`.
