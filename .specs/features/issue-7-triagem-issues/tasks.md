# Triagem reutilizável de issues Implementation Plan

**Spec:** [spec.md](spec.md). **Design:** [design.md](design.md). **Status:** Execução autorizada em 2026-10-14; T1–T4 concluídas, 4/8 tarefas. Documentação adiada por decisão explícita do mantenedor; caller funcional e testes relevantes permanecem.
**Goal:** Entregar triagem reutilizável com rotas SDD/patch, publicação por PR e piloto real da central.
**Architecture:** caller → triagem → central LLM; configuração confiável separada da base analisada; publicar somente após validação.
**Tech Stack:** Node 22.23.3, ESM, node:test, Ajv/dependências fixadas da central, GitHub Actions/REST/GraphQL e Git.

## Execution Protocol

Usar `tlc-spec-driven`: testes derivados dos requisitos, gate antes de fechar tarefa e commit local atômico com progresso/traceability. Implementação pelo agente principal neste worktree, sequencial, conforme preferência do mantenedor. Não criar branches paralelas de implementação. Verifier independente ao entregar T1–T7 e após evidência de T8. Não enfraquecer assertions ou confundir fixtures com piloto real.

O plano preserva as aprovações existentes; sua revisão fecha o último gate de planejamento. Aprovação de execução não autoriza push/merge/ativação remota adicional ou uso de auth pessoal.

## Global Constraints

- Repositório privado não fork; origem/autor/operador confiáveis antes da autenticação.
- Body até 16 KiB; contexto e config até 32 KiB; envelope até 1 MiB; summary até 4000 caracteres; outputs até 8 KiB; retenção 1 dia.
- Size/Estimate representam valor. Rota simples: Bug/Task, Low, XS/1 ou S/2, sem MAJOR/blocker aberto e base inequívoca.
- Nenhum harness, comandos da LLM, merge/fechamento/aprovação automática, force-push ou alteração do fluxo SonarQube.
- Caller escolhe modalidade, secrets, modelos/esforço/prompts. Tokens de coleta/publicação nunca entram no processo da LLM.
- Dispatch/envelope v1 existentes permanecem compatíveis. Perfil triage usa origem explícita e envelope v2 com config_source_sha.
- Cada componente inclui seus testes comportamentais. Não existe piso de casos nem teste de texto/documentação. Documentação de adoção/manual adiada em 2026-10-14; T7 entrega somente o caller executável, configuração, prompts e inspector.

## Review Focus

| Falha relevante | Tarefa e prova |
| --- | --- |
| Informação ausente ser interpretada como caso simples | T1: missing/contradictory → needs-human, não patch |
| Config/prompts da release ou body autorizarem origem/base | T3: checkout/config confiáveis separados; branches fora da política recusadas |
| SHA correto mas configuração de outra revisão | T3/T7: envelope v2 e inspector recusam config_source_sha divergente |
| Erro parcial criar PR duplicado ou alterar recurso humano | T5: reconsulta recupera recurso próprio; recurso humano não é atualizado |
| Execução de código proposto receber secrets | T4/T6: job isolado, subprocesso sem auth/escrita; publisher não executa produto |

## Test Coverage Matrix

Gerada de `tests/llm/{preflight,workflow,result,caller,persistence}.test.mjs`, `scripts/llm/package.json` e CI existente. Constituição, AD-003/004 e spec delimitam cobertura; contagem não é gate.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Política/configuração | unit | Rotas e limites da spec; completos/ausentes/contraditórios | `tests/triage/policy.test.mjs` | `node --test tests/triage/policy.test.mjs` |
| Coleta/central/publicação | integration | Origem, identidade, falhas e efeitos reais simulados; nunca auth real | `tests/triage/*.test.mjs` e testes centrais afetados | `node --test tests/llm/*.test.mjs tests/triage/*.test.mjs` |
| Patch/job/workflow/caller | integration/contract | Patch aplicável, recusas, isolamento, consumo e erro de publicação | `tests/triage/{patch,workflow,caller}.test.mjs` | Mesmo Full |
| Instruções do caller | revisão manual | Configuração/limites/recuperação completos; sem testar prosa | `examples/callers/triage/README.md` | Revisão + contratos executáveis |
| Piloto privado | e2e real | TRI-24/25; autenticação, fila, falha e recuperação com evidência sanitizada | `docs/triage-pilot.md` | Caller real no consumidor escolhido pelo mantenedor |

