# Validation Report — infraestrutura documental Java/Vue

**Date**: 2026-10-25
**Verifier**: independent sub-agent `/root/package_docs_independent_verifier` (author ≠ verifier)
**Result**: FAIL — rodada 1; corrigir PDOC-03.AC3 antes da entrega técnica.
**Publicação dos sites**: PENDENTE de promoção/merges humanos; Pages habilitado não equivale a deployment realizado.

## Escopo imutável

- Central: `acdb458..67a7773b480c8dbc69ec5e273d0bc27dfa317870`; runtime fixado nos consumidores `080df5aa1c803252ba91fa00ac529fc5e2006c47`.
- Java: `47a1991..fab31050b2f54d49067e06c81f23ddeca335c536`, PR36 para `release/v0.0.1`.
- Vue: `d17697a..85e9c1ac7662c2f409b4ec50d89e582c304ab69e`, PR39 para `release/v0.0.1`.
- Nenhum arquivo de implementação foi editado pelo Verifier. Sem Go, commits/push, merges, disparos de deploy ou alterações administrativas.
- Spec e todos os ACs foram rederivados; os validadores estruturais não foram usados como substitutos dos gates reais.

## Task Completion

| Task | Status | Evidence |
| --- | --- | --- |
| T1 called central | PASS | Dois layouts npm executados pelo teste funcional; central65/65/typecheck. |
| T2 Java | PASS | VitePress, quatro páginas, reactor quatro módulos/quatro testes, build limpo e sensor de divergência. |
| T3 Vue | FAIL parcial | verify17/17 não detecta a base errada: os cinco HTML recém-compilados apontam para `/assets/`. |
| T4 revisão/entrega | Em execução | Sensor2/2 detectado; correção e revalidação pendentes; sites ainda não publicados. |

## Spec-Anchored Acceptance Criteria

Paths nesta matriz são relativos ao respectivo repositório; `scratch/` significa `C:/Users/gerso/AppData/Local/Temp/pdoc-independent-0d008d2b705640c19da5fe53017bdce1/`.

