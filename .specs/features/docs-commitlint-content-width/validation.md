# Validation: docs-commitlint-content-width — PASS

**Date**: 2026-10-28
**Spec**: `.specs/features/docs-commitlint-content-width/spec.md`
**Diff range**: `9884bd9..a1d76c4fda32d1cf713ad887f1cbec4ac25d925b`
**Verifier**: subagente independente, autor diferente do verificador.
**Result**: PASS. Os quatro critérios foram atendidos. Nenhuma lacuna encontrada.

## Critérios ancorados na especificação

| Critério | Resultado esperado | Evidência e asserção executada | Resultado |
| --- | --- | --- | --- |
| DOCS-01.1 | CJS completo antes do YAML; arquivos nos caminhos usados pelo hook | `docs/pipelines/pre-commit-config.md:7`, `docs/pipelines/pre-commit-config.md:12`, `docs/pipelines/pre-commit-config.md:31`, `docs/pipelines/pre-commit-config.md:44`. Extração dos dois blocos com `assert.deepEqual(languages, ['js', 'yaml'])`; objeto CJS avaliado em VM com `assert.deepEqual(snippet, expected)` contra `config/commitlint/commitlint.config.cjs:9`; YAML parseado com igualdade completa contra `.pre-commit-config.yaml:1`; caminho `--config config/commitlint/commitlint.config.cjs --edit` conferido. | PASS |
| DOCS-01.2 | Mensagem convencional aceita; tipo inválido rejeitado por `type-enum`; mesmas regras reais | `docs/pipelines/pre-commit-config.md:13`, `docs/pipelines/pre-commit-config.md:15`, `docs/pipelines/pre-commit-config.md:22`. Commitlint 17.4.4 carregou o objeto do snippet em memória: `assert.equal(valid.valid, true)`, `assert.equal(invalid.valid, false)`, `assert.ok(invalid.errors.some(e => e.name === 'type-enum'))`. CLI real: `docs: completar configuracao local` saiu 0; `invalid: testar regra de tipo` saiu 1 com `type-enum`. | PASS |
| DOCS-02.1 | Conteúdo ≥800 px em 1440 e ≥1200 px em 1920; sidebar e índice visíveis; sem overflow da página | `docs/.vitepress/theme/custom.css:3`, `docs/.vitepress/theme/custom.css:45`, `docs/.vitepress/theme/custom.css:50`, `docs/.vitepress/theme/custom.css:56`. DOM medido independentemente: 833,6 e 1313,6 px. Asserções: `width >= 800`/`width >= 1200`, sidebar e índice com caixa visível dentro da viewport, `scrollWidth <= clientWidth`. Os mesmos valores constam em `.specs/features/docs-commitlint-content-width/implementation-log.md:27`. | PASS |
| DOCS-02.2 | Conteúdo dentro da viewport em 390/768/960; navegação acessível; código com rolagem interna | `docs/.vitepress/theme/custom.css:44`, `docs/.vitepress/theme/custom.css:95`, `docs/pipelines/pre-commit-config.md:11`, `docs/pipelines/pre-commit-config.md:35`. DOM: `left >= 0`, `right <= innerWidth`, `scrollWidth <= clientWidth`; ambos os exemplos com `overflowX === 'auto'`. Menu móvel abriu em 390 px, com classe `open`, botão expandido e 17 links. Medidas independentes coincidem com `.specs/features/docs-commitlint-content-width/implementation-log.md:24` e navegação descrita em `.specs/features/docs-commitlint-content-width/implementation-log.md:30`. | PASS |

**Cobertura**: 4/4 critérios. As asserções verificam valores e estados exigidos pela especificação. Nenhum teste permanente foi criado ou alterado.

## Evidência responsiva independente

Inspeção executada pelo verificador em 2026-10-27, nesta mesma sessão, em `http://127.0.0.1:5190/.github/pipelines/pre-commit-config.html`. Na retomada de 2026-10-28, o HEAD e os dois arquivos de produto permaneciam iguais ao material inspecionado. Os checks de configuração, sensor e build foram executados novamente na retomada.

