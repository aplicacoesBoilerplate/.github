# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff



- **Feature:** `.specs/features/agentic-remote-pilot/spec.md`; correção T6/ARP-07 após primeiro run real.
- **Phase / Task:** preparação T1–T5 integrada; T6 pricing aprovada em revisão independente; T7 corrige prefixo upstream observado no novo piloto.
- **Completed:** PR24 integrado na release084f826; reconciliação b582d3b preservou árvore bf7ada4d5b553736ca2b0f0f944be78dbae379d4. Develop remoto restaurado da master, sem tocar develop local. PR25 squash limpo077bcdd e PR26 promoção ad203b6 aprovados em CI/SemVer e mergeados sob autorização explícita do usuário. Árvore publicada idêntica à revisada. Release alinhada à master por6020169.
- **Remote evidence:** run40416458541 no SHAad203b6 passou origem, secret presente, snapshot e guard pós-execução. OpenCode/AWF falhou com400 unknown_model_ai_credits antes da inferência porque o catálogo não conhece o modelo gratuito. Integridade verified não aprovou a análise. Sem valor de chave acessado.
- **Fix:** pricing opcional por processo (USD/token, input/output finitos >=0), transportado para models.providers.openai.models[modelo].cost; nenhum fallback global. API pública OpenRouter confirmou tarifas zero do modelo exato. Tests primeiro falharam e depois passaram para configuração, renderer e catálogo compilado.
- **Gates:** T6 passou87/87 no Node22 e CI40418152607; revisão independente pricing-validation.md PASS,8/8 contratos e3/3 mutações mortas. T7 observou dois testes falhando antes da correção e a suíte Node22 passou87/87 depois, zero skips. Tipos/reprodução e revisão final de T7 em fechamento.
- **Next step:** fechar/publicar T7 no PR28 e repetir primeiro a triagem na branch de correção; depois executar revisão. Promover pelo Git Flow somente após os pilotos reais, com mensagens próprias de integração e gates.
- **Novo piloto:** run40421313262 no SHA94745c5 chegou à requisição do modelo, mas GET/v1/models e POST/v1/chat/completions retornaram404; integridade verified, inferência sem aprovação. AWFv0.28.70 concatena /api/v1 + /v1, duplicando o segmento. T7 usa prefixo técnico/api e preserva reflexão/harness. Review40421333266 cancelado antes da inferência para evitar repetição da falha.
- **Credential setup:** usuário confirmou API_KEY_OPENROUTER em Actions secrets; recebido pelo caller, ainda sem resposta real do provedor neste primeiro run.
- **Branch / worktree:** codex/issue-9-awf-pricing em C:/Users/gerso/.codex/worktrees/issue-9-agentic-mvp/.github; PR28 draft na release, correção de rota local. develop local/checkout principal preservados.
- **Scope:** ensaio manual sem escrita pelo modelo. SonarQube not-run; issues7–9/épica3 não encerradas. ReleasePlease abriu PRtécnico27, que permanece sem auto-merge/tagv1.0.0. PRs14–16 preservados.
