# Code review reutilizável Design

**Spec:** spec.md, aprovada em 2026-10-15. **Status:** Approved pelo mantenedor em 2026-10-15.

## Architecture Overview

O code review é um workflow de domínio que chama a central existente. Coleta, inferência, checks e publicação continuam separados. Nenhuma autenticação ou configuração particular do demo-repository é adicionada ao central.

```text
issue → caller de triagem → central LLM → PR draft
                                          ↓
                      job explícito de dispatch (sem sessão LLM)
                                          ↓ nova execução na default
PR humano → bridge de evento → dispatch → caller de review
                                          ↓
              coleta → central LLM → checks isolados → comentário / PR complementar
```

### Abordagens avaliadas

| Abordagem | Trade-off | Escolha |
| --- | --- | --- |
| Dispatch explícito, com review em novo run na default | Exige validar origem/handoff e recuperar dispatch ambíguo; lê a sessão após a triagem | Recomendada, concretiza o encadeamento aprovado |
| Chamada aninhada de review no mesmo run da triagem | Menos transporte, mas repository secrets já foram capturadas quando o run entrou na fila | Rejeitada: renovação na triagem tornaria a cópia do review antiga |
| Depender só do evento implícito do PR | Menos código no caller, mas PR criado com GITHUB_TOKEN pode exigir aprovação para iniciar os runs | Rejeitada para o piloto automático |

O job explícito aprovado na spec realiza dispatch, não repassa a sessão da triagem ao review. Isso preserva REV-17 e a política de sessão: repository secrets são lidas ao enfileirar o run, não a cada job. Uma execução nova que ainda capturar sessão obsoleta será recusada pelo guard atual; não enfraquecer esse guard para fazer o piloto passar.

### Entrada e confiança

- Caller de review possui `workflow_dispatch` na branch padrão, com número do PR e identificadores opcionais de handoff. Sua revisão confiável é verificada pela API antes de ler configuração e antes de autenticar a LLM.
- Para PR humano, um bridge curto atende opened/reopened/synchronize via evento do PR e solicita dispatch na default. Não faz checkout do head, não recebe sessão, PAT de Secrets ou token de publicação. Recebe somente token necessário a leitura/dispatch; não interpola body/title/ref em shell.
- Para PR da triagem, job posterior ao called bem-sucedido faz o mesmo dispatch, passando PR, run/attempt e fingerprint, nunca body ou credencial. Reconsultar os recursos reais e comprovar a publicação própria; um número de PR ou marcador isolado não autoriza inferência.
- O dispatch valida operador humano com write/maintain/admin. Para acionamento da própria automação, usa identidade de serviço explicitamente autorizada pelo consumidor e evidência API da execução de origem, PR e publicação concluída. Não aceitar todo actor com sufixo bot; não exigir que o run-pai inteiro tenha terminado enquanto o job de dispatch ainda está em execução.
- Bridge nunca é fonte de configuração privilegiada: o workflow de review só carrega a default. Forks e branches desconhecidas não ganham acesso por fornecerem um número de PR. Config e código central são carregados de SHAs confiáveis fixados.

## Code Reuse Analysis

| Componente | Local atual | Uso no review |
| --- | --- | --- |
| Execução/config/prompts | `scripts/llm/execute.mjs`, `validate-request.mjs` | Estender por perfil explícito; preservar single/decision-then-prompt e modelos do caller |
| Sessão/freshness/persistência | `scripts/llm/auth.mjs`, `check-session-freshness.mjs`, `persist-session.mjs` | Reusar integralmente; mesma fila por repo/nome de secret |
| Diretrizes completas e hashes | `scripts/llm/instructions.mjs` | Global genérico mais AGENTS do SHA confiável do consumidor |
| Patch Git isolado | `scripts/triage/prepare-patch.mjs` | Extrair somente o núcleo neutro necessário; adapters de triagem/review validam seus próprios contratos |
| Container de checks | `scripts/triage/verify-product.mjs` | Reusar imagem por digest, limites, ambiente fechado e relatório bound ao patch |
| Transporte GitHub | `scripts/triage/api.mjs`, `publication-api.mjs` | Compartilhar apenas transporte/validação de baixo nível que realmente se repetir; policy e ownership continuam no domínio |
| Recuperação e ownership | `scripts/triage/publish.mjs` | Reusar padrão de reconsulta/autoria/integridade; não chamar publisher de issue fingindo um snapshot de review |
| Testes/CI/caller | `tests/llm`, `tests/triage`, `examples/callers/triage` | Gates legados e estilo node:test; estender descoberta e entregar caller genérico, sem defaults do piloto |

