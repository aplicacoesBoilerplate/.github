# Proposal

## Why

A issue #5 descreve análise preventiva em PR, mas o fluxo aprovado exige análise corretiva do código já integrado em `develop`. Hoje não há um contrato reutilizável que associe o Quality Gate ao SHA analisado, impeça a promoção de um SHA reprovado para `master` e registre a correção sem reabrir a épica da release.

## What Changes

- Introduzir análise SonarQube acionada pelo consumidor após merge em `develop`, com resultado do Quality Gate vinculado ao SHA exato e evidência navegável da análise.
- Introduzir check de promoção para PR `develop → master` que exige PASS do mesmo SHA e bloqueia resultado ausente, inconclusivo ou obsoleto.
- Em FAIL confirmado, criar de forma idempotente uma issue do tipo `Hotfix`, com Status `On hold` no Project V2 e a mesma milestone da épica encerrada; preservar épica em `Done` e milestone fechada.
- Preparar exemplos de workflows consumidores, documentação de configuração/permissões e testes de contrato com respostas simuladas.
- Não acionar Sonar em cada feature PR, não atribuir `Request changes` por reprovação pós-merge e não provisionar um servidor SonarQube neste MVP.

## Capabilities

### New Capabilities

- `sonarqube-develop-quality-gate`: Análise pós-merge, decisão de promoção por SHA e rastreamento da Hotfix corretiva.

### Modified Capabilities

Nenhuma. A integração com o versionamento por sprint, ainda registrada em uma change não sincronizada às specs principais, será tratada no design e nas tarefas sem declarar uma spec principal inexistente como modificada.

## Impact

- Workflows reutilizáveis em `.github/workflows/`, scripts de qualidade, testes e documentação de callers; interação com os gates de homologação/versionamento existentes.
- APIs do SonarQube Server e do GitHub (commit status/checks, Issues, milestones e Projects V2), com segredos e permissões configurados pelos consumidores.
- A configuração de um Quality Gate real, um servidor SonarQube, a branch remota `develop` e a proteção obrigatória de `master` são pré-requisitos de ativação externos e ainda não estão disponíveis; os testes locais não substituirão uma validação ponta a ponta.
