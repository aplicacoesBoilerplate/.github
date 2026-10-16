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

## T4: integração com a central

Premissas: o novo perfil é opt-in, não altera default manual/triage. Modelos, esforço e templates vêm das configs confiáveis do consumidor. Resolver API/config/diff e o conjunto limitado de blobs antes de restaurar auth. Arquivos: review/invocation.mjs e source.mjs; execute/orchestrate/preflight/run/validate-request e llm-execute.yml centrais; central.test.mjs/fixtures e assertion de interface fechada em llm/workflow.test.mjs.

RED observado: perfil review era UNTRUSTED_CONTEXT, runner INVALID_CONFIG e campos/steps não existiam. GREEN final: Full em Node 22.23.3 com 166 pass/0 fail/0 skipped; npm check, sintaxe direta dos módulos review/centrais e actionlint Windows 1.7.12 nos seis workflows passaram. API e CLI são fixtures; Git, blob selection, subprocessos, empacotamento e limpeza reais locais. Nenhuma inferência/auth real.

Ruling: coletar blobs regulares via ls-tree/cat-file no SHA confirmado, não copiar a working tree nem o repositório inteiro. Arquivo não alterado de 2 MiB não impede review; arquivo selecionado >1 MiB retorna inconclusivo antes da auth. Evita TOCTOU de conteúdo local e mantém snapshot limitado. Custo: revisão parcial por arquivos mudados; contexto complementar fica para evolução fora deste MVP.

Ruling: interface central estendida explicitamente com pull_number/review_config_path/review_fingerprint/review_handoff_json e REVIEW_READ_TOKEN opcionais. Assertion fechada recebeu somente essas adições aprovadas; permissões, isolamento, origens e todos os guards legados permanecem. Inputs de review em perfil manual/triage são recusados. Não houve relaxamento para fazer teste antigo passar.

Ruling: runner lê PR/handoff do GITHUB_EVENT_PATH real, comparando-os à chamada; preflight fornece config SHA e head separadamente. Checkout de review fetch-depth 0 permite merge-base, e phase source valida o contexto sem auth LLM. Modelos não recebem o token de leitura; invoke mantém único ponto de materialização das credenciais.

| Critério / AC | Evidência/assertion | Resultado |
| --- | --- | --- |
| Modelo/esforço/prompt e fonte | `tests/review/central.test.mjs:65–75`: v3/SHAs corretos; summary own-review\|high\|OWN REVIEW PROMPT; source_files somente main.go/new, mesmo com arquivo sujo e arquivo não alterado de 2 MiB | REV-03/04/06 |
| Instruções e fronteira | `:70–75`: READ/GITHUB_TOKEN undefined no processo, shell_tool false, AGENTS confiável presente e AGENTS head somente no diff | REV-02/03/04 |
| Config/contexto/identidade/credenciais inválidos | `:84–88`: códigos exatos UNTRUSTED/STALE/METADATA/AUTH_CONFIG_ERROR, authUsed false e root vazio; manual rejeita inputs review | REV-02/03/08/26 |
| Decisão antes da execução | `:96–97`: uma chamada own-decision, skipped/null/findings vazio | REV-04/08 |
| Limite antes de auth | `:102–103`: REVIEW_INCONCLUSIVE, authUsed false e sem artefatos | REV-05 |
| Persistência/limpeza | `:111–115`: AUTH_PERSIST_FAILED, sem artefato e ENOENT na auth temporária | REV-20/26 |
| Runner/evento real | `:129–132`: preflight/source exit0 e source SHA exato; payload PR forjado exit1/UNTRUSTED_CONTEXT | REV-01/03 |
| Workflow | `:137–143`: defaults, env sem auth na source, ref exata/fetch-depth0/persist-credentials false e mesma fila de sessão | REV-03/20/26 |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| central:65–75 | REV-02/03/04/06, modelo e instruções reais da chamada | Sim |
| central:84–103 | REV-02/03/04/05/08/26, recusa antes de auth e decisão | Sim |
| central:111–115 | REV-20/26, persistência e remoção | Sim |
| central:129–143 e interface fechada central | REV-01/03/20/26 e compatibilidade | Sim |

