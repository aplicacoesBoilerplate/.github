# Code review reutilizável Implementation Plan

**Goal:** Entregar review pela central e homologar #9/#7/#8 juntas no consumidor privado, sem configurações particulares na central.
**Architecture:** caller confiável → coleta → central LLM → checks isolados → publicação recuperável. Triagem aciona review por dispatch de novo run após persistência da sessão.
**Tech Stack:** Node 22.23.3, ESM/node:test, Git, Ajv e dependências fixadas existentes; GitHub Actions e container por digest do consumidor.
**Spec:** spec.md. **Design:** design.md, aprovado em 2026-10-15. **Status:** In Progress; plano aprovado e implementação sequencial autorizada em 2026-10-15. T1–T7 e T10 concluídas localmente; T8 fixa esse helper já commitado no caller. Refinamento de granularidade, sem novos requisitos.

## Execution Protocol

Usar `tlc-spec-driven` e execução sequencial pelo agente principal neste worktree, conforme escolha já expressa pelo mantenedor. Dez commits coesos em três fases; T10 separa o helper originalmente incluído em T8 para que o caller possa apontar para um SHA real contendo o código. Não abrir execução paralela nem delegar implementação. Verifier TLC independente ao entregar código local e após o piloto, com sensor em scratch isolado. Nenhuma meta quantitativa de testes, testes de prosa ou manual extenso.

Cada tarefa segue: escrever teste contratual e observar RED; implementar o componente; executar o gate e revisar adequação; marcar progresso/traceability e criar um commit local atômico. Nunca enfraquecer assertions, remover testes ou usar fixtures como prova de homologação. Ferramentas: apply_patch, Node, Git local e scripts TLC; cicd para workflows; github-planning/permissões para operações remotas autorizadas. Context7 quando disponível; documentação oficial como fallback documentado.

## Global Constraints

- Consumidor privado não fork; configuração e instruções do SHA confiável da default, código do head como dado.
- Config 32 KiB; body 16 KiB; diff 16 KiB e até 100 arquivos; contexto 32 KiB; resultado agregado 1 MiB; outputs 8 KiB; retenção 1 dia.
- Até 20 achados critical/warning/suggestion em linhas adicionadas do diff; message até 2000 caracteres e summary até 4000.
- Callers escolhem credenciais, modalidade, modelos, esforço, prompts, branches, Project e checks. Nenhum valor particular do demo-repository em código/config executável central.
- Nenhuma aprovação, merge, fechamento automático, push direto no head original, Sonar pré-merge ou transição automática no Project.
- v1/v2 e callers existentes preservados; review v3 explícito. Sem harness ou nova identidade central.
- Código do produto só executa no job/container de checks, sem secrets/rede/socket/mounts da automação.
- Aprovação do plano permite execução e commits locais; push/ativação/execução real e sessão dedicada continuam exigindo autorização e provisionamento específicos.

## Review Focus

| Falha relevante | Tarefa e prova |
| --- | --- |
| PR da triagem ignorado como qualquer bot | T2/T8: handoff próprio válido aceito, complementar de review interrompe recursão |
| Review herdar sessão antiga da triagem | T8: dispatch posterior à persistência cria novo run; guard de freshness não é alterado |
| Achado plausível em linha não adicionada | T1/T3: índice do diff e validação rejeitam linha/arquivo inventados |
| Patch ou PR alterado após análise | T5/T6: parent/tree/hash e snapshot atual conferidos, escrita recusada sem force-push |
| Timeout duplicar publicação ou dispatch | T6/T8: recuperação consulta identidade exata; runs duplicados convergem sem sobrescrever recursos humanos |

## Test Coverage Matrix

