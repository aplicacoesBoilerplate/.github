# Execution ledger: code review

Spec, design e tarefas aprovados em 2026-10-15. Execução pelo principal, sequencial, na branch/worktree da #8 empilhada sobre #7/#9. Nenhuma autorização de uso de auth pessoal, push ou ativação externa foi inferida.

## T8: caller integrado e consumo

Assumptions: exemplos genéricos só são ativados depois de revisão/publicação e configuração privada no consumidor. O commit e2027dd contém workflow/helper necessários ao caller, evitando pin de código inexistente. Sessão e modelo são escolhas locais; testes usam sessões simuladas, nunca a conta pessoal/global.

Files: examples/callers/review (três workflows, política/review/triage, quatro configs/prompts, dois inspectors e instruções completas), scripts/llm/lint-workflow.mjs, tests/review/{caller,caller-integration}.test.mjs e progresso TLC.

Success: dispatch posterior à persistência/inspeção, novo run com sessão atual, origem comprovada e complementar sem recursão; instruções de configuração/credenciais/resultados/recuperação e pins reais; inspector read-only vinculado a identidades independentes. Sem documentação central extensa ou testes da prosa.

RED: arquivos de caller/inspector ausentes. GREEN: Full Node 22.23.3 com 194 pass/0 fail/0 skipped; syntax/npm check e actionlint Windows sobre dez YAML verdes. validate_tasks/validate_spec e diff check verdes. Nenhuma assertion existente alterada; nenhum SPEC_DEVIATION. A simulação criptografa/descriptografa de fato o PUT, mas a renovação da sessão, API, checks e LLM são simulados; isso não é piloto real.

| Critério / AC | Evidência/assertion | Resultado esperado |
| --- | --- | --- |
| Caller, auth e pins | `tests/review/caller.test.mjs:25–32`: inputs/run-name/pin/expected_head_sha/session mode/secrets exatos; `:51–55`: git show confirma helper/workflow no SHA e política genérica | REV-01/21 sem configuração particular do piloto |
| Dispatch após entrega, sem herdar sessão | `:35–39`: needs triage/inspect success, status de draft, Actions write e ausência de concorrência aninhada; fingerprint e token explícitos | REV-17/20 |
| Bridge confiável | `:41–49`: pull_request_target só own-repo, checkout default, token de dispatch específico, nenhum source checkout/secret de LLM | REV-02/19/21 |
| Inspector independente | `:78–85`: exit 0/Verified succeeded, outro PR/run/attempt/repo/head/base/merge/config/automation/fingerprint → INVALID_RESULT; sidecar adulterado recusado, fonte e config intactas | REV-06/08/21 |
| Sessão renovada na triagem | `tests/review/caller-integration.test.mjs:78–82`: modelo consumer-triage/prompt próprio, sessão initial e store renewed após PUT criptografado; writes 1 | REV-04/17, nenhuma sessão real |
| PR e novo run | `:91/100/106/113`: árvore real igual à proposta, draft 30, payload fechado sem auth, run 200 captura sessão renewed | REV-17/20 |
| Review próprio e resultado | `:123/130–132`: auth renewed, modelo consumer-review/prompt próprio; status reviewed/PR 30/sem segundo PR, comentário presente, auth dirs ENOENT | REV-04/17/21 |
| Fila antiga e falta de credencial | `:134–137`: AUTH_CONFIG_ERROR e AUTH_SNAPSHOT_STALE, nenhum novo artefato | REV-20/26, caller não recebe autenticação global de fallback |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| caller:25–55 | REV-01/02/17/19/20/21 | Sim |
| caller:78–85 | REV-06/08/21 | Sim |
| caller-integration:78–82/91/100/106/113/123/130–137 | REV-04/17/20/21/26 e ciclo de sessão do consumidor | Sim |

Adequação: três cenários coesos comprovam payloads, estado, Git, crypto, recusa e isolamento. Instruções completas de caller foram entregues sem testes de prosa, conforme AD-003/004. Código T8 pronto para revisão independente após seu commit local. Não declarar a feature ou a meta concluída: Verifier local e T9 real continuam pendentes.

