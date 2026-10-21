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

### AD-004
- **Decision**: Escrever módulos novos/migrados da automação central de versionamento em TypeScript, com contratos estritos e execução do JavaScript compilado; preservar YAML e entrypoints compatíveis.
- **Reason**: O usuário priorizou manutenção com uma linguagem próxima à programação habitual da equipe, contratos explícitos e encapsulamento.
- **Trade-off**: Acrescenta toolchain/build e exige conferir a correspondência entre fontes e executável, sem transferir compilação para o consumidor ou escritor privilegiado.
- **Scope**: Código central de versionamento e sua distribuição, não a linguagem das aplicações consumidoras ou outros sistemas do repositório.
- **Date**: 2026-10-19
- **Status**: superseded by AD-005

### AD-005
- **Decision**: Toda a lógica central de versionamento em escopo terá fonte TypeScript e execução Node compilada no checkout do workflow; retirar scripts Shell próprios do fluxo final, sem distribuir um produto CLI independente.
- **Reason**: O usuário consolidou master, PRs e trabalho local relevante no objetivo de migração completa, mantendo callers de configuração e os calleds centrais.
- **Trade-off**: Exige migrar e verificar todos os pontos de entrada internos, além da correspondência src/dist; preserva contratos externos, não caminhos .sh internos.
- **Scope**: Cinco adaptadores e serviços/workflows centrais de versionamento; não inclui shell do runner, launchers nativos ou automações alheias.
- **Date**: 2026-10-20
- **Status**: active

## Handoff

- **Feature**: packages-versioning-readiness, cinco adaptadores e automação central TypeScript sem produto CLI independente.
- **Phase / Task**: Execute autorizado em 2026-10-21; T1–T22 concluídas (22/40), próxima T23 entrypoint escritor. A contagem representa tarefas, não percentual de homologação remota.
- **Completed**: Baselines #12/#13 conciliadas; toolchain TypeScript estrita com dist verificado; portas de processo/Git/GitHub, contratos, policy, evidência auditável e guia de homologação; cinco adaptadores, inclusive Release Please SDK real 17.11.2; bundles schema1/schema2 e PRs técnicos; publicação single/batch; prévia e preparação pós-merge internas em Node. A T22 separa origem funcional/técnica, preserva produtor run/job/SHA central, emite relatório/plano/snapshot/policy/bundle e valida CI, origem e merge técnico. A suíte local passou com 47 fixtures; testes nativos anteriores não equivalem ao aceite hospedado. Histórico completo em packages-versioning-readiness/implementation-log.md.
- **In-progress** (file:line): Nenhuma tarefa aberta parcialmente neste checkpoint. Workflows ainda invocam pontos legados; T24–T27 fazem a troca final e retiram a ponte schema1 transitória.
- **Next step**: Executar T23 na ordem validada em tasks.md: escritor Node revalida artifact e estado antes de PR técnico ou publicação. Verificador independente e aceite remoto permanecem gates separados.
- **Blockers**: Nenhum para T23 local. Context7 indisponível nesta sessão; referências oficiais no design. Publicação central, pilotos e registry exigem etapas posteriores próprias; nenhum aceite hospedado presumido.
- **Remote checkpoint**: T1–T21 foram publicados no GitHub na branch `codex/reconcile-native-profiles`, SHA `9d7073bc4df23e3a7b6b33ff24b217864da0a380`, conferido por `git ls-remote`. Sem PR novo nem merge.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github. Preservar sujeira do checkout principal develop em .specify/.agents/docs; PRs #14/#15/#16 não fazem parte deste escopo.
- **Documentation / PR**: Em 2026-10-20, master 3511b1f1266a35d43ff12a81306514c44cc65fc5; #12 aberto c7e610117edfbe8a6338ec0d3b6703156026ef70 -> master; #13 aberto b1b2ec51906306c7afa5129f6557b30b9528f6b5 -> codex/versioning-profiles. Preservar histórico OpenSpec, evidências anteriores e registro do incidente npm.
