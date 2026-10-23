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
- **Phase / Task**: Execute em 2026-10-23; T1–T29 concluídas (29/40), próxima T30. Meta explícita: concluir as 40 tarefas, com gate e commit/push por tarefa. A contagem representa tarefas, não percentual de homologação remota.
- **Completed**: Cinco perfis no fluxo Node; 16 scripts Shell e calculador paralelo retirados após equivalentes. Fachadas import-safe sem lógica manual; schema1 TypeScript, testes legados compostos sobre leitores/escritores e Git reais. Gate Full: 54 fixtures locais mais nove nativas, tipos/dist/TLC aprovados. Corrigidos diagnóstico de tag anotada, preflight de contexto schema1, atribuição de corrida e checkout divergente de manifests. Evidências no implementation-log; sem aceite hospedado inferido.
- **In-progress** (file:line): Nenhuma tarefa parcial após este checkpoint. T28 valida POMs/JARs reais (Native-Maven); T29 valida tarballs reais/pack sem lifecycle, 66 assertions. 56 fixtures locais/typecheck/check-dist aprovados. Nenhum deploy.
- **Next step**: Confirmar push T29 antes de codificar T30. Criar cinco templates .yml.template, explicitamente não executáveis até pin real T35, sem inventar SHA ou reutilizar pin antigo. Um workflow por perfil com job build (nome esperado pelos entrypoints), preview/publish needs:build, eventos completos e scopes actions/checks read. Go genérico; App somente Node técnico; environment omitido por padrão. Validadores distribuem funções, executar arquivo JS sozinho é no-op: roteiros devem importar/chamar e usar lookup real, nunca async()=>null em produção. Etapas opcionais separadas sem credencial publisher no build. T31–T32 READMEs; T33 Verifier; T34+ hosted/pilotos/registry.
- **Blockers**: Nenhum para implementação local. Context7 indisponível; referências oficiais consultadas. Usuário autorizou commit/push por tarefa na mesma branch e execução contínua com saídas mínimas. Pilotos e registry continuam em etapas próprias.
- **Remote checkpoint**: Último SHA confirmado antes deste commit: T28 `c077fa59ea18ef49fc9041814db3022ded561b69` na branch `codex/reconcile-native-profiles`. T29 segue commit/push individual após Build aprovado; conferir git log/ls-remote ao retomar. Conta agentegersonfribeiro-AI confirmada; issue permanece aberta no Project Reopened. Sem PR novo nem merge.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github. Preservar sujeira do checkout principal develop em .specify/.agents/docs; PRs #14/#15/#16 não fazem parte deste escopo.
- **Documentation / PR**: Em 2026-10-20, master 3511b1f1266a35d43ff12a81306514c44cc65fc5; #12 aberto c7e610117edfbe8a6338ec0d3b6703156026ef70 -> master; #13 aberto b1b2ec51906306c7afa5129f6557b30b9528f6b5 -> codex/versioning-profiles. Preservar histórico OpenSpec, evidências anteriores e registro do incidente npm.
