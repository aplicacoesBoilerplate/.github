# Execution ledger: code review

Spec, design e tarefas aprovados em 2026-10-15. Execução pelo principal, sequencial, na branch/worktree da #8 empilhada sobre #7/#9. Nenhuma autorização de uso de auth pessoal, push ou ativação externa foi inferida.

## Pre-flight

| Produtor → consumidor | Interface | Resultado |
| --- | --- | --- |
| T1 → T2/T3/T5 | Policy e índice de arquivos/linhas do diff | Definidos nesta tarefa; nenhuma inferência autoriza caminhos |
| T2 → T3/T4/T6 | Snapshot com head/base/merge-base/config e fingerprint | Proveniência vem da API/Git confiáveis |
| T3 → T4/T5/T8 | Envelope v3 e sidecar com hash | v1/v2 preservados; nenhum downgrade artificial |
| T5 → T6/T7 | Proposta própria e relatório bound | Checks isolados não fornecem árvore mutada ao publisher |
| T7 → T8 → T9 | Called fixado e dispatch de novo run | Piloto real continua obrigatório e não é fixture |

Ruling: ledger e evidências usam a estrutura TLC existente, não uma segunda árvore de documentação superpowers. Preserva a fonte única aprovada e a preferência do mantenedor; custo: ferramentas de extração auxiliares não são necessárias.

## T2: coleta confiável de PR e handoff

Assumptions: sourceRoot contém objetos Git de head/base, conferidos pelos SHAs; configRoot é checkout separado da default. T7 fará os checkouts e lerá o evento real. O coletor não recebe sessão LLM nem executa produto. Arquivos: review/collect.mjs, api.mjs, extensão opcional triage_handoff da policy/schema e collect.test.mjs.

RED: módulos ainda ausentes; casos adicionais reproduziram aceitação ausente de complementar próprio e classificação errada de JSON inválido como erro de API. GREEN: Full em Node 22.23.3 passou, 153 pass/0 fail/0 skipped; syntax de collect/api/policy e gates estruturais passaram. API simulada; Git, conteúdo, comparação e hashes reais locais. Nenhuma credencial pessoal ou escrita remota.

Ruling: parâmetros adicionais sourceRoot e triage_handoff concretizam a origem aprovada; paths de workflow/config e nome do job de conclusão pertencem ao consumidor, sem hardcode do piloto. Custo: consumidor configura esses três valores para habilitar handoff automático.

Ruling: a tentativa é vinculada pelo endpoint `/actions/runs/{id}/attempts/{attempt}/jobs` e pelo run consultado; não exigir run_attempt em cada objeto job, pois esse campo não faz parte do contrato documentado. Mesmo teste de sucesso mantido, fixture ganhou caso sem esse campo; novas assertions de recusa não foram enfraquecidas.

Ruling: selo de body detecta edição, não é assinatura. Handoff também exige autor id/login configurados, run/path/config SHA, job finish concluído, recolhe a issue pela política da triagem e cruza fingerprint/commit/pai/base. Complementar próprio usa protocolo review:v1 e ancestralidade/PR original, sem virar um novo pedido de correção. Custo: edição humana, mudança de default ou metadados após a triagem requer nova execução/intervenção, não uma autorização silenciosa.