Não acrescentar dependências de runtime se Node/Git/Ajv existentes resolverem o contrato. Não duplicar login, fila de sessão ou executor Codex.

## Components

### Política e diff

`scripts/review/policy.mjs` e `diff.mjs`: schema fechado de configuração, classificação review-only/correction e índice de linhas adicionadas. `validateReviewConfig(config)`, `classifyPull(pr, config)` e `buildDiffIndex(diff)` não consultam LLM.

Config confiável define reviewer, identidades de automação autorizadas, prefixes de branches corrigíveis, branches protegidas, allowlist de arquivos, comandos de checks e paths das configs LLM. Release/develop/master e branches de complemento nunca são corrigíveis. Head desconhecido recebe somente achados. Os valores concretos pertencem ao consumidor.

### Coleta

`scripts/review/collect.mjs` e `api.mjs`: `collectReview({event, configRoot, inputs}, api)` produz snapshot e fingerprint. API consulta repo, default SHA, PR aberto, autoria/permissões, head/base SHA e handoff quando presente. Git consulta objetos de head/base com ambiente fechado, sem textconv, external diff, hooks ou execução de produto; resolve merge-base e diff completo. Conferir identidades antes/depois da coleta.

Limites: body 16 KiB, diff 16 KiB, 100 arquivos, contexto 32 KiB. Binário, patch ausente/incompleto, limite excedido ou objeto indisponível produzem `needs-human/REVIEW_INCONCLUSIVE`, sem LLM para uma revisão parcial silenciosa. Renomes/deleções textuais podem ser analisados; correção no MVP fica restrita a arquivos regulares presentes no head e dentro do diff/allowlist.

### Adaptador da central

`scripts/review/invocation.mjs` resolve um novo `caller_profile: review`. Inputs fechados incluem PR, caminho de config do domínio, fingerprint e head esperado; defaults manual/triage permanecem iguais. A central recompõe o contexto pela API; não confia em JSON fornecido pelo bridge ou pela LLM.

Executor adiciona contrato explícito de resultado `review`, validado pela automação, não um schema arbitrário do caller. Modelo recebe diff, metadados e apenas os arquivos necessários da revisão em snapshot read-only limitado; nenhuma descoberta de configuração, ferramentas ou scripts do head. O limite de snapshot existente permanece; excesso gera inconclusivo antes da autenticação, não fallback para uma análise truncada.

### Resultado

`scripts/review/result.mjs`: `validateReviewResult(result, snapshot)` valida achados, escopo do patch e identidade. Introduzir envelope review v3 opt-in, preservando v1/v2 byte/semanticamente conforme seus contratos. Não adicionar campos de review aos schemas fechados antigos.

Payload da LLM: `{summary, findings, patch}`, com até 20 achados `{severity, path, line, message}`; severity critical/warning/suggestion, line inteiro positivo existente no conjunto de linhas adicionadas do diff; message não vazia até 2000 caracteres. Summary até 4000. O conteúdo não pode incluir credenciais do processo.

Pacote review: `result.json`, `review.json` e opcional `proposal.patch`; limite agregado 1 MiB, lista fechada. Envelope v3 contém identidade central completa, `config_source_sha`, `pull_number`, `base_sha`, `merge_base_sha`, `review_fingerprint` e hash de review.json. `source_sha` é o head SHA; run/attempt/invocation/automation e hashes vêm da execução confiável, nunca da LLM. Inspector revalida identidade esperada, hash do sidecar e referências ao diff antes de consumir.

### Preparação e publicação

