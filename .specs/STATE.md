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

### AD-004
- **Decision**: Concluir a primeira versão reutilizável com caller compartilhável por triagem/code review e instruções completas de configuração/consumo. Adiar manual central extenso e testes documentais; piloto usa o mesmo caller. Mantenedor corrigiu a transcrição: reduzir intensidade dos testes, não qualidade das instruções do caller.
- **Reason**: Mantenedor definirá outra abordagem de documentação depois das issues atuais e priorizou entrega funcional. Testes adicionais serão escolhidos pelo impacto contratual/operacional.
- **Scope**: Issue #9, T7–T13; T12 fora do MVP.
- **Date**: 2026-10-13
- **Status**: active

## Handoff

- **Feature**: `.specs/features/issue-7-triagem-issues/`
- **Phase / Task**: Execute; plano aprovado em 2026-10-14, T1–T2 concluídas, 2/8 tarefas. Documentação adiada por pedido explícito; caller funcional permanece.
- **Completed**: In progress aplicado no Project GitHub Features por pedido explícito e verificado via API. Empilhamento sobre #9 preservado; nenhum merge/aceite do PR da central. Aprovação de spec/context registrada.
- **In-progress**: Coleta T2 verificada com origem/ator, metadata/proveniência, paginação e limites; nenhum código parcial da integração central.
- **Next step**: T3, adaptar origem e checkouts config/source na central com envelope v2, preservando o dispatch v1 e o ciclo de auth.
- **Blockers**: Nenhum para implementação local autorizada; blocked-by #5/#9 preservados conforme entrega empilhada. Piloto real exige consumidor e credenciais do mantenedor.
- **Uncommitted files**: Nenhum após commit da proposta. Planejamento OpenSpec anterior preservado como histórico.
- **Branch**: `feature/issue-7-triagem-issues`
