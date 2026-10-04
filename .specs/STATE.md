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

- **Feature**: Pipeline centralizada de versionamento
- **Phase / Task**: SHA-only follow-up complete; independent local MVP validation PASS
- **Completed**: T1-T24; 41/41 ACs, 7/7 edges, 9/9 local fixtures, pinned real Go, 5/5 mutants killed; OpenSpec preserved
- **In-progress** (file:line): none
- **Next step**: authorized user grants PR creation access or opens codex/issue-4-versioning-mvp -> master in GitHub; await review and separate pilot authorization
- **Blockers**: branch push succeeded; PR creation denied by organization OAuth restrictions in gh and FORBIDDEN/write permission in GitHub connector. Hosted PR CI and boilerplate-cli integration not performed
- **Uncommitted files**: none after delivery commit; branch published, PR not created, no merge/release or pilot changes
- **Branch**: codex/issue-4-versioning-mvp
