# Piloto local de agentes: tarefas

## Execution Protocol

TLC, implementação sequencial pelo agente principal, commits locais por tarefa, testes de contrato e falhas relevantes. Sem publicação remota. Recorte local aprovado pelo usuário em 2026-10-26 e corrigido para o próprio .github.

**Status:** Done, somente recorte local

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Configuração e adapter | unit/integration | modelos independentes, arquivos confiáveis, ausência de chave, ambiente fechado, falha e limpeza | ci-scripts/tests/agentic-*.test.ts | node --import tsx --test tests/agentic-*.test.ts |
| Caller e inferência | integration | duas chamadas reais, resposta útil, metadados e ausência de secrets | evidências locais | npm run pilot:agentic -- ../examples/agentic/self-pilot/config.json |
| Documentação | none | sem testes de texto | .specs | validação estrutural TLC |

## Gate Check Commands

Executar comandos Node/npm em ci-scripts.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Config e adapter | node --import tsx --test tests/agentic-*.test.ts |
| Full | Caller real | npm run pilot:agentic -- ../examples/agentic/self-pilot/config.json |
| Build | Entrega local | npm test && npm run typecheck |

## Execution Plan

### Phase 1: Piloto

```text
T1 → T2 → T3 → T4
```

## Task Breakdown

### T1: Contrato da configuração do consumidor

**What:** validar processos e arquivos do consumidor.
**Where:** ci-scripts/scripts/agentic/CAgenticConfiguration.ts
**Depends on:** None
**Requirement:** AGP-01, AGP-02, AGP-08
**Done when:**
- [x] Modelos e prompts preservados; configuração inválida e caminhos fora da política rejeitados. Gate: 4 testes aprovados; arquivos versionados são conferidos pelo adapter em T2.
**Tests:** unit
**Gate:** Quick

### T2: Adapter OpenCode isolado

**What:** executar o harness fixado com perfil temporário e ambiente fechado.
**Where:** ci-scripts/scripts/agentic/COpenCodePilot.ts
**Depends on:** T1
**Requirement:** AGP-03, AGP-04, AGP-05
**Done when:**
- [x] Perfil pessoal e PATs não são herdados; falha/timeout não liberam sucesso e limpam temporários. Gate: 8 testes e typecheck aprovados.
**Tests:** integration
**Gate:** Quick

### T3: Caller e prova real no .github

**What:** fornecer caller dos dois processos com configurações próprias e evidências locais.
**Where:** ci-scripts/scripts/agentic/run-pilot.ts
**Depends on:** T2
**Requirement:** AGP-03, AGP-06
**Done when:**
- [x] Caller possui config, prompts e inputs controlados; evidência sanitizada e testes de contrato aprovados. Gate: 74 testes e typecheck aprovados.
**Tests:** integration
**Gate:** Build

### T4: Prova real e revisão independente

**What:** executar e inspecionar as duas inferências no próprio .github.
**Where:** .specs/features/agentic-local-pilot/implementation-log.md
**Depends on:** T3
**Requirement:** AGP-07, AGP-08
**Done when:**
- [x] Duas respostas reais inspecionadas; 78 testes e tipos aprovados; revisão independente PASS8/8 e sensor6/6 concluídos. Evidência no SHAd1c6aef.
**Tests:** integration
**Gate:** Full

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |
| T4 | T3 | T3 → T4 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Configuração | unit | unit | Match |
| T2 | Adapter | integration | integration | Match |
| T3 | Caller | integration | integration | Match |
| T4 | Inferência | integration | integration | Match |
