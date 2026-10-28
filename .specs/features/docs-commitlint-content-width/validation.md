# Validation: docs-commitlint-content-width — PASS

**Date**: 2026-10-28
**Diff range**: `9884bd9..a1d76c4fda32d1cf713ad887f1cbec4ac25d925b`
**Spec**: `.specs/features/docs-commitlint-content-width/spec.md`
**Verifier**: subagente independente, autor diferente do verificador.
**Result**: PASS. Quatro critérios atendidos, nenhuma lacuna.

## Critérios da especificação

| Critério | Evidência e asserção executada | Resultado |
| --- | --- | --- |
| DOCS-01.1: CJS completo antes do YAML, caminhos coerentes | `docs/pipelines/pre-commit-config.md:7`, `docs/pipelines/pre-commit-config.md:12`, `docs/pipelines/pre-commit-config.md:31`, `docs/pipelines/pre-commit-config.md:44`. Extração dos blocos: `assert.deepEqual(languages, ['js', 'yaml'])`. Objeto avaliado em VM: `assert.deepEqual(snippet, expected)` contra `config/commitlint/commitlint.config.cjs:9`. YAML parseado igual a `.pre-commit-config.yaml:1`; caminho de `--config` conferido. | PASS |
| DOCS-01.2: Commitlint aceita mensagem válida e rejeita tipo inválido | `docs/pipelines/pre-commit-config.md:13`, `docs/pipelines/pre-commit-config.md:15`. Commitlint 17.4.4 carregou o snippet avaliado em memória: `valid.valid === true`, `invalid.valid === false`, `invalid.errors.some(e => e.name === 'type-enum')`. CLI real: `docs: completar configuracao local` saiu 0; `invalid: testar regra de tipo` saiu 1 com `type-enum`. | PASS |
| DOCS-02.1: conteúdo ≥800/1200 px em 1440/1920, navegação visível, sem overflow | `docs/.vitepress/theme/custom.css:3`, `docs/.vitepress/theme/custom.css:45`, `docs/.vitepress/theme/custom.css:50`, `docs/.vitepress/theme/custom.css:56`. DOM independente: 833,6/1313,6 px; asserções `width >= 800`/`width >= 1200`, sidebar e índice visíveis dentro da viewport, `scrollWidth <= clientWidth`. Valores também registrados em `.specs/features/docs-commitlint-content-width/implementation-log.md:27`. | PASS |
| DOCS-02.2: conteúdo contido em 390/768/960, menu acessível, código rolável | `docs/.vitepress/theme/custom.css:44`, `docs/pipelines/pre-commit-config.md:11`, `docs/pipelines/pre-commit-config.md:35`. DOM: `left >= 0`, `right <= innerWidth`, `scrollWidth <= clientWidth`; ambos os exemplos com `overflowX === 'auto'`. Menu abriu em 390 px, botão expandido e 17 links. Medidas coincidem com `.specs/features/docs-commitlint-content-width/implementation-log.md:24`; navegação em `.specs/features/docs-commitlint-content-width/implementation-log.md:30`. | PASS |

**Cobertura**: 4/4 critérios. Asserções verificam os valores e estados exigidos. Nenhum teste permanente criado ou alterado.

## Navegador e tema

Inspeção independente executada em 2026-10-27, nesta sessão, na prévia local. Na retomada de 2026-10-28, o HEAD e os arquivos de produto permaneciam iguais. Configurações, sensor e build foram executados novamente na retomada.

| Viewport | Conteúdo | `scrollWidth / clientWidth` da página |
| ---: | ---: | ---: |
| 390 px | 327,2 px | 375 / 375 |
| 768 px | 688 px | 753 / 753 |
| 960 px | 624,8 px | 945 / 945 |
| 1440 px | 833,6 px | 1425 / 1425 |
| 1920 px | 1313,6 px | 1905 / 1905 |

Gutter da `.VPDoc`: 24 px em desktop; padding horizontal central zero. Sidebar e índice visíveis nas duas larguras maiores. Em 390 px, os exemplos tinham largura interna de 375 px e conteúdo de 826/756 px, com rolagem interna. Menu conferido visualmente. Override de viewport removido e aba de verificação fechada.

VitePress instalado: 1.6.4. Os seletores correspondem à árvore real do tema. O padding central original aparece em `docs/node_modules/vitepress/dist/client/theme-default/components/VPDoc.vue:174`; o teto de 688 px em `docs/node_modules/vitepress/dist/client/theme-default/components/VPDoc.vue:191`; a grade usa a variável alterada em `docs/node_modules/vitepress/dist/client/theme-default/components/VPContent.vue:94`. As regras móveis foram preservadas.

## Sensor em memória

| Mutação | Origem | Resultado |
| --- | --- | --- |
| Tipo permitido `docs` → `invalid` | `docs/pipelines/pre-commit-config.md:18` | KILLED: igualdade completa lançou `ERR_ASSERTION`, confirmada por `assert.throws`. |
| Limite do cabeçalho 120 → 121 | `docs/pipelines/pre-commit-config.md:22` | KILLED: mesma comparação lançou `ERR_ASSERTION`, confirmada por `assert.throws`. |

**Sensor**: 2/2 mutações mortas, zero sobreviventes. Strings mutantes avaliadas em VM separada; nenhuma fonte modificada. `git status --porcelain=v1` vazio antes e depois. Alterações posteriores do orquestrador nos artefatos TLC foram preservadas. Nenhum stash usado.

## Gates

- CJS/YAML, Commitlint e sensor independentes: exit 0; Node 24.19.0, Commitlint 17.4.4.
- `npm.cmd run docs:build`, executado pelo verificador em `docs/`: exit 0; bundles e páginas renderizados com VitePress 1.6.4 em 19,38 s.
- `git diff --check 9884bd9..HEAD`: exit 0.
- [CI 40522960312](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40522960312): status e log lidos independentemente; `success` no HEAD revisado; 86 testes, 86 aprovados, zero falhas, zero skips.
- [Documentação 40522960096](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40522960096): `success` no mesmo HEAD, conferido por leitura independente.

O diff de produto contém somente guia e CSS, sem alterações de configurações reais, dependências, hooks, workflows ou testes. Mudanças pequenas e compatíveis com os padrões existentes. **Conclusão: PASS**, DOCS-01/DOCS-02 verificados, nenhuma correção pendente. Esta revisão não fez commits nem escritas remotas.