| Critério / AC | Evidência/assertion | Resultado |
| --- | --- | --- |
| Snapshot, diff e SHAs separados | `tests/review/collect.test.mjs:82–87`: repository/PR/head/base/config/merge-base exatos, added_lines [1], body API, source config old e fingerprint muda com body | REV-01/03/06, Git sem produto |
| Origem e autorização | `:93–100`: rejects UNTRUSTED_CONTEXT para evento/ref/workflow/PR/fork/público e autor/operador sem escrita | REV-02 antes de LLM |
| Entrada antiga | `:101–104`: rejects STALE_REVIEW_INPUT para PR fechado/default/head alterados | REV-24 |
| Limites/inconclusivo e erros | `:109–118`: needs-human/body vazio, REVIEW_INCONCLUSIVE e erro API sem texto privado; `:125`: INVALID_REVIEW_CONFIG exato para JSON inválido | REV-05/26 sem revisão parcial falsa |
| Handoff próprio | `:131–137`: origin triage/route correction/source_run_id 100; falha de job/path/edição/autoria/fingerprint recusa UNTRUSTED_CONTEXT | REV-17/19 com evidência cruzada |
| Complementar não recursivo | `:151–152`: skip-correction para origem review comprovada, pai divergente recusado | REV-19 |
| Transporte e paginação | `:161–166`: 101 jobs, segunda página de attempt correta, endpoint/auth/redirect e 403 sanitizado | REV-02/26, ausência distinta de indisponibilidade |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| collect:82–87 | REV-01/03/06 e fingerprint | Sim |
| collect:93–104 | REV-02/24 | Sim |
| collect:109–125 | REV-03/05/26 | Sim |
| collect:131–152 | REV-17/19 | Sim |
| collect:161–166 | REV-02/26 e adapter de leitura | Sim |

Adequação: asserts medem dados, estado e erros reais, não apenas chamadas. Sem testes de prosa/pisos numéricos; legados preservados, constituição e AD-003/004 seguidos. T2 completa localmente; caller/dispatch e autenticação real permanecem T4/T8/T9.

Fontes técnicas, Context7 indisponível e fallback oficial: [workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run) e [git diff](https://git-scm.com/docs/git-diff), consultados em 2026-10-15.

## T1: política e diff

Assumptions: classificação pura decide somente a elegibilidade da correção. T2 comprovará confiança real via API; um marker ou nome de bot não é prova de ownership. Paths de checks/config/modelos permanecem controlados pelo consumidor.

Files: scripts/review/policy.mjs, diff.mjs, schemas/config.schema.json e tests/review/policy.test.mjs, além de progresso TLC.

Success: configuração fechada e paths seguros; branches de integração/complementares não corrigíveis; índice contém somente linhas adicionadas reais; diff incompleto/excessivo/binário é inconclusivo, não vazio válido.

RED: módulos de review ainda ausentes. Um caso adicional reproduziu headers sem hunks sendo aceitos como diff completo; o parser foi corrigido sem alterar expectativas. GREEN: gate completo em Node 22.23.3 passou, 146 pass/0 fail/0 skipped; sintaxe de policy/diff e validate_tasks passaram. Contagem é evidência da execução, não meta.

| Critério / AC | Evidência/assertion | Resultado |
| --- | --- | --- |
| Config fechada/isolada/paths e prefixos seguros | `tests/review/policy.test.mjs:13`: deepEqual(policy, original) e allowed_paths original intacto; `:18`: throws INVALID_REVIEW_CONFIG/message iguais | Config própria preservada; inválida não autoriza patch |
| Feature, integração, complementar e bot | `:23–29`: equal correction para feature/triagem, review-only para protegidas/desconhecidas, skip-correction para origem review; body/login não muda rota | REV-16/19 sem ignorar todo bot |
| Somente linhas adicionadas | `:35`: deepEqual files/old_path/added_lines [2,3,9]; `:36–40`: vazio/new/deleted exatos | Contexto/headers não viram achados |
| Diff incompleto/forjado/binário | `:48`: throws REVIEW_INCONCLUSIVE/message iguais, incluindo headers sem hunks | Recusa, não revisão vazia completa |
| Limites em bytes/arquivos | `:53–55`: 100 arquivos aceitos; 101 e UTF-8 acima de 16 KiB recusados | REV-05 explícito |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| policy.test:13/18 | T1 config segura; REV-11/16 | Sim |
| policy.test:23–29 | REV-16/19 e elegibilidade T1 | Sim |
| policy.test:35–40/48 | REV-05/07, índice correto e truncamento | Sim |
| policy.test:53–55 | REV-05, limites de arquivos/bytes | Sim |

Adequação: assertions verificam políticas, conteúdo do índice e erros reais, sem mocks, testes documentais ou alterações nos testes legados. Segue constituição e AD-003/004. T1 completa; T2 ainda deve provar origem/handoff pela API. Nenhuma credencial real ou escrita remota.
