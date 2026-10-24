# Três pilotos Release Please Implementation Plan

> Execute inline com tlc-spec-driven e superpowers:executing-plans; um commit por tarefa e Verifier independente no final.

**Goal:** entregar etapa 1 nos três consumidores, sem distribuição. **Spec:** spec.md e design.md. **Status:** In progress, escopo autorizado pelo usuário.

## Global Constraints

- Callers ficam nas aplicações; nenhum novo exemplo central por adaptador.
- publish-artifacts=false nos três; não executar deploy/publish/GoReleaser.
- Preservar as branches de release e os clones sujos; não promover features para master.
- Usar o motor nativo, sem versão/changelog próprios; cada consumidor fixa o mesmo SHA em uses e central-ref.
- Merges e alterações administrativas continuam humanos; issue #4 permanece fechada.

## Review Focus

- Uma release_created verdadeira não pode contornar o flag false.
- Config local gerado não pode ser confundido com config remoto nativo.
- Override escalar não pode unificar/downgradear os pacotes Vue.
- revision/parents e ranges/lockfiles precisam acompanhar a versão real.
- Um check de contrato não comprova publicação hospedada nem autoriza marcar a meta completa.

## Test Coverage Matrix

Guidelines: AGENTS.md central, skills CI/CD/Entregas e comandos existentes de cada repo. Nenhum AGENTS.md foi encontrado nos worktrees consumidores.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Contrato/orquestrador/SDK | Integração funcional | Flags, modos, caminhos, negativos e resultados nativos; sete casos preservados | ci-scripts/tests/release-please.test.ts | npm test --prefix ci-scripts |
| Maven consumidor | Build/testes | Reactor verify e coerência das versões/pais/revision | POMs e testes existentes | mvn -B verify |
| npm consumidor | Lint/tipos/testes/build | Grafo real, privados e comandos existentes | Workspaces existentes | npm run verify |
| Go consumidor | Testes/vet/build | Sem regressão funcional e contrato do caller | Testes Go existentes | go test ./...; go vet ./...; go build ./... |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Iterar contrato central | npm run test:functional --prefix ci-scripts |
| Full | Tarefas centrais | npm test --prefix ci-scripts; npm run typecheck --prefix ci-scripts |
| Build | Cada consumidor/entrega | Full central ou comando completo do consumidor acima, mais git diff --check e validadores TLC |

## Execution Plan