`scripts/review/prepare-patch.mjs`: restringe patch à interseção diff/allowlist, valida v3 e prepara commit filho do head pelo núcleo Git isolado. Não converter v3 em envelope v2 artificial para enganar guards da triagem. Relatório de checks vincula head/config/patch; publisher reconstrói patch original em workspace próprio e nunca usa árvore que executou checks.

`scripts/review/publish.mjs`: `publishReview({snapshot,result,prepared,verification,config}, api)` reconsulta PR/config/head/base e autoria antes de cada escrita relevante. Publica comentário automático e, quando elegível, PR draft em `feature/review-pr-<N>-<head curto>` para a branch head original. Não atualiza head original, não pede aprovação nativa, não contém keywords de fechamento e não altera Project.

Chave idempotente inclui repo/PR/head/base/config/automation/fingerprint; recurso próprio exige autor id/login e integridade do conteúdo. SHA curto só nomeia branch, não prova identidade. Correção existente deve ter pai, árvore e marcadores completos correspondentes. Divergência ou edição humana retorna conflito; erro de criação ambíguo consulta recurso antes de repetir. PR complementar do review comprovado não gera outra correção. PR da triagem não é excluído por ser bot/draft.

### Workflow e caller

`.github/workflows/pr-code-review.yml` separa coleta, central, checks, publisher e finish/cleanup. Permissões e secrets são explícitos; nada de inherit. Checks não recebem tokens de escrita/LLM. Serialização de publicação ocorre só no workflow de review por repo/PR; fila de sessão fica somente no job central, com a mesma chave já usada pela triagem e sem cancel-in-progress. Não reutilizar chave de concorrência entre pai e filho para evitar deadlock.

`examples/callers/review/` fornece caller/bridge/config/prompts/inspector com placeholders genéricos e pins reais. O caller integrado acrescenta dispatch depois da triagem com `actions: write` apenas naquele job. Nenhuma configuração particular do demo-repository será incorporada aqui; sua adoção será feita nele quando autorizada.

Dispatch é pelo menos uma vez: em timeout, consultar runs com identidade/handoff exatos quando possível; nunca buscar o último run como prova. Duplicata que ainda ocorrer deve convergir no guard/idempotência de publicação. Falha ao acionar review fica explícita e recuperável por novo dispatch; não marca o conjunto homologado só porque a triagem terminou.

Detalhamento T10: o helper usa config confiável na default, prova de finish da triagem e operador autorizado antes de criar outro run. A permissão especial de validar o próprio run existe somente nesse helper pré-dispatch; o coletor da LLM continua recusando self-run. Bridge roda em pull_request_target com código fixado e configuração da default, nunca checkout/execução do head. Seu token de dispatch precisa de identidade com write verificável pelo coletor (por exemplo, PAT restrito de uma conta colaboradora); não presumir que todo bot é colaborador. Para PR próprio da triagem, a identidade API id/login configurada e a prova de publicação permitem o token de dispatch correspondente à sua autoria. Nenhum token de sessão ou Secrets-write PAT entra no bridge.

O caller de destino define run-name `review:<PR>:<dispatch_id>` e aceita somente PR, expected_head_sha, review_handoff_json e dispatch_id como entradas de contexto. A correlação inclui repo/PR/head/base/config/workflow/run de origem/attempt/handoff; não é uma autorização e não substitui a revalidação antes de auth na central. A API 2026-03-10 devolve workflow_run_id em resposta 200; o helper confere o run pela API. Timeout recupera correlação exata e autoria, nunca o run mais recente. Uma execução exata já reprovada não gera outro POST com a mesma identidade; novo dispatch manual/run de origem ou attempt explícito produz a nova tentativa. A consulta é limitada e falha se não conseguir percorrer o conjunto inteiro.

Granularidade: T10 entrega helper/runner antes do caller T8 para permitir pin Git imutável real sem autorreferência a um commit que ainda não existe. O contrato opcional expected_head_sha também é revalidado no bootstrap/coletor do called; mudança de head entre dispatch e início falha antes de LLM.

## Data Models