Gerada da constituição `.specify/memory/constitution.md`, decisões AD-003/004 de STATE e orientação explícita do mantenedor. Estilo inferido de `tests/triage/{policy,central,publish,caller}.test.mjs` e `tests/llm/persistence.test.mjs`; comandos de `scripts/llm/package.json`, check.mjs e lint-workflow.mjs. Profundidade protege os requisitos e falhas relevantes, não uma quantidade de casos.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Política/diff/achados | unit | Rotas, limites e referência ao diff; não aceitar informação inventada | `tests/review/{policy,result}.test.mjs` | Quick por componente |
| Coleta/central/publicação | integration | Origem, SHAs, modelo/prompt, recusa, estado publicado e recuperação | `tests/review/*.test.mjs` e centrais afetados | Full |
| Git/checks/workflow/caller | integration/contract | Efeitos reais locais, isolamento e consumo; simuladores somente para serviços externos | `tests/review/{patch,workflow,caller}.test.mjs` | Full + Build |
| Instruções operacionais | revisão manual | Inputs/secrets/pins/recuperação completos no caller, sem testar prosa | `examples/callers/review/` | Revisão junto do contrato executável |
| Piloto conjunto | e2e real | REV-22/23 e TRI-24/25; cenários reais e evidência sanitizada | Evidência local `pilot.md` da feature | Caller real no consumidor autorizado |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | T1/T3 | `node --test tests/review/policy.test.mjs` ou `node --test tests/review/result.test.mjs`; `node --check` nos módulos alterados |
| Full | T2–T8 | `node --test tests/llm/*.test.mjs tests/triage/*.test.mjs tests/review/*.test.mjs`, também em Node 22.23.3 |
| Build | T4/T7/T8 | Full + `npm --prefix scripts/llm run check` e `npm --prefix scripts/llm run lint:workflow`; T7 inclui discovery de review/shared nos scripts existentes |
| Pilot | T9 | Runs reais identificados + revisão independente; nenhuma fixture substitui evidência |

Lint: script existente requer Linux amd64. No Windows, executar actionlint 1.7.12 fixado/verificado diretamente; mesmas exceções pontuais de queue e job.workflow_repository/workflow_sha, sem ampliar regex para esconder defeitos. A extensão de discovery/CI só é alegada pronta em T7.

## Execution Plan

Implementação estritamente sequencial. Fases são fronteiras de coesão, não agentes paralelos.

```text
Phase 1: T1 → T2 → T3
Phase 2: T4 → T5 → T6
Phase 3: T7 → T10 → T8 → T9

Transição Phase 1 → Phase 2: T3 → T4
Transição Phase 2 → Phase 3: T6 → T7
```

## Task Breakdown

### T1: Política e índice confiável do diff

**What:** Validar configuração de review e classificar correção/achados com referências verificáveis.
**Where:** `scripts/review/policy.mjs`
**Supporting files:** `diff.mjs`, schema fechado de config e `tests/review/policy.test.mjs`.
**Depends on:** None
**Reuses:** Ajv e validação de paths existentes.
**Requirement:** REV-05, REV-07, REV-11, REV-16, REV-19
**Interfaces:** `validateReviewConfig(config)` → policy; `classifyPull(pr, config)` → review-only/correction/skip-correction; `buildDiffIndex(diff)` → arquivos e linhas adicionadas válidas.
**Done when:**
- [x] Config inválida/paths inseguros recusados; integração e complementar nunca autorizam correção.
- [x] Diff completo indexa linhas RIGHT adicionadas; arquivo/linha fora do índice não é válido.
- [x] Limites textuais/arquivos e formato incompleto são distinguíveis de diff vazio válido.
**Tests:** unit; config e linhas exatas, integração/feature/complementar, limites e diff inválido.
**Gate:** Quick
**Commit:** `feat(review): validate review policy and diff references refs #8`

### T2: Coleta de PR e handoff pela API

**What:** Produzir snapshot confiável e fingerprint antes da autenticação LLM.
**Where:** `scripts/review/collect.mjs`
**Supporting files:** `api.mjs`, coleta Git segura, fixtures e `tests/review/collect.test.mjs`.
**Depends on:** T1
**Reuses:** Transporte limitado de leitura, padrão de coleta da triagem e ambiente Git fechado.
**Requirement:** REV-01, REV-02, REV-03, REV-05, REV-06, REV-17, REV-19, REV-24, REV-26
**Interfaces:** `verifyReviewOrigin(event, api)` → metadata de bootstrap; `collectReview({event, configRoot, sourceRoot, inputs}, api)` → snapshot/fingerprint ou inconclusivo; head/base/merge-base/config separados. sourceRoot contém os objetos Git da comparação, sem scripts de produto executados.
**Done when:**
- [x] Privacidade, origem, operador/autoria, default, PR e SHAs são consultados, não derivados do body.
- [x] Handoff de triagem confere run/attempt, publicação concluída e PR próprio; marker/bot/número isolados não autorizam LLM.
- [x] Coleta completa respeita limites; mudanças durante a coleta são detectadas; nenhuma credencial LLM necessária.
**Tests:** integration; snapshot exato, API incompleta/403, fork/público/identidade não autorizada, handoff forjado e PR antigo recusados antes de auth.
**Gate:** Full
**Commit:** `feat(review): collect trusted pull request context refs #8`

### T3: Resultado estruturado e envelope review v3

