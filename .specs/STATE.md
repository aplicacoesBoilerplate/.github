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
- **Status**: active

## Handoff

- **Feature**: packages-versioning-readiness: adição TypeScript aprovada pelo usuário para a automação central, em 2026-10-19.
- **Phase / Task**: PKG-01 a10 aprovados e PKG-11 adicionado pela escolha TS; design atualizado, ainda aguardando gate humano antes de Tasks/Execute exigido pelo TLC.
- **Completed**: Spec/context/design agora mapeiam11 requisitos e AD-004 registra TypeScript. Fontes src, dist ESM da mesma revisão, typecheck estrito e CI de correspondência; nenhum compilador nos jobs consumidores/escritor. Contratos, cinco adaptadores, permissões e fronteiras A/B/C preservados.
- **In-progress** (file:line): .specs/features/packages-versioning-readiness/design.md, TypeScript Build and Distribution. Apenas planejamento alterado; nenhuma instalação ou execução de TypeScript ocorreu.
- **Next step**: Revisar o design atualizado e derivar tarefas formais que incluam toolchain, testes de tipos, distribuição e migração incremental; manter execução neste chat após gates TLC.
- **Blockers**: Context7 indisponível, fontes oficiais do tag fixado consultadas como fallback. PR12/13 reconfirmados abertos em2026-10-19 nos mesmos SHAs registrados; nenhuma aprovação/merge presumidos. Adoção dos pilotos e publicação remota continuam dependentes de autorização própria.
- **Uncommitted files**: Somente spec/context/design e este STATE até o commit documental TypeScript; sem código, workflows, dependências ou pilotos alterados.
- **Branch**: codex/reconcile-native-profiles, worktree versioning-reconciled/.github; planejamento local apenas. Não enviar automaticamente esta especificação ao PR12. A implementação Changesets deverá continuar no PR13 após conciliação autorizada.
- **Documentation / PR**: PR12 https://github.com/aplicacoesBoilerplate/.github/pull/12 HEADc7e610117edfbe8a6338ec0d3b6703156026ef70; PR13 https://github.com/aplicacoesBoilerplate/.github/pull/13 HEADb1b2ec51906306c7afa5129f6557b30b9528f6b5. Issue4 OPEN. Nenhuma alteração nos pilotos, workflows ou remotos nesta iteração documental. Incidente npm anterior preservado no relatório REC, sem limpeza adicional.
