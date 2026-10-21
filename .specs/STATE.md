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
- **Phase / Task**: Execute autorizado em 2026-10-21; T1–T15 concluídas (15/40), próxima T16 SDK nativo do Release Please. A contagem representa tarefas, não percentual de homologação remota.
- **Completed**: Baselines #12/#13 conciliadas; toolchain TypeScript estrita com dist verificado; portas de processo/Git/GitHub, contratos, policy, evidência auditável e guia de homologação; adaptadores Go, jgitver/Maven, standard-version e Changesets migrados para serviços tipados; SCM de snapshot somente-leitura para Release Please. O histórico e os comandos/resultados de cada tarefa estão em packages-versioning-readiness/implementation-log.md; todas as 40 fixtures locais passaram após T15 e os testes nativos executados para os perfis implementados passaram.
- **In-progress** (file:line): Nenhuma tarefa aberta parcialmente neste checkpoint. Os workflows ainda invocam pontos legados; novos serviços não equivalem à migração final sem Shell. Integração do SDK Release Please permanece para T16.
- **Next step**: Executar T16 Release Please e tarefas subsequentes na ordem validada em tasks.md. Verificador independente final e aceite remoto são gates separados; não declarar issue concluída antes deles.
- **Blockers**: Nenhum para T16 local. Context7 indisponível nesta sessão; referências oficiais foram registradas no design. Publicação central, pilotos e registry exigem etapas posteriores próprias; nenhum aceite hospedado presumido.
- **Remote checkpoint**: T1–T14 foram publicados no GitHub na branch `codex/reconcile-native-profiles`, SHA `166cfc46c867fb1a8f717941f741578cf6a504b5`, conferido por `git ls-remote`; T15 aguarda este commit/push. Sem PR novo nem merge.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github. Preservar sujeira do checkout principal develop em .specify/.agents/docs; PRs #14/#15/#16 não fazem parte deste escopo.
- **Documentation / PR**: Em 2026-10-20, master 3511b1f1266a35d43ff12a81306514c44cc65fc5; #12 aberto c7e610117edfbe8a6338ec0d3b6703156026ef70 -> master; #13 aberto b1b2ec51906306c7afa5129f6557b30b9528f6b5 -> codex/versioning-profiles. Preservar histórico OpenSpec, evidências anteriores e registro do incidente npm.