**What:** Validar achados e empacotar resultado vinculado ao snapshot sem mudar v1/v2.
**Where:** `scripts/review/result.mjs`
**Supporting files:** Schema v3/sidecar, integração explícita com result.mjs central e `tests/review/result.test.mjs`.
**Depends on:** T2
**Reuses:** validatePatch, identidades/hashes e limites centrais, sem downgrade artificial de envelope.
**Requirement:** REV-06, REV-07, REV-08, REV-09, REV-26
**Interfaces:** `validateReviewResult(result, snapshot)`; `packageReviewResult(result, provenance, snapshot, outputRoot)` → envelope v3, review.json/hash e patch opcional.
**Done when:**
- [x] Achados respeitam severidade/limites/linha adicionada; invalidade recusa o resultado inteiro.
- [x] Proveniência deriva do snapshot confiável, sidecar tem hash e lista de arquivos fechada.
- [x] Pacote agregado ≤1 MiB; dados sensíveis não saem; formatos antigos continuam válidos e fechados.
**Tests:** unit/integration; achado correto, linha inventada, hash adulterado, identidade de outro run/attempt/repo/PR e v1/v2 preservados.
**Gate:** Quick + Full
**Commit:** `feat(review): package validated review findings refs #8`

### T4: Perfil de review na central LLM

**What:** Conectar coleta e contrato review ao ciclo de inferência existente.
**Where:** `scripts/review/invocation.mjs`
**Supporting files:** source.mjs para blobs limitados pré-auth, preflight/validate-request/execute/orchestrate/run centrais, interface llm-execute.yml, testes centrais afetados e `tests/review/central.test.mjs` com fixtures CLI/API.
**Depends on:** T3
**Reuses:** Login temporário, freshness, persistência, fila de sessão, diretrizes e executor existentes.
**Requirement:** REV-02, REV-03, REV-04, REV-05, REV-06, REV-08, REV-20, REV-26
**Interfaces:** `resolveReviewInvocation(...)` → request/context/snapshot confiáveis; `caller_profile: review` opt-in com PR/config/fingerprint/head esperado; defaults antigos intactos.
**Done when:**
- [x] Contexto é refeito pela API; checked-out/config/head devem corresponder ao snapshot.
- [x] Modelo/esforço/prompt próprios chegam à invocação; snapshot limitado só envia arquivos necessários como dados.
- [x] Guard de sessão e limpeza mantidos; falha de persistência não produz v3 utilizável; perfil antigo não aceita inputs review.
**Tests:** integration; execução CLI simulada verifica argumentos/prompt exatos, legado continua, forja/excesso/secret ausente falham antes de auth e erro de persistência não publica resultado.
**Gate:** Full + Build do workflow central afetado
**Commit:** `feat(llm): support trusted code review invocations refs #8`

### T5: Preparação isolada da correção de review

**What:** Preparar patch no head analisado sem alterar a fonte e reutilizando o núcleo Git seguro.
**Where:** `scripts/review/prepare-patch.mjs`
**Supporting files:** Extração mínima `scripts/shared/prepare-patch.mjs`, adapter triage preservado e `tests/review/patch.test.mjs`.
**Depends on:** T4
**Reuses:** Clone/árvore/commit/bundle, ownership em memória e limpeza da preparação triage.
**Requirement:** REV-11, REV-12, REV-13, REV-14, REV-16, REV-24
**Interfaces:** `prepareReviewPatch({snapshot,envelope,expected,patch,sourceRoot,config})` → proposta própria; núcleo shared recebe somente operação Git já autorizada pelos adapters.
**Done when:**
- [x] Patch limitado ao diff e allowlist; paths sensíveis, symlinks/submódulos e base diferente recusados.
- [x] Commit preparado tem pai head exato; fonte intacta; sem hooks/produto/credenciais.
- [x] Adapter da triagem mantém suas recusas e contrato v2; review não finge envelope de triagem.
**Tests:** integration com Git real temporário; conteúdo/pai/árvore/fonte/limpeza, patch fora do diff ou aplicável só em outra base recusados; testes triage preservados.
**Gate:** Full
**Commit:** `feat(review): prepare isolated corrective proposals refs #8`

### T6: Publicação recuperável de achados e PR complementar

