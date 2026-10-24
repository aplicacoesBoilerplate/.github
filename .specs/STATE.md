# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff

- **Feature:** `.specs/features/release-please-consumer-pilots-stage1/spec.md`.
- **Phase / Task:** Execute / T1 concluída localmente; T2 seguinte, sete tarefas totais, implementação inline.
- **Completed:** meta ativa registrada; inventário das branches reais, quatro worktrees isolados; baseline central 7/7/tipos, Java verify e Go test/vet/build; T1 booleano publish-artifacts=false e guards com gate 7/7/tipos.
- **In-progress:** Vue baseline com runtime npm10.9.4; SDK configurado e três callers ainda não implementados. Arquivos/SHAs em implementation-log.md.
- **Next step:** commitar/publicar T1 e executar T2 com API oficial do SDK para configurações que a Action não expõe; manter distribuição desabilitada.
- **Blockers:** sem bloqueio técnico para T2. Perguntas assíncronas apresentadas sobre milestone agrupadora no Vue e base release no Go; defaults explícitos preservam versões e desenvolvimento. Merges permanecem humanos.
- **Uncommitted files:** T1, documentos novos da feature e este snapshot; conferir git status antes de retomar.
- **Branch:** codex/release-please-pilots-stage1 no worktree nativo release-please-pilots-stage1/.github, base 564f1bba751ed605931beffa5e9fed00e42fec4c.
- **Scope:** callers nas aplicações, central sem exemplos por adaptador; etapa 1 não publica pacotes nem binários. Issue #4 permanece fechada por decisão expressa posterior ao piloto interno bem-sucedido.
- **Preservation:** clones principais Java/Vue/Go sujos e worktrees antigos não alterados; novos consumidores partem das releases remotas atuais.
- **Evidence:** piloto interno publicado https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1; tag aponta ao merge 564f1bb, run40064553394 SUCCESS. Não reutilizar o snapshot antigo que dizia PR17 aberto.
