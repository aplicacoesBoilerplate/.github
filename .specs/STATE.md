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
- **Phase / Task**: Governed hotfix extension complete; independent local MVP validation PASS
- **Completed**: T1-T26; 43/43 ACs, 7/7 edges, 9/9 local fixtures, pinned real Go, 5/5 mutants killed; OpenSpec preserved
- **In-progress** (file:line): none
- **Next step**: review PR #10 (codex/issue-4-versioning-mvp -> master), inspect hosted checks, and await separate pilot authorization
- **Blockers**: previous PR creation denial resolved after user-requested authentication switch to agentegersonfribeiro-AI; PR #10 created successfully. Hosted check results and boilerplate-cli integration are not claimed
- **Uncommitted files**: none after documentation delivery commit; no merge/release or pilot changes
- **Branch**: codex/issue-4-versioning-mvp
- **Hotfix decision**: develop -> master and hotfix/<name> -> master share every gate; hotfix starts from master and does not force PATCH. Caller pinned to 07bd5372f7fc4a34a1b04134a84a0b9f4aba3b45. Pilot go-ci consolidation remains deferred.
- **Documentation / PR**: workflows and scripts READMEs independently reviewed, 32 relative links and 50 workflow assertions PASS; docs commit c79429f. PR https://github.com/aplicacoesBoilerplate/.github/pull/10 authored by agentegersonfribeiro-AI; review requested from gersonfribeiro, milestone v1.0.0, issue #4 linked.
