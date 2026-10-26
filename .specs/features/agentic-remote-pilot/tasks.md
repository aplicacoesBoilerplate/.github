# Tarefas do piloto remoto

**Status:** preparação local concluída; revisão independente PASS na rodada2. Implementação sequencial pelo principal, commits locais por componente e revisão independente final. Autorização: avançar até preparar testes remotos; não interpretar como merge ou homologação já ocorrida.

## Execution Protocol

Usar TLC. Manter asserções existentes e testar fronteiras com falhas reais, sem testes de documentação.

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Engine/gerador/guard | unit/integration | auth placeholder, política, modelos, drift e tamper | ci-scripts/tests/agentic-remote*.test.ts | node --import tsx --test tests/agentic-remote*.test.ts |
| Lock compilado | integration | grafo/permissões/segredos/firewall e reprodução | workflow locks | gh-aw compile agentic-triage agentic-review |
| Documentação | none | revisão humana | README | gate estrutural TLC |

## Gate Check Commands

Comandos npm/Node em ci-scripts; gh-aw na raiz.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | componente | node --import tsx --test tests/agentic-remote*.test.ts |
| Full | integração | compilação gh-aw e verificação de locks |
| Build | fechamento | npm test; npm run typecheck |

## Execution Plan

### Phase 1: Preparação

```text
T1 → T2 → T3 → T4 → T5 → T6
```

## Task Breakdown

### T1: Engine OpenCode somente leitura
**What:** fixar definição upstream e testar política/configuração do harness.
**Where:** .github/workflows/shared/agentic-opencode.md
**Depends on:** None
**Requirement:** ARP-03
**Done when:**
- [x] Config nativa nega escrita/shell e usa endpoint AWF com placeholder. Dois testes de fronteira do harness e typecheck aprovados.
**Tests:** integration
**Gate:** Quick

### T2: Gerador e callers compilados
**What:** gerar os dois callers a partir do consumidor e compilar locks.
**Where:** ci-scripts/scripts/agentic/CGhAwPilot.ts
**Depends on:** T1
**Requirement:** ARP-01, ARP-02
**Done when:**
- [x] Modelos/prompts preservados; secret explicitamente mapeada pelo caller; locks estritos workflow_call e callers manuais, sem escrita/detector. Compilador real aprovou os dois locks sem avisos; cinco testes e tipos aprovados.
**Tests:** integration
**Gate:** Full

### T3: Proveniência e integridade no runner
**What:** conferir hashes/SHA e recusar adulteração do workspace.
**Where:** ci-scripts/scripts/agentic/remote-pilot.ts
**Depends on:** T2
**Requirement:** ARP-04, ARP-05
**Done when:**
- [x] Guard recusa SHA/modelo/origem/contexto divergente e compara hashes de todos os arquivos versionados; somente metadados na evidência. Oito testes contratuais e typecheck aprovados.
**Tests:** integration
**Gate:** Quick

### T4: CI e preparação do acionamento
**What:** integrar reprodução na CI e entregar instruções e revisão final.
**Where:** .github/workflows/ci.yml
**Depends on:** T3
**Requirement:** ARP-06
**Done when:**
- [x] CI de reprodução e instruções exatas de secret/acionamento implementadas; revisão independente PASS de preparação registrada em validation.md.
**Tests:** integration
**Gate:** Build

### T5: Reforçar regressões apontadas pela revisão independente
**What:** conferir hashes reais da proveniência e adulteração de fonte fora do manifesto, sem remover cenários existentes.
**Where:** ci-scripts/tests/agentic-remote-guard.test.ts
**Depends on:** T4
**Requirement:** ARP-04, ARP-05
**Done when:**
- [x] Fixture fora do contexto e valores exatos dos hashes verificados; suíte Node22 86/86 e tipos aprovados; revalidação independente PASS; três mutantes antes sobreviventes agora mortos.
**Tests:** integration
**Gate:** Build

### T6: Transportar tarifação explícita do consumidor ao AWF
**What:** corrigir unknown_model_ai_credits observado no primeiro run real com pricing por modelo exato, sem fallback global.
**Where:** ci-scripts/scripts/agentic/CAgenticConfiguration.ts, CGhAwPilot.ts; config do consumidor e artefatos gerados.
**Depends on:** T5
**Requirement:** ARP-07
**Done when:**
- [x] Config opcional preserva compatibilidade; tarifas inválidas recusadas e valores zero/não zero chegam ao catálogo compilado do modelo selecionado. Node22 87/87, tipos e compilação/reprodução aprovados; revisão independente automática após este commit.
**Tests:** integration
**Gate:** Build

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | Match |
| T2 | T1 | T1→T2 | Match |
| T3 | T2 | T2→T3 | Match |
| T4 | T3 | T3→T4 | Match |
| T5 | T4 | T4→T5 | Match |
| T6 | T5 | T5→T6 | Match |

## Test Co-location Validation

| Task | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- |
| T1 | integration | integration | Match |
| T2 | integration | integration | Match |
| T3 | integration | integration | Match |
| T4 | integration | integration | Match |
| T5 | integration | integration | Match |
| T6 | integration | integration | Match |
