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