## Gate Check Commands

Comandos atuais: `npm --prefix scripts/llm test`, `npm --prefix scripts/llm run check` e `npm --prefix scripts/llm run lint:workflow`. T6 estende os scripts existentes para descobrir testes/sintaxe/workflows de triagem, sem framework novo.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | T1 | `node --test tests/triage/policy.test.mjs` + `node --check scripts/triage/policy.mjs` |
| Full | T2–T5 | `node --test tests/llm/*.test.mjs tests/triage/*.test.mjs`; syntax dos arquivos adicionados com `node --check` |
| Build | T6–T7 / entrega local | Scripts npm centrais de test/check/lint estendidos; Node 22.23.3; TLC Verifier |
| Pilot | T8 | Runs reais e evidências TRI-24/25 + TLC Verifier; nunca fixtures como substituto |

No Windows, lint usa actionlint 1.7.12 já verificado em `C:/Users/gerso/AppData/Local/Temp/issue-9-actionlint-1.7.12/actionlint.exe`. Somente as exceções documentadas de queue/concurrency e job.workflow_repository/workflow_sha são mantidas. Em Linux, script fixado existente; não afirmar execução Ubuntu pelo lint Windows.

## Execution Plan

Fases e tarefas estritamente sequenciais; oito tarefas cabem em um lote inline. Arquivos de suporte/schema/testes necessários ao mesmo componente acompanham sua tarefa.

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

## Task Breakdown

### T1: Contrato e política de triagem

**What:** Componente puro valida config/metadados e determina a rota sem inferência ou credenciais.
**Where:** `scripts/triage/policy.mjs`
**Supporting files:** `scripts/triage/schemas/config.schema.json`, `tests/triage/policy.test.mjs`.
**Depends on:** None
**Reuses:** Ajv fixado da central, readTrustedFile e convenções ESM.
**Requirement:** TRI-05, TRI-09, TRI-10, TRI-11, TRI-14
**Tools:** TLC/cicd; apply_patch, Node e Git local.
**Interfaces:** `validateTriageConfig(config)` → configuração v1 normalizada; `selectRoute(metadata)` → `{route, reasons}`; `resolveBase(metadata, config)` → base de release ou empilhamento autorizado.
**Done when:**
- [x] Config schema fechado com project owner/number, mapeamento de campos, configs plan/patch, bases empilhadas, reviewer e verificações; paths/branches inválidos recusados.
- [x] Rotas completas obedecem à política aprovada e não usam labels/body para autorizar correção.
- [x] Metadados ausentes/inconsistentes retornam needs-human; ausência de base não produz patch. Sinal SDD conhecido continua planejamento, sem autorizar código.
**Tests:** unit; `route === 'plan'` para High/Team/MAJOR; `route === 'propose-patch'` somente combinações simples válidas; `route === 'needs-human'` para insuficiência/contradição; base do body ignorada.
**Gate:** Quick
**Commit:** `feat(triage): validate policy and route issue metadata refs #7`

### T2: Coletor de origem e metadados

