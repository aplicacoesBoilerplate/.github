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

### AD-003
- **Decision**: Testes protegem contratos e efeitos relevantes; a quantidade de casos não é gate. Evitar repetição que não detecte regressão adicional.
- **Reason**: Correção explícita do mantenedor ao iniciar a fase de autenticação.
- **Scope**: Execução da issue #9.
- **Date**: 2026-10-12
- **Status**: active

## Handoff

- **Feature**: `.specs/features/issue-9-llm-centralizado/`
- **Phase / Task**: Execute; T5 concluída. 5/13 tarefas.
- **Completed**: Planejamento aprovado e persistido; T1 contrato/dependências, T2 origem/SHA, T3 diretrizes integrais/proveniência implementadas com commits por tarefa.
- **In-progress**: Auth temporária e guard de sessão antiga implementados; seus gates passaram.
- **Next step**: Executar T6 (persistência criptografada no consumidor).
- **Blockers**: Nenhum para implementação offline. T13 requer repositório privado piloto e credenciais provisionadas pelo mantenedor; publicação não autorizada nesta iteração.
- **Uncommitted files**: Nenhum após o commit de T5.
- **Branch**: `feature/issue-9-llm-centralizado`
