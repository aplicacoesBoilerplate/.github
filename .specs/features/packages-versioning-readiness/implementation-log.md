# Diário de implementação — versionamento central em TypeScript

## T1 — conciliação da base (2026-10-21)

Referências verificadas com `git show`: master `3511b1f1266a35d43ff12a81306514c44cc65fc5`, PR #12 `c7e610117edfbe8a6338ec0d3b6703156026ef70`, PR #13 `b1b2ec51906306c7afa5129f6557b30b9528f6b5`, ancestral comum `fcf31e08165156a5938eec7577bbf1be945f365f`. A base de trabalho vinha do #12; o delta pertinente do #13 foi integrado em merge local, mantendo as especificações anteriores como histórico.

Seleção nos conflitos: preservados os jobs de leitura/escrita separados, a transferência de artifacts validados, Node 24, Java 21, Maven fixado e o bundle pré-calculado de standard-version; adicionados Changesets ao registro, aos outputs em lote, à instalação Node no leitor, aos guias, callers de exemplo e duas fixtures próprias. O teste de contrato do workflow foi ampliado para exigir exatamente ambos os perfis Node no leitor e token de App apenas na fase funcional. Nenhuma asserção foi removida. A conciliação ainda **não** torna Changesets publicável: seu gerador legado executa no escritor, enquanto o job exige bundle pré-calculado. Tarefas posteriores fecharão esse limite antes da entrega central remota.

Inventário fora de escopo preservado: `boilerplate-cli`, `PackagesJava`, `PackagesVue`, issues desses produtos, PRs remotos e tags/releases hospedadas. A integração ocorreu apenas no worktree de `.github`, sem push remoto. Os arquivos OpenSpec não foram apagados.

Gate Baseline: `node tests/versioning/run.mjs --local`, com `C:\Program Files\Git\bin` antes do Bash WSL inválido no PATH, passou com código 0 nas 29 fixtures. O primeiro ensaio detectou uma expectativa antiga no contrato Node; após atualização da asserção para o contrato ampliado, a execução integral passou. `node tests/versioning/workflow-contract.mjs`: 79 asserções passaram; `node tests/versioning/native-workflows.mjs`: passou; `node tests/versioning/changesets-flow.mjs`: passou. Esses testes são locais e não substituem verificação independente nem CI hospedada.

## T2 — toolchain TypeScript (2026-10-21)

Teste red-green: `node tests/versioning/typescript-build.mjs` falhou inicialmente por ausência do manifest central. Criados `scripts/versioning/package.json`, lockfile npm v3, `tsconfig.json`, fonte inicial `src/index.ts` e saída ESM `dist/index.js`. Compilador `typescript@5.9.3` e tipos `@types/node@24.10.0` foram fixados; o pacote é privado, sem `bin`, sem instalação no consumidor. A fixture verifica configuração estrita, fonte válida, import ESM do compilado sem loader, erro TS2322 e ausência de saída com `noEmitOnError`.

Gate Toolchain: `npm --prefix scripts/versioning run typecheck` passou; `npm --prefix scripts/versioning run build` passou; `node tests/versioning/typescript-build.mjs` passou; `node tests/versioning/run.mjs --local` passou com código 0 nas 30 fixtures, incluindo a nova. Dependências de desenvolvimento locais foram instaladas com `npm ci --ignore-scripts --no-audit --no-fund` a partir do lockfile; `node_modules` não é versionado. A correspondência completa de `src`/`dist` será adicionada e testada em T3.

## T3 — integridade da distribuição compilada (2026-10-21)

Teste red-green: `node tests/versioning/dist-integrity.mjs` falhou primeiro pela ausência de `src/build/check-dist.ts`. O verificador tipado percorre o conjunto completo de arquivos da recompilação isolada e do `dist` versionado, compara nomes e bytes e rejeita symlinks/entradas especiais. O script `check-dist` usa a fixture de build para recompilar em diretório temporário e executar o verificador recém-compilado, não uma cópia possivelmente adulterada do próprio `dist`.

Casos confirmados: distribuição idêntica, byte alterado, arquivo faltante, arquivo extra, junction de diretório rejeitado explicitamente como symlink e recompilação repetida idêntica. No Windows, criação de symlink de arquivo retornou `EPERM`; o teste usa junction, sem pular a prova de rejeição de link. `npm --prefix scripts/versioning run typecheck`, `build` e `check-dist` passaram. `node tests/versioning/run.mjs --local` passou com código 0 nas 31 fixtures. O `git diff --check` e o validador TLC são executados antes do commit desta tarefa.

