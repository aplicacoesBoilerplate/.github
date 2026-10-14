# Execution ledger: triagem

## T6: workflow, isolamento e CI

Premissa: usar o workflow central, não duplicar auth; produto só executa em container no job de checks. Arquivos: issue-triage.yml, run/workflow/verify-product.mjs, fingerprint opcional na central, intervenção no publisher, scripts test/check/lint e CI, testes co-localizados e progresso TLC.

RED: módulos/runner ausentes; fingerprint recusado pela interface antiga e decisão needs-human indevidamente recusada no publisher. GREEN: npm test descobre central+triagem; gate completo em Node 22.23.3, syntax e actionlint Windows 1.7.12 passaram. Nenhum segredo real/push/Actions real. Docker version confirmou daemon local indisponível; transporte Docker simulado não é homologação de isolamento em runtime.

Ruling: triage_fingerprint opcional limita outputs a identidades; central reconstrói o contexto pela API e confere hash, conservando context_json/v1 legados — body não vira output de job. Custo: API reconsultada, sem inferência repetida.
Ruling: imagem OCI imutável fornecida pelo caller, checks em container sem rede/capabilities/credenciais/PID/socket ou mounts da automação — stripping de env sozinho não isola produto do host. Custo: dependências offline precisam constar na imagem; registry privado e harness fora do MVP.
Ruling: publisher reconstrói a proposta em processo/workspace próprio a partir do patch original validado; nunca usa árvore possivelmente alterada pelos testes. Relatório vinculado a source/config SHA e patch hash não substitui revalidação da entrada.
Ruling: contexto job.workflow_sha é válido nos steps, não no env do job; lint detectou e a origem foi movida aos steps sem ampliar exceções. Preload Node usa URL em Windows; correção de fixture de execução, sem mudança de assertion/expectativa.

| Critério / AC | Evidência e assertion | Resultado |
| --- | --- | --- |
| Coleta → central → checks → publicação | `tests/triage/workflow.test.mjs:46,52–54,67–69`: fingerprint/context '{}', modelo own-patch, SHAs/status bound, fonte old, draft/PR/milestone/reviewer/commit pai/link | Fluxo integrado real de código/Git com serviços simulados |
| Rotas e identidade | `tests/triage/workflow.test.mjs:74–79,91–95,105–110`: needs-human sem PR, planned/summary, recusas SHA/config/automação e decisão central preservada | Informação insuficiente não vira sucesso/patch |
| Workflow e falhas | `tests/triage/workflow.test.mjs:115–130,138`: concorrência/called relativo/secrets explícitos, env sem sessão/escrita nos checks, ausência de auth LLM no publisher, pins/cleanup, ARTIFACT_FAILED exato | Separação e finalização sem falso sucesso |
| Runner coletor real | `tests/triage/workflow.test.mjs:156–161`: bootstrap/collect exit0, outputs <8KiB sem body/token, snapshot/body/SHAs corretos, cleanup ENOENT e HEAD fonte intacto | CLI e ciclo de artefatos demonstrados sem rede real |
| Isolamento do produto | `tests/triage/verify.test.mjs:17–26`: report/identidade/checks exatos, flags/mount único/command/env fechado, nenhum socket/PID host/secret e remoção do container próprio | Contrato do subprocesso Docker verificado |
| Falha/timeout/limpeza/imagem | `tests/triage/verify.test.mjs:34–41`: failed/error_code sem output privado, rm próprio, digest exigido, CHECK_CLEANUP_FAILED | Nenhum relatório válido após erro de limpeza |
| Fingerprint sem body | `tests/triage/central.test.mjs:76–78`: v2/contexto da API correto; fingerprint divergente STALE e output vazio | Redução de outputs não enfraquece a origem |

| Testes / assertions | Requisito / critério | Necessário |
| --- | --- | --- |
| workflow:46–110 | TRI-01/04/07/11/12/13/15/17/20/22: integração, payloads e rotas | Sim |
| workflow:115–161 | TRI-01/04/05/17/19/22: workflow, runner e ciclo | Sim |
| verify:17–41 | TRI-17/18/22: contenção, relatório e falhas | Sim |
| central:76–78 e interface fechada | TRI-05/06/07: novo transporte bound, legados preservados | Sim |

