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

- **Feature**: packages-versioning-readiness: conciliação Changesets e aceite Java/Vue para a issue #4 reaberta.
- **Phase / Task**: Specify concluído estruturalmente; proposta aguardando revisão humana antes de Design/Tasks/Execute.
- **Completed**: spec.md e context.md com 8 requisitos, fronteiras A central/B integração/C distribuição, pressupostos identificados e fontes oficiais. validate_spec.py --strict: zero erros/avisos. REC T1-T14 permanece concluída no c7e6101 remoto, CI38837059222 aprovada nesse SHA e sensor independente7/7; não atribuir essa CI ao novo planejamento local.
- **In-progress** (file:line): .specs/features/packages-versioning-readiness/spec.md, seção Assumptions & Open Questions; aprovar defaults, especialmente milestone em lote e distribuição como aceite separado.
- **Next step**: Usuário revisar spec/context; depois produzir design e tarefas TLC antes da implementação. Não implementar nem presumir aprovação dos novos defaults.
- **Blockers**: PR12/13 abertos sem aprovação/merge. Isso não impede planejamento e futura conciliação local; pilotos/publicação no registry dependem de autorização explícita aplicável.
- **Uncommitted files**: Somente spec/context e este handoff até o commit documental desta iteração; demais mudanças do checkout principal foram preservadas.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github; planejamento local apenas. Não enviar automaticamente esta especificação ao PR12. A implementação Changesets deverá continuar no PR13 após conciliação autorizada.
- **Documentation / PR**: PR12 https://github.com/aplicacoesBoilerplate/.github/pull/12 HEADc7e610117edfbe8a6338ec0d3b6703156026ef70; PR13 https://github.com/aplicacoesBoilerplate/.github/pull/13 HEADb1b2ec51906306c7afa5129f6557b30b9528f6b5. Issue4 OPEN. Nenhuma alteração nos pilotos, workflows ou remotos nesta iteração documental. Incidente npm anterior preservado no relatório REC, sem limpeza adicional.
