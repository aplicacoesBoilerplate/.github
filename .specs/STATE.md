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

- **Feature**: Pipeline centralizada de versionamento, extensão standard-version e jgitver.
- **Phase / Task**: T27-T35 concluídas; validação independente VER-07/08/09 PASS.
- **Completed**: CI hospedada `37967754943` verde em `8466045` (fixtures, standard-version real, jgitver real e Go real); 7/7 mutações comportamentais mortas na revisão independente.
- **In-progress** (file:line): none.
- **Next step**: revisão humana e decisão de merge do PR #12; ensaio real em um consumidor Node/Maven é adoção posterior. Changesets/Turbo permanece pendente.
- **Blockers**: nenhum para revisão do PR; não há alegação de publicação real Node/Maven.
- **Uncommitted files**: nenhum após o commit de validação.
- **Branch**: codex/versioning-profiles, baseada em `6255ec333f13adb879dd70162d9aaae0a4735657`.
- **Documentation / PR**: https://github.com/aplicacoesBoilerplate/.github/pull/12, autoria `agentegersonfribeiro-AI`, revisão solicitada de `gersonfribeiro`; calleds Node/Maven fixados em `b41582e2a6535fc3f9b4a8059c3d4e8971160aae`. Nenhuma alteração no `boilerplate-cli` ou LocalLabs.
