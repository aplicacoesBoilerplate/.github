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
- **Phase / Task**: Execute; T1/T2 concluídas, T3 disponível.
- **Completed**: Workspace existente confirmado, issue e dependências consultadas, planejamento TLC e protótipos de caller escritos.
- **In-progress**: Contrato e preflight implementados; 44 testes passaram; evidências em `execution-review.md`.
- **Next step**: Executar T3 em sequência; T13 depende de piloto privado e credenciais próprias.
- **Blockers**: Nenhum para implementação offline. Auth real e compatibilidade de dependências ainda não homologadas.
- **Uncommitted files**: T2 pronta para commit atômico (preflight, testes e status).
- **Branch**: `feature/issue-9-llm-centralizado`
