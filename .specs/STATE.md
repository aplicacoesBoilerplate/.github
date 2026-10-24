# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff

- **Feature:** `.specs/features/release-please-consumer-pilots-stage1/spec.md`.
- **Phase / Task:** Execute / T1–T7 de implementação/evidência concluídas; meta integral em andamento até os três ciclos reais.
- **Completed:** PR central19; Java36 (47a1991), Vue39 (d17697a), Go16 (282285e). CI dos quatro aprovada; SDK ensaiado nos arquivos reais, Maven recompilado em0.0.2; Verifier técnico aprovado, quatro mutantes mortos, sem sobreviventes. Correções de links, npm/cache, ordem de build e checkout do SHA integrado persistidas.
- **In-progress:** consolidação/publicação final dos registros T7. Os três ciclos de PR técnico/tag/GitHub Release dependem da revisão e dos merges humanos, não foram realizados pelo agente.
- **Next step:** conferir CI do commit documental final; usuário revisa/integra PRs, preserva Git Flow e promove consumidores a master; depois acompanhar os dois momentos reais por aplicativo. Nenhuma distribuição na etapa 1.
- **Blockers:** nenhum impedimento técnico conhecido. Política administrativa de criação de PRs confirmada no Go; consulta em Java/Vue retorna403 para a identidade AI, portanto configuração não confirmada (não inferir desabilitada). Defaults conservadores Vue nativo/Go release preservados. Não realizar merges, alterar políticas ou reabrir issue4.
- **Worktree:** registros T7 e lição incluídos no commit final; runtime continua o SHA publicado1d874d946e5f5ad233a6b1f6bf278fef78f3b46d usado igualmente pelos três callers. Conferir git status e HEAD na retomada.
- **Branch:** codex/release-please-pilots-stage1 no worktree nativo release-please-pilots-stage1/.github, base 564f1bba751ed605931beffa5e9fed00e42fec4c.
- **Scope:** callers nas aplicações, central sem exemplos por adaptador; etapa 1 não publica pacotes nem binários. Issue #4 permanece fechada por decisão expressa posterior ao piloto interno bem-sucedido.
- **Preservation:** clones principais Java/Vue/Go sujos e worktrees antigos não alterados; novos consumidores partem das releases remotas atuais.
- **Evidence:** piloto interno publicado https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1; tag aponta ao merge 564f1bb, run40064553394 SUCCESS. Não reutilizar o snapshot antigo que dizia PR17 aberto.
