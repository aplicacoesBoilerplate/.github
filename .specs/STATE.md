# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff

- **Feature:** `.specs/features/release-please-consumer-pilots-stage1/spec.md`.
- **Phase / Task:** Execute / T3 gate local aprovado; publicação/PR e T4 seguintes, sete tarefas totais, implementação inline.
- **Completed:** T1 remota em 6f964cd; T2 modos single/manifest/SDK configurado com sete testes, tipos e audit runtime limpo; revisão independente sem bloqueio stage1. Baselines Java verify, Vue verify e Go test/vet/build aprovadas.
- **In-progress:** publicação de T3/PR central e callers dos três consumidores. T2 remota em 1bfe472a24b6111aaee4721a8416ef00900c02ea.
- **Next step:** publicar T3, abrir PR central e fixar seu SHA nos três consumidores, começando pelo Maven.
- **Blockers:** sem bloqueio técnico para T2. Perguntas assíncronas apresentadas sobre milestone agrupadora no Vue e base release no Go; defaults explícitos preservam versões e desenvolvimento. Merges permanecem humanos.
- **Uncommitted files:** T2 e status neste snapshot antes do commit atômico; conferir git status antes de retomar.
- **Branch:** codex/release-please-pilots-stage1 no worktree nativo release-please-pilots-stage1/.github, base 564f1bba751ed605931beffa5e9fed00e42fec4c.
- **Scope:** callers nas aplicações, central sem exemplos por adaptador; etapa 1 não publica pacotes nem binários. Issue #4 permanece fechada por decisão expressa posterior ao piloto interno bem-sucedido.
- **Preservation:** clones principais Java/Vue/Go sujos e worktrees antigos não alterados; novos consumidores partem das releases remotas atuais.
- **Evidence:** piloto interno publicado https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1; tag aponta ao merge 564f1bb, run40064553394 SUCCESS. Não reutilizar o snapshot antigo que dizia PR17 aberto.
