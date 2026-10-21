# Diário de implementação — versionamento central em TypeScript

## T1 — conciliação da base (2026-10-21)

Referências verificadas com `git show`: master `3511b1f1266a35d43ff12a81306514c44cc65fc5`, PR #12 `c7e610117edfbe8a6338ec0d3b6703156026ef70`, PR #13 `b1b2ec51906306c7afa5129f6557b30b9528f6b5`, ancestral comum `fcf31e08165156a5938eec7577bbf1be945f365f`. A base de trabalho vinha do #12; o delta pertinente do #13 foi integrado em merge local, mantendo as especificações anteriores como histórico.

Seleção nos conflitos: preservados os jobs de leitura/escrita separados, a transferência de artifacts validados, Node 24, Java 21, Maven fixado e o bundle pré-calculado de standard-version; adicionados Changesets ao registro, aos outputs em lote, à instalação Node no leitor, aos guias, callers de exemplo e duas fixtures próprias. O teste de contrato do workflow foi ampliado para exigir exatamente ambos os perfis Node no leitor e token de App apenas na fase funcional. Nenhuma asserção foi removida. A conciliação ainda **não** torna Changesets publicável: seu gerador legado executa no escritor, enquanto o job exige bundle pré-calculado. Tarefas posteriores fecharão esse limite antes da entrega central remota.

Inventário fora de escopo preservado: `boilerplate-cli`, `PackagesJava`, `PackagesVue`, issues desses produtos, PRs remotos e tags/releases hospedadas. A integração ocorreu apenas no worktree de `.github`, sem push remoto. Os arquivos OpenSpec não foram apagados.

Gate Baseline: `node tests/versioning/run.mjs --local`, com `C:\Program Files\Git\bin` antes do Bash WSL inválido no PATH, passou com código 0 nas 29 fixtures. O primeiro ensaio detectou uma expectativa antiga no contrato Node; após atualização da asserção para o contrato ampliado, a execução integral passou. `node tests/versioning/workflow-contract.mjs`: 79 asserções passaram; `node tests/versioning/native-workflows.mjs`: passou; `node tests/versioning/changesets-flow.mjs`: passou. Esses testes são locais e não substituem verificação independente nem CI hospedada.

## T2 — toolchain TypeScript (2026-10-21)

Teste red-green: `node tests/versioning/typescript-build.mjs` falhou inicialmente por ausência do manifest central. Criados `scripts/versioning/package.json`, lockfile npm v3, `tsconfig.json`, fonte inicial `src/index.ts` e saída ESM `dist/index.js`. Compilador `typescript@5.9.3` e tipos `@types/node@24.10.0` foram fixados; o pacote é privado, sem `bin`, sem instalação no consumidor. A fixture verifica configuração estrita, fonte válida, import ESM do compilado sem loader, erro TS2322 e ausência de saída com `noEmitOnError`.

Gate Toolchain: `npm --prefix scripts/versioning run typecheck` passou; `npm --prefix scripts/versioning run build` passou; `node tests/versioning/typescript-build.mjs` passou; `node tests/versioning/run.mjs --local` passou com código 0 nas 30 fixtures, incluindo a nova. Dependências de desenvolvimento locais foram instaladas com `npm ci --ignore-scripts --no-audit --no-fund` a partir do lockfile; `node_modules` não é versionado. A correspondência completa de `src`/`dist` será adicionada e testada em T3.
