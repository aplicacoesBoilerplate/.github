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