**What:** Buscar dados reais, validar autorização e construir snapshot limitado/fingerprint sem materializar secrets LLM.
**Where:** `scripts/triage/collect.mjs`
**Supporting files:** `scripts/triage/api.mjs`, schema da policy para field_sources opcionais e `tests/triage/collect.test.mjs` com fixtures de API.
**Depends on:** T1
**Reuses:** githubGet/metadata API da central e política T1.
**Requirement:** TRI-01, TRI-02, TRI-03, TRI-05, TRI-08, TRI-20, TRI-22
**Tools:** TLC/cicd; Node e consultas oficiais GitHub; sem escrita externa.
**Interfaces:** `collectIssue({event, config}, api)` → snapshot com repo/issue, metadata, base SHA, config SHA, route, fingerprint e contexto JSON limitado.
**Done when:**
- [x] Issue aberta ou número de dispatch é reconsultado no repo corrente; issue/ator inelegíveis recusados antes de LLM.
- [x] Metadata inclui proveniência; campos não encontrados não são inventados; paginação não ignora dependências/Projects. field_sources permite escolher issue ou Project explicitamente; padrão Project preservado.
- [x] Limites em bytes recusam excesso; entrada fechada/alterada é detectável por fingerprint.
**Tests:** integration; assertions no snapshot/fingerprint e rejeições para fork/público/ator read/evento proibido/403/excesso; tipo/milestone/épica/blockers/campos corretos.
**Gate:** Full
**Commit:** `feat(triage): collect trusted issue context refs #7`

### T3: Adaptador compatível de triagem na central

**What:** Integrar origem de issue e SHAs separados ao ciclo central existente, preservando dispatch v1.
**Where:** `scripts/llm/`
**Supporting files:** workflow `llm-execute.yml`, adaptador `scripts/triage/invocation.mjs`, extração coesa de origem em collect.mjs, schemas/request/result, testes centrais afetados e `tests/triage/central.test.mjs` com preload de API somente para teste.
**Depends on:** T2
**Reuses:** Executor/auth/instructions/freshness/persistência/limpeza existentes, sem segundo login/runtime.
**Requirement:** TRI-03, TRI-04, TRI-06, TRI-07, TRI-13, TRI-22
**Tools:** TLC/cicd; Node, API fixtures e actionlint.
**Interfaces:** Perfil opcional `caller_profile: manual|triage`, `issue_number`, `triage_config_path` e `expected_source_sha`; defaults preservam chamada manual atual. Orquestração recebe `configRoot` confiável separado de `sourceRoot`. Envelope triage v2 adiciona `config_source_sha` com schema discriminado; v1 permanece fechado e inalterado.
**Done when:**
- [x] Origem real/ator/base são validados independentemente de context_json; configuração vem da branch padrão e código do SHA permitido.
- [x] Modelo, esforço e prompt do caller são usados; proveniência v2 não vem da LLM.
- [x] Callers antigos e falhas de sessão continuam cobertos; assertions de segurança de evento/SHA preservadas. Interface fechada do workflow foi estendida explicitamente ao perfil aprovado.
**Tests:** integration; dispatch continua v1, triage produz v2 correto, configuração/SHA/base/origem divergentes rejeitados, sem artefato após erro de persistência e sem fallback de auth.
**Gate:** Full + lint do workflow modificado
**Commit:** `feat(llm): support trusted triage sources refs #7`

### T4: Preparação isolada de patch

**What:** Validar e aplicar proposta sobre base exata, sem publicar ou executar produto com secrets.
**Where:** `scripts/triage/prepare-patch.mjs`
**Supporting files:** `tests/triage/patch.test.mjs` e fixtures de Git temporário.
**Depends on:** T3
**Reuses:** validatePatch/validateEnvelope e Git sem shell/interpolação do patch.
**Requirement:** TRI-13, TRI-16, TRI-17
**Tools:** TLC/cicd; Node, Git local, sem credenciais reais.
**Interfaces:** `preparePatch({envelope, expected, patch, sourceRoot, config})` → alteração real preparada ou erro sanitizado; caminhos permitidos vêm da configuração confiável.
**Done when:**
- [x] Envelope/paths/base validados, `git apply --check` e aplicação exata sem symlinks/hooks/config externos.
- [x] Patch vazio, proibido/inaplicável e base divergente não produzem proposta publicável.
- [x] Preparação não executa scripts do produto e não herda secrets. O job separado de verificação será conectado em T6, conforme sua dependência no plano.
**Tests:** integration em repo temporário; conteúdo alterado correto, fonte original preservada, paths proibidos/inaplicável/empty recusados e nenhum segredo no subprocesso.
**Gate:** Full
**Commit:** `feat(triage): prepare validated patches in isolation refs #7`

