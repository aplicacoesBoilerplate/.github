# Tarefas do piloto remoto

**Status:** In Progress. Implementação sequencial pelo principal, commits locais por componente e revisão independente final. Autorização: avançar até preparar testes remotos; não interpretar como merge ou homologação já ocorrida.

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
T1 → T2 → T3 → T4
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
- [ ] Gates e revisão independente aprovados; instruções exatas da secret/ativação e pendências reais registradas.
**Tests:** integration
**Gate:** Build

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | Match |
| T2 | T1 | T1→T2 | Match |
| T3 | T2 | T2→T3 | Match |
| T4 | T3 | T3→T4 | Match |

## Test Co-location Validation

| Task | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- |
| T1 | integration | integration | Match |
| T2 | integration | integration | Match |
| T3 | integration | integration | Match |
| T4 | integration | integration | Match |