Adequação: produto/Docker e GitHub em fixtures; CLI/Git/payloads/limpeza exercitados de verdade. Gates legados preservados e npm/syntax/lint incluem triagem sem Node na raiz. Nenhum teste documental ou meta de quantidade. Task 6: complete localmente; homologação Docker/GitHub/Codex real continua T8.

## T5: publicação recuperável

Premissa: publisher recebe snapshot recolhido, envelope/expected confiáveis e proposta recém-preparada no próprio processo; não recebe Git config nem executa produto. Arquivos: publish.mjs, publication-api.mjs, exportação read-only da proposta em prepare-patch.mjs, publish/publication-api.test.mjs e progresso TLC.

RED: módulo inexistente antes da implementação; testes adicionais reproduziram substituição do patch, keywords de fechamento e consulta filtrada que perderia PR com head editado. GREEN: gate Full em Node 22.23.3 e sintaxe passaram. API stateful e fetch simulado, sem token real/push/PR remoto.

Ruling: identidade de escrita consultada por GraphQL viewer (id/login); marcador mais digest detectam edição, mas não são assinatura de segurança. Reconsultar autoria/body/ref/base antes de atualizar e reconciliar timeout, sem alegar transação CAS. Piloto deve confirmar permissões/identidade da credencial escolhida.
Ruling: Git Data API envia blobs e árvore exatos da proposta própria; SHA da árvore remoto deve coincidir e commit tem um único pai da base. Nunca executar push/hooks/produto com a credencial de publicação. Base/ref divergente ou PR humano/editado falha, nunca force-push; uma proposta anterior incompatível exige intervenção.
Ruling: lista paginada de todos PRs (não apenas head atual) encontra o marcador mesmo após edição humana de branch. Custo: limite explícito de paginação; indisponibilidade não é ausência.

| Critério / AC | Evidência e assertion | Resultado |
| --- | --- | --- |
| Planejamento e recurso próprio | `tests/triage/publish.test.mjs:67–70`: planned/comment_id iguais, contexto/SDD/proposta/riscos/próximos passos/draft/summary/base presentes, writes somente comment e pulls vazio | Comentário útil sem PR duplicado |
| Intervenção sem patch | `tests/triage/publish.test.mjs:75–77`: needs-human/METADATA_INCOMPLETE e pulls vazio | Sem PR para informação/proposta insuficiente |
| PR e testes falhos | `tests/triage/publish.test.mjs:83–90`: draft-checks-failed, base/ref/SHA/draft/Refs/milestone/reviewer, link comentário e commit pai/fingerprint exatos | Falha rastreável, nunca aprovação/fechamento |
| Entrada e identidade divergentes | `tests/triage/publish.test.mjs:97–102,126–127,141`: rejects STALE/INVALID_RESULT/INVALID_TRIAGE_VERIFICATION/INVALID_TRIAGE_PATCH e writes vazio | Recusa antes de publicação |
| Recuperação parcial | `tests/triage/publish.test.mjs:108–110`: recursos únicos e criação uma vez após timeout de comment/ref/pull/milestone/review | Recuperação consulta estado, sem criação cega |
| Recursos humanos e erros | `tests/triage/publish.test.mjs:116–121,129–133`: body/ref humanos intactos, recurso com mesmo marcador mas autor humano preservado, erro/mensagem sanitizados | Sem sobreposição humana ou falso sucesso |
| Sem fechamento automático | `tests/triage/publish.test.mjs:138`: regex de fechamento #N false no body publicado | Summary não autoriza encerramento |
| Transporte Git exato | `tests/triage/publication-api.test.mjs:20–33`: identidade, blobs/base_tree/tree/parents/date/ref/draft e endpoint/auth/redirect exatos | Alteração publicada deriva da árvore validada |
| Paginação e falhas | `tests/triage/publication-api.test.mjs:44–63`: segunda página e PRs all sem head, ref ausente null, POST único, secrets/403 sanitizados, mismatch árvore sem commit | Ausência distinta de falha; sem retry de escrita |

