# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff


- **Feature:** `.specs/features/agentic-remote-pilot/spec.md`.
- **Phase / Task:** T1–T5 locais concluídas; revisão independente PASS na segunda rodada.
- **Completed:** engine OpenCode2.0.26/AWF readonly fixado, gerador called/caller com secret/modelo explícitos, locks gh-aw0.93.5 strict/validate reproduzidos, guard pre/post SHA/hashes e CI de reprodução. Piloto local anterior permanece comprovado em agentic-local-pilot/pilot-evidence.json.
- **Gates:** 86/86 testes no Node22 da CI e tipos aprovados; dois locks reproduzidos sem avisos. Sensor8 mutações: cinco mortas inicialmente; três lacunas reforçadas nos mesmos casos e mortas na revisão2. Nenhum teste removido/skipado.
- **Next step:** usuário cadastrar API_KEY_OPENROUTER em Actions secrets do próprio aplicacoesBoilerplate/.github. Publicar branch/PR mediante autorização explícita e integrar callers à master por revisão humana; depois dispatch manual de triage e review, inspecionando respostas/sessões e evidence.json.
- **Blockers:** cadastro de secret e primeiro run remoto pendentes; workflows novos precisam existir na branch padrão para dispatch. Nenhum merge/publicação/LLM remoto executado nesta preparação. Docker local indisponível; AWF/Linux e transporte OpenRouter ainda não homologados.
- **Worktree / branch:** C:/Users/gerso/.codex/worktrees/issue-9-agentic-mvp/.github; codex/issue-9-agentic-mvp. Commits locais, outras árvores preservadas.
- **Scope:** ensaio manual sem comentários/issues/PRs do agente. Handlers implícitos desativados explicitamente; detector fora apenas deste recorte sem escrita. MCP mínimo GitHub readonly; harness pessoal/plugins/provedores adicionais não homologados. SonarQube not-run. Não fechar issues7–9 nem substituir PRs antigos com base nesta preparação.
- **Evidence:** agentic-remote-pilot/validation.md, implementation-log.md; instruções em examples/agentic/self-pilot/README.md. Config do consumidor permanece em examples/agentic/self-pilot/config.json. Diretrizes globais integrais versionadas e AGENTS do consumidor incluídos.