**What:** Publicar somente resultado atual, preservando intervenção humana e recuperando escritas parciais.
**Where:** `scripts/review/publish.mjs`
**Supporting files:** Adapter publication-api e extração mínima de transporte se necessário; `tests/review/publish.test.mjs` e fixture stateful.
**Depends on:** T5
**Reuses:** Padrão de ownership/integridade/reconsulta, Git Data API e verifyProduct existentes.
**Requirement:** REV-09, REV-10, REV-14, REV-15, REV-16, REV-18, REV-19, REV-24, REV-25, REV-26
**Interfaces:** `publishReview({snapshot,result,prepared,verification,config}, api)` → comentário/PR/status explícitos.
**Done when:**
- [x] Comentário distingue críticos/sugestões/nenhum achado e registra SHA; nunca cria aprovação nativa/merge/fechamento.
- [x] Complementar draft aponta para head_ref original e deriva de head_sha; falha nos checks é explícita; integração só comenta.
- [x] Reexecução/timeouts recuperam somente recursos próprios íntegros; entrada antiga e edição humana impedem escrita destrutiva.
**Tests:** integration stateful; inspecionar body/ref/parent/tree/draft/checks, mesma identidade sem duplicata, erros ambíguos, PR alterado e recurso humano preservado.
**Gate:** Full
**Commit:** `feat(review): publish recoverable findings and correction PRs refs #8`

### T7: Workflow reutilizável e gate de CI

**What:** Entregar entry point executável com isolamento de jobs e resultado final explícito.
**Where:** `.github/workflows/pr-code-review.yml`
**Supporting files:** `scripts/review/{run,workflow}.mjs`, testes workflow e discovery review/shared em npm/check/lint/ci.
**Depends on:** T6
**Reuses:** Estrutura collect/invoke/check/publish/finish, pins e Node existentes.
**Requirement:** REV-01, REV-04, REV-13, REV-15, REV-20, REV-26
**Interfaces:** workflow_call com config_path, PR/handoff, modalidade/secrets e verification_image por digest; outputs status/PR/SHA/artefato limitados.
**Done when:**
- [x] Jobs separam metadata, sessão e escrita; checks usam container sem rede/secrets/socket/mounts do central.
- [x] Serialização por PR e chave de sessão compartilhada não se cancelam nem criam deadlock pai/filho.
- [x] Upload/cleanup/publicação falhos impedem sucesso; CI descobre testes/scripts/YAML novos sem quebrar descoberta antiga.
**Tests:** integration/contract; runner real com serviços simulados chega a comentário/complementar; assertions de env/outputs/status e falhas de cada fronteira, sem execução de produto em publisher.
**Gate:** Full + Build
**Commit:** `feat(review): expose reusable workflow and CI gates refs #8`

### T10: Helper de dispatch confiável com revisão fixável

**What:** Extrair do escopo original T8 o helper central de dispatch e sua validação, permitindo que o caller T8 fixe um commit real já contendo o helper.
**Where:** `scripts/review/dispatch.mjs`
**Supporting files:** Transporte/runner de dispatch, reuso explícito da prova de publicação em collect.mjs e testes/fixtures de dispatch.
**Depends on:** T7
**Reuses:** Metadata API e provas de autoria/run/job/commit da coleta de review, sem duplicar autenticação de LLM.
**Requirement:** REV-01, REV-02, REV-17, REV-18, REV-19, REV-20, REV-26
**Done when:**
- [x] Origem humana ou publicação própria da triagem conferida antes de dispatch na default; complementar comprovado não reinicia correções.
- [x] Somente PR/head/handoff e correlação entram no novo run, sem sessão, body ou configuração de modelo global.
- [x] Timeout consulta identidade exata e não repete POST cegamente; falhas são explícitas e sanitizadas.
**Tests:** integration/contract com serviços simulados; prova de finish/source-run, guard central preservado, payload, recuperação e recusas.
**Gate:** Full + Build
**Commit:** `feat(review): add trusted consumer dispatch helper refs #8`

### T8: Caller integrado e inspector

