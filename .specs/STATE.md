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

- **Feature**: `.specs/features/issue-9-llm-centralizado/`
- **Phase / Task**: Meta de entrega local encerrada por solicitação explícita do mantenedor; T1–T11 concluídas e verificadas, T12 adiada, T13 transferida para triagem #7, não executada.
- **Completed**: Workflow central, scripts, CI, callers ChatGPT/API opt-in, configuração/prompt do consumidor, inspector de resultado e instruções completas. Commits locais por tarefa e contratos verificados.
- **In-progress**: Nenhuma implementação parcial. Correção de LLM-11 e caller atualizado passaram na reverificação independente; aprovação pendente do teste foi concedida e resolvida.
- **Next step**: Especificação TLC da triagem #7, primeiro consumidor e responsável pelo piloto real compartilhado. PR draft da central publicado para release/v1.0.0 e revisão humana solicitada; não houve merge.
- **Blockers**: Nenhum para a meta local revista. Homologação real transferida exige consumidor privado e credenciais próprias; fixtures não a comprovam. Nenhum login pessoal ou inferência real realizado.
- **Uncommitted files**: Nenhum após commit do relatório e deste handoff. Dois scratches de auditoria restaurados/inativos permanecem no Temp, conforme validation.md; remoção rejeitada pela política automática, sem credenciais reais.
- **Branch**: `feature/issue-9-llm-centralizado`
