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
- **Phase / Task**: Execute retomado em 2026-10-22; T1–T23 concluídas (23/40), próxima T24. A contagem representa tarefas, não percentual de homologação remota.
- **Completed**: Cinco adaptadores, portas tipadas, policy, guia, bundles, PR técnico e publicador. T23 integra o escritor Node com digests confiáveis do leitor, proveniência de run/job/artifact, revalidação viva e outputs single/batch/parcial. Revisão focada corrigiu quatro lacunas; sentinelas e grafo impedem execução/carregamento nativo no escritor. Gate Quick passou nas 48 fixtures, com typecheck/build/dist verificados. Evidências em packages-versioning-readiness/implementation-log.md; nenhum aceite hospedado inferido.
- **In-progress** (file:line): Nenhuma tarefa aberta parcialmente neste checkpoint. Workflows ainda invocam pontos legados; T24–T27 fazem a troca final e retiram a ponte schema1 transitória.
- **Next step**: T24 conecta a prévia compilada. A inspeção encontrou a normalização jgitver ausente na composição padrão, a resolução do binário standard-version e a rota de prévia técnica a preservar. T25 conecta leitor/environment/escritor e seus digests confiáveis. Verifier completo permanece na T33.
- **Blockers**: Nenhum para implementação local. Context7 indisponível; referências oficiais consultadas. Usuário autorizou commit/push por tarefa na mesma branch e execução contínua com saídas mínimas. Pilotos e registry continuam em etapas próprias.
- **Remote checkpoint**: Último SHA confirmado antes deste commit: T22 `ed912c289e162dd0a304ffbcd6578f586e974bb5` na branch `codex/reconcile-native-profiles`. T23 segue commit/push individual após o gate; conferir git log/ls-remote ao retomar. Sem PR novo nem merge.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github. Preservar sujeira do checkout principal develop em .specify/.agents/docs; PRs #14/#15/#16 não fazem parte deste escopo.
- **Documentation / PR**: Em 2026-10-20, master 3511b1f1266a35d43ff12a81306514c44cc65fc5; #12 aberto c7e610117edfbe8a6338ec0d3b6703156026ef70 -> master; #13 aberto b1b2ec51906306c7afa5129f6557b30b9528f6b5 -> codex/versioning-profiles. Preservar histórico OpenSpec, evidências anteriores e registro do incidente npm.