## T10: dispatch antes do pin do caller

Assumptions: o destino é o caller de review na default do mesmo consumidor privado. Dispatch pós-triagem prova o próprio finish já concluído; central continua exigindo outro run. Credenciais de metadata/Actions pertencem ao consumidor e não autenticam a LLM. Correlação identifica uma solicitação, não concede autoridade.

Files: scripts/review/{dispatch,dispatch-api,dispatch-run}.mjs, prova compartilhada explícita em collect.mjs, expected_head_sha opcional em workflow.mjs/run.mjs/pr-code-review.yml; tests/review/dispatch.test.mjs e fixtures/dispatch-api.mjs; progresso TLC. Helper separado do T8 original para que o caller possa fixar seu SHA real. Sem novos requisitos nem mudança de fronteira de auth.

Desvio de processo: o rascunho inicial do helper precedeu a suíte específica. O gate não foi dispensado: RED comportamental reproduziu POST duplicado para run antigo já reprovado; a implementação passou a recusar esse caso antes de escrever. Dois erros de preparação da fixture (PR number omitido e evento do bridge usado em vez do novo workflow_dispatch) foram corrigidos sem alterar expectativas. GREEN: Full Node 22.23.3 com 191 pass/0 fail/0 skipped, npm check, sintaxe dos testes/fixture, actionlint Windows e gates estruturais verdes. Testes e guards legados preservados; nenhuma credencial real.

| Critério / AC | Evidência/assertion | Resultado esperado |
| --- | --- | --- |
| Novo run e payload limitado | `tests/review/dispatch.test.mjs:70–73`: equal dispatched/run_id 200, segundo recovered sem novo POST; keys PR/head/handoff/correlação exatas e sem sessão | REV-01/17/20 |
| Prova de source-run, guard da central | `:76–78`: UNTRUSTED_CONTEXT no mesmo run; outro run aceita origem triage/correction | REV-02/17, guard central não enfraquecido |
| Job/attempt/autoria/entrada | `:87–95`: rejects UNTRUSTED_CONTEXT ou STALE_REVIEW_INPUT para finish falho, run/attempt/body, origem pública/evento indevido/head/role; posts vazio | REV-02/17/24 |
| Timeout e falha anterior | `:100–106`: recovered 200, ignora latest 999, run antigo reprovado falha sem segundo POST, erro sanitizado sem run criado | REV-18/25/26 |
| Head no called | `:112`: rejects STALE_REVIEW_INPUT quando expected_head_sha diverge, antes de inferência | REV-24 |
| Transporte de tokens/dados | `:126–141`: token de leitura separado de dispatch, workflow_run_id 200/payload/ref exatos, paginação, redirect error, uma tentativa POST e payload de sessão/caminho/token recusados | REV-17/25/26 |
| Complementar comprovado | `:155–157`: skipped-correction/run_id null e nenhum POST; pai adulterado recusado | REV-19, não filtrar genericamente todo bot |
| Runner real | `:174–179`: exit 0/status dispatched, output run_id 200, payload sem credencial; PR number forjado falha sem alterar captura | REV-01/17/26, serviços simulados |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| dispatch:70–78 | REV-01/02/17/20 | Sim |
| dispatch:87–95/112 | REV-02/17/24 | Sim |
| dispatch:100–106/126–141 | REV-18/25/26 e transporte T10 | Sim |
| dispatch:155–157 | REV-19 | Sim |
| dispatch:174–179 | REV-01/17/26 e entrada de ambiente T10 | Sim |

Adequação: assertions sobre payloads, origem, run recuperado, ausência de writes e erros reais; nenhuma contagem como meta, nenhum teste de prosa. T10 completa localmente; adoção com pins/instruções e sensor independente ainda T8. Não há evidência de homologação.

Context7 indisponível (nenhuma ferramenta correspondente nesta sessão). Fontes oficiais consultadas em 2026-10-15: [dispatch de workflow](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), resposta 200 com workflow_run_id na API 2026-03-10, e [listagem de runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow), usada somente com correlação exata e paginação limitada.

## T7: workflow, runner e CI