| Modelo | Campos relevantes e invariantes |
| --- | --- |
| ReviewSnapshot | repo, PR, autor, head_ref/head_sha, base_ref/base_sha, merge_base_sha, config_source_sha, diff/line index, route, handoff, fingerprint |
| DispatchHandoff | PR, expected_head_sha, source_run_id/attempt, source_fingerprint; apenas referência, conferida na API |
| ReviewResult | summary, findings e patch validados; sem proveniência autorizada pelo modelo |
| ReviewEnvelope v3 | Identidade de execução + snapshot + hash do sidecar; versões antigas preservadas |
| Prepared/Verification | Proposta própria em memória e relatório vinculado ao SHA/hash; metadados serializados não concedem authority |

## Error Handling Strategy

| Situação | Resultado |
| --- | --- |
| Origem/handoff/configuração não confiáveis | UNTRUSTED_CONTEXT, antes de auth |
| Diff incompleto/excesso/binário | REVIEW_INCONCLUSIVE, intervenção sem falsa revisão completa |
| Achado/sidecar/patch/identidade inválidos | INVALID_RESULT, sem publicação da proposta |
| PR/config/head/base alterados | STALE_REVIEW_INPUT, nova execução necessária |
| Recurso humano ou proposta divergente | REVIEW_RESOURCE_CONFLICT, sem sobrescrever |
| API/provider/persistência/limpeza falhos | Falha sanitizada; sem resultado utilizável |
| Checks falhos | PR draft-checks-failed com evidência, nunca aprovação |

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Secret capturada antes de renovação em job anterior | `scripts/llm/check-session-freshness.mjs:11` | Review do mesmo run pode usar cópia antiga | Novo run por dispatch depois da persistência; guard de freshness preservado |
| Central só aceita perfis e schemas legados | `scripts/llm/validate-request.mjs:18`, `execute.mjs:11`, `result.mjs:65` | Review não funciona por mera mudança de prompt | Perfil/contrato review explícitos e v3 opt-in, regressão v1/v2 |
| Núcleo de patch conhece policy da triagem | `scripts/triage/prepare-patch.mjs:43` | Reuso direto exigiria fingir identidade de domínio | Extrair somente operação Git neutra, adapters preservam validação |
| Writer limita branch à triagem | `scripts/triage/publication-api.mjs:7` | Nome de correção não permitido | Transporte compartilhado limitado a refs permitidas pelos adapters; testes antigos preservados |
| Autoria ou marcador isolados não provam handoff | `scripts/triage/publish.mjs:55` | Bot forjado ou PR estranho pode consumir sessão | Cruzar API/run/job/publicação/SHAs e identidades configuradas, antes de auth |
| Runs implícitos duplicam dispatch | Caller/bridge novos | Publicação duplicada e consumo de LLM | Guard por identidade exata e publicação idempotente; não ignorar todos os bots |
| API não fornece leitura transacional | Publicação | PR pode mudar entre consulta e escrita | Reconsultas, refs próprias sem force-push e resultado rastreável; não alegar atomicidade |
| Docker e sessão reais não homologados | Piloto T8 da triagem | Fixtures não provam isolamento/renovação real | Homologação conjunta obrigatória com evidências reais e Verifier |

## Tech Decisions

- Implementação sequencial neste worktree; nenhuma implementação paralela, push ou merge remoto nesta fase.
- Não enfraquecer os testes existentes para acomodar o novo perfil. Testes adicionais cobrem identidades, achados, falta de autorização, recuperação, encadeamento e isolamento; sem piso quantitativo ou testes de prosa.
- Piloto real continua requisito de entrega das três pipelines. Não transferir novamente sua conclusão para uma futura issue.

## Fontes

Código e constituição locais; spec/context aprovados. Context7 indisponível nesta sessão; fallback em documentação oficial:

- [Secrets reference](https://docs.github.com/en/actions/reference/security/secrets), leitura ao enfileirar o workflow, consultado em 2026-10-15.
- [Trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), dispatch e eventos produzidos por GITHUB_TOKEN, consultado em 2026-10-15.

Design aprovado pelo mantenedor em 2026-10-15. As tarefas serão revisadas antes da implementação, conforme TLC. Nenhuma capacidade descrita como nova já está implementada.
