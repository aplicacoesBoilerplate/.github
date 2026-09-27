---
description: "Tarefas da feature de versionamento por sprint"
---

# Tasks: Versionamento por sprint

**Input**: `specs/001-versionamento-por-sprint/` (spec, plan, research, data-model, contracts e quickstart)

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/versioning.md`

**Tests**: Contratos e cenários FR-001–FR-009 / SC-001–SC-004; roteiro em `quickstart.md`.

**Organization**: T001–T015 são histórico da implementação anterior; T017+ corrigem o
contrato de acordo com [OpenSpec](../../openspec/changes/corrigir-versionamento-pos-merge/tasks.md).
`[X]` no histórico registra que o código antigo foi produzido, não que satisfaz a spec atual.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode ser executada em paralelo com outras tarefas marcadas que tocam arquivos distintos.
- **[Story]**: história que a tarefa realiza.

## Path Conventions

- Workflows em `.github/workflows/`; coordenação e adaptadores em `scripts/versioning/`.
- Cenários e exemplos de consumo em `LocalLabs/tests/versioning/` e
  `LocalLabs/examples/` (clone de testes fornecido pelo usuário);
  documentação compartilhada em `docs/versioning.md`.

## Histórico - Phase 1: Setup (contrato antigo, substituído)

**Purpose**: Estabelecer a estrutura de validação sem alterar os templates de issue existentes.

- [X] T001 Criar cenário de consumidor de prévia e publicação em `LocalLabs/tests/versioning/fixtures/caller.yml`, com referência estável `@v1` para ativar após publicá-la e sem secrets reais.
- [X] T002 [P] Definir lint/validação YAML e checagem de `workflow_call` em `LocalLabs/tests/versioning/validate-contract.sh`.

## Histórico - Phase 2: Foundational

**Purpose**: Impedir comandos e versões ambíguos nos adaptadores.

- [X] T003 Implementar seleção por enumeração fechada (`standard-version`, `changesets`, `jgitver`, `go-gitsemver`) e validação de `project_path` em `scripts/versioning/resolve-adapter.sh`.
- [X] T004 [P] Criar validador de milestone `vMAJOR.MINOR.PATCH`, branch `release/<milestone>`, metadados mínimos e conventional commits em `scripts/versioning/validate-sprint.sh` e `scripts/versioning/version.mjs`.

## Histórico - Phase 3: User Story 1 - Prévia semântica no PR (substituída)

**Goal**: Publicar prévia no PR sem efeitos de escrita.

**Independent Test**: PR válido e inválido para release produzem prévia/diagnóstico, sem tag.

- [X] T005 [US1] Implementar cálculo não destrutivo por perfil, retornando `bump` (`major|minor|patch|none`), `candidate_version` e `summary`, em `scripts/versioning/preview.sh`.
- [X] T006 [US1] Criar `.github/workflows/version-preview.yml` com `workflow_call`, entradas `adapter`/`release_branch`/`project_path`, saídas do contrato e `contents: read`, `pull-requests: read`, `issues: read` para verificar a sub-issue.
- [X] T007 [US1] Registrar em `LocalLabs/tests/versioning/preview-scenarios.md` passos de validação para PR válido, empilhado e malformado, exigindo ausência de tags e releases.

**Checkpoint**: prévia utilizável isoladamente nos quatro perfis.

## Histórico - Phase 4: User Story 2 - Publicação após aprovação (substituída)

**Goal**: Publicar após merge, mantendo versão gerada pelo perfil do consumidor.

**Independent Test**: merge aprovado gera uma tag/release, tentativa antes da homologação falha.

- [X] T008 [US2] Implementar preparação/checagem da versão do perfil em `scripts/versioning/prepare-release.sh` e changelog opcional em `scripts/versioning/publish.sh`, sem executar shell interpolado a partir de PR.
- [X] T009 [US2] Implementar criação de tag e GitHub Release no commit integrado, conferindo existência antes de criar, em `scripts/versioning/publish.sh`.
- [X] T010 [US2] Criar `.github/workflows/version-publish.yml` com `workflow_call`, inputs `adapter`/`release_branch`/`project_path`/`target_branch`/`homologation_environment`, `contents: write` apenas nesta operação e saídas `version`/`tag`/`release_url`/`outcome`.
- [X] T011 [US2] Incluir em `LocalLabs/tests/versioning/fixtures/caller.yml` exemplo de caller pós-merge que requer review/homologação e serializa pelo destino, sem permitir publicação no evento de PR.

**Checkpoint**: publicação funcional sem comprometer o MVP de prévia.

## Histórico - Phase 5: User Story 3 - Concorrência e recuperação

**Goal**: Reexecutar sem duplicar e resolver colisões sem mover tags.

**Independent Test**: duas publicações concorrentes e dez reexecuções preservam a tag original.

- [X] T012 [US3] Incorporar em `scripts/versioning/publish.sh` comparação de commit/tag com criação exclusiva da ref e reconciliação `published|already-published|conflict`, sem force-push.
- [X] T013 [US3] Tratar em `.github/workflows/version-publish.yml` e `scripts/versioning/publish.sh` falha parcial e retorno acionável quando a release existe sem tag correspondente ou vice-versa.
- [X] T014 [US3] Registrar reexecuções, colisão entre commits diferentes e recuperação manual em `LocalLabs/tests/versioning/retry-scenarios.md`.

**Checkpoint**: conflitos não corrompem tags ou releases existentes.

## Histórico - Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentação de contrato, consumo e evidências de validação.

- [X] T015 Documentar em `docs/versioning.md` os quatro perfis de callers, permissões, referência estável, limites e política de migração.
- [ ] T016 Executar e registrar os passos hospedados do `quickstart.md` corrigido em `LocalLabs/tests/versioning/validation-results.md` após revisão fixa, checks e gates; depende de T017–T036.

## Phase 7: User Story 1 - Checks contextuais e homologação (Priority: P1) 🎯 MVP corrigido

**Goal**: PR final pode passar no check obrigatório sem sub-issue de feature nem SemVer antecipado.

**Independent Test**: Três transições válidas e três inválidas, sem tags e sem escrita no consumidor.

- [X] T017 [US1] Classificar evento PR por base/head em `scripts/versioning/version.mjs` e `scripts/versioning/validate-sprint.sh`; testar rejeição de transições desconhecidas.
- [X] T018 [US1] Separar regra de sub-issue (feature) de regra de épica encerrada e milestone concluída (release → develop) em `scripts/versioning/validate-sprint.sh`; testar vínculo válido/inválido e release ainda aberta.
- [X] T019 [US1] Verificar conclusão de homologação, épica/milestone e review no PR develop → principal em `scripts/versioning/validate-sprint.sh`; testar falhas de cada gate.
- [X] T020 [US1] Substituir prévia SemVer obrigatória por check contextual em `scripts/versioning/preview.sh` e `.github/workflows/version-preview.yml`; testar status exigível em main/master.
- [X] T021 [US1] Produzir guia opcional em `scripts/versioning/preview.sh`, sem bloquear PR por ferramenta ausente; testar ausência de mudanças e tags.

## Phase 8: User Story 2 - Versão definitiva pós-merge (Priority: P1)

**Goal**: Node versionado em PR posterior ao merge funcional; Java/Go derivados do Git.

**Independent Test**: Merge funcional Node cria PR versionado e não tag; merge deste PR publica no SHA correto.

- [X] T022 [US2] Validar push funcional/PR de versão, proveniência e SHA em `scripts/versioning/prepare-release.sh` e `scripts/versioning/publish.sh`; testar evento/branch/PR falsos.
- [X] T023 [US2] Preparar standard-version sem commit/tag automático após merge em `scripts/versioning/prepare-release.sh`; testar vários PRs sem tag intermediária e bump único.
- [X] T024 [US2] Preparar Changesets por pacote com lockfile e changelog em `scripts/versioning/prepare-release.sh`; testar versão `@scope/name@X.Y.Z`.
- [X] T025 [US2] Abrir/reutilizar PR de versão com diff limitado e gates em `scripts/versioning/`, reportando `pending-version-pr`; testar reexecução e base avançada.
- [X] T026 [US2] Reconhecer o merge aprovado do PR versionado e publicar apenas no commit com versão persistida em `scripts/versioning/publish.sh`; testar SHA e não recriação de PR.
- [ ] T027 [US2] Obter versão estável derivada de Git para jgitver/go-gitsemver em `scripts/versioning/prepare-release.sh`; testar com ferramentas reais no ensaio hospedado.

## Phase 9: User Story 3 - Publicação, migração e ensaio hospedado (Priority: P2)

**Goal**: Publicação reconciliável e adoção segura por quatro perfis.

**Independent Test**: Reexecução e conflito não movem tags, cada rodada produz tag e release próprias.

- [ ] T028 [US3] Preservar token no job publicador em `.github/workflows/version-publish.yml` e testar `gh api` real em `scripts/versioning/publish.sh`; demonstrar que o unset em processo filho não era causa de falha.
- [X] T029 [US3] Validar versão/SHA/tag/release na reconciliação em `scripts/versioning/publish.sh`; testar `published`, `already-published`, `conflict` e falha parcial.
- [ ] T030 [US3] Adequar `.github/workflows/version-publish.yml` e caller de teste para duas fases, privilégios mínimos e identidade que dispare checks; validar contrato YAML.
- [ ] T031 [US3] Atualizar `docs/versioning.md` e `specs/001-versionamento-por-sprint/` com contrato pós-merge, migração de saídas e changelog opcional; verificar ausência de exigência pré-merge.
- [ ] T032 [US3] Conciliar `openspec/changes/versionamento-por-sprint/` com o contrato corrigido e verificar requisitos não conflitantes antes de sincronizar/arquivar.
- [ ] T033 [US3] Atualizar testes/fixtures de `LocalLabs/tests/versioning/` para os três PRs, PR versionado e publicação; executar verificações locais.
- [ ] T034 [US3] Documentar em `docs/versioning.md` o roteiro LocalLabs com quatro rodadas/tag próprias, proteção, environment, CI TypeScript/Spring Boot e referências fixas; conferir matriz de resultados esperados.
- [ ] T035 [US3] Preparar caller de `LocalLabs/tests/versioning/fixtures/caller.yml` para `.github/workflows/` do consumidor, sem ativar publicação antes das prévias; validar checks de CI.
- [ ] T036 [US3] Definir matriz de evidências hospedadas (URL de check/PR, tag, SHA, release, reexecução, conflito) em `quickstart.md` e `docs/versioning.md`; conferir quatro perfis e cenário standard-version multi-PR.

## Dependencies & Execution Order (correção atual)

- T001–T015 descrevem a base existente, não são gates da correção.
- T017–T021 (US1) primeiro: habilitam o check exigido na proteção de main/master.
- T022–T027 (US2) dependem do contrato de PR; T028–T036 (US3) fecham publicação
  e roteiro; T016 hospedado exige referência fixa, acesso e conclusão anterior.

## Parallel Example: User Story 3

- Após T021, documentação de laboratório T034 pode ser redigida em paralelo à
  reconciliação de publicação T029, pois atingem arquivos diferentes.

## Implementation Strategy

- MVP corrigido: T017–T021, três PRs passam pelos checks contextuais sem tags.
- Depois: T022–T027 para versionamento, T028–T036 para publicação/consumo;
  T016 é validação hospedada final, não satisfeita pelos testes locais.

## Notes

- A versão Node é produzida **após** integração funcional; revisão humana do PR de
  versão precede tag/release. A milestone não determina a versão do consumidor.