Assumptions: caller usa dispatch na default, como aprovado. Config e código são checkouts separados; produto só executa no container sem secrets. Resultado/checks são artefatos limitados, consumidos com identidade independente. Nenhuma fixture comprova Docker ou GitHub Actions reais.

Files: .github/workflows/{pr-code-review,ci}.yml, scripts/review/{workflow,run,collect}.mjs, scripts/shared/verify-product.mjs, adapter triage/verify-product.mjs, scripts/llm/{package.json,check.mjs,lint-workflow.mjs}, tests/review/workflow.test.mjs e fixture review-api.mjs, mais progresso TLC.

Success: cinco jobs separados; modelo/prompt propagados; snapshot e pacote v3 revalidados; somente proposta reconstruída chega ao publisher; falhas de etapas e limpeza impedem sucesso. CI mantém descoberta antiga e acrescenta review/shared/YAML. Nenhuma fila de sessão duplicada no pai.

RED: módulo workflow ausente antes da implementação. O runner reproduziu REVIEW_METADATA_UNAVAILABLE porque a fixture antiga só reconhecia author/operator; o simulador passou a aceitar explicitamente o autor do PR configurado e o operador, sem modificar assertions nem os guards reais. GREEN: Full Node 22.23.3 com 184 pass/0 fail/0 skipped; npm check, sintaxe dos testes e actionlint Windows sobre os sete YAML passaram. Assertions adicionais de gates/continue-on-error confirmadas também em Node 22.23.3. Sem SPEC_DEVIATION.

| Critério / AC | Evidência/assertion | Resultado esperado |
| --- | --- | --- |
| Central/configuração do consumidor | `tests/review/workflow.test.mjs:65`: equal received.model consumer-review/effort high e invocation.context_json '{}' | REV-04, nenhuma configuração central de modelo |
| Isolamento dos checks | `:53–59`: docker/network none/read-only/cap-drop, um mount sem socket/automação e deepEqual chaves env fechadas | REV-13; args inspecionados, Docker real ainda pendente |
| Fonte e árvore publicadas | `:66–71`: verification failed, temporário ENOENT, draft-checks-failed e deepEqual mudanças fixed/base64, fonte new intacta | REV-13/15, produto que grava poison não fornece árvore ao publisher |
| Identidade/relatório/limpeza | `:76–84`: rejects INVALID_REVIEW_INPUT/STALE_REVIEW_INPUT/INVALID_RESULT/INVALID_REVIEW_VERIFICATION/CHECK_CLEANUP_FAILED e writes vazio; imagem mutável/config fora do contrato recusadas | REV-06/24/26 |
| Status final | `:86–87`: draft normal, ARTIFACT_FAILED para failure em collect/llm/checks/publish/cleanup | REV-26, upload/cleanup falhos não viram sucesso |
| Segregação e filas | `:92–105`: jobs exatos, review queue max sem cancelamento, llm sem concorrência duplicada, secrets explícitos e ausentes em checks/publisher conforme papel, condições de sucesso antes de publicar | REV-01/20/26 |
| Artefatos e CI | `:106–113`: upload if-no-files-found error/retention 1/overwrite false, checkout sem persistência e descoberta llm/triage/review/shared/YAML | REV-26 e Done-when CI T7 |
| Runner real | `:131–139`: saída correction/source_sha limitada sem texto/token, snapshot PR 9, cleanup ENOENT, evento forjado UNTRUSTED_CONTEXT e finish ARTIFACT_FAILED | REV-01/26 com API simulada |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| workflow:53–71 | REV-04/13/14/15 e árvore independente dos checks | Sim |
| workflow:76–87 | REV-06/24/26 | Sim |
| workflow:92–113 | REV-01/20/26 e discovery T7 | Sim |
| workflow:131–139 | REV-01/26 e runner/cleanup T7 | Sim |

Adequação: quatro cenários coesos exercitam o fluxo e falhas relevantes, com assertions sobre dados e efeitos; testes legados preservados. Nenhum teste de prosa, nenhuma meta quantitativa. TLC e cicd orientaram gates e segregação. T7 completa localmente; caller/dispatch/Verifier T8 e homologação real T9 permanecem.

