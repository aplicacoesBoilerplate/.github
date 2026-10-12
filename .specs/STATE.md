# STATE

## Decisions

### AD-001
- **Decision**: Workflows de LLM compartilham lógica; cada consumidor possui sua configuração de invocação, credenciais e ciclo de manutenção. Nenhuma identidade central atende várias aplicações.
- **Reason**: Isolamento e autonomia definidos pelo usuário ao retomar a issue #9.
- **Trade-off**: Cada aplicação precisa provisionar e manter suas credenciais; simplicidade de uma conta global é descartada.
- **Scope**: Issue #9 e contratos futuros de triagem #7 e code review #8.
- **Date**: 2026-10-12
- **Status**: active

### AD-002
- **Decision**: A especificação corrente da issue #9 passa a `.specs/features/issue-9-llm-centralizado/`; o OpenSpec anterior permanece como histórico explicitamente substituído.
- **Reason**: Usuário solicitou TLC Spec Driven e revisão do limite entre caller e workflow compartilhado.
- **Trade-off**: Consumidores planejados anteriormente precisam reconciliar seus contratos ao retomar implementação; não manter duas fontes normativas concorrentes.
- **Scope**: Planejamento da issue #9.
- **Date**: 2026-10-12
- **Status**: active

## Handoff

- **Feature**: `.specs/features/issue-9-llm-centralizado/`
- **Phase / Task**: Execute; Phase 1 concluída, T4 disponível. 3/13 tarefas.
- **Completed**: Planejamento aprovado e persistido; T1 contrato/dependências, T2 origem/SHA, T3 diretrizes integrais/proveniência implementadas com commits por tarefa.
- **In-progress**: Nenhuma tarefa parcial. 54 testes passaram em Node 22.23.3; check de sintaxe passou; evidências em `execution-review.md`.
- **Next step**: Executar T4 (auth temporária), depois T5/T6 (freshness e persistência), sequencialmente.
- **Blockers**: Nenhum para implementação offline. T13 requer repositório privado piloto e credenciais provisionadas pelo mantenedor; publicação não autorizada nesta iteração.
- **Uncommitted files**: Nenhum após o commit de T3.
- **Branch**: `feature/issue-9-llm-centralizado`
