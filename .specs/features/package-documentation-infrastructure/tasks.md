# Package documentation implementation plan

**Status:** execução do escopo solicitada pelo usuário. Main implementa inline; helpers somente recon/revisão.

## Global Constraints

Go excluído, issue4 fechada, distribuição Maven/npm false, nenhum merge/política por conta própria. Um commit e push por tarefa verificada. Preservar todos os testes e os clones originais sujos.

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Called documental | Integração funcional | Dois layouts reais e guards/defaults/npm pin | ci-scripts/tests/documentation.test.ts | npm test --prefix ci-scripts |
| Site Java | Build/contrato nativo | Quatro artefatos/versão/links + reactor | docs/ e POMs | npm run docs:build --prefix docs; mvn -B verify |
| Site Vue | Build/contrato | Cinco pacotes + API UI + versões | apps/docs/ | npm run verify -- --force |
| Entrega | Independente/hospedado | SHAs, CI, sensor e Pages | .specs/feature/validation.md | Gates pertinentes + APIs GitHub |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Iterar called | npm exec --prefix ci-scripts -- tsx --test ci-scripts/tests/documentation.test.ts |
| Full | Central | npm test --prefix ci-scripts; npm run typecheck --prefix ci-scripts |
| Build | Fim de tarefa | Full central ou gate real do consumidor; git diff --check e validadores TLC |

## Execution Plan

### Phase 1: Integração e documentação

```text
T1 -> T2 -> T3 -> T4
```

## Task Breakdown

### Task 1: Called documental
#### T1: Suportar site isolado e workspace
**Where**: `.github/workflows/documentacao-pages.yml`
**Depends on**: None
**Requirement**: PDOC-01
**Tests**: Um teste funcional com npm/build reais em dois layouts e guard de publicação.
**Gate**: Build.
- [x] RED observado por input ausente; install-dir/build-script/npm-version implementados sem alterar default ou autorização de deploy.
- [x] Gate64/64 inicial e65/65 após incorporar a master atual, tipos e VitePress aprovados; runtime publicado em080df5a antes dos consumidores.

### Task 2: Java
#### T2: Documentar quatro artefatos e migrar caller
**Where**: `PackagesJava/docs/`
**Depends on**: T1
**Requirement**: PDOC-02, PDOC-04
**Tests**: VitePress real, reactor e extra-files nativos.
**Gate**: Build.
- [x] Site isolado/versão dinâmica e quatro páginas reais; POMs/manifest/JSONs documentais sincronizados pelo motor e negativos do loader aprovados.
- [x] Callers atualizados; VitePress e reactor aprovados; af24bc8 +repin fab3105 publicados no PR36 antes de concluir T3.

### Task 3: Vue
#### T3: Documentar cinco pacotes e migrar caller
**Where**: `PackagesVue/apps/docs/`
**Depends on**: T2
**Requirement**: PDOC-03, PDOC-04
**Tests**: Build limpo real e HTML/versões/manifests, verify preservado.
**Gate**: Build.
- [x] Páginas dos cinco pacotes e versões do checkout, preservando catálogo UI e features pendentes.
- [x] Callers/Pages atualizados; reparo b33547d publicado/conferido no PR39 após verify17/17, inspeção real dos cinco HTML e negativos em CI; revalidação independente em T4.

### Task 4: Evidência e publicação
#### T4: Verificar independentemente e conferir Pages
**Where**: `.specs/features/package-documentation-infrastructure/validation.md`
**Depends on**: T3
**Requirement**: PDOC-05
**Tests**: Gates reais, sensor scratch, CI/runs/Pages/SHAs.
**Gate**: Build.
- [ ] Verifier novo; corrigir gaps e validar, máximo três rodadas.
- [ ] Conferir PRs/CI e tentar somente publicação autorizada; registrar URL/run ou impedimentos concretos de permissão/merge.
- [ ] Commit/push final de evidências, sem alegar publicação não comprovada.

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Sem entrada | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Called | Integração | Mesmo fluxo para dois layouts | Match |
| T2 | Java | Build/nativo | Site/reactor | Match |
| T3 | Vue | Build | Site/verify | Match |
| T4 | Entrega | Independente | Gates/sensor/CI | Match |
