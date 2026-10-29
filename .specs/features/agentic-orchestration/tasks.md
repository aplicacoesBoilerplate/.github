# Tasks do MVP

Execution Protocol: autorização explícita para o MVP completo, sem testes locais novos/TypeScript; validar funcionalmente no piloto.

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Workflows | none | compilação e inspeção; comportamento no piloto | .github/workflows/agentic-* | gh aw compile |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Build | componente | gh aw compile --strict --validate |
| Full | homologação | execução dos callers no repositório piloto |

## Execution Plan

T1 → T2 → T3

## Task Breakdown

### T1: Runtime e perfis DRY
**What:** preparar OpenCode/AWF e capacidades por papel.
**Where:** .github/workflows/shared/
**Depends on:** None
**Requirement:** AOR-06, AOR-13, AOR-14
**Done when:**
- [x] Perfis e runtime importados pelos quatro workers; compilação strict/validate aprovou as fontes, sem credencial central.
**Tests:** none
**Gate:** Build

### T2: Agentes compilados
**What:** triagem, correção direta, spec e implementação protegida.
**Where:** .github/workflows/agentic-*.md
**Depends on:** T1
**Requirement:** AOR-01, AOR-02, AOR-03, AOR-04, AOR-05, AOR-07, AOR-10, AOR-11, AOR-15
**Done when:**
- [x] Quatro agentes compilam strict/validate, zero avisos, com terminal, modelos explícitos e gate antes da implementação. Scanner estrutural nativo sem engine Copilot; homologação permanece no piloto.
**Tests:** none
**Gate:** Build

### T3: Coordenação e piloto
**What:** ligar rotas, aprovação, caller e cenários reais.
**Where:** .github/workflows/agentic-orchestrator.yml
**Depends on:** T2
**Requirement:** AOR-08, AOR-09, AOR-12, AOR-16, AOR-17
**Done when:**
- [ ] Caller e coordenador validados; relatório separa compile de homologação real e registra impedimentos.
**Tests:** none
**Gate:** Full