## T4 — porta tipada de processos e paths (2026-10-21)

Teste red-green: a fixture `tests/versioning/process-runner.mjs` falhou inicialmente porque `dist/ports/process.js` não existia. A implementação passou a `src/ports/process.ts`; `process-runner.mjs` é somente fachada de exportação. A porta aplica `realpath` a workspace/cwd, remove credenciais e opções de runtime do ambiente filho, usa argv separado, limita timeout a 120 s e saída a 1 MiB, e mantém o tratamento de launchers nativos no Windows sem invocar a própria lógica em Shell.

Casos da fixture: sucesso/subdiretório, cwd externo direto e via junction, segredos removidos, timeout configurado e limite máximo, saída maior que 1 MiB, código de erro, comando ausente, argv inválido, launcher `.cmd` com espaços e rejeição de metacaractere (Windows), além de import isolado sem efeitos no filesystem. `node tests/versioning/process-runner.mjs` passou; `npm --prefix scripts/versioning run typecheck`, `build` e `check-dist` passaram; `node tests/versioning/run.mjs --local` passou com código 0 nas 31 fixtures. Nenhuma instalação ou mutação ocorreu nos consumidores.

## T5 — porta tipada de Git e snapshot (2026-10-21)

Teste red-green: `tests/versioning/git-port.mjs` falhou inicialmente porque `dist/ports/git.js` ainda não existia. A nova `src/ports/git.ts` executa Git por argv, lê blobs por SHA, resolve a tag anotada até o commit, captura refs ordenadas e conserva a regra de retry da própria tag no mesmo SHA. `git-inputs.mjs` virou fachada e entrypoint de arquivo; a lógica de snapshot vive no compilado. A porta já aceita os cinco IDs previstos, mas isso não habilita perfis não implementados.

Os testes Git reais cobrem SHA correto e incorreto, blob da origem após avanço do checkout, peeling de tag anotada, ref nova, substituição de ref já observada, retry da tag exata e checkout avançado. `node tests/versioning/git-port.mjs` e `node tests/versioning/git-inputs.mjs` passaram. `npm --prefix scripts/versioning run typecheck`, `build` e `check-dist` passaram; `node tests/versioning/run.mjs --local` passou com código 0 nas 32 fixtures. O relatório e o commit desta tarefa não afirmam publicação hospedada.

## T6 — portas GitHub de leitura e escrita (2026-10-21)

Teste red-green: `tests/versioning/github-port.mjs` falhou primeiro por ausência de `dist/ports/github.js`. A implementação em `src/ports/github.ts` define transporte injetável sem credenciais no modelo de requisição, `ReadApi` com GET opcional/paginado e `WriteApi` separada para mutações. Paginação segue somente links do mesmo endpoint e origem; ciclo ou deslocamento são recusados. 404 é ausência apenas em `getOptional`; 401, 403, 429, 5xx e 404 em lista/escrita são erros HTTP explícitos sem ecoar corpo potencialmente sensível.

Casos confirmados: página única/final, duas páginas, 404 opcional e lista 404, 401/403/429/503, ReadApi sem método de escrita, payload exato do POST, URL externa recusada e Link externo recusado. `node tests/versioning/github-port.mjs` passou; `npm --prefix scripts/versioning run typecheck`, `build` e `check-dist` passaram; `node tests/versioning/run.mjs --local` passou com código 0 nas 33 fixtures. O coletor legado ainda não usa esta porta; a integração é tarefa posterior, portanto T6 não comprova execução hospedada.

## T7 — contrato e registro tipados (2026-10-21)

Teste red-green: `tests/versioning/adapter-contract.mjs` falhou inicialmente pela ausência do módulo compilado. A nova camada define `AdapterContext` sem credenciais, descritores discriminados por ID/capacidade, `ReleasePlan` single/batch/no-release e digest SHA-256 sobre JSON canônico. O registro confiável conhece cinco IDs; implementação ausente falha explicitamente, sem fallback para outro adaptador. Isto ainda não habilita a execução nativa dos dois perfis novos — ela ocorrerá nas tarefas de adaptação.

