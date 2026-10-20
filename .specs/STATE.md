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
- **Phase / Task**: Execute; código local verificado e publicado nos PRs empilhados #15/#16. F2 corrige o checkout raso da CI com revisão independente PASS LOCAL; nova CI remota pendente. T9 real permanece aberto.
- **Completed**: Publicação explicitamente autorizada pelo mantenedor e realizada: PR #15 (triagem) sobre #9 e PR #16 (review) sobre #7, ambos draft, autor agentegersonfribeiro-AI, milestone v1.0.0 e review solicitada a gersonfribeiro. Nenhum merge remoto. Consumidor demo-repository privado selecionado; piloto ainda pendente.
- **In-progress**: F2 em #7/549d1dc e merge local #8/076d18a habilitam histórico no checkout do job de contratos, preservando persist-credentials false. RED→GREEN; Full #7 141/141, #8 196/196; check/actionlint verdes. Verifier focado: 5/5 e mutação depth1 killed, relatório ci-history-validation.md. CI antiga falhou nos runs 38881461059/38881522449 por pins indisponíveis em depth1. Nenhuma inferência/refresh/check Docker de produto real foi executado.
- **Next step**: Publicar F2 nos mesmos PRs e conferir os novos runs. Depois, preparar adoção no demo com credenciais dedicadas e autorização de ativação. Não fechar REV-22/23 ou TRI-24/25 sem piloto real.
- **Blockers**: Publicação das branches já autorizada. Piloto real exige provisionamento de credenciais dedicadas e autorização específica de ativação; nenhuma auth pessoal/global. Pergunta sobre disponibilidade dos secrets enviada ao mantenedor.
- **Uncommitted files**: Nenhum após commit de evidência F2. Scratchs antigos e novo ci-history-verifier-076d18a retidos após cleanup negado, sem nova tentativa; demais worktrees preservados.
- **Branch**: `feature/issue-8-code-review`