| Testes / assertions | Requisito / critério | Necessário |
| --- | --- | --- |
| publish:67–77 | TRI-11/12/16/19: comentário ou intervenção, sem patch/duplicata | Sim |
| publish:83–110 | TRI-13/15/18/19/20/21: payload correto, bound e recuperação | Sim |
| publish:116–141 | TRI-13/15/19/20/22: proteção humana, fechamento e erro sanitizado | Sim |
| publication-api:20–63 | TRI-13/15/19/21/22: transporte real do contrato, paginação e falhas | Sim |

Adequação: asserts inspecionam estado persistido e payload Git real simulado; contagens somente comprovam ausência de duplicatas/retry junto do conteúdo. Convenções node:test/ESM e AD-003 preservadas; nenhum teste de documentação. Task 5: complete. Serialização e isolamento dos jobs serão conectados em T6.

## T4: preparação isolada

Premissa: preparar um commit local não publica nem executa verificações do produto. Arquivos: prepare-patch.mjs, patch.test.mjs e progresso TLC. T6 conecta o job separado de checks sem credenciais; essa integração não é alegada como concluída em T4.

RED observado por módulo inexistente antes da implementação; allowlist do ambiente também testada antes da extração do helper. GREEN: gate completo em Node 22.23.3 e sintaxe passaram. Nenhum teste removido/ignorado ou credencial real utilizada.

Ruling: clone local sem checkout/hardlinks e template vazio; árvore aceita somente blobs regulares antes de checkout, hooks/global/system config desativados e ambiente fechado — preserva a fonte e evita execução de produto. Custo: bases com symlinks/submódulos exigem intervenção humana no MVP.
Ruling: bundle diferencial de um commit com base como pré-requisito — entrega uma proposta transportável sem Git config ou história inteira. Publisher precisa validar identidade/hash novamente; checks não autorizam publicação por si só.

| Critério / AC | Evidência e assertion | Resultado |
| --- | --- | --- |
| Aplicação exata e fonte intacta | `tests/triage/patch.test.mjs:35–40`: conteúdo new/old, HEAD fonte/base e HEAD^ da proposta iguais ao source_sha | Proposta na base exata, fonte preservada |
| Bundle e limpeza | `tests/triage/patch.test.mjs:41–42`: bundle verify exit0, access(directory) rejeita ENOENT | Artefato Git verificável, temporários removidos |
| Recusa sem proposta | `tests/triage/patch.test.mjs:51–53`: rejects códigos sanitizados para empty/out-of-policy/protected/inaplicável/SHA/envelope; fonte old | Sem patch publicável para entrada inválida |
| Nenhuma execução de produto/credenciais | `tests/triage/patch.test.mjs:62–67`: chaves de env exatas, CODEX_AUTH_JSON undefined, texto literal e hook marker ENOENT | Env fechado e hooks ignorados; produto não executado |
| Symlinks/submódulos | `tests/triage/patch.test.mjs:78`: rejects INVALID_TRIAGE_PATCH após base com modos 120000/160000 | Recusa antes do checkout |

Mapeamento reverso: todos testes do componente protegem TRI-13/16/17, sem testes documentais. Adequação: efeitos reais de Git/conteúdo/ancestralidade/limpeza, não apenas número de comandos; integração do job de produto explicitamente pendente T6. Task 4: complete.

## T3: central compatível

Premissa: configuração/default Git SHA separado do SHA analisado; perfil triage explícito sem abrir origens legadas indiscriminadamente. Arquivos: preflight/request/orchestrate/result/run, workflow central, origem extraída em collect, adaptador de domínio invocation, testes centrais/triage e progresso TLC.

RED: nova integração falhou UNTRUSTED_CONTEXT no código legado; comportamento ausente confirmado antes da implementação. GREEN: suite completa em Node 22.23.3, syntax e actionlint 1.7.12 Windows passaram. Binário reacquirido e checksum zip validado porque scratch antigo foi removido externamente; exceções precisas pré-existentes mantidas. Nenhuma inferência/autenticação real.