As fixtures cobrem cinco IDs e capacidades, IDs desconhecidos e `__proto__`, capacidade errada/prepare ausente, JSON inválido, plano vazio/unitário/múltiplo, no-release, digest adulterado, campos adicionais inseguros, incremento divergente, path externo, valor não serializável, substituto confiável e import sem escrita. `type-tests/adapter-contract.ts` demonstra que o compilador rejeita contexto com token, runtime incompatível e preparo ausente/artificial. `node tests/versioning/adapter-contract.mjs` e `type-contracts.mjs` passaram. Gate Build: typecheck, build, check-dist e `node tests/versioning/run.mjs --local` passaram com código 0 nas 35 fixtures. O registro `.mjs` legado continua temporariamente atendendo os três perfis já operacionais; será migrado com seus adaptadores, sem expor os novos como prontos prematuramente.

## T8 — policy compartilhada em TypeScript (2026-10-21)

Teste red-green: `tests/versioning/release-policy.mjs` falhou por ausência de `dist/services/release-policy.js`. A decisão pura migrou para `src/services/release-policy.ts`, e a fachada `.mjs` só lê/grava os arquivos de CLI. O classificador de incremento é o contrato TypeScript comum; a policy não calcula uma versão alternativa. SHA e SemVer de entrada são validados antes de aceitar a autoridade do adaptador.

Os 63 checks específicos cobrem rotas develop/hotfix equivalentes, sem milestone, match exato, divergência de versão/bump, título inválido sem bypass, duas pessoas Maintain/Admin, mesmo ator, papel insuficiente, ordem e SHA do review, lote Changesets com/sem milestone e SHA de publicação distinto do head revisado. `node tests/versioning/release-policy.mjs` passou; typecheck, build e check-dist passaram; `node tests/versioning/run.mjs --local` passou com código 0 nas 35 fixtures. A coleta auditável de timeline/reviews ainda será migrada em T9; este resultado não autoriza publicação.

## T9 — evidência auditável de PR e CI (2026-10-21)

Teste red-green: `pr-evidence.mjs` falhou inicialmente porque o serviço compilado não existia; `github-port.mjs` falhou porque a porta não lia o objeto paginado `check_runs`. O serviço `src/services/pr-evidence.ts` agora reduz timeline, reviews efetivas, papéis, milestone atual e checks vinculados ao SHA exigido. A porta de leitura ganhou paginação de campo (`listField`) para o endpoint de check-runs. A coleta também distingue o head revisado do merge commit a publicar e rejeita proveniência ambígua.

Os cenários específicos passaram para aprovação válida, dismissed, changes-requested, bot/revisor-autor, review de head antigo, CI de SHA errado, milestone removida/trocada, label reaplicado/retirado, labeler sem Maintain/Admin, check duplicado mais recente, review pendente e falhas de API/papel. `node tests/versioning/pr-evidence.mjs`, `github-port.mjs`, `pr-policy.mjs` e `pr-check.mjs` passaram; typecheck, build e check-dist passaram. `node tests/versioning/run.mjs --local` passou com código 0 nas 36 fixtures. O workflow ainda chama o coletor legado; T24 migrará o entrypoint. Nenhuma autorização ou publicação hospedada foi inferida desses testes locais.

## T10 — guia de homologação tipado (2026-10-21)

Teste red-green: `homologation-guide.mjs` falhou primeiro pela ausência de `dist/services/homologation-guide.js`. O serviço `src/services/homologation-guide.ts` renderiza JSON e Markdown a partir do relatório nativo ou do `ReleasePlan` validado. A fachada `.mjs` preserva a CLI e a validação do relatório legado; a lógica de apresentação foi migrada para TypeScript. O guia mantém fatos coletados apartados dos checks sugeridos, sempre pendentes, e escapa conteúdo não confiável.

Casos confirmados: versão única Go, lote Changesets com dependente, no-release Release Please, caracteres HTML/Markdown hostis, checklist recebido como `done` convertido a `pending`, incompatibilidade de SHA e ausência de alteração no checkout do consumidor. `node tests/versioning/homologation-guide.mjs`, typecheck, build e check-dist passaram; `node tests/versioning/run.mjs --local` passou com código 0 nas 36 fixtures. O guia é artefato provisório e não declara homologação ou aprovação humana; a troca de workflow permanece para T24–T27.