| Viewport | Conteúdo | `scrollWidth / clientWidth` da página | Resultado |
| ---: | ---: | ---: | --- |
| 390 px | 327,2 px | 375 / 375 | Dentro da viewport; exemplos roláveis |
| 768 px | 688 px | 753 / 753 | Dentro da viewport; exemplos roláveis |
| 960 px | 624,8 px | 945 / 945 | Dentro da viewport; exemplos roláveis |
| 1440 px | 833,6 px | 1425 / 1425 | Sidebar e índice visíveis |
| 1920 px | 1313,6 px | 1905 / 1905 | Sidebar e índice visíveis |

Gutter horizontal da `.VPDoc`: 24 px nas larguras de desktop. A coluna central apresentou padding horizontal zero. Em 390 px, os dois exemplos tinham largura interna de 375 px e conteúdo de 826/756 px, preservando a rolagem dentro dos blocos. O menu foi aberto e conferido visualmente. O override temporário de viewport foi removido e a aba de verificação foi fechada.

## Compatibilidade com o tema instalado

O código local confirma VitePress 1.6.4. A árvore em `docs/node_modules/vitepress/dist/client/theme-default/components/VPDoc.vue:43` contém `.container > .content > .content-container`, correspondendo aos seletores adicionados. O padding central original está em `docs/node_modules/vitepress/dist/client/theme-default/components/VPDoc.vue:174`; o teto de 688 px está em `docs/node_modules/vitepress/dist/client/theme-default/components/VPDoc.vue:191`. A grade usa `--vp-layout-max-width` em `docs/node_modules/vitepress/dist/client/theme-default/components/VPContent.vue:94` e `docs/node_modules/vitepress/dist/client/theme-default/components/VPSidebar.vue:114`.

As novas regras de conteúdo começam em 960 px. As regras móveis existentes foram preservadas. Nenhum seletor oculta a sidebar ou o índice. A rolagem dos exemplos continua fornecida pelo tema em `docs/node_modules/vitepress/dist/client/theme-default/styles/components/vp-doc.css:282`.

## Sensor de discriminação

Sensor leve executado novamente em 2026-10-28. Os mutantes foram strings em memória, avaliadas em uma VM separada. Nenhum arquivo de produto foi modificado.

| Mutação | Origem | Asserção discriminante | Resultado |
| --- | --- | --- | --- |
| Trocar tipo permitido `docs` por `invalid` | `docs/pipelines/pre-commit-config.md:18` | A comparação completa `assert.deepEqual(evaluate(mutant), expected)` lançou `ERR_ASSERTION`, conferido com `assert.throws`. | KILLED |
| Trocar limite do cabeçalho de 120 por 121 | `docs/pipelines/pre-commit-config.md:22` | A mesma comparação completa lançou `ERR_ASSERTION`, conferido com `assert.throws`. | KILLED |

**Resultado**: 2/2 mutações mortas, zero sobreviventes. `git status --porcelain=v1` era vazio antes e depois do sensor. As alterações posteriores do orquestrador em `spec.md` e `implementation-log.md` são externas ao sensor e foram preservadas. Nenhum stash foi usado.

## Gates e integridade

- Verificação independente de CJS/YAML, Commitlint e sensor: exit 0 em Node 24.19.0, Commitlint 17.4.4.
- `npm.cmd run docs:build`, executado pelo verificador em `docs/`: exit 0; bundles e páginas renderizados; VitePress 1.6.4, 19,38 s.
- `git diff --check 9884bd9..HEAD`: exit 0.
- [CI 40522960312](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40522960312): `success`, HEAD `a1d76c4fda32d1cf713ad887f1cbec4ac25d925b`. O verificador leu o status e o log: 86 testes, 86 aprovados, zero falhas, zero skips.
- [Documentação 40522960096](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40522960096): `success` no mesmo HEAD, conferido por leitura independente.
- O diff de produto toca somente o guia e o CSS. Configurações reais, dependências, hooks, workflows e testes existentes permanecem fora do diff. Nenhuma asserção existente foi enfraquecida ou removida.

## Qualidade e conclusão

Mudanças pequenas, compatíveis com os padrões existentes e restritas aos pedidos documentais e visuais. O guia reproduz o objeto completo do repositório e explica os caminhos sem alterar regras. O CSS remove os limites identificados e preserva a navegação nas larguras verificadas.

**Overall**: PASS. DOCS-01 e DOCS-02 verificados; 4/4 critérios atendidos; sensor 2/2; nenhuma correção pendente. Esta revisão não fez commits nem escritas remotas.
