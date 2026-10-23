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
- **Phase / Task**: Execute em 2026-10-23; T1–T26 concluídas (26/40), próxima T27. A contagem representa tarefas, não percentual de homologação remota.
- **Completed**: Prévia/publicação Node e CI conectadas aos cinco perfis. T26 instala toolchain no prefixo central, confere tipos/dist recebido e exige todos os nativos. Gate Full aprovado: 52 fixtures locais e nove nativas, incluindo Go pinado, Maven, standard-version, Changesets2/3 e Release Please17.11.2. Revisões focadas aprovadas; evidências/limites de ambiente no implementation-log. Nenhum aceite hospedado inferido.
- **In-progress** (file:line): Nenhuma tarefa parcial após este checkpoint. T27 e posteriores não iniciadas.
- **Next step**: T27: migrar primeiro a ponte standard-version e seus imports JS/CLI para TS; depois fachadas e fixtures preservando os 29 cenários baseline, retirar os 16 .sh centrais e fechar migration-inventory com negativos. Atualizar comandos ativos de docs sem apagar história OpenSpec. Exige Gate Full novamente. Verifier completo permanece T33; hosted/pilotos/registry em tarefas próprias.
- **Blockers**: Nenhum para implementação local. Context7 indisponível; referências oficiais consultadas. Usuário autorizou commit/push por tarefa na mesma branch e execução contínua com saídas mínimas. Pilotos e registry continuam em etapas próprias.
- **Remote checkpoint**: Último SHA confirmado antes deste commit: T25 `c88e4789011f008bb60e8ef48381f21601e17b21` na branch `codex/reconcile-native-profiles`. T26 segue commit/push individual após Gate Full aprovado; conferir git log/ls-remote ao retomar. Sem PR novo nem merge.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github. Preservar sujeira do checkout principal develop em .specify/.agents/docs; PRs #14/#15/#16 não fazem parte deste escopo.
- **Documentation / PR**: Em 2026-10-20, master 3511b1f1266a35d43ff12a81306514c44cc65fc5; #12 aberto c7e610117edfbe8a6338ec0d3b6703156026ef70 -> master; #13 aberto b1b2ec51906306c7afa5129f6557b30b9528f6b5 -> codex/versioning-profiles. Preservar histórico OpenSpec, evidências anteriores e registro do incidente npm.