Adequação: sucesso inspeciona payload/args/artefato e conteúdo real; falhas inspecionam ausência de auth/artefatos e erro sanitizado. Nenhum teste de prosa, piso quantitativo, remoção/skip ou credencial pessoal. Gates legados preservados, AD-003/004/constituição seguidos. T4 completa localmente; workflow de domínio, caller integrado e piloto real ainda pendentes.

## T3: achados e envelope v3

Premissas: pacote de review usa validator próprio v3, sem fazer o validador legado aceitar outro contrato. Snapshot é reconsultado/reconstruído pela camada confiável; modelo fornece somente summary/findings/patch. Arquivos: review/result.mjs, schemas/result.schema.json, exportação neutra resultIdentity no central e result.test.mjs.

RED por módulo inexistente observado antes da implementação. GREEN: Full em Node 22.23.3, 159 pass/0 fail/0 skipped; node --check de review/result e llm/result, npm check e actionlint Windows 1.7.12 nos seis workflows passaram. Binário temporário anterior estava ausente; novo ZIP validado pelo SHA256 completo conhecido antes da execução. Nenhum schema/assertion legado foi alterado.

Ruling: extrair somente a identidade comum por exportação, não importar review no módulo legado. Evita ciclo entre validadores e preserva v1/v2 fechados; T4 selecionará explicitamente o empacotamento v3. Custo: consumidores de review usam validator próprio, não validateEnvelope legado.

Ruling: envelope v3 inclui hash do patch além do hash de review.json. Leitor confere bytes, lista fechada, identidade independente e referências ao diff; não aceita alteração do arquivo só porque o path continua permitido. Custo: novo campo obrigatório apenas em v3, sem migração das versões antigas.

| Critério / AC | Evidência/assertion | Resultado |
| --- | --- | --- |
| Proveniência e pacote | `tests/review/result.test.mjs:26–39`: arquivos exatos, repo/PR/run/attempt/invocation/SHAs/hashes/summary e conteúdo do achado/patch iguais aos valores independentes; outputs ≤8192 | REV-06/07/09 |
| Referências e resposta fechada | `:47–53`: throws INVALID_RESULT para linha/arquivo/severidade/message/extra/count inválidos, índice adulterado, patch fora do diff e rota não corrigível | REV-07/08 |
| Identidades/bytes divergentes | `:61–66`: rejects INVALID_RESULT para outro run/attempt/repo/PR/base/config/automação/instruções, sidecar/patch alterados e arquivo extra | REV-06/08 |
| Sigilo e limite agregado | `:73–77`: INVALID_RESULT para secret inclusive com aspas e payload excessivo, diretório vazio; duplicata ARTIFACT_FAILED e conteúdo original preservado | REV-08/26 |
| Sem achados/skip | `:83–87`: patch_file/hash null, findings vazio e skipped com arquivos exatos | REV-09, sem aprovação nativa |
| Legados | `:95–99` e `:40`: v1/v2 continuam sem review_file e aceitos somente no validator correto; v3 recusado pelo legado | Compatibilidade e opt-in |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| result:26–40 | REV-06/07/09 e formato v3 | Sim |
| result:47–66 | REV-06/07/08, recusa integral | Sim |
| result:73–77 | REV-08/26, sigilo/limites/preservação | Sim |
| result:83–99 | REV-09 e compatibilidade legada | Sim |

Adequação: conteúdo real escrito/lido e erros concretos, sem mocks ou testes documentais; expected não vem do envelope. Diff bruto é reindexado em vez de confiar no índice do artefato. Constituição/AD-003/004 seguidas; T3 completa localmente. T4 ainda deve ligar CLI e orquestração; não houve inferência real.

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