Ruling: adapter de domínio em scripts/triage autoriza rota/contexto/base e não duplica o ciclo de auth; central mantém executor genérico — evita trazer regras SDD para o executor; custo: perfil precisa manter compatibilidade de adapter junto da revisão central.
Ruling: schemas v1/v2 discriminados, v2 derivado do schema fechado v1 com campo config_source_sha obrigatório — preserva callers existentes sem duplicar todos campos; custo: revisão deve avaliar alterações comuns para ambos formatos.
Ruling: assertion de interface fechada do workflow atualizada somente com os inputs/secret aprovados; guards legados de evento/SHA e v1 não foram enfraquecidos — evolução de contrato, não remoção de teste; custo: consumidores v2 precisam passar token de leitura próprio.

| AC / critério | Evidência e assertion | Resultado |
| --- | --- | --- |
| Modelo/prompt/diretrizes e fonte corretos | `tests/triage/central.test.mjs:59–69`: schema/source/config SHA, modelo/esforço/template/source_files e env/instruções exatos | V2 vinculado à fonte e configuração próprias |
| Forja/base/issue/config/token ausente | `tests/triage/central.test.mjs:83–85`: código/mensagem exatos, authUsed false, output vazio | Recusa antes de auth |
| SDD não retorna código | `tests/triage/central.test.mjs:93–94`: INVALID_RESULT/output vazio | Patch em plan recusado |
| Inspector/config SHA e legado | `tests/triage/central.test.mjs:99–107`: valida/recusa v2 spoof/downgrade, manual schema 1 sem campo novo | V1 preservado e v2 fechado |
| Persistência e token de leitura | `tests/triage/central.test.mjs:131–141`: AUTH_PERSIST_FAILED após PUT real simulado, output vazio/ENOENT; token em summary recusado | Sem resultado utilizável ou vazamento |
| Runner real e evento da plataforma | `tests/triage/central.test.mjs:170–179`: subprocesso bootstrap/source exit0, SHAs emitidos, somente state.json; payload diferente exit1 UNTRUSTED_CONTEXT | SHA Git/config e issue validados antes do checkout de análise |
| Workflow de checkouts e credenciais | `tests/triage/central.test.mjs:185–194`: manual default, refs exatas e zero sessão/PAT nas fases de metadata | Separação preservada |

Mapeamento reverso: asserts novos cobrem TRI-03/04/06/07/09/13/20/22 e critérios T3. Suite anterior continua no gate; sem testes de texto ou metas de contagem. Preload de rede é test-only e nunca faz fallback externo. Task 3: complete; integração local não substitui piloto GitHub/Codex real.

## T2: coleta

Premissa: configuração confiável escolhe fonte dos campos; metadata não vem do body. Arquivos: collect.mjs, api.mjs, config.schema.json/field_sources, collect.test.mjs e progresso TLC. Sucesso: consulta issue real, autor/ator autorizados, origem privada/default, metadata paginada, SHA de base/config separados e limites sem truncamento.

RED observado antes de collect.mjs existir. GREEN: testes do componente, suite completa em Node 22.23.3 e sintaxe passaram. Credenciais de LLM não foram utilizadas; transportes dos testes são fixtures.

Ruling: field_sources opcional por campo, default Project, permite usar Issue Fields sem confundi-los com Project — consulta real da issue mostrou Effort distinto nos dois lugares; fontes explícitas evitam downgrade silencioso; custo: consumidor precisa escolher fonte se preferir a organização.
Ruling: adapter read-only dedicado suporta queries paginadas/GraphQL que githubGet central não aceita — preserva endpoint fixo/prazo/erros sanitizados, sem retry automático de POST; custo: manter adapter testado em vez de ampliar implicitamente o helper de auth.

| AC / critério | Evidência e assertion | Resultado |
| --- | --- | --- |
| Origem/ator/issue fechada | `tests/triage/collect.test.mjs:74` assert.rejects UNTRUSTED_CONTEXT / STALE_TRIAGE_INPUT | Sem snapshot autorizado |
| Snapshot e duas revisões | `tests/triage/collect.test.mjs:40–49` issue/base/source/config SHA/route/proveniência/body exatos | Contexto da API e hashes separados |
| Entrada antiga | `tests/triage/collect.test.mjs:57,58,61` fingerprint muda com body/base | Nova análise distinguível |
| Insuficiência/ambiguidades | `tests/triage/collect.test.mjs:85–87` needs-human, complete false, erro privado ausente | Ausência não concede patch |
| Fonte issue explícita | `tests/triage/collect.test.mjs:94–96` Team + field_id/source/value exatos + plan | Fonte selecionada preservada |
| Limites bytes | `tests/triage/collect.test.mjs:101,104,105` tamanho íntegro / INVALID_TRIAGE_INPUT | Sem truncamento |
| Paginação e erros reais do adapter | `tests/triage/collect.test.mjs:117–123,130–133,154–157` blocker da segunda página, endpoint/auth/read-only, erro sanitizado, fields/values completos | Não ignorar segunda página nem dados GraphQL parciais |

