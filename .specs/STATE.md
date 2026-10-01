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
- **Phase / Task**: Verifier fix loop 2 - T19
- **Completed**: T1-T18; independent verification rounds 1 and 2 recorded
- **In-progress** (file:line): none
- **Next step**: execute T19-T22 and dispatch independent verifier round 3
- **Blockers**: none
- **Uncommitted files**: `.specs/features/centralized-versioning-pipeline/validation.md`, `.specs/features/centralized-versioning-pipeline/tasks.md`, `.specs/STATE.md`, `.specs/LESSONS.md`, `.specs/lessons.json`
- **Branch**: feature/issue-4-versionamento