| Criterion | Spec-defined outcome | file:line + assertion/outcome | Result |
| --- | --- | --- | --- |
| PDOC-01.AC1 omissão de inputs | Instalar em docs-dir e executar docs:build | central `ci-scripts/tests/documentation.test.ts:14`, `:15`, `:46`, `:69`, `:70`, `:79`: defaults, diretórios e HTML `built:standalone`; teste real passou. | PASS |
| PDOC-01.AC2 workspace | Instalar/buildar raiz e upload de apps/docs/.vitepress/dist | central `documentation.test.ts:47`, `:69`, `:70`, `:79`: diretórios `.` e HTML `built:workspace`; erro proposital foi detectado em`:69`. | PASS |
| PDOC-01.AC3 npm solicitado | Pin antes de acessar o consumidor | central `documentation.test.ts:22`, `:24`, `:26`, `:27`: sem cache npm antecipado, runner.temp, pin e ordem; Vue verify executado com npm10.9.4. | PASS |
| PDOC-01.AC4 PR/publicação | PR build-only; deploy master; Pages mínimos | central `documentation.test.ts:34`, `:36`, `:37`, `:38`: guards idênticos upload/deploy e permissions exatas; called `.github/workflows/documentacao-pages.yml:83`, `:88`, `:91`. | PASS |
| PDOC-02.AC1 quatro artefatos reais | Parent/BOM/core/starter, sem APIs inventadas | Java `docs/artefatos/core.md:13`, `:16` corresponde a `boilerplate-core/src/main/java/br/com/aplicacoesBoilerplate/core/CBoilerplateInfoContributor.java:12`; starter documenta condições implementadas em `boilerplate-starter/src/main/java/br/com/aplicacoesBoilerplate/starter/CBoilerplateAutoConfiguration.java:16`, `:20`, `:21`. HTML das quatro páginas existe e contém coordenadas/versionamento. | PASS |
| PDOC-02.AC2 versão conjunta | POMs/revision/manifest/docs JSONs alinhados pelo motor nativo | Java `release-please-config.json:9` e`:15`; ensaio SDK `scratch/native-extra-files.mjs:27`–`:44` aplicou0.0.2 usando Manifest real aos quatro POMs/revision/manifest e três campos JSON; loader aceitou0.0.2 e rejeitou ambos os negativos`:58`–`:66`; exit0 sem rede. | PASS |
| PDOC-02.AC3 versão/base Java | Código documentado e /PackagesJava/ | Java `docs/.vitepress/config.mts:11`, `:16`, `:17`; `scratch/inspect-html.mjs:9`, `:10`, `:11` confirma4HTML/base/coordenadas0.0.1; build limpo sem dist inicial passou. | PASS |
| PDOC-03.AC1 cinco pacotes/catalog UI | Cinco páginas e UI preservada | Vue `apps/docs/.vitepress/config.ts:21`, `:28`, `:30`, `:31`; `scratch/inspect-html.mjs:28`–`:32`: exports2/1/1, BaseOverlay e versão corretos nas três APIs; catálogo/previews anteriores preservados por diff. | PASS |
| PDOC-03.AC2 versão por pacote | package.json público do checkout, sem versão docs/schema | Vue `apps/docs/.vitepress/package-metadata.ts:17`, `:18`, `:21`; `scratch/inspect-html.mjs:19`, `:20`, `:23`, `:24`: quatro pacotes0.0.1, ui-vuetify1.1.1, nunca docs0.0.0/schema1.1. | PASS |
| PDOC-03.AC3 checkout limpo/base Vue | Manifests antes do catálogo e saída /PackagesVue/ | Manifest/catalog foram construídos no verify17. Porém `scratch/inspect-html.mjs:22`, `:39` falha nos cinco HTML; `turbo run build --dry=json` mostra strict/configured[]/inferred[]/passthrough null. `DOCS_BASE=/PackagesVue/` foi filtrado antes do VitePress. | FAIL |
| PDOC-03.AC4 APIs vazias honestas | Composables/utils sem APIs fictícias | Vue `packages/composables/src/index.ts:2`, `packages/utils/src/index.ts:2` têm `export {}`; páginas `apps/docs/packages/composables.md:7`, `utils.md:7` dizem isso; `scratch/inspect-html.mjs:35`, `:36` confirma fonte e texto renderizado. | PASS |
| PDOC-04.AC1 contrato/SHA | uses/central-ref mesma revisão publicada/configs atuais | Ambas `.github/workflows/release.yml:17`, `:21`, `:34`, `:37`, `:39`–`:41` usam080df5a; callers docs também no mesmoSHA. `git ls-remote` confirmou heads atuais publicados. | PASS |
| PDOC-04.AC2 CI/sem registry/modelos | CI antes de writer; publish-artifactsfalse; Java conjunto/Vue independente | Ambas `.github/workflows/release.yml:25`, `:29`, `:38`; Java config raiz Maven e Vue config cinco paths distintos preservados. | PASS |
| PDOC-04.AC3 preservação | Fontes/branches/PRs e Go preservados | `git diff --name-status 47a1991..HEAD` e `d17697a..HEAD` restringe mudanças a docs/config/callers; nenhum fonte Java/Vue funcional alterado. Este Verifier não abriu nem modificou Go. | PASS |
| PDOC-05.AC1 persistência por tarefa | Gates antes de commits/push; próxima tarefa após publicação | `implementation-log.md:18`–`:55` registra gates e SHAs; git history + ls-remote conferem central67a7773/Javafab3105/Vue85e9c1a. Status final desta revisão ainda deve ser persistido pelo implementador. | PASS das tarefas concluídas; final pendente |
| PDOC-05.AC2 independência/sensor | Verifier distinto, gates e mutantes scratch | Este relatório; `scratch/central-sensor.mjs:14`–`:28` e `scratch/java-sensor.mjs:18`–`:43`, ambos detectaram falhas; real-tree porcelain antes/depois exatamente igual. | PASS da revisão, com gap encaminhado |
| PDOC-05.AC3 publicação demonstrável | URL/run real ou pendência concreta, sem alegar deploy | Guards do called`:83`/`:88`; Pages workflow habilitado mas PRs para release/master ainda abertos e sem deployment dos sites. URLs configuradas não são evidência de publicação. | PASS do registro de pendência; publicação PENDENTE |

**Status**: há um gap funcional de base Vue. Não reduzir a especificação para aceitar assets na raiz.

## Gate Check

Gates executados serialmente nesta revisão:

1. Central `npm test --prefix ci-scripts`:65/65, zero falhas/cancelamentos/skips/todos; log Temp/pdoc-verifier-central.log. `npm run typecheck --prefix ci-scripts`:exit0. validate_spec/tasks --strict:0 erros/avisos. A feature adiciona um teste funcional, preservando os casos existentes; a base atualmaster contém64, total65.
2. Java `npm ci --prefix docs` + `DOCS_BASE=/PackagesJava/ DOCS_SOURCE_SHA=fab3105... npm run docs:build --prefix docs`:exit0; quatro HTML e asserts de coordenadas/versão. `mvn -B verify`:quatro módulos SUCCESS, quatro testes, zero falhas/erros/skips; Temp/pdoc-verifier-maven.log.
3. Vue npm10.9.4 `run verify -- --force --concurrency=1` com DOCS_BASE=/PackagesVue/:17/17 tarefas,0 cache; Temp/pdoc-verifier-vue.log. passWithNoTests já existente em composables/utils não é evidência funcional desses pacotes. Este gate passa indevidamente quanto à base, comprovado pelo auditor HTML independente.
4. Auditor de HTML real: Java4páginas PASS; Vue5versões +3APIs PASS; base de todos5Vue FAIL.
5. Java clean archive: snapshot sem node_modules/dist, npmci e VitePress reais; quatro páginas/base PASS. Alteração/restauração com rebuild final PASS.
6. SDK Release Please17.3.0 e loaderTS reais: `node scratch/native-extra-files.mjs`, exit0. Read transport simulado sobre arquivos reais, cálculo e updaters nativos, rede explicitamente proibida. Não confundir esse ensaio com uma publicação GitHub/Maven.

