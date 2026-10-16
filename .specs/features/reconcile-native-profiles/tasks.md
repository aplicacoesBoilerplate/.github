# Reconcile Native Profiles — Tasks

## Execution Protocol (MANDATORY -- do not skip)
Usar tlc-spec-driven, testes por tarefa, commit atômico e verificador fresco ao final.
Usuário autorizou conciliação e push no PR12 em 2026-10-15; execução neste chat conforme escolha anterior. Não delegar lotes.
**Status**: Approved.
**Design**: design.md.

## Test Coverage Matrix
Guidelines: AGENTS.md e CI; amostras version-report, standard-flow, adapter-report, workflow-contract e real-standard-version.
| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Ports/parsing/domain/guide | unit | ACs e negativos com payload exato | tests/versioning/*.mjs | fixture da tarefa |
| Adapters/orquestração | integration | Happy/error/retry e native real | tests/versioning/*.mjs | --local e real afetado |
| Workflows | integration | Jobs, permissões e setup, sem privilégios na execução nativa | tests/versioning/*.mjs | --local, YAML/actionlint |
| Docs | none | links e contratos | docs | validadores |

## Gate Check Commands
| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Componente isolado | node fixture(s) da tarefa; node --check; git diff --check; docs: validate_spec/tasks |
| Full | Integração | Quick + fixtures de fluxo afetado; adaptador nativo real quando alterado |
| Build | Workflows/final | --local completo, --real-go, real-standard-version.mjs, real-jgitver.mjs, YAML/actionlint e diff |
Baseline PR12:13 fixtures locais. Local Maven:21, reactor118. União preservará todas assertions.
Windows usa Git Bash explícito no PATH; Java21/Maven3.9.9 para fixture novo.
Atualização de prerequisites das fixtures Maven e de asserts estruturais de jobs é migração do contrato, não remoção de cenários; cada alteração deve manter ou fortalecer os outcomes exigidos.

## Execution Plan
### Phase 1: Reconciliação e ports
T1 -> T2 -> T3 -> T4
### Phase 2: Adaptadores
T5 -> T6 -> T7
### Phase 3: Publicação
T8 -> T9 -> T10
### Phase 4: Contrato e documentação
T11 -> T12

## Task Breakdown
### T1: Registrar conciliação e baseline
**What**: Registrar conciliação e baseline.
**Where**: spec.md
**Depends on**: None
**Requirement**: REC-01, REC-06
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Mapa PR12/local e autorização documentados; validadores estruturais passam.
**Tests**: none
**Gate**: Quick

### T2: Reaproveitar executor de processos
**What**: Reaproveitar executor de processos.
**Where**: scripts/versioning/process-runner.mjs
**Depends on**: T1
**Requirement**: REC-04
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Process port passa timeout, confinamento, argv e remoção de credenciais.
**Tests**: unit
**Gate**: Quick

### T3: Reaproveitar parser Properties
**What**: Reaproveitar parser Properties.
**Where**: scripts/versioning/java-properties.mjs
**Depends on**: T2
**Requirement**: REC-02
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Escapes, duplicação e malformed passam gates sem perda de testes.
**Tests**: unit
**Gate**: Quick

### T4: Conciliar contrato VersionReport
**What**: Conciliar contrato VersionReport.
**Where**: scripts/versioning/version-report.mjs
**Depends on**: T3
**Requirement**: REC-01, REC-02
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Go/standard/prefixos preservados; Properties/SHA strict e bootstrap0.0.1 rejeitam negativos.
**Tests**: unit
**Gate**: Quick

### T5: Integrar coletor Maven estrito
**What**: Integrar coletor Maven estrito.
**Where**: scripts/versioning/adapters/jgitver.mjs
**Depends on**: T4
**Requirement**: REC-02, REC-04
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Coletor isolado exige plugin1.9, Properties completas e SHA, rejeita overrides; executor injetado comprovado.
**Tests**: unit
**Gate**: Quick

### T6: Encapsular coletor Go
**What**: Encapsular coletor Go.
**Where**: scripts/versioning/adapters/go-gitsemver.mjs
**Depends on**: T5
**Requirement**: REC-01
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Mesmo argv/envelope/SHA e negativos; Go real preservado.
**Tests**: unit
**Gate**: Quick

### T7: Compor registro e adaptador Node
**What**: Compor registro e adaptador Node.
**Where**: scripts/versioning/collect-version-report.mjs
**Depends on**: T6
**Requirement**: REC-01, REC-03
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Três adaptadores usam registro/port e entrypoint fino; collector, Node real e reactor Maven118/prefixo nativo passam juntos.
**Tests**: integration
**Gate**: Full

### T8: Materializar arquivos técnicos sem privilégio
**What**: Materializar arquivos técnicos sem privilégio.
**Where**: scripts/versioning/version-bundle.mjs
**Depends on**: T7
**Requirement**: REC-03, REC-04
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Bundle valida conteúdo/hash/path e gera/aplica manifests sem execução nativa no escritor; adulteração bloqueia.
**Tests**: integration
**Gate**: Full

### T9: Revalidar evidência no publicador
**What**: Revalidar evidência no publicador.
**Where**: scripts/versioning/release-gates.sh
**Depends on**: T8
**Requirement**: REC-02, REC-03, REC-04
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Snapshots e contexto pré-computado passam; escritor exit99 nativo, tag anotada, Node funcional/técnico e retries passam.
**Tests**: integration
**Gate**: Full

### T10: Conciliar workflows e CI
**What**: Conciliar workflows e CI.
**Where**: .github/workflows/version-publish.yml
**Depends on**: T9
**Requirement**: REC-04, REC-06
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Jobs read/write isolados, toolchains fixadas, suítes unidas e caller contracts passam.
**Tests**: integration
**Gate**: Build

### T11: Integrar guia de evidência Maven
**What**: Integrar guia de evidência Maven.
**Where**: scripts/versioning/homologation-guide.mjs; version-report.mjs (CLI do envelope Maven); tests/versioning/jgitver-report.mjs
**Depends on**: T10
**Requirement**: REC-05
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [x] Payload Properties/derived e guia Go/Node preservados; policy equivalente e CLI do mesmo envelope Maven passam.
**Tests**: unit
**Gate**: Quick

### T12: Documentar adoção e compatibilidade PR13
**What**: Documentar adoção e compatibilidade PR13.
**Where**: docs/versioning.md
**Depends on**: T11
**Requirement**: REC-01, REC-06
**Reuses**: PR12 e componentes locais validados, conforme matriz design.
**Tools**: TLC, CI/CD, Entregas, Git/Node/Java/Maven e docs oficiais.
**Done when**:
- [ ] Caller por SHA revisado, limitações/depreciação, compatibilidade PR13 e relatórios locais documentados; pronto para Verifier.
**Tests**: none
**Gate**: Build

## Diagram-Definition Cross-Check
| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | none | none | Match |
| T2 | T1 | T1 | Match |
| T3 | T2 | T2 | Match |
| T4 | T3 | T3 | Match |
| T5 | T4 | T4 | Match |
| T6 | T5 | T5 | Match |
| T7 | T6 | T6 | Match |
| T8 | T7 | T7 | Match |
| T9 | T8 | T8 | Match |
| T10 | T9 | T9 | Match |
| T11 | T10 | T10 | Match |
| T12 | T11 | T11 | Match |

## Test Co-location Validation
| Task | Required | Task Says | Status |
| --- | --- | --- | --- |
| T1 | none | none | Match |
| T2 | unit | unit | Match |
| T3 | unit | unit | Match |
| T4 | unit | unit | Match |
| T5 | unit | unit | Match |
| T6 | unit | unit | Match |
| T7 | integration | integration | Match |
| T8 | integration | integration | Match |
| T9 | integration | integration | Match |
| T10 | integration | integration | Match |
| T11 | unit | unit | Match |
| T12 | none | none | Match |
