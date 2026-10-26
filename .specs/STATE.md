# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff



- **Feature:** `.specs/features/agentic-remote-pilot/spec.md`; correção T6/ARP-07 após primeiro run real.
- **Phase / Task:** preparação T1–T5 integrada; pricing do consumidor em verificação antes do novo piloto.
- **Completed:** PR24 integrado na release084f826; reconciliação b582d3b preservou árvore bf7ada4d5b553736ca2b0f0f944be78dbae379d4. Develop remoto restaurado da master, sem tocar develop local. PR25 squash limpo077bcdd e PR26 promoção ad203b6 aprovados em CI/SemVer e mergeados sob autorização explícita do usuário. Árvore publicada idêntica à revisada. Release alinhada à master por6020169.
- **Remote evidence:** run40416458541 no SHAad203b6 passou origem, secret presente, snapshot e guard pós-execução. OpenCode/AWF falhou com400 unknown_model_ai_credits antes da inferência porque o catálogo não conhece o modelo gratuito. Integridade verified não aprovou a análise. Sem valor de chave acessado.
- **Fix:** pricing opcional por processo (USD/token, input/output finitos >=0), transportado para models.providers.openai.models[modelo].cost; nenhum fallback global. API pública OpenRouter confirmou tarifas zero do modelo exato. Tests primeiro falharam e depois passaram para configuração, renderer e catálogo compilado.
- **Gates:** targeted8/8 e tipos/compilação strict/validate aprovados. Primeira suíte Node22:86/87; teste preexistente AGP-05 timeout encerra também subprocessos do harness falhou sob carga Windows. Oito testes desse arquivo passaram isolados sem alteração; suíte serial completa passou87/87 no Node22, sem skips ou alteração de teste. Revisão independente da correção ainda pendente.
- **Next step:** fechar gates/revisão, publicar correção em PR para release e executar pilotos na própria branch de correção; registro manual já existe na master e permite --ref. Promover a correção pelo Git Flow após a homologação real, sem concatenação de mensagens históricas de versionamento.
- **Credential setup:** usuário confirmou API_KEY_OPENROUTER em Actions secrets; recebido pelo caller, ainda sem resposta real do provedor neste primeiro run.
- **Branch / worktree:** codex/issue-9-awf-pricing em C:/Users/gerso/.codex/worktrees/issue-9-agentic-mvp/.github; mudanças locais de pricing. develop local/checkout principal preservados.
- **Scope:** ensaio manual sem escrita pelo modelo. SonarQube not-run; issues7–9/épica3 não encerradas. ReleasePlease abriu PRtécnico27, que permanece sem auto-merge/tagv1.0.0. PRs14–16 preservados.