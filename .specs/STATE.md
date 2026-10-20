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
- **Phase / Task**: Spec completa e defaults aprovados em 2026-10-19 com solicitação de implementação. Design concretizado, aguardando gate humano antes de Tasks/Execute exigido pelo TLC.
- **Completed**: design.md mapeia os10 requisitos: contratos/capacidades, portas Git/API/processo, bundle seguro, PR técnico e publicação comuns, Release Please17.11.2 nativo em leitura, fixtures Changesets2.29.5/3.0.3, fronteiras de adoção/distribuição e riscos. Spec/context registram a aprovação completa sem reabrir decisões.
- **In-progress** (file:line): .specs/features/packages-versioning-readiness/design.md, Approval Gate. Nenhuma tarefa de código iniciada; não afirmar implementação concluída ou ferramentas testadas nesta iteração.
- **Next step**: Revisão do design pelo usuário; depois derivar tasks.md formal com testes, gates e commits atômicos e manter execução neste chat. Gate TLC impede iniciar código antes das revisões do planejamento.
- **Blockers**: Context7 indisponível, fontes oficiais do tag fixado consultadas como fallback. PR12/13 reconfirmados abertos em2026-10-19 nos mesmos SHAs registrados; nenhuma aprovação/merge presumidos. Adoção dos pilotos e publicação remota continuam dependentes de autorização própria.
- **Uncommitted files**: Somente spec/context/design e este handoff até o commit documental; sem código, workflows, dependências ou pilotos alterados.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github; planejamento local apenas. Não enviar automaticamente esta especificação ao PR12. A implementação Changesets deverá continuar no PR13 após conciliação autorizada.
- **Documentation / PR**: PR12 https://github.com/aplicacoesBoilerplate/.github/pull/12 HEADc7e610117edfbe8a6338ec0d3b6703156026ef70; PR13 https://github.com/aplicacoesBoilerplate/.github/pull/13 HEADb1b2ec51906306c7afa5129f6557b30b9528f6b5. Issue4 OPEN. Nenhuma alteração nos pilotos, workflows ou remotos nesta iteração documental. Incidente npm anterior preservado no relatório REC, sem limpeza adicional.