Mapeamento reverso: esses asserts atendem TRI-01/02/03/05/08/09/11/14/20/22 e critérios T2; nenhum teste de documentação. Efeitos/snapshots são assertados, não somente contagem de requests. Task 2: complete; integração do coletor com auth/workflow ainda depende de T3/T6.

Plan: `.specs/features/issue-7-triagem-issues/tasks.md`. Spec/design/tasks aprovados em 2026-10-14; execução inline sequencial.

## Pre-flight

T1 produz policy/route/base candidatos para T2; T2 comprova origem/base e produz snapshot para T3/T5. T3 produz envelope v2 para T4/T7; T4 prepara patch para T5; T5 publica via API; T6 integra componentes e T7 entrega caller; T8 exige piloto real. Interfaces compatíveis no plano.

Ruling: progresso/rulings ficam no ledger TLC e STATE, não em documentação paralela superpowers — preserva o workflow TLC escolhido e a decisão de evitar documentação; custo se inadequado: adaptar tooling de extração sem alterar produto.
Ruling: documentação operacional adiada por solicitação em 2026-10-14; T7 mantém caller/config/prompts/inspector funcional — não remover componentes executáveis ao adiar prosa; custo: documentação de adoção futura ainda necessária.
Ruling: sinal explícito High/Team/MAJOR determina SDD mesmo quando outros metadados faltarem — TRI-09 é determinístico; não autoriza patch nem ignora informações faltantes no planejamento; custo: resumo pode exigir complemento humano.

## T1: política

Assumptions: policy pura não prova existência remota da branch; T2 deve comprová-la. Files: scripts/triage/policy.mjs, schemas/config.schema.json, tests/triage/policy.test.mjs e progresso TLC. Success: rota simples exige evidência completa/base; sinais SDD não podem ser burlados; configuração/path/base inválidos recusados sem ecoar valores.

RED: teste escrito antes de policy.mjs; falha observada por componente inexistente. Dependências centrais instaladas pelo lockfile com scripts desativados, sem usar credencial LLM.

GREEN: Quick passou; suite completa central+triagem passou em Node 22.23.3, sintaxe e validate_tasks passaram. Nenhum teste eliminado/ignorado, nenhuma credencial real de LLM utilizada.

| Critério / AC | Evidência e assertion | Resultado especificado |
| --- | --- | --- |
| Config fechada/path/base/limite | `tests/triage/policy.test.mjs:18,25,28`: deepEqual do config e throws INVALID_TRIAGE_CONFIG | Config próprio preservado, inválidos recusados |
| SDD obrigatório | `tests/triage/policy.test.mjs:34,57`: deepEqual plan/SDD_REQUIRED | High/Team/MAJOR não autorizam patch |
| Caso simples e blockers | `tests/triage/policy.test.mjs:41,43,44`: rota exata e blockers open/closed | Patch somente com evidência simples; blocker aberto planeja |
| Insuficiência/contradição/base desconhecida | `tests/triage/policy.test.mjs:51,53`: needs-human exato | Sem autorização de patch |
| Base não vem do body | `tests/triage/policy.test.mjs:63,65–67`: release/stack/null exatos | Somente milestone ou config confiável |

Mapeamento reverso: todos asserts de policy.test.mjs atendem critérios T1 e TRI-05/09/10/11/14; nenhum teste de prosa ou regra externa à spec. Adequação: asserts medem configuração/rota/base, não mocks; consulta remota fica explicitamente em T2. Task 1: complete, gate Node22 e Quick green; registrar no commit atômico T1.
