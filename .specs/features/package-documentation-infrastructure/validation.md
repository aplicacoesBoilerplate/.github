# Validation Report — infraestrutura documental Java/Vue

**Date**: 2026-10-25
**Verifier**: independent sub-agent `/root/package_docs_independent_verifier` (author ≠ verifier)
**Result**: PASS — rodada 2; implementação e prontidão técnica verificadas, sem gaps funcionais restantes no escopo.
**Publicação dos sites**: PENDENTE de promoção/merges humanos; Pages habilitado não equivale a deployment realizado.

## Escopo imutável

- Central: `acdb458..4859704556e2309dcc5030dcb7da2f3160414693`; código verificado em67a7773, seguido somente por registros TLC; runtime fixado nos consumidores `080df5aa1c803252ba91fa00ac529fc5e2006c47`.
- Java: `47a1991..fab31050b2f54d49067e06c81f23ddeca335c536`, PR36 para `release/v0.0.1`.
- Vue: `d17697a..b33547d185992007c2fb0bf2a3c8e78e8c641c4d`, PR39 para `release/v0.0.1`. Rodada1 avaliou85e9c1a e encontrou a base errada; reparo b33547d foi revalidado separadamente.
- Nenhum arquivo de implementação foi editado pelo Verifier. Sem Go, commits/push, merges, disparos de deploy ou alterações administrativas.
- Spec e todos os ACs foram rederivados; os validadores estruturais não foram usados como substitutos dos gates reais.

## Task Completion

| Task | Status | Evidence |
| --- | --- | --- |
| T1 called central | PASS | Dois layouts npm executados pelo teste funcional; central65/65/typecheck. |
| T2 Java | PASS | VitePress, quatro páginas, reactor quatro módulos/quatro testes, build limpo e sensor de divergência. |
| T3 Vue | PASS após reparo | Build limpo8/8 sem cache, cinco páginas/três APIs com base/SHA/versões corretos; env/hash/inputs e guard CI comprovados. |
| T4 revisão/entrega | Revisão PASS; persistência final pelo implementador | Sensor3/3 detectado; zero gaps restantes; publicar evidências finais, mantendo sites como pendentes de merges humanos. |

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
| PDOC-02.AC3 versão/base Java | Código documentado e /PackagesJava/ | Java `docs/.vitepress/config.mts:11`, `:16`, `:17`; `scratch/inspect-html.mjs:10`–`:13` confirma4HTML/base/coordenadas0.0.1; build limpo sem dist inicial passou. | PASS |
| PDOC-03.AC1 cinco pacotes/catalog UI | Cinco páginas e UI preservada | Vue `apps/docs/.vitepress/config.ts:29`, `:62`, `:67`, `:71`; auditor real: exports2/1/1, BaseOverlay e versão corretos nas três APIs; catálogo/previews anteriores preservados por diff. | PASS |
| PDOC-03.AC2 versão por pacote | package.json público do checkout, sem versão docs/schema | Vue `apps/docs/.vitepress/package-metadata.ts:17`, `:18`, `:21`; `apps/docs/.vitepress/config.ts:48`, `:52`; auditor real confirma quatro pacotes0.0.1, ui-vuetify1.1.1, nunca docs0.0.0/schema1.1. | PASS |
| PDOC-03.AC3 checkout limpo/base Vue | Manifests antes do catálogo e saída /PackagesVue/ | Vue `turbo.json:8`–`:16` declara env+inputs; `config.ts:13`, `:15`, `:36`, `:43` valida contexto e HTML. Snapshot b33547d sem seis dist/.turbo: npmci real, buildCI8/8 zero cache, auditor de cinco páginas/três APIs PASS. `scratch/check-turbo-context.mjs:19`–`:26` e `check-vue-metadata-inputs.mjs:24` provam hash/contexto/metadata; sensor de perda deenv detectado pelo gate real. | PASS após correção |
| PDOC-03.AC4 APIs vazias honestas | Composables/utils sem APIs fictícias | Vue `packages/composables/src/index.ts:2`, `packages/utils/src/index.ts:2` têm `export {}`; páginas `apps/docs/packages/composables.md:7`, `utils.md:7` dizem isso; auditor confirma fonte e texto renderizado nas duas páginas. | PASS |
| PDOC-04.AC1 contrato/SHA | uses/central-ref mesma revisão publicada/configs atuais | Ambas `.github/workflows/release.yml:17`, `:21`, `:34`, `:37`, `:39`–`:41` usam080df5a; callers docs também no mesmoSHA. `git ls-remote` confirmou heads atuais publicados. | PASS |
| PDOC-04.AC2 CI/sem registry/modelos | CI antes de writer; publish-artifactsfalse; Java conjunto/Vue independente | Ambas `.github/workflows/release.yml:25`, `:29`, `:38`; Java config raiz Maven e Vue config cinco paths distintos preservados. | PASS |
| PDOC-04.AC3 preservação | Fontes/branches/PRs e Go preservados | `git diff --name-status 47a1991..HEAD` e `d17697a..HEAD` restringe mudanças a docs/config/callers; nenhum fonte Java/Vue funcional alterado. Este Verifier não abriu nem modificou Go. | PASS |
| PDOC-05.AC1 persistência por tarefa | Gates antes de commits/push; próxima tarefa após publicação | `implementation-log.md:18`–`:55` e histórico complementar registram gates/SHAs; git history+ls-remote+CI confirmam central4859704/Javafab3105/Vueb33547d. Relatório final é entregue ao implementador para seu checkpoint final. | PASS do progresso publicado |
| PDOC-05.AC2 independência/sensor | Verifier distinto, gates e mutantes scratch | Este relatório; `scratch/central-sensor.mjs:20`, `scratch/java-sensor.mjs:29`, `scratch/vue-sensor.mjs:24` verificam saídas nãozero específicas dos faults, com restauração/novo gate. Real-tree porcelain antes/depois exatamente igual em ambas rodadas. | PASS |
| PDOC-05.AC3 publicação demonstrável | URL/run real ou pendência concreta, sem alegar deploy | Guards do called`:83`/`:88`; Pages workflow habilitado mas PRs para release/master ainda abertos e sem deployment dos sites. URLs configuradas não são evidência de publicação. | PASS do registro de pendência; publicação PENDENTE |

