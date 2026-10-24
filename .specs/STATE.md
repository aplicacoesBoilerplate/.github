# STATE

## Decisions

Nenhuma decisão global nova registrada nesta consolidação. O piloto usa a abordagem Release Please da master; os defaults técnicos estão explícitos na especificação da feature.

## Handoff

- **Feature:** `.specs/features/release-please-self-pilot/spec.md`.
- **Phase / Task:** Execute / T1-T3 aprovadas no runner; T4 implementada localmente. TLC registra a extensão aprovada para preparar o caller real e abrir o PR de entrega.
- **Completed:** teste funcional existente ampliado; RED observado pelo caller inexistente; correções locais no caller/called/entrypoint/inputs; modo simple e outputs; motor real gerando versão/changelog/dados de release com fetch proibido; suíte integral 7/7 e typecheck aprovados.
- **In-progress:** PR de entrega aberto e aguardando CI/revisão humana: https://github.com/aplicacoesBoilerplate/.github/pull/17, título fix(versioning): habilita o piloto real do Release Please, autor agentegersonfribeiro-AI, base master, milestone v0.0.1 e revisão solicitada a gersonfribeiro. Revisão independente T4 PASS em 133f896: 9/9 critérios, 7/7 testes, typecheck e validadores aprovados; 2/2 mutações detectadas e controle positivo com version.txt 0.0.1 aprovado.
- **Next step:** conferir CI e revisão do PR de entrega; os merges ficam com o usuário. Após o piloto interno, validar pelo menos um consumidor externo antes de avaliar o fechamento da issue #4. Nenhuma aplicação externa está autorizada a mudar agora.
- **Blockers:** nenhum local. A política que permite Actions criar PRs depende de administrador; a API de políticas retornou 403 para o agente e não foi alterada.
- **Uncommitted files:** confirmar via git status; os commits são atômicos por tarefa, incluindo seus registros TLC.
- **Branch:** `codex/release-please-self-pilot`, baseada em `e05a76af07096e2cc4350af02896a68b11386bd5`, publicada no origin. Evidência hospedada em `b6493740679134fc540c27344e4d8ec28cc23004`; este registro é posterior, sem alteração do runtime.
- **Preservation:** o worktree antigo `versioning-reconciled` e o checkout principal não foram modificados.
- **Research:** release-please 17.3.0 e yaml 2.9.1 são dependências de desenvolvimento; tsx é dependência do runtime central. Context7 indisponível; documentação oficial consultada. A autenticação ativa do GitHub CLI é agentegersonfribeiro-AI.
- **Hosted evidence:** https://github.com/aplicacoesBoilerplate/.github/actions/runs/40034124370 em fbc7c31, actor agentegersonfribeiro-AI, 7/7 e typecheck aprovados. master e05a76a; tags e Releases ausentes na última consulta. Nenhuma aplicação externa modificada.
- **Scratch:** a cópia temporária restaurada do Verifier anterior permanece no caminho registrado em validation-sdk.md; sua remoção foi bloqueada pela política de execução e não foi tentada por outro mecanismo.
- **Milestone do piloto:** https://github.com/aplicacoesBoilerplate/.github/milestone/2, v0.0.1 criada com autorização expressa. Issue #4 continua OPEN/Reopened, com v1.0.0 preservada. A cópia temporária do segundo sensor está registrada em validation.md e também teve remoção bloqueada, sem tentativa alternativa.