### Phase 1: Contrato central e consumidores

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7
```

## Task Breakdown

### Task 1: Isolar distribuição
#### T1: Criar opt-out de publicação
**Where**: `.github/workflows/version-release-please-called.yml`
**Depends on**: None
**Requirement**: RPIL-01
**Files**: called, mesmo teste funcional e status TLC.
- [x] RED com ausência do booleano default false e de guards de distribuição.
- [x] Implementar publish-artifacts false por padrão, exigido nos três publishers; fortalecer as asserções existentes sem remover condições.
- [x] Gate Full, status e commit `feat(versioning): separate releases from artifact publication`. Persistência remota imediatamente após o commit, antes de T2.
**Tests**: integração funcional no arquivo existente, exatamente sete casos superiores.
**Gate**: Full.

### Task 2: Configuração nativa avançada
#### T2: Integrar manifest e override configurado
**Where**: `ci-scripts/scripts/release-orchestrator.ts`
**Depends on**: T1
**Requirement**: RPIL-02, RPIL-03, RPIL-04
**Files**: orquestrador, ponte SDK tipada, manifest/lock do runtime, called e mesmo teste funcional com fixtures de dados nativos.
- [x] RED para políticas/configs inválidas, configuração preservada e override raiz.
- [x] Action single/manifest e SDK público configurado; nenhum algoritmo próprio ou distribuição nesta fase.
- [x] Exercitar Maven/revision, grafo npm/privados/versões e negativos com motor real e transporte isolado.
- [x] Gate Build e auditoria runtime aprovados; status incluído no commit `feat(versioning): support native configured release engines`; push antes de T3.
**Tests**: integração funcional e fixtures nativas no fluxo existente.
**Gate**: Build.

### Task 3: Publicar contrato consumível
#### T3: Documentar e validar o SHA central
**Where**: `docs/pipelines/versionamento-release-please.md`
**Depends on**: T2
**Requirement**: RPIL-01, RPIL-02, RPIL-06
**Files**: guia central, exemplo genérico existente se necessário e registros TLC.
- [ ] Documentar modos, SDK, etapa 1/2, permissões e referências iguais.
- [ ] Gate e revisão antes de abrir PR central; registrar SHA remoto testado para os callers.
- [ ] Commit `docs(versioning): define stage one consumer contract`, push; sem merge.
**Tests**: suíte existente e CI hospedada, sem teste artificial de prosa.
**Gate**: Build.

### Task 4: Integrar Maven
#### T4: Entregar PackagesJava
**Where**: `PackagesJava/.github/workflows/release.yml`
**Depends on**: T3
**Requirement**: RPIL-03, RPIL-06
**Files**: caller/config nativo e manifest no consumidor, workflow de distribuição desativado automaticamente e documentação/status locais.
- [ ] Configurar caller por SHA, versão conjunta, revision sincronizada e skip-snapshot; preservar verify.
- [ ] Desativar distribuição automática; executar verify e contrato nativo correspondente.
- [ ] Commit `ci(versioning): integrate centralized Release Please stage one`, push e PR para release, sem merge.
**Tests**: integração nativa central e reactor Maven real.
**Gate**: Build.

### Task 5: Integrar npm
#### T5: Entregar PackagesVue
**Where**: `PackagesVue/.github/workflows/release.yml`
**Depends on**: T4
**Requirement**: RPIL-04, RPIL-06
**Files**: caller/config/manifest, gates legados concorrentes e documentação/status do consumidor.
- [ ] Mapear workspaces reais e seeds sem downgrade; preservar independência/privacidade e ranges/lockfile.
- [ ] Aposentar automação/gate concorrente Changesets e manter distribuição desabilitada.
- [ ] Executar npm verify e contratos; commit `ci(versioning): integrate centralized workspace releases`, push e PR para release.
**Tests**: grafo nativo central e gates npm reais.
**Gate**: Build.

### Task 6: Integrar Go
#### T6: Entregar boilerplate-cli
**Where**: `boilerplate-cli/.github/workflows/release.yml`
**Depends on**: T5
**Requirement**: RPIL-05, RPIL-06
**Files**: caller, CI/gates de integração antigos e guia/status, sem código funcional.
- [ ] Migrar integração legada para called imutável com publicação de binários false.
- [ ] Preservar Go CI, GoReleaser/configs de empacotamento e trabalho funcional, sem promoção de branches.
- [ ] Executar gates Go/contrato; commit `ci(versioning): migrate Go caller to Release Please`, push e PR para release.
**Tests**: suíte Go e integração nativa/contrato central.
**Gate**: Build.

### Task 7: Fechar a evidência da etapa
#### T7: Verificar entrega e pendências humanas
**Where**: `.specs/features/release-please-consumer-pilots-stage1/validation.md`
**Depends on**: T6
**Requirement**: RPIL-06
**Files**: relatórios de evidência e status TLC dos quatro repositórios.
- [ ] Verifier novo com gates e sensor isolado; corrigir gaps com rastreabilidade antes de declarar entrega.
- [ ] Conferir CI/SHAs dos PRs, solicitar revisão e registrar merges/publicações que dependem do usuário como pendentes.
- [ ] Commit/push dos registros finais; manter a meta ativa enquanto restar critério obrigatório não comprovado.
**Tests**: gates reais, sensor e revisão independente; nenhuma publicação inferida de mock.
**Gate**: Build.

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Sem entrada | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T4 | T4 -> T5 | Match |
| T6 | T5 | T5 -> T6 | Match |
| T7 | T6 | T6 -> T7 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Contrato | Integração | Mesmo teste funcional | Match |
| T2 | Orquestrador/SDK | Integração | Motor real + fixture | Match |
| T3 | Docs | Revisão + regressão | Suíte/CI | Match |
| T4 | Maven | Build/testes | verify + nativo | Match |
| T5 | npm | Build/testes | verify + nativo | Match |
| T6 | Go | Testes/vet/build | Gates Go + contrato | Match |
| T7 | Evidência | Independente | Gates/sensor | Match |
