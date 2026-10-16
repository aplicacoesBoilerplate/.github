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
- **Phase / Task**: REC T1-T14 concluídas; revisão independente PASS, entrega remota e CI hospedada aprovadas no8256757.
- **Completed**: PR12 branch codex/versioning-profiles atualizada por AI/fast-forward; CI38836589007 success no8256757, título verde.27 fixtures, Node real/bootstrap2 replays+4 rejeições, Maven reactor118/prefixo/installer e Go real passaram no Linux. Sensor independente7/7 e parecer T14 preservados.
- **In-progress** (file:line): .specs/features/reconcile-native-profiles/publication.md registra provas. Commit seguinte só documental; acompanhar checks de seu próprio SHA, sem atribuir a ele o run8256757.
- **Next step**: Conferir checks do último commit documental e atualizar resumo do PR12; depois aguardar revisão humana de gersonfribeiro. Não fazer merge sem instrução específica.
- **Blockers**: Nenhum para revisão da entrega. PR13 Changesets precisa conciliação própria; deploy/registry e pilotos continuam fora desta entrega.
- **Uncommitted files**: Nenhum após commit do registro de publicação; apenas documentação/estado foi atualizada depois da revisão e CI.
- **Branch**: codex/reconcile-native-profiles em C:/Users/gerso/.codex/worktrees/versioning-reconciled/.github; destino remoto codex/versioning-profiles. Código chamado11fa3c699b3ade5396e4d59ceb3845de80980a35; delta posterior de código é somente chmod/assertion do fixture Maven, aprovado e testado no Linux.
- **Documentation / PR**: https://github.com/aplicacoesBoilerplate/.github/pull/12; CI https://github.com/aplicacoesBoilerplate/.github/actions/runs/38836589007. Sem merge, release, force-push ou alteração dos pilotos/PR13/PR14. Incidente npm fora do scratch mantido em validation.md; home/node_modules preservada sem limpeza.
