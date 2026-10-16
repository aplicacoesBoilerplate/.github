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

- **Feature**: Conciliação Go/standard-version/jgitver no PR12 existente.
- **Phase / Task**: REC T1-T12 concluídas localmente; verificador fresco TLC pendente.
- **Completed**: Baseline PR12 congelada13 fixtures PASS; união27 fixtures PASS. Ferramentas reais Go/standard-version9.5.0/Maven1.9.0, reactor118 e prefixo nativo PASS; Maven3.9.9/checksum inválido PASS; workflow64 e semântico read/write PASS; callers lintados isoladamente e76 links relativos conferidos.
- **In-progress** (file:line): .specs/features/reconcile-native-profiles/validation.md será produzido por verificador independente.
- **Next step**: Fechar gate, revisão independente com mutações em scratch; após PASS, atualizar somente codex/versioning-profiles no remoto por fast-forward e conferir CI.
- **Blockers**: Nenhum bloqueio externo atual; não declarar revisão ou CI hospedada desta conciliação aprovadas antes de executá-las. PR13 requer conciliação própria.
- **Uncommitted files**: Nenhum após commit T12; próximos artifacts pertencem à verificação.
- **Branch**: codex/reconcile-native-profiles em C:/Users/gerso/.codex/worktrees/versioning-reconciled/.github, baseada no PR12 fcf31e08165156a5938eec7577bbf1be945f365f; código11fa3c699b3ade5396e4d59ceb3845de80980a35.
- **Documentation / PR**: https://github.com/aplicacoesBoilerplate/.github/pull/12. Push/edição desse PR autorizados pelo usuário, sem merge, release, force-push ou alteração dos pilotos/PR13/PR14. Código local anterior b4c783a preservado na branch codex/jgitver-maven.