CI hospedada antes da correção: central67a7773 CI40193297392/docs40193297370 PASS; Javafab3105 verify40192829453/docs40192829750 PASS; Vue85e9c1a validate40193158807/docs40193159137 PASS. O build hospedado aprovado do Vue também não comprova a base que faltava nas assertions. Preflight fornecido pelo orquestrador: Pages habilitado nos dois, github-pages somente master, ambos URLs404 e nenhum deployment; PR20/36/39 continuam abertos.

Warnings Sass legados e de dependências não foram contados como falhas. Não houve exclusão, enfraquecimento ou skip de teste pelo Verifier.

## Discrimination Sensor

Sensor executado após os gates existentes passarem, em arquivos git archive temporários, nunca no código real. Profundidade lightweight, dois faults nos riscos novos.

| Mutation | Location/assertion | Result |
| --- | --- | --- |
| Called ignora install-dir e tenta workspace dentro de apps/docs | scratch central workflow`:70`/`:74`; `documentation.test.ts:69` esperava`.` e recebeu`apps/docs` | KILLED,baseline0/mutant1 |
| Java docs9.9.9 enquanto manifest0.0.1 | scratch Java docs/package.json; loader `docs/packages.data.ts:17` lança erro no VitePress real | KILLED,baseline0/mutant1 |

**Result**:2/2 killed. Fontes scratch restaurados byte a byte e Java rebuild pós-restauração passou. Scratch retido em Temp para evidência; nenhuma tentativa de cleanup destrutivo de junctions. Antes/depois dos sensores: porcelain vazio e mesmo HEAD nos três repositórios; confirmado antes da escrita deste relatório.

## Code Quality / Edge Cases

- Mudanças cirúrgicas, sem novo motor de versão nem distribuição de pacotes. Um fluxo TS novo cobre dois layouts; verificações de HTML integradas ao build dos apps, sem proliferação de arquivos de teste pequenos.
- Java rejeita descompasso docs/manifest; versões nativas são responsabilidade do Release Please.
- Vue APIs UI não vazias e composables/utils vazios documentados corretamente. Preservação dos previews confirmada pelo diff e render SSR, sem alegar teste browser interativo.
- Gap importante: a suíte verifica texto/versões mas não o destino correto dos assets sob o nome do repositório. Build aprovado ainda pode produzir Pages quebrado.
- Habilitação Pages removeu o bloqueio administrativo inicial, mas merge/promoção humana permanece necessário e não foi contornado.

## Fix Plans

### Fix 1 — P1: preservar o contexto documental através do Turbo

- **Root cause**: Vue `turbo.json:4` não declara DOCS_BASE/SOURCE_SHA; modo strict filtra ambos. `apps/docs/.vitepress/config.ts:12` então usa`/`. Cinco HTML novos ficam com`/assets/...` em vez de`/PackagesVue/assets/...`.
- **Fix task**: declarar as duas variáveis no contrato da tarefa build, incluindo-as no hash do Turbo; acrescentar assertion compilada que confira base real e SHA esperado quando fornecido. Não usar env-mode loose global nem outro número de versão.
- **Done when**: build raiz com caller real e checkout limpo, sem outputs/caches iniciais, gera cinco páginas e três APIs com assets/links `/PackagesVue/`, mantendo versões individuais e SHA; reexecute gates afetados e sensor que detecte a perda da configuração.

## Requirement Traceability / Summary

| Requirement | Verdict |
| --- | --- |
| PDOC-01 | Verified |
| PDOC-02 | Verified — VitePress/reactor/buildlimpo/sensor/SDK/loader reais aprovados |
| PDOC-03 | Needs Fix — AC3 |
| PDOC-04 | Verified |
| PDOC-05 | Evidência/sensor registrados; correção/persistência final pendentes; deployment humano pendente |

**Overall**: NOT READY na rodada1. Nenhuma falha funcional Java encontrada. Vue exige corrigir a propagação da base antes de promover. A publicação real dos dois sites continua PENDENTE dos merges humanos e deve ser comprovada por URL/run posteriormente.
