# Pipeline reutilizável de LLM Tasks

**Design:** [design.md](design.md). **Status:** Aprovado; execução sequencial. **Execução:** 2/13 tarefas concluídas.

## Execution Protocol

Implementação local autorizada pelo mantenedor em 2026-10-12. Usar `tlc-spec-driven`, um componente e seus testes por tarefa, um commit atômico após o gate. Atualizar traceability antes do commit e executar a verificação independente TLC ao final. Execução sequencial pelo agente principal, respeitando a preferência do mantenedor. Publicação e ativação do piloto são ações externas separadas.

## Test Coverage Matrix

> Base: `.specify/memory/constitution.md`, `.github/workflows/ci.yml` e amostras `tests/versioning/{go-version,pr-check,post-merge,real-go-gitsemver,real-changesets}.mjs`. O repositório já usa Node ESM, assert e CLI/API simuladas. A feature adota `node:test` para contagem verificável. Cobertura funcional cobre todos os ACs e casos de borda, sem criar uma meta percentual não definida.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Validação, contexto, instruções e auth | unit | Caminho válido e todos os limites/erros descritos | `tests/llm/*.test.mjs` | `npm --prefix scripts/llm test` |
| Processos Codex e REST Secrets | integration com fakes | Chamadas/saídas, timeout, restauração, persistência e limpeza, sem tokens reais | `tests/llm/*.test.mjs` | `npm --prefix scripts/llm test` |
| Workflow e callers | contract | Parsing YAML e correspondência de inputs/secrets/outputs, locks e permissões | `tests/llm/workflow.test.mjs` | `npm --prefix scripts/llm test` |
| Docs e provenance | documental | Campos cobertos, exemplos coerentes e links locais existentes | `tests/llm/docs.test.mjs` | `npm --prefix scripts/llm test` |
| Piloto | e2e privado | Execução real e recuperação, com evidência sanitizada | `docs/llm-pilot.md` | Caller manual em repo privado |

## Gate Check Commands

> Comandos atuais observados: `node tests/versioning/pr-check.mjs` e `node tests/versioning/post-merge.mjs`. Comandos `scripts/llm` abaixo são planejados e passam a existir em T1/T10, não foram executados nesta iteração. Não incluir testes existentes que geram tags/instalam ferramentas na validação só de documentação.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Componente isolado | `node --test tests/llm/<componente>.test.mjs` |
| Full | Integração entre componentes | `npm --prefix scripts/llm test` (mapeia para `node --test ../../tests/llm/*.test.mjs`) |
| Build | Fechamento de fase e YAML | Full + `npm --prefix scripts/llm run check` (node --check dos módulos) + actionlint na versão fixada |
| Pilot | T13 | Duas execuções novas sequenciais e falhas controladas pelo caller privado; preencher evidência |

Os mínimos de casos abaixo são piso de planejamento, não contagem observada. Ao implementar, registrar a contagem real e justificar acréscimos; não remover testes para atingir o piso.

## Execution Plan