### T5: Publicação recuperável por issue

**What:** Gateway publica comentário ou PR draft de proposta validada e recupera erros parciais sem duplicar recursos.
**Where:** `scripts/triage/publish.mjs`
**Supporting files:** `tests/triage/publish.test.mjs` e API simulada stateful.
**Depends on:** T4
**Reuses:** Snapshot/fingerprint T2, validação T3/T4 e metadata GitHub; nenhum código da LLM executado no publisher.
**Requirement:** TRI-12, TRI-14, TRI-15, TRI-16, TRI-18, TRI-19, TRI-20, TRI-21, TRI-22
**Tools:** TLC/github-planning; API fixtures na implementação, nenhuma publicação real para testar.
**Interfaces:** `publishTriage({snapshot, result, prepared, verification, config}, api)` → comentário/PR e status explícitos. `api` distingue GET com retry limitado de criação sem retry cego.
**Done when:**
- [ ] Reconsulta issue/base/fingerprint; entrada antiga falha STALE_TRIAGE_INPUT antes de publicar proposta.
- [ ] Comentário de SDD tem contexto/proposta/riscos/próximo passo e rascunho; comentário humano não é sobrescrito.
- [ ] PR draft na base correta contém Refs/milestone/reviewer; nunca merge, Closes intermediário ou force-push.
- [ ] Reexecução e timeout após criação recuperam recursos próprios; divergência humana impede atualização destrutiva.
**Tests:** integration stateful; inspeção de comentário/PR/ref reais simulados, base/SHA/reviewer/draft, duas execuções sem duplicatas, erro parcial/403/conflito e zero alterações em recurso humano.
**Gate:** Full
**Commit:** `feat(triage): publish recoverable review proposals refs #7`

### T6: Workflow reutilizável e integração CI

**What:** Entry point coordena coleta, LLM, preparo/verificação sem secrets e publicação com privilégios separados.
**Where:** `.github/workflows/issue-triage.yml`
**Supporting files:** `scripts/triage/run.mjs`, testes/workflow, ajustes coesos nos comandos test/check/lint e CI existentes.
**Depends on:** T5
**Reuses:** Jobs/pins/runtime central, T1–T5 e seu fluxo de artefatos; serialização por issue e sessão.
**Requirement:** TRI-01, TRI-04, TRI-17, TRI-18, TRI-19, TRI-22, TRI-23
**Tools:** TLC/cicd; Node, actionlint e parsing YAML.
**Interfaces:** `workflow_call` com config_path, issue_number para dispatch, modalidade/secrets explícitos; outputs status/route/issue/PR; runner fases collect/prepare/publish/finalize.
**Done when:**
- [ ] Workflow chama central por job aninhado, sem secrets: inherit; jobs de inferência e publicação não compartilham auth.
- [ ] Testes configurados pelo consumidor rodam sem credencial de escrita/sessão; failure mantém draft e é rastreável.
- [ ] CI descobre todos testes/scripts/YAML da triagem mesmo sem projeto Node na raiz e preserva gates anteriores.
**Tests:** integration/contract; simulação caller → resultado/publicação stateful, secrets ausentes recusados, cenário plan/patch/needs-human e erro de upload/verificação/publicação, assertions nas permissões e status finais.
**Gate:** Build
**Commit:** `feat(triage): expose reusable workflow and contract gates refs #7`

