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

- **Feature**: `.specs/features/issue-8-code-review/`
- **Phase / Task**: Execute; spec/context/design/tasks aprovados pelo mantenedor em 2026-10-15; T1–T6 concluídas localmente.
- **Completed**: Consumidor demo-repository escolhido pelo mantenedor e privacidade confirmada via API. Branch #8 empilhada por merge local sobre #7 em 745023c, sem reescrever histórico. T1–T7 da triagem preservadas e verificadas localmente; T8 real permanece pendente.
- **In-progress**: Gateway de publicação de review concluído em simulações stateful: achados/SHAs, draft complementar, checks falhos explícitos, revalidação, recuperação de timeout e recusa de edições humanas. Transporte GitHub extraído com guards distintos e triagem preservada. Full Node 22.23.3: 180 pass/0 fail/0 skipped; sintaxe, npm check, actionlint Windows e gates estruturais verdes. Nenhuma publicação/inferência/auth real.
- **Next step**: Executar T7: workflow/runner de review com jobs isolados, checks por container e CI descobrindo review/shared; depois caller/dispatch T8 e piloto real T9.
- **Blockers**: Nenhum para implementação local já autorizada. Piloto real exige provisionamento de credenciais dedicadas e autorização específica de publicação/ativação; nenhuma auth pessoal/global.
- **Uncommitted files**: T6 e registros de progresso até seu commit atômico; demais worktrees preservados. Actionlint temporário validado em C:/Users/gerso/AppData/Local/Temp/review-actionlint-9e482284f513447183c17c298e019f76/actionlint.exe.
- **Branch**: `feature/issue-8-code-review`