**Status**:17/17 critérios contemplados, sem reduzir a especificação. Critério de publicação usa explicitamente a alternativa de registrar a pendência humana; não significa site publicado.

## Gate Check

Gates executados serialmente nesta revisão:

1. Central `npm test --prefix ci-scripts`:65/65, zero falhas/cancelamentos/skips/todos; log Temp/pdoc-verifier-central.log. `npm run typecheck --prefix ci-scripts`:exit0. validate_spec/tasks --strict:0 erros/avisos. A feature adiciona um teste funcional, preservando os casos existentes; a base atualmaster contém64, total65.
2. Java `npm ci --prefix docs` + `DOCS_BASE=/PackagesJava/ DOCS_SOURCE_SHA=fab3105... npm run docs:build --prefix docs`:exit0; quatro HTML e asserts de coordenadas/versão. `mvn -B verify`:quatro módulos SUCCESS, quatro testes, zero falhas/erros/skips; Temp/pdoc-verifier-maven.log.
3. Rodada1 Vue npm10.9.4 `run verify -- --force --concurrency=1` com DOCS_BASE=/PackagesVue/:17/17 tarefas,0 cache; Temp/pdoc-verifier-vue.log. O gate antigo não detectava a base incorreta. passWithNoTests já existente em composables/utils não é evidência funcional desses pacotes.
4. Rodada2 Vue b33547d: npmci real em snapshot git archive; antes do build não existiam seis diretórios dist nem .turbo. `CI=true DOCS_BASE=/PackagesVue/ DOCS_SOURCE_SHA=b33547d...` e `npm10.9.4 run build -- --force --concurrency=1`:8/8 tarefas,zero cache,exit0. Log `scratch/vue-clean-build.log`. Auditor real lê quatro páginas Java/cinco Vue/três APIs, confere assets prefixados, SHA e versões; exit0 antes e depois do sensor.
5. Java clean archive: snapshot sem node_modules/dist, npmci e VitePress reais; quatro páginas/base PASS. Alteração/restauração com rebuild final PASS.
6. SDK Release Please17.3.0 e loaderTS reais: `node scratch/native-extra-files.mjs`, exit0. Read transport simulado sobre arquivos reais, cálculo e updaters nativos, rede explicitamente proibida. Não confundir esse ensaio com uma publicação GitHub/Maven.

CI hospedada antes da correção: central67a7773 CI40193297392/docs40193297370 PASS; Javafab3105 verify40192829453/docs40192829750 PASS; Vue85e9c1a validate40193158807/docs40193159137 PASS. O build hospedado aprovado do Vue também não comprova a base que faltava nas assertions. Preflight fornecido pelo orquestrador: Pages habilitado nos dois, github-pages somente master, ambos URLs404 e nenhum deployment; PR20/36/39 continuam abertos.

