# Registro da iteração documental Java/Vue

## Baseline e autorização

- Pedido de25/10/2026: somente infra Java/Vue, documentação por pacote e publicação pelo called central. Go fora desta iteração; merges continuam humanos. Execução inline, helpers de recon somente leitura.
- Central master1bd925d599f51a1a4d60bae57fee44c9b49c436d já inclui as alterações recentes do usuário: caminhos/configs/collisions/footer e extra-files nativos. PR19 integrado; não ressuscitar PR12 antigo.
- Worktree central limpo reaproveitado em codex/package-documentation-infrastructure a partir da nova master. Standalone repos locais release-pr19/docs-navigation e clones originais sujos preservados.
- Java PR36 head47a1991, base release2992a009. Vue PR39 headd17697a, base releasea846332. Reaproveitar as próprias branches dos PRs.
- Identidade AI restabelecida após detectar conta humana ativa; nenhuma credencial impressa. Ambas as apps dão write à AI; Pages GET404, estado de configuração não comprovado. Nenhuma mudança administrativa ou merge realizado.
- Baseline central63 testes/tipos aprovados. Documentação atual: Java só guia de versionamento; Vue3UI sem versões e sem páginas de composables/utils.

## T1: Called documental compatível com workspace

- RED: novo fluxo funcional falhou porque install-dir não existia.
- Implementação: install-dir vazio preserva docs-dir; build-script default docs:build; npm-version opcional instalado em runner.temp antes de qualquer npm no consumidor. npm ci/build usam o diretório de instalação; o upload usa docs-dir/.vitepress/dist. DOCS_BASE/SOURCE_SHA enviados ao build.
- Sem cópia de pipeline nas aplicações. Guard master+push/manual, PR build-only, environment e permissões mantidos. Removida somente a consulta antecipada de cache npm que violava devEngines.
- Um único teste funcional novo executa npmci e scripts de build reais em dois layouts temporários sem dependências de rede, conferindo HTML na saída esperada. Nenhum teste existente removido;63->64 casos.
- Gates:64/64, zero skips/falhas; typecheck e VitePress central aprovados, diff limpo. Typecheck detectou inferência de spawnSync no teste; anotação SpawnSyncReturns<string> corrigida antes do commit.

| Critério | Evidência de asserção | Resultado |
| --- | --- | --- |
| PDOC-01.AC1/default | documentation.test.ts:15, build-script.default === docs:build; execução standalone escreve HTML emdocs/.vitepress/dist | PASS |
| PDOC-01.AC2/workspace | documentation.test.ts:68-80, diretórios resolvidos e conteúdo built:workspace no upload apps/docs/.vitepress/dist | PASS |
| PDOC-01.AC3/npm | documentation.test.ts:24-30, pin antes de install, em runner.temp, sem cache antecipado | PASS do contrato; npm10.9.4 real verificado na app |
| PDOC-01.AC4/autorização | documentation.test.ts:33-39, igualdade dos guards e permissões Pages mínimas | PASS do contrato; sem deploy presumido |

Todas as asserções novas pertencem ao contrato PDOC-01; não ampliam regras de versão ou publicação de pacotes. Publicação efetiva dos sites ainda depende do gate de implantação e não é inferida desses testes.

## Reconciliação em25/10/2026

- Ao retomar, o worktree central já estava em codex/package-documentation-infrastructure/d79c8c6 e Java já tinha af24bc8 commitado/publicado, com site completo. Vue continha a implementação parcial autorizada, sem commit. Nenhum trabalho foi descartado ou refeito.
- A master avançou para acdb458, incluindo a correção GraphQL0f689aa. Incorporada por merge local preservando o histórico do PR20:080df5aa1c803252ba91fa00ac529fc5e2006c47. Gates65/65, zero skips/falhas, typecheck e VitePress central aprovados; push/SHA remoto conferido. Esse é o runtime comum dos dois consumidores.
- O snapshot global STATE ainda apontava para o piloto anterior; corrigido para esta feature com base nos commits e gates reais.

## T2 Java concluída

- af24bc8 contém site VitePress1.6.4, quatro páginas parent/BOM/core/starter, guias, loader com versão/commit e coordenadas Maven derivadas da versão. Revisão somente leitura confirmou as APIs e condições reais, sem inventar features.
- Gate autor: VitePress com base/PackagesJava/ e quatro páginas verificadas pelo buildEnd; mvn verify com quatro módulos/quatro testes/zero skips/falhas.
- Rehearsal independente suplementar no SDK17.3.0: Manifest.buildPullRequests aplicou0.0.2 aos quatro POMs/revision/manifest/docs package.json/lock rootversion/lock packages[''].version. Loader TS real aceitou{version:0.0.2,sha:b*40}; manifest antigo e JSON documental adulterado falharam. Evidências em Temp/rp-java-docs-extra-files-1792930805912/recheck.mjs:27-44,58-60,63,66 e result.json; sem rede ou escrita real.
- fab31050b2f54d49067e06c81f23ddeca335c536 repina validação/publicação/documentação para080df5a e corrige frase de exemplo de tag fixa no guia. Commit/push/SHA remoto conferidos no PR36. Nenhum fonte Java alterado.

## T3 Vue concluída

- Implementação parcial preservada e finalizada: cinco páginas de pacotes e catálogo, componentes de versão/instalação, loader TS de package.json, SHA e base/PackagesVue/. Catálogo UI gerado e previews preservados; composables/utils declaram corretamente API ainda vazia.
- buildEnd confere versão e comando npm em todas as cinco páginas, além de exports/manifests e API BaseOverlay nas três UI. Dados não usam schemaVersion ou versão privada de docs como versão da biblioteca.
- Gate autor: npm10.9.4 verify -- --force --concurrency=1,17/17 tarefas com zero cache, incluindo VitePress real e seus guards. Os passWithNoTests preexistentes de composables/utils não foram contados como cobertura funcional; nenhuma asserção/caso foi removido.
- README atualizado para os cinco nomes atuais e para o deploy central; guia de versão alinhado ao contrato atual config-file/manifest-file/project-path, incluindo bloqueio de override global ambíguo.
-85e9c1ac7662c2f409b4ec50d89e582c304ab69e publicado no PR39, caller de versão e caller documental na mesma revisão080df5a. Nenhum fonte funcional de biblioteca/feature pendente foi alterado.

## Preflight Pages atualizado

- Primeiro preflight comprovou has_pages:false nos dois consumidores. A conta AI tem push, sem Admin/Maintain; nenhuma política foi alterada pelo agente.
- Usuário respondeu Vou habilitar nos dois e depois Habilitado. Nova consulta confirmou has_pages:true, build_type:workflow e environment github-pages com regra somente master, sem reviewers/waiters adicionais retornados.
- URLs configuradas: https://aplicacoesboilerplate.github.io/PackagesJava/ e https://aplicacoesboilerplate.github.io/PackagesVue/. Na consulta, ainda404 e sem deployments. Configuração habilitada não equivale a site publicado.
- PRs36/39 continuam para release/v0.0.1; PR20 central para master. Merges permanecem humanos. Não contornar guard de deployment nem promover features para conseguir evidência.