## T6: publicação recuperável

Assumptions: recollect reconstrói snapshot confiável pela API/Git antes das escritas. O writer é do consumidor e distinto do reviewer; para correções, sua identidade deve estar explicitamente configurada para que o coletor consiga provar a origem do complementar. Nenhuma chamada real é autorizada nesta tarefa.

Files: scripts/review/{publish,publication-api}.mjs, extração mínima scripts/shared/publication-api.mjs e adapter scripts/triage/publication-api.mjs; tests/review/{publish,publication-api}.test.mjs e fixtures/publication.mjs; registros TLC.

Success: comentário automático distingue severidades/ausência/inconclusivo, SHA registrado e sem aprovação; draft complementar filho do head original; checks falhos explícitos; recursos próprios recuperáveis e humanos preservados. Transporte compartilhado conserva endpoint fixo, paginação, erros e guard de branches da triagem, sem retry cego.

RED: teste de publicação recusado por módulo ausente. GREEN: Full em Node 22.23.3, 180 pass/0 fail/0 skipped; sintaxe dos sete módulos novos/alterados, npm check, actionlint Windows e validate_tasks/validate_spec/check_commit verdes. Testes legados não alterados, nenhum SPEC_DEVIATION. Fixtures simulam serviços externos; não são homologação.

| Critério / AC | Evidência/assertion | Resultado esperado |
| --- | --- | --- |
| Comentário automático/SHAs/severidade/nenhum achado | `tests/review/publish.test.mjs:9–16`: equal reviewed/pr_number null, corpo inclui SHA/config/automação e categorias; nenhuma keyword de fechamento, somente escrita comment | REV-09/10/18 sem review APPROVE/merge/Project/Sonar |
| Complementar e falha de checks | `:22–32`: equal draft-checks-failed, draft true, base=head_ref/head_sha; deepEqual parents e tree_sha da proposta; mensagem de commit exata e reviewer solicitado | REV-14/15, sem push no head original |
| Integração/complementar e entrada antiga | `:37–55`: somente comment; rejects STALE_REVIEW_INPUT para PR/refs/SHAs/config/entrada; INVALID_RESULT/INVALID_REVIEW_VERIFICATION/INVALID_REVIEW_PATCH para artefatos/relatório/capacidade divergentes, writes vazio | REV-08/16/19/24 |
| Recuperação idempotente | `:62–64`: mesmo comment_id/pr_number, um comentário/PR e uma escrita do recurso após timeout | REV-18/25, recursos próprios íntegros |
| Recursos humanos e commit remoto | `:71–88`: rejects REVIEW_RESOURCE_CONFLICT; corpos/branch/escritas preservados; tree/parent/message divergentes recusados, comentário humano intacto | REV-18/24/25 |
| Mudança tardia/falha sanitizada | `:94–98`: STALE_REVIEW_INPUT antes de escrita; REVIEW_PUBLISH_FAILED/message exato e nenhum comentário em erro | REV-24/26 |
| Atualização própria e race de edição | `:106–113`: mesmo comment_id e uma update-comment recuperada; edição entre leitura/update recusa conflito, sem nova escrita | REV-09/18/25 |
| Inconclusivo distinto de vazio | `:120–122`: needs-human/pr_number null, corpo afirma revisão incompleta e não afirma nenhum achado | REV-05/09 |
| Git Data e superfície de escrita | `tests/review/publication-api.test.mjs:23–34`: parents/tree/author, ref e draft payloads exatos; branches originais/protegidas e PR não draft recusados sem chamadas | REV-10/14/26 |
| Transporte limitado | `:48–57`: ausência null distinta de 403; segunda página observada; sem retry POST, token recusado no payload, árvore divergente impede commit e erro sanitizado | REV-25/26 |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| publish:9–16/37–38/120–122 | REV-05/09/10/16/19 | Sim |
| publish:22–32 | REV-14/15/18 | Sim |
| publish:43–55/94–98 | REV-08/24/26 | Sim |
| publish:62–88/106–113 | REV-18/25 e preservação de intervenção humana | Sim |
| publication-api:23–34/48–57 | REV-10/14/25/26 e transporte mínimo compartilhado | Sim |

