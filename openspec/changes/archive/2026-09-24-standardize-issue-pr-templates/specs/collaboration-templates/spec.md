# Spec Delta

## Purpose

Padronizar o registro e a revisão de trabalho nos repositórios da organização por meio de formulários de issues e um template de PR compartilháveis, preservando a semântica dos metadados de cada entrega.

## ADDED Requirements

### Requirement: Catálogo de tipos de issue
O catálogo MUST oferecer entradas distinguíveis para épica de release, release não épica, feature, task e hotfix, sem duplicar a opção de épica, e MUST manter a jornada existente de relato de bug da CLI.

#### Scenario: Escolha do formulário
- **WHEN** uma pessoa escolhe criar uma issue em um repositório que usa o catálogo
- **THEN** encontra as cinco finalidades distintas e a opção especializada de bug da CLI

#### Scenario: Preservação do piloto
- **WHEN** a pessoa escolhe relatar bug da CLI
- **THEN** consegue informar comando executado, ecossistema afetado e logs como campos obrigatórios

### Requirement: Conteúdo e vínculo da issue
Cada formulário MUST pedir contexto, entrega esperada e premissas pertinentes ao seu tipo e MUST orientar o título. A épica MUST usar o nome exato da milestone; sub-issues MUST orientar título `[LABEL]` seguido da descrição, com o marcador substituído pelo nome do label escolhido em maiúsculas, e vínculo com a épica e a milestone. O hotfix MUST pedir impacto, urgência e validação da correção.

#### Scenario: Épica de sprint
- **WHEN** uma épica de release é registrada
- **THEN** há instruções para igualar o título à milestone e registrar início e entrega nas mesmas datas

#### Scenario: Sub-issue comum
- **WHEN** uma feature ou task é registrada
- **THEN** o título inicia com o nome do label em maiúsculas entre colchetes (por exemplo `[TEMPLATES]`) e há campos para contexto, entrega, premissas e referência da épica

#### Scenario: Correção urgente
- **WHEN** um hotfix é registrado
- **THEN** sua descrição registra a falha em produção, impacto, correção e modo de validar

### Requirement: Escala de valor e metadados
Os formulários MUST explicitar que Size e Estimate medem valor agregado, não dificuldade. A épica MUST orientar Release MAJOR, Size XL, Estimate 10 e Effort Team; uma release não épica MUST orientar Estimate 7, 8 ou 9 conforme PATCH, MINOR ou MAJOR, nunca 10 por padrão. Feature MUST orientar XS–XL e Estimate 1–5 conforme a escala; hotfix MUST orientar Estimate 6 e Size variável; homologação MUST orientar Estimate 0. Campos de esforço ou prioridade MUST NOT ser inferidos do Estimate.

#### Scenario: Valores distintos de release
- **WHEN** alguém escolhe release não épica do tipo MINOR
- **THEN** recebe orientação de Estimate 8 sem os valores fixos reservados à épica

#### Scenario: Limite de metadados nativos
- **WHEN** um metadado não puder ser definido pelo formulário ou exigir permissão/configuração externa
- **THEN** a pessoa recebe orientação explícita de como preenchê-lo depois, sem promessa de atribuição automática

### Requirement: Revisão de PR
O template de PR MUST conter vínculo da issue, `Realização`, `Fontes modificados`, `p/ teste` e `O que há de novo`, além de orientação para conferir metadados equivalentes aos da issue e solicitar revisão. O vínculo MUST distinguir referência simples de instrução de fechamento quando a integração na branch padrão realmente encerrar a issue.

#### Scenario: PR de entrega
- **WHEN** um PR é aberto a partir de uma branch de trabalho
- **THEN** o autor encontra as quatro seções e indica a issue, evidências, testes e metadados a conferir

#### Scenario: PR intermediário
- **WHEN** um PR tem como base uma branch intermediária
- **THEN** o autor é orientado a referenciar a issue sem fechá-la prematuramente

### Requirement: Adoção e compatibilidade
A documentação MUST explicar o uso como defaults herdados do repositório público `.github`, o comportamento quando o consumidor possui templates locais e as etapas manuais para relacionamentos e metadados que não são herdados ou preenchidos automaticamente. Nenhuma configuração MUST inserir itens em Project de outro domínio por padrão.

#### Scenario: Repositório com templates locais
- **WHEN** um consumidor já possui formulários locais de issue
- **THEN** a documentação deixa claro que a pasta de defaults não será mesclada com os formulários locais

#### Scenario: Repositório sem configuração de Project
- **WHEN** um consumidor usa os templates sem ter Project ou campos equivalentes
- **THEN** consegue registrar issue e PR com as informações essenciais e consultar o que precisa de ajuste manual
