---
description: "Tarefas de implementação dos templates de issues e PRs"
---

# Tasks: Templates de issues e PRs

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [contrato](contracts/templates.md) e [quickstart.md](quickstart.md).

**Tests**: Validação estrutural dos seis formulários e revisão de conteúdo/experiência conforme [quickstart.md](quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: tarefa executável em paralelo em arquivo distinto.
- **[Story]**: corresponde às jornadas da especificação.

## Phase 1: Setup

**Purpose**: preservar a funcionalidade dos pilotos antes da migração.

- [X] T001 Registrar em `specs/003-templates-issues-prs/quickstart.md` que o piloto `.github/ISSUE_TEMPLATE/issueCLI.yml` exige comando, ecossistema e logs, e que `issuePai.yml` é o único formulário de épica; conferir no diff da migração.

## Phase 2: Foundational

**Purpose**: manter uma escala consistente para todas as jornadas.

- [X] T002 Escrever `docs/templates.md` com a escala Size XS–XL, Estimate 0 homologação, 1–5 feature, 6 hotfix, 7/8/9 PATCH/MINOR/MAJOR e 10 somente épica; conferir os exemplos com issue #4.

## Phase 3: User Story 1 - Registrar entrega (P1)

**Goal**: cinco escolhas de issue, mantendo o bug da CLI.

**Independent Test**: conferir seleção, obrigatoriedade dos campos, título, tipo, escala e nenhuma duplicação de épica.

- [X] T003 [US1] Corrigir `.github/ISSUE_TEMPLATE/issuePai.yml` como única épica com `body`, `type: Release`, título `vX.Y.Z` e orientações de milestone/datas/Estimate 10/Size XL/Effort Team/Release MAJOR; validar a sintaxe e que não há chave `release` personalizada.
- [X] T004 [P] [US1] Criar `.github/ISSUE_TEMPLATE/release.yml` com `type: Release`, escolha PATCH/MINOR/MAJOR, Estimate 7/8/9, contexto/entrega/premissas e aviso de que não é épica; validar as opções.
- [X] T005 [P] [US1] Criar `.github/ISSUE_TEMPLATE/feature.yml` com `type: Feature`, prefixo `[LABEL]` editável, referência à épica, contexto/entrega/premissas e escala XS–XL/Estimate 1–5; conferir os campos obrigatórios.
- [X] T006 [P] [US1] Criar `.github/ISSUE_TEMPLATE/task.yml` com `type: Task`, prefixo `[LABEL]` editável, referência à épica, contexto/entrega/premissas e seleção de valor sem Estimate fixo; conferir os campos obrigatórios.
- [X] T007 [P] [US1] Criar `.github/ISSUE_TEMPLATE/hotfix.yml` com `type: Hotfix`, prefixo `[LABEL]` editável, impacto/urgência/validação, contexto/premissas, Estimate 6 e Size variável; conferir os campos obrigatórios.
- [X] T008 [US1] Preservar `.github/ISSUE_TEMPLATE/issueCLI.yml` com comando, ecossistema e logs obrigatórios, corrigindo apenas incompatibilidades comprovadas; comparar com o piloto no `git diff`.

## Phase 4: User Story 2 - Revisar PR (P2)

**Goal**: PR com evidências e vínculo coerente à issue.

**Independent Test**: visualizar PR e localizar as quatro seções, relação, metadados e revisão.

- [X] T009 [US2] Criar `.github/PULL_REQUEST_TEMPLATE.md` com issue relacionada, `Realização`, `Fontes modificados`, `p/ teste`, `O que há de novo` e checklist de review/metadados; conferir se as quatro seções aparecem no Markdown.
- [X] T010 [US2] Orientar no mesmo `.github/PULL_REQUEST_TEMPLATE.md` referência simples em PRs intermediários e fechamento somente quando merge na branch padrão encerrar a issue; conferir exemplo para base `master`.

## Phase 5: User Story 3 - Metadados e adoção (P3)

**Goal**: usar apenas metadados nativos globais seguros e instruir complementação.

**Independent Test**: validar tipos organizacionais, ausência de `projects` fixado e documentos para preenchimento restante.

- [X] T011 [US3] Documentar em `docs/templates.md` campos nativos `title`, `labels`, `type`, `projects` (este último com permissão e somente para consumidor específico), distinguindo Issue Fields dos campos Projects; conferir que os formulários não contêm Project #6 nem assignee global.
- [X] T012 [US3] Documentar em `docs/templates.md` herança na organização pública `.github`, precedência da pasta local de Issue Forms, substituição do PR template local e ausência de herança de workflows; conferir exemplos de consumidor com e sem templates locais.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 Revisar todos os formulários YAML em `.github/ISSUE_TEMPLATE/` contra o contrato em `specs/003-templates-issues-prs/contracts/templates.md` e executar `git diff --check`; conferir que labels inexistentes não bloqueiam e nenhum campo externo é prometido como automático.
- [X] T014 Executar o roteiro em `specs/003-templates-issues-prs/quickstart.md` onde houver permissão de ensaio e registrar em `specs/003-templates-issues-prs/validation-results.md` resultados e passos de UI não executados; não criar issues de teste no repositório principal.

## Dependencies & Execution Order

- T001–T002 precedem T003–T012; T003 precede T008; T004–T007 são independentes entre si.
- US2 pode começar após T002 em paralelo com US1; T011–T012 precedem a validação final.
- MVP: T001–T008; entrega completa: T001–T014.