Execução sequencial; cada fase depende da anterior. Diagrama lista somente dependências reais, não paralelismo autorizado.

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13
```

## Task Breakdown

### Phase 1: Contrato e fontes confiáveis

### T1: Validar o contrato de chamada

**Status**: Complete. Evidências em [execution-review.md](execution-review.md#t1-contrato-de-entrada).

**What**: Implementar o componente de normalização da configuração, com schema e manifesto de dependências da feature.
**Where**: `scripts/llm/validate-request.mjs`
**Depends on**: None
**Reuses**: ESM e assert de testes de versionamento; constituição de contratos.
**Requirement**: LLM-01, LLM-02
**Tools**: Git, Node, documentação oficial; skills TLC e cicd.
**Done when**:
- [x] Config v1 fecha campos, valida inputs/limites e diferencia os dois modos antes de qualquer credencial.
- [x] Manifesto/lock fixam versões exatas de Codex, Ajv, libsodium e parser YAML; registrar compatibilidade de flags sem autenticação.
- [x] Testes da tarefa cobrem pelo menos 12 casos; Quick passa (28 casos).
**Tests**: unit em `tests/llm/request.test.mjs`; schemas e dependências pertencem ao mesmo contrato, sem outros comportamentos.
**Gate**: Quick + instalação com lock em diretório central limpo, sem código do consumidor.
**Commit**: `feat(llm): validate caller invocation contract`

### T2: Validar a origem da chamada

**Status**: Complete. Evidências em [execution-review.md](execution-review.md#t2-origem-e-revisão-confiáveis).

**What**: Implementar o preflight de evento/repositório e resolução do SHA confiável.
**Where**: `scripts/llm/preflight.mjs`
**Depends on**: T1
**Reuses**: Testes de API falsa em versionamento, sem sua lógica de release.
**Requirement**: LLM-02, LLM-13
**Tools**: Node, GitHub REST simulada; TLC/cicd.
**Done when**:
- [x] MVP aceita dispatch pela branch padrão, nega fork, pull_request_target, branch arbitrária e contexto público com sessão.
- [x] Checkout usa SHA resolvido e não altera referência por texto de contexto.
- [x] Pelo menos 8 casos em Quick passam, incluindo API indisponível (16 casos).
**Tests**: unit/integration em `tests/llm/preflight.test.mjs`.
**Gate**: Quick.
**Commit**: `feat(llm): verify trusted caller context`

### T3: Compor diretrizes com proveniência

**What**: Implementar carregamento integral de instruções globais e específicas do consumidor.
**Where**: `scripts/llm/instructions.mjs`
**Depends on**: T2
**Reuses**: AGENTS global integral aprovado e descoberta documentada do Codex.
**Requirement**: LLM-15, LLM-16
**Tools**: Node fs/crypto, documentação oficial; TLC.
**Done when**:
- [ ] Snapshot global e provenance correspondem ao arquivo aprovado no momento da implementação; diferenças desde a revisão são apresentadas.
- [ ] Descoberta de AGENTS/overrides e teto de 65536 bytes não truncam instruções; skills ausentes são documentadas.
- [ ] Pelo menos 8 casos (incluindo symlink e limites exato/excedido) passam.
**Tests**: unit em `tests/llm/instructions.test.mjs`.
**Gate**: Quick + Build da fase (check de módulos existentes; actionlint somente onde houver YAML executável).
**Commit**: `feat(llm): compose versioned execution guidance`

### Phase 2: Runtime e ciclo de credenciais

### T4: Restaurar credenciais por invocação

**What**: Implementar auth temporária e cleanup para sessão ChatGPT e API key explícita.
**Where**: `scripts/llm/auth.mjs`
**Depends on**: T3
**Reuses**: Diretórios temporários e fixtures de testes existentes.
**Requirement**: LLM-06, LLM-07, LLM-12
**Tools**: Node, CLI falso; TLC/cicd.
**Done when**:
- [ ] Combinação de modalidade e secrets é validada; não existe fallback, conta central ou uso do home pessoal.
- [ ] Sessão malformed, modo externo não suportado e segredo ausente não iniciam CLI.
- [ ] Pelo menos 8 casos verificam permissões, ambiente e remoção normal/erro.
**Tests**: unit/integration em `tests/llm/auth.test.mjs`.
**Gate**: Quick.
**Commit**: `feat(llm): isolate caller authentication lifecycle`

### T5: Recusar snapshots de sessão antigos

**What**: Implementar o guard de freshness com metadata da secret e criação do workflow run.
**Where**: `scripts/llm/check-session-freshness.mjs`
**Depends on**: T4
**Reuses**: API falsa de GitHub nos testes; inputs normalizados.
**Requirement**: LLM-09
**Tools**: Node, REST Secrets/Actions documentadas; TLC.
**Done when**:
- [ ] `updated_at >= created_at` recusa execução antes de disponibilizar sessão ao CLI.
- [ ] Timestamp inválido, 403, rerun antigo e precisão no mesmo segundo falham explicitamente.
- [ ] Pelo menos 7 casos provam zero chamadas e zero persistência em snapshot recusado.
**Tests**: unit/integration em `tests/llm/freshness.test.mjs`.
**Gate**: Quick.
**Commit**: `fix(llm): reject stale queued authentication snapshots`

### T6: Persistir somente a sessão do consumidor

**What**: Implementar writeback criptografado condicionado à alteração do arquivo e ausência de conflito.
**Where**: `scripts/llm/persist-session.mjs`
**Depends on**: T5
**Reuses**: libsodium fixado, metadata obtida em preflight.
**Requirement**: LLM-10, LLM-11
**Tools**: Node fetch, chaves criptográficas de teste; TLC.
**Done when**:
- [ ] Fixture descriptografa o payload e encontra a sessão renovada, nunca seed anterior.
- [ ] Sem alteração não há PUT; arquivo inválido, metadata modificada ou destino de outro repo são recusados.
- [ ] Pelo menos 9 casos cobrem 201/204, 403, timeout ambíguo, erro de chave e falha após inferência válida.
**Tests**: integration em `tests/llm/persistence.test.mjs`.
**Gate**: Quick.
**Commit**: `feat(llm): persist refreshed consumer session`

### T7: Executar modos de invocação limitados

**What**: Implementar executor Codex single ou decisão seguida de prompt com ambiente mínimo.
**Where**: `scripts/llm/execute.mjs`
**Depends on**: T6
**Reuses**: Contrato normalizado, instruções e auth temporária; catálogo de três templates da mesma feature.
**Requirement**: LLM-03, LLM-04, LLM-05, LLM-14, LLM-19, LLM-20
**Tools**: Node child_process, Codex falso e smoke test do binário sem segredo; TLC.
**Done when**:
- [ ] CLI falso confirma número de invocações, modelo/esforço selecionados e zero interpolação de shell.
- [ ] Processo não recebe tokens GitHub; checkout não muda; config/MCP/hooks do consumidor não são herdados.
- [ ] Timeout agregado encerra subprocessos e retorna erro, sem retry automático de inferência.
- [ ] Pelo menos 12 casos cobrem os modos, decisões, erro da segunda chamada, timeout e sandbox/config hostil.
**Tests**: integration em `tests/llm/execution.test.mjs`.
**Gate**: Full; smoke de flags/sandbox com versão fixada, sem LLM real nesta tarefa.
**Commit**: `feat(llm): execute caller-selected Codex requests`

### T8: Validar e empacotar resultados

**What**: Implementar envelope v1 e pacote de arquivos explicitamente permitidos.
**Where**: `scripts/llm/result.mjs`
**Depends on**: T7
**Reuses**: Ajv, crypto e informação confiável de runtime.
**Requirement**: LLM-17, LLM-18, LLM-19, LLM-21
**Tools**: Node, fixtures de respostas e patches; TLC.
**Done when**:
- [ ] Modelo não pode falsificar repositório, SHA ou run_id do envelope.
- [ ] Duas chamadas do mesmo workflow no mesmo run/attempt geram nomes distintos com seus invocation_id; colisão não habilita overwrite.
- [ ] Patch é somente dado; paths perigosos, arquivos de auth e excesso de bytes são recusados.
- [ ] Pelo menos 10 casos comprovam schema, limites, allowlist de arquivos e ausência dos segredos-sentinela.
**Tests**: unit/integration em `tests/llm/result.test.mjs`.
**Gate**: Full + Build da fase.
**Commit**: `feat(llm): validate result and patch artifacts`

### Phase 3: Workflow, consumo e homologação

### T9: Orquestrar o workflow reutilizável

**What**: Conectar componentes no job chamado com outputs, lock e finalização segura.
**Where**: `.github/workflows/llm-execute.yml`
**Depends on**: T8
**Reuses**: Checkout da automação em `job.workflow_sha` observado no workflow de versionamento.
**Requirement**: LLM-01, LLM-06, LLM-08, LLM-11, LLM-12, LLM-13, LLM-14, LLM-17, LLM-21
**Tools**: Parser YAML, actionlint, harness de job; TLC/cicd.
**Done when**:
- [ ] Workflow declara inputs/secrets/outputs do design; código central e contexto consumidor usam suas revisões corretas.
- [ ] Sessão serializada por repo/secret; nenhuma configuração de org global ou secrets: inherit.
- [ ] Erro de CLI ainda tenta persistir refresh; erro de persistência/upload não publica sucesso.
- [ ] Pelo menos 10 contratos passam incluindo cancelamento e falha sem outputs.
**Tests**: contract/integration em `tests/llm/workflow.test.mjs`.
**Gate**: Full + actionlint.
**Commit**: `feat(llm): expose reusable invocation workflow`

### T10: Incluir verificações da feature na CI

**What**: Adicionar gate explícito da feature à CI, independentemente de package.json na raiz.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T9
**Reuses**: CI existente e manifesto `scripts/llm`.
**Requirement**: LLM-22
**Tools**: Node, actionlint; TLC/cicd.
**Done when**:
- [ ] CI instala somente dependências fixadas da feature, roda todos seus testes e check de sintaxe.
- [ ] Pelo menos 3 casos de contrato provam execução sem package raiz e preservam os caminhos condicionais anteriores.
**Tests**: contract em `tests/llm/ci.test.mjs`.
**Gate**: Build.
**Commit**: `ci(llm): enforce feature contract checks`

### T11: Entregar caller e configuração próprios do consumidor

**What**: Materializar um caller mínimo com variante API key documentada e configuração de invocação versionada.
**Where**: `examples/callers/llm/`
**Depends on**: T10
**Reuses**: Protótipos não executáveis desta especificação.
**Requirement**: LLM-23
**Tools**: YAML/JSON parser, actionlint; TLC/cicd.
**Done when**:
- [ ] Caller possui evento, config_path, auth_mode, mapping explícito de secrets e ref fixa publicada/revisada.
- [ ] Cada chamada define invocation_id próprio; o consumo confere esse ID e o SHA no envelope.
- [ ] Caller não contém comandos de autenticação copiados, sessão global nem credenciais nos inputs.
- [ ] README cobre valores, alternativas, provisionamento, rerun versus novo run e leitura dos outputs.
- [ ] Pelo menos 5 contratos validam as duas modalidades e a troca de modelo sem editar o central.
**Tests**: contract/documental em `tests/llm/caller.test.mjs`.
**Gate**: Full + actionlint do exemplo após resolver a referência do piloto.
**Commit**: `docs(llm): deliver consumer-owned caller examples`

### T12: Documentar o contrato operacional central

**What**: Entregar manual da pipeline, dependências, limites, resultados e recuperação.
**Where**: `docs/llm.md`
**Depends on**: T11
**Reuses**: Design e tabela de inputs/secrets/outputs, sem duplicar decisões divergentes.
**Requirement**: LLM-22
**Tools**: Verificação de links/campos; TLC.
**Done when**:
- [ ] Cada entrada/secret/saída e código de erro aparece no manual com efeito e configuração.
- [ ] Limites da sessão Plus, snapshot antigo, PAT por repo e ausência de atomicidade externa estão documentados.
- [ ] Pelo menos 3 verificações documentais cobrem campos, caminhos e exemplos sem credenciais.
**Tests**: documental em `tests/llm/docs.test.mjs`.
**Gate**: Full + Build da fase antes da publicação.
**Commit**: `docs(llm): document invocation and recovery contract`

### T13: Homologar o piloto privado e registrar evidências

**What**: Executar caller real no piloto fornecido pelo mantenedor e registrar os resultados sanitizados.
**Where**: `docs/llm-pilot.md`
**Depends on**: T12
**Reuses**: Caller e matriz de aceitação; credenciais provisionadas pelo proprietário.
**Requirement**: LLM-24
**Tools**: GitHub Actions/REST e Codex real; TLC/cicd.
**Done when**:
- [ ] Dois runs novos sequenciais retornam envelope válido; caminho de refresh real observado ou explicitamente pendente, sem adulterar credencial para fingir teste.
- [ ] Execução enfileirada com snapshot antigo é recusada; novo run recebe estado atual.
- [ ] Falha controlada de persistência impede sucesso e procedimento de recuperação é demonstrado.
- [ ] Inspeção confirma ausência de secrets nos logs/artefatos; pelo menos 4 cenários documentados.
**Tests**: e2e privado, sem considerar fixtures como comprovação da autenticação real.
**Gate**: Pilot + verificação independente TLC e relatório de conclusão, apenas depois das evidências necessárias.
**Commit**: `docs(llm): record private pilot evidence`

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
| T9 | T8 | T8 → T9 | Match |
| T10 | T9 | T9 → T10 | Match |
| T11 | T10 | T10 → T11 | Match |
| T12 | T11 | T11 → T12 | Match |
| T13 | T12 | T12 → T13 | Match |

## Test Co-location Validation

| Tasks | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1–T5 | Contrato/contexto/instruções/auth | unit e integrações necessárias | Mesmo componente e testes na mesma tarefa | Match |
| T6–T8 | API/processos/resultado | integration | Fixtures de comportamento e casos negativos | Match |
| T9–T11 | Workflow/CI/caller | contract | Parsing e execução simulada onde pertinente | Match |
| T12 | Docs | documental | Verificação de contrato e links | Match |
| T13 | Piloto | e2e | Evidência de execução real | Match |

Cada tarefa produz um componente coeso e seus testes; manifests, schemas e fixtures necessários ao componente não são entregas independentes. A execução permanece sequencial. O Verifier independente é obrigatório ao concluir a implementação e homologação.