Após correção, CI b33547d [40195456856](https://github.com/aplicacoesBoilerplate/PackagesVue/actions/runs/40195456856) PASS17/17, com docs recompilado e16tarefas cacheadas; o called documental [40195457152](https://github.com/aplicacoesBoilerplate/PackagesVue/actions/runs/40195457152) passou8/8 ZEROcache, em runner limpo. Logs conferidos pelo orquestrador registram DOCS_BASE=/PackagesVue/ e DOCS_SOURCE_SHA=dc817aa991147fd8862d02b0064b5c4ba20a4cf4 (checkout merge do PR). Central4859704 também passou CI/docs/hygiene/version-policy. Os jobs de deploy continuam SKIPPED nos PRs, conforme o contrato. Não houve deployment.

Warnings Sass legados e de dependências não foram contados como falhas. Não houve exclusão, enfraquecimento ou skip de teste pelo Verifier.

## Discrimination Sensor

Sensor executado após os gates existentes passarem, em arquivos git archive temporários, nunca no código real. Profundidade lightweight, três faults nos riscos novos.

| Mutation | Location/assertion | Result |
| --- | --- | --- |
| Called ignora install-dir e tenta workspace dentro de apps/docs | scratch central workflow`:70`/`:74`; `documentation.test.ts:69` esperava`.` e recebeu`apps/docs` | KILLED,baseline0/mutant1 |
| Java docs9.9.9 enquanto manifest0.0.1 | scratch Java docs/package.json; loader `docs/packages.data.ts:17` lança erro no VitePress real | KILLED,baseline0/mutant1 |
| Turbo deixa de propagar DOCS_BASE no CI | scratch Vue `turbo.json:11`, removendo somente DOCS_BASE; VitePress real rejeita em `apps/docs/.vitepress/config.ts:13` | KILLED,baseline0/mutant1 |

**Result**:3/3 killed. Fontes scratch restaurados byte a byte; Java rebuild e Vue filtered build/auditor pós-restauração passaram. Mutações de entrada válidas separadas (composables/utils0.0.42) invalidaram o hash documental e, após restauração, recuperaram exatamente o hash anterior. Não contam como faults extras.

Scratch retido em Temp para evidência; nenhuma tentativa de cleanup destrutivo de junctions. Rodada1 antes/depois: porcelain vazio/HEADs67a7773/fab3105/85e9c1a idênticos. Após o reparo do implementador, nova captura antes/depois do sensor3: porcelain vazio/HEADs4859704/fab3105/b33547d idênticos. A gravação deste relatório ocorre depois dessas comparações. Uma primeira tentativa do sensor3 encontrou npm11 no PATH do próprio harness sanitizado; ela foi descartada como sinal inválido, corrigiu-se somente o PATH do harness para npm10.9.4 e repetiu-se até obter o erro específico DOCS_BASE. Nenhum código real foi alterado por isso.

## Code Quality / Edge Cases

- Mudanças cirúrgicas, sem novo motor de versão nem distribuição de pacotes. Um fluxo TS novo cobre dois layouts; verificações de HTML integradas ao build dos apps, sem proliferação de arquivos de teste pequenos.
- Java rejeita descompasso docs/manifest; versões nativas são responsabilidade do Release Please.
- Vue APIs UI não vazias e composables/utils vazios documentados corretamente. Preservação dos previews confirmada pelo diff e render SSR, sem alegar teste browser interativo.
- Gap encontrado na rodada1 e corrigido: contexto documental agora é propagado e participa do hash do Turbo apenas para docs#build; manifests públicos e config são inputs; o gate CI rejeita ausência das variáveis e confere assets/SHA renderizados.
- Habilitação Pages removeu o bloqueio administrativo inicial, mas merge/promoção humana permanece necessário e não foi contornado.
- Orquestrador conferiu o Go fora do escopo: HEAD282285ea372ab3bb9a5a47c5dff51d9b10b7c049 e porcelain vazio preservados; este Verifier não editou nem executou nada nesse piloto.

## Fix Resolved — histórico da rodada1

### Fix 1 — P1 resolvido em b33547d: preservar o contexto documental através do Turbo

- **Root cause**: Vue `turbo.json:4` não declara DOCS_BASE/SOURCE_SHA; modo strict filtra ambos. `apps/docs/.vitepress/config.ts:12` então usa`/`. Cinco HTML novos ficam com`/assets/...` em vez de`/PackagesVue/assets/...`.
- **Correção verificada**: tarefa docs#build com duas env e inputs externos, sem env-mode loose; CI chama verify com contexto do evento e o VitePress rejeita contexto ausente. Build compilado confere base/SHA/versões.
- **Fechamento**: snapshot limpo8/8zero-cache +9páginas/3APIs auditadas, hashes/contexto/metadata e sensor da perda deenv aprovados. Nenhum fix funcional permanece aberto.

## Requirement Traceability / Summary

| Requirement | Verdict |
| --- | --- |
| PDOC-01 | Verified |
| PDOC-02 | Verified — VitePress/reactor/buildlimpo/sensor/SDK/loader reais aprovados |
| PDOC-03 | Verified após reparo b33547d |
| PDOC-04 | Verified |
| PDOC-05 | Revisão independente aprovada; checkpoint final pelo implementador; deployment humano pendente |

**Overall**: READY técnico na rodada2. Zero gaps funcionais restantes;17/17ACs contemplados e3/3faults detectados. Round1 FAIL preservado no histórico4859704 e lição candidataL-002 mantida como evidência, sem promoção artificial de recorrência. A publicação real de [PackagesJava](https://aplicacoesboilerplate.github.io/PackagesJava/) e [PackagesVue](https://aplicacoesboilerplate.github.io/PackagesVue/) continua PENDENTE dos merges humanos: PR20para master, PR36/39para release/v0.0.1 e posterior promoção à master. Site publicado só poderá ser declarado após URL/run de deployment comprovados.

**Closing gate**: `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py package-documentation-infrastructure` executado sobre o relatório final:0 erros,exit0. `git diff --check`:exit0. A validação estrutural confirma a existência do relatório; a prontidão técnica está sustentada pelos gates reais descritos acima.
