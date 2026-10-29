# Validation: docs-commitlint-content-width — FAIL

**Date**: 2026-10-28
**Result**: FAIL por validação visual pendente. Revisão parcial da ampliação: 2/4 critérios comprovados, 2/4 pendentes. Não foi identificado defeito funcional remanescente nos exemplos revisados.
**Diff range**: `83e98df..8d675fd6ecb62f655d26385be09723669fd16ba6`
**Verifier**: subagente independente do autor; segunda leitura semântica dos guias também independente.
**Spec**: `.specs/features/docs-commitlint-content-width/spec.md`, incluindo a ampliação de 2026-10-28.

## Critérios atuais

| Critério | Evidência e asserção | Resultado |
| --- | --- | --- |
| DOCS-01.1: YAML antes do CJS, conteúdo completo e caminhos coerentes | `docs/pipelines/pre-commit-config.md:7`, `docs/pipelines/pre-commit-config.md:20`, `docs/pipelines/pre-commit-config.md:37`, `docs/pipelines/pre-commit-config.md:42`. Extração: `assert.deepEqual(languages, ['yaml', 'js'])`. YAML parseado igual a `.pre-commit-config.yaml:1`; CJS avaliado em VM igual ao objeto de `config/commitlint/commitlint.config.cjs:9`. | PASS |
| DOCS-01.2: mensagem válida aceita, tipo inválido rejeitado por `type-enum` | `docs/pipelines/pre-commit-config.md:45`. Commitlint 17.4.4 carregou o snippet em memória: `valid.valid === true`, `invalid.valid === false`, erro `type-enum`. CLI real: `feat: adicionar recurso` saiu 0; `invalid: testar tipo` saiu 1 com `type-enum`. | PASS |
| DOCS-02.1: largura ≥800/1200 px em 1440/1920, sidebar e índice visíveis, sem overflow | `docs/.vitepress/theme/custom.css:4`, `docs/.vitepress/theme/custom.css:46`, `docs/.vitepress/theme/custom.css:74`. Novos valores declarados foram conferidos por parser CSS e seletores confrontados com o tema instalado. Faltam medidas do DOM e inspeção visual deste CSS. | PENDENTE |
| DOCS-02.2: conteúdo dentro de 390/768/960, menu acessível e código rolável | `docs/.vitepress/theme/custom.css:44`, `docs/pipelines/pre-commit-config.md:11`, `docs/pipelines/pre-commit-config.md:41`. Análise estática não comprova ausência de overflow, acesso ao menu ou comportamento dos exemplos após a mudança. | PENDENTE |

## Ampliação revisada

- Navbar/sidebar: declarados padding de 16 px e coluna de 240 px em `docs/.vitepress/theme/custom.css:4`, `docs/.vitepress/theme/custom.css:48`, `docs/.vitepress/theme/custom.css:49`, `docs/.vitepress/theme/custom.css:53`. Sumário: coluna de 208 px, gutter de 16 px e largura interna de 192 px em `docs/.vitepress/theme/custom.css:74`, `docs/.vitepress/theme/custom.css:75`, `docs/.vitepress/theme/custom.css:80`. Parser confirmou esses valores; efeitos renderizados continuam pendentes.
- Setup dos dois hooks conferido nos exemplos npm, Maven, Gradle e Go em `docs/pipelines/pre-commit-setup.md:21`, `docs/pipelines/pre-commit-setup.md:42`, `docs/pipelines/pre-commit-setup.md:61`, `docs/pipelines/pre-commit-setup.md:72`. Validação manual e diagnósticos/Husky/worktrees constam em `docs/pipelines/pre-commit-setup.md:75`, `docs/pipelines/pre-commit-setup.md:91`, `docs/pipelines/pre-commit-setup.md:99`.
- Corrigida a observação da revisão: a receita Makefile tinha dois espaços. No commit `8d675fd`, extraí o bloco e confirmei `setup:\n\tpre-commit install --hook-type pre-commit --hook-type commit-msg\n` com `assert.match`, incluindo TAB de código 9. Sem execução de Make ou dos builds consumidores.
- A segunda revisão confirmou que o SHA histórico em `docs/pipelines/documentacao-pages.md:29` corresponde à [release publicada v0.1.0](https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.1.0), cujo workflow contém `install-dir`, `build-script` e `npm-version`. Diagnóstico Pages revisado em `docs/pipelines/documentacao-pages.md:65` contra o workflow local. Referências consultadas: [pre-commit](https://pre-commit.com/#confining-hooks-to-run-at-certain-stages), [scripts npm](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

## Sensor e gates atuais

- Sensor em memória no produto ampliado: trocar `docs` por `invalid` na lista de tipos e trocar o limite do cabeçalho 120 por 121. Ambas as comparações completas com a configuração real lançaram `ERR_ASSERTION`, confirmado com `assert.throws`: **2/2 mutações mortas, zero sobreviventes**. Origens: `docs/pipelines/pre-commit-config.md:48` e `docs/pipelines/pre-commit-config.md:52`. Porcelain e HEAD permaneceram iguais antes/depois; nenhuma fonte alterada nem stash usado.
- CJS/YAML e Commitlint real: aprovados pelo verificador nesta rodada. Node 24.19.0 e Commitlint 17.4.4.
- Build independente do produto `ef3d614`: `npm.cmd --prefix docs run docs:build`, exit 0, VitePress 1.6.4, bundles e páginas renderizados em **5,40 s**. A mudança posterior `8d675fd` foi somente a indentação do exemplo Makefile, conferida separadamente.
- [CI 40794097579](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40794097579) e [documentação 40794097911](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40794097911): `success` no HEAD `ef3d614`, confirmado por leitura independente. Esses resultados não foram atribuídos ao commit posterior.
- Nenhum teste permanente criado, removido ou enfraquecido. Nenhuma instalação de hooks, execução de Maven/Gradle/Make ou aplicação consumidora foi realizada.

## Pendência e histórico

O orquestrador informou que a tentativa pelo Cua recebeu bloqueio porque o uso do navegador está desabilitado nas configurações Work. Nenhum runtime alternativo foi usado. Faltam uma inspeção responsiva atual em 390/768/960/1440/1920 px e conferência de navbar/sidebar/sumário, navegação móvel, overflow e exemplos. Até isso ocorrer, o gate TLC deve permanecer reprovado por evidência incompleta e o PR deve continuar em revisão.

O **PASS histórico** da primeira entrega cobria somente `9884bd9..a1d76c4`, com as medidas antigas. O relatório completo está preservado em `83e98df:.specs/features/docs-commitlint-content-width/validation.md`. Ele não aprova a ordem nova, os guias ampliados ou o CSS atual.