**What:** Entregar adoção copiável que encadeia triagem e review sem propagar sessão antiga.
**Where:** `examples/callers/review/`
**Supporting files:** `tests/review/caller.test.mjs`; exemplo integrado de triagem referencia a revisão central fixa correspondente, incluindo helper entregue em T10.
**Depends on:** T10
**Reuses:** Caller triage, inspector de identidade independente, contrato de review e endpoint de dispatch.
**Requirement:** REV-01, REV-02, REV-06, REV-17, REV-18, REV-19, REV-20, REV-21, REV-26
**Interfaces:** `dispatchReview({pull, expected_head_sha, handoff, target}, api)` → disparado/recuperado ou falha explícita; inspector read-only recebe identidades esperadas independentes do artefato.
**Done when:**
- [ ] Dispatch ocorre depois de triagem/persistência bem-sucedidas; novo run carrega sessão atual, sem passar auth ou body em inputs.
- [ ] Bridge de PR e handoff conferem origem; PR da triagem é aceito e complementar do review não cria recursão.
- [ ] Configurações de exemplo são genéricas; caller tem secrets explícitos, pins reais e instruções completas, sem valores particulares do demo.
- [ ] Inspector recusa outro run/attempt/repo/PR/head/config/sidecar e nunca aplica patch ou aprova PR.
**Tests:** integration/contract; simular caller→triagem→dispatch→review com sessão alterada entre runs, argumentos/modelo/prompt próprios, falta de auth, dispatch ambíguo e consumo de resultado correto/divergente.
**Gate:** Full + Build + Verifier TLC independente local
**Commit:** `feat(review): deliver integrated consumer caller refs #8`

### T9: Piloto real do conjunto

**What:** Homologar as três pipelines no consumidor escolhido com evidência real e sanitizada.
**Where:** `.specs/features/issue-8-code-review/pilot.md`
**Supporting files:** Configuração de produto somente no demo-repository, em sua entrega própria autorizada; atualizar evidências/status T8 da triagem sem dar baixa fictícia.
**Depends on:** T8
**Reuses:** Caller integrado e critérios pendentes TRI-24/25; nenhum segundo login/conta central.
**Requirement:** REV-22, REV-23; TRI-24, TRI-25
**Done when:**
- [ ] Após autorização/provisionamento, runs reais demonstram issue→triagem→PR draft→review com modelo e identidades do consumidor.
- [ ] Duas execuções sequenciais novas da central, fila antiga/conflito/falha de persistência e recuperação têm evidências sanitizadas; refresh real comprovado ou explicitamente não observado.
- [ ] Ausência de secrets em logs/artefatos conferida e Verifier final confirma requisitos; simulações não encerram a tarefa.
**Tests:** e2e real no consumidor privado, sem auth pessoal/global, publicação/ativação só autorizadas.
**Gate:** Pilot + Verifier independente final + validate_state
**Commit:** `docs(review): record integrated real pilot evidence refs #8`

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Um componente de política/referências ao diff | Granular |
| T2 | Um coletor confiável com transporte de suporte | Granular |
| T3 | Um contrato de resultado/empacotamento | Granular |
| T4 | Um adaptador de invocação na central existente | Granular |
| T5 | Um preparador de proposta com extração coesa | Granular |
| T6 | Um gateway de publicação recuperável | Granular |
| T7 | Um entry point coordenador e seu runner | Granular |
| T10 | Helper de dispatch antes do pin imutável do caller | Granular |
| T8 | Um caller integrado e consumo | Granular |
| T9 | Uma homologação conjunta real | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Origem | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |
| T4 | T3 | Phase 1 → Phase 2 | Match |
| T5 | T4 | T4 → T5 | Match |
| T6 | T5 | T5 → T6 | Match |
| T7 | T6 | Phase 2 → Phase 3 | Match |
| T10 | T7 | T7 → T10 | Match |
| T8 | T10 | T10 → T8 | Match |
| T9 | T8 | T8 → T9 | Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Política/diff | unit | unit | OK |
| T2 | Coleta/API | integration | integration | OK |
| T3 | Resultado/empacotamento | unit/integration | unit/integration | OK |
| T4 | Central/executor | integration | integration | OK |
| T5 | Git/preparação | integration | integration | OK |
| T6 | Publicação/API | integration | integration | OK |
| T7 | Workflow/runner | integration/contract | integration/contract | OK |
| T10 | Dispatch/runner | integration/contract | integration/contract | OK |
| T8 | Caller/dispatch/inspector | integration/contract | integration/contract | OK |
| T9 | Piloto | e2e real | e2e real | OK |

## Requirement Traceability

REV-01/02/03/05/06: T1/T2/T3/T4/T8/T10; REV-04: T4/T7; REV-07/08: T1/T3/T4; REV-09/10: T3/T6; REV-11/12: T1/T5; REV-13: T5/T7; REV-14/15/16: T1/T5/T6/T7; REV-17/18/19/20/21: T2/T4/T6/T7/T8/T10; REV-22/23: T9; REV-24/25/26: T2/T3/T4/T5/T6/T7/T8/T10. Todos os 26 requisitos mapeados; nenhum marcado Verified antes de evidência.

Plano escrito aprovado pelo mantenedor em 2026-10-15. Método de execução já escolhido: agente principal, sequencial e commits locais; não perguntar novamente por paralelização.
