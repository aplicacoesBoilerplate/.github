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