Adequação: asserts verificam corpos, SHAs, árvore, pai, refs e efeitos persistidos, além de recusas exatas. Sem testes de prosa nem metas quantitativas; constituição e AD-003/004 preservadas. T6 completa localmente. Conexão workflow/CI/caller e piloto real continuam T7–T9; nenhum PR remoto foi criado.

## T5: preparo isolado da correção

Assumptions: autorização de paths pertence ao adapter; o núcleo Git recebe apenas a operação já autorizada. Config, snapshot e identidade esperada vêm dos componentes confiáveis anteriores, nunca do patch. Checks do produto e publicação permanecem fora desta tarefa.

Files: scripts/shared/prepare-patch.mjs, scripts/triage/prepare-patch.mjs, scripts/review/prepare-patch.mjs e tests/review/patch.test.mjs, além deste progresso TLC.

Success: interseção diff/allowlist, paths sensíveis recusados, pai=head exato e fonte intacta. Capacidade própria em memória impede metadados serializados de autorizar publicação/limpeza. Triagem preserva v2, erros públicos e testes sem alterações.

RED: teste novo recusado por módulo ausente. Implementação extraiu apenas operações Git, ownership e limpeza; adapters mantêm contratos distintos. A fixture de adulteração de HEAD precisou fornecer identidade Git local para criar o commit adversarial; nenhuma expectativa foi modificada. GREEN: Full Node 22.23.3 com 170 pass/0 fail/0 skipped; sintaxe dos quatro módulos e validate_tasks/validate_spec/check_commit verdes. Sem SPEC_DEVIATION.

| Critério / AC | Evidência/assertion | Resultado esperado |
| --- | --- | --- |
| Pai, conteúdo e fonte intacta | `tests/review/patch.test.mjs:44–51`: equal HEAD^/base_sha ao snapshot.source_sha, conteúdo fixed/new, status fonte vazio e deepEqual changes/base64 | REV-12/14, proposta isolada filha do head analisado |
| Ownership e limpeza | `:53–57`: rejects cópia serializada INVALID_REVIEW_PATCH; alteração de metadados não muda base própria; diretório temporário ENOENT e fonte preservada | REV-12, somente capacidade própria autoriza consumo/remoção |
| Diff/allowlist/identidade/rota/base | `:68/72/75`: rejects INVALID_RESULT ou INVALID_REVIEW_PATCH para expansão, hash/identidade/rotas/paths sensíveis; STALE_REVIEW_INPUT exato para checkout diferente | REV-11/16/24, nenhum preparo fora do contrato |
| Sem execução de hook/texto/secrets | `:82–88`: deepEqual chaves do ambiente fechado, equal texto literal $(echo forbidden), marker ENOENT e HEAD adulterado recusado | REV-12, preparo não executa código; REV-13 em container ainda T7 |
| Árvores inseguras | `:97–99`: rejects INVALID_REVIEW_PATCH para modos 120000/160000 e equal HEAD/conteúdo fonte preservados | REV-11/12 |
| Triagem preservada | `tests/triage/patch.test.mjs:37–44/55/68–74/83–88`: conteúdo/pai/limpeza, recusas, ambiente fechado/hooks e árvores inseguras; arquivo legado sem alterações | REV-24 e Done-when T5, contrato v2 sem downgrade artificial de review |

| Testes/assertions | Mapeamento reverso | Manter |
| --- | --- | --- |
| review/patch:44–57 | REV-12/14, integridade e limpeza T5 | Sim |
| review/patch:68–75 | REV-11/16/24 | Sim |
| review/patch:82–88 | REV-12 e segregação da preparação T5 | Sim |
| review/patch:97–99 | REV-11/12 e edge cases árvores inseguras | Sim |
| triage/patch existente | Regressão obrigatória T5, nenhum teste repetido novo para v2 | Sim |

Adequação: assertions observam commits, árvores, bytes e erros reais, não contagem de chamadas. Sem testes de prosa ou meta numérica, seguindo constituição e AD-003/004. T5 completa localmente; PR complementar, checks em container e piloto real continuam pendentes.

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
