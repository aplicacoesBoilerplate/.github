# STATE

## Decisions

### AD-001
- **Decision**: O workflow central é o dono da validação e da publicação; o caller consumidor apenas fornece configuração e encadeia sua CI.
- **Reason**: A regra precisa ser consistente entre aplicações sem duplicar lógica de release.
- **Trade-off**: Mudanças no contrato central exigem compatibilidade e versionamento cuidadosos.
- **Scope**: Workflows reutilizáveis de versionamento e callers consumidores.
- **Date**: 2026-10-01
- **Status**: active

### AD-002
- **Decision**: A ferramenta escolhida pelo consumidor calcula a versão; a pipeline não mantém um algoritmo SemVer paralelo.
- **Reason**: Cada ecossistema preserva sua convenção nativa e uma única fonte de verdade.
- **Trade-off**: A pipeline precisa normalizar e validar formatos diferentes de saída.
- **Scope**: Todos os adaptadores de versionamento.
- **Date**: 2026-10-01
- **Status**: active

### AD-003
- **Decision**: Divergências planejadas exigem label aplicado por Maintain ou Admin e aprovação posterior de outra pessoa com Maintain ou Admin.
- **Reason**: O override precisa ser explícito, auditável e resistente a labels aplicados por engano ou abuso.
- **Trade-off**: Exceções exigem duas ações humanas e consultas adicionais à API do GitHub.
- **Scope**: Checks obrigatórios de versão nos pull requests de publicação.
- **Date**: 2026-10-01
- **Status**: active

## Handoff

- **Feature**: packages-versioning-readiness: escopo aprovado mais aditivo Release Please e composição dos scripts, em 2026-10-19.
- **Phase / Task**: Specify do aditivo concluído estruturalmente. PKG-01 a PKG-08/defaults anteriores aprovados expressamente; PKG-09/10 adicionados por pedido do usuário. Sem Design/Tasks/Execute nesta iteração.
- **Completed**: spec/context agora têm 10 requisitos, preservam standard-version e as fronteiras A/B/C. Aditivo exige cálculo/preparo nativo Release Please, PR técnico sob gates centrais e reuso por contratos/capacidades/portas explícitas. validate_spec.py --strict: zero erros/avisos. A CI remota c7e6101 anterior não é evidência das novas adições.
- **In-progress** (file:line): .specs/features/packages-versioning-readiness/spec.md, Assumptions & Open Questions: revisar apenas defaults novos, incluindo Release Please Node/npm de componente único, configuração permitida e composição incremental. Não pedir nova aprovação do escopo anterior.
- **Next step**: Validar os defaults técnicos do aditivo e produzir design TLC com versão upstream fixada, limites de configuração, prova de planejamento sem mutações e tarefas atômicas antes de implementar.
- **Blockers**: Nenhum para planejamento local. Context7 indisponível; fontes oficiais consultadas como fallback, sem instalar dependências. Pilotos, registry e operações remotas mantêm gates de autorização; estado dos PRs é o observado em 2026-10-16, não reconfirmado nesta alteração documental.
- **Uncommitted files**: Somente spec/context e este handoff até o commit documental do aditivo; sem código, workflows, dependências ou pilotos alterados.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github; planejamento local apenas. Não enviar automaticamente esta especificação ao PR12. A implementação Changesets deverá continuar no PR13 após conciliação autorizada.
- **Documentation / PR**: PR12 https://github.com/aplicacoesBoilerplate/.github/pull/12 HEADc7e610117edfbe8a6338ec0d3b6703156026ef70; PR13 https://github.com/aplicacoesBoilerplate/.github/pull/13 HEADb1b2ec51906306c7afa5129f6557b30b9528f6b5. Issue4 OPEN. Nenhuma alteração nos pilotos, workflows ou remotos nesta iteração documental. Incidente npm anterior preservado no relatório REC, sem limpeza adicional.