### T7: Caller copiável e instruções completas

**What:** Adaptar o caller entregue pela #9 como modelo utilizável da triagem, com identidade própria do consumidor.
**Where:** `examples/callers/triage/`
**Supporting files:** `tests/triage/caller.test.mjs`, link README e inspector/config/prompts do modelo.
**Depends on:** T6
**Reuses:** Caller/inspector da #9 e nova interface T6; referência imutável de commit real contendo implementação local.
**Requirement:** TRI-04, TRI-07, TRI-13, TRI-23
**Tools:** TLC/cicd; Node, parsing YAML, revisão manual das instruções.
**Done when:**
- [ ] Exemplo suporta issues.opened e dispatch; inputs/config/secret/modelo/prompt próprios e ref fixa real, sem conta central.
- [ ] Inspector confere repo/run/issue/base/config SHAs e hashes, recusando outra revisão antes de aplicar artefato.
- [ ] Caller executável/configuração mantêm configuração explícita de permissões/Project/branches/modelos/prompts/resultados; documentação de adoção adiada, sem bloquear o componente funcional.
**Tests:** integration/contract; consumo real de envelope v2 válido/forjado e propagação de modelo/prompt; documentação somente revisão manual.
**Gate:** Build + Verifier independente local T1–T7
**Commit:** `docs(triage): deliver configured reusable caller refs #7`

### T8: Piloto real compartilhado com a central

**What:** Homologar no consumidor privado escolhido pelo mantenedor usando o mesmo caller T7; cumprir transferência LLM-24/T13.
**Where:** `docs/triage-pilot.md`
**Depends on:** T7
**Reuses:** T7, matriz de aceitação e credenciais dedicadas/provisionadas pelo mantenedor.
**Requirement:** TRI-24, TRI-25
**Tools:** TLC/github-planning; GitHub Actions e Codex reais somente após autorização de ativação/publicação e provisionamento.
**Done when:**
- [ ] Duas execuções reais novas sequenciais produzem saída vinculada ao repo/issue/SHA correto, sem secrets em logs/artefatos.
- [ ] Refresh real comprovado ou explicitamente pendente; nunca substituir autenticação real por fixture ou auth pessoal.
- [ ] Fila antiga/conflito/falha de persistência recusam resultado utilizável; recuperação demonstrada com nova execução/sessão atual.
**Tests:** e2e real; evidências sanitizadas distinguem execução de preparação e falhas de provider de teste simulado.
**Gate:** Pilot + Verifier independente final; feature não concluída sem evidência exigida
**Commit:** `docs(triage): record shared real pilot evidence refs #7`

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Origem | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |
| T4 | T3 | T3 → T4 | Match |
| T5 | T4 | T4 → T5 | Match |
| T6 | T5 | T5 → T6 | Match |
| T7 | T6 | T6 → T7 | Match |
| T8 | T7 | T7 → T8 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Policy/schema | unit | unit junto do componente | Match |
| T2 | Coleta/API | integration | integração com snapshot real simulado | Match |
| T3 | Central integration | integration | regressões v1/v2 e auth co-localizadas | Match |
| T4 | Git/patch | integration | Git temporário e recusas | Match |
| T5 | Publisher/API | integration | API stateful e recuperação | Match |
| T6 | Workflow/runner/CI | integration/contract | fluxo completo e contratos | Match |
| T7 | Caller/inspector | integration/contract | consumo executável + revisão manual das instruções | Match |
| T8 | Pilot | e2e real | evidências não simuladas | Match |

## Requirement Traceability

TRI-01/02/03/05/08/20/22: T2/T6; TRI-04/06/07/13: T3/T7; TRI-09/10/11/14: T1/T5; TRI-12/15/16/18/19/21: T5/T6; TRI-17: T4/T6; TRI-23: T6/T7; TRI-24/25: T8. 25 requisitos mapeados; nenhum marcado Verified antes de evidência.
