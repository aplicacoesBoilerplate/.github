# Validação: Commitlint, documentação e CI

**Veredito: PASS para a árvore de trabalho em 2026-10-23.** Verificador independente. Escopo: alterações staged, unstaged e arquivos novos sobre `a7c059f`; o conjunto ainda não foi versionado.

## Critérios de aceite

| Requisito | Evidência e resultado |
| --- | --- |
| CC-01 | `ci-scripts/tests/conventional-commit.test.ts:21-24` cria mensagem inválida com corpo e rodapé; `:36-39` exige saída `1` e `type-empty`. **PASS**. |
| CC-02 | `ci-scripts/tests/conventional-commit.test.ts:25-28` cria mensagem válida com corpo e rodapé; `:41-43` exige saída `0`. **PASS**. |
| DOC-01 | `docs/.vitepress/theme/custom.css:77-116` ajusta cartões e navbar nas larguras intermediárias. No VitePress compilado, Playwright mediu `scrollWidth === innerWidth` em 768, 820, 839, 840 e 959 px; título e três cartões ficaram dentro da viewport, sem sobreposição. Em 820 px, o botão de busca permaneceu visível (`40×40`, `pointer-events: auto`). **PASS**. |
| DOC-02 | `docs/pipelines/versionamento-release-please.md:16-18` contém `hr` antes de `h2`; `docs/.vitepress/theme/custom.css:57-65` remove a segunda borda. Playwright mediu borda de `1px` no `hr`, `border-top: 0` e `padding-top: 0` no `h2`. **PASS**. |
| CI-01 | `.github/workflows/ci.yml:3-10` configura PR e pushes; `:28-41` aponta para os dois lockfiles, executa `npm ci` na raiz e em `ci-scripts`, seguido de `npm test`. Em contêiner Node 22/Linux, uma cópia isolada com Git inicializado executou esses comandos e passou **7/7** testes. **PASS para o conjunto atual**. |

## Gates independentes

- `npm test` em `ci-scripts`: **7 passaram, 0 falharam, 0 ignorados**. A versão staged anterior tinha 6 testes; o novo teste eleva a contagem a 7 (`ci-scripts/package.json:6`).
- `ci-scripts/node_modules/.bin/tsc --noEmit -p ci-scripts/tsconfig.json`: código `0`.
- `npm run docs:build` em `docs`: código `0`, inclusive após o último ajuste de CSS.
- Node 22/Linux: `npm ci` na raiz, `npm ci` em `ci-scripts` e `npm test`: **7/7**. O teste de Release Please resolveu o caminho Linux em `ci-scripts/tests/release-please.test.ts:8-14`.

## Sensor de discriminação

As mutações ocorreram somente em cópias temporárias dentro de contêineres, com o repositório real montado para leitura. `git status --porcelain` da árvore real foi idêntico antes e depois de cada execução.

| Mutação isolada | Resultado |
| --- | --- |
| Substituir as regras em `config/commitlint/commitlint.config.cjs:9-21` por regras vazias | **Morta**: o teste em `ci-scripts/tests/conventional-commit.test.ts:38-39` falhou; suíte 6/7. |
| Fazer a configuração lançar `CONFIG_LOAD_FAILED`, simulando falha de carregamento | **Morta**: o teste falhou na exigência de `type-empty` em `ci-scripts/tests/conventional-commit.test.ts:39`; suíte 6/7. Isso cobre o caso de borda em `.specs/features/commitlint-docs-ci/spec.md:71`. |

**Resultado do sensor: 2 mutações mortas, 0 sobreviventes.**

## Lacunas e condição de entrega

- **P1 — versionar o lockfile:** `ci-scripts/package-lock.json` está presente, válido no Linux e não é mais ignorado (`ci-scripts/.gitignore:1`), mas aparece como `??` e não em `git ls-files`. Ele precisa integrar o commit futuro; sem ele, `.github/workflows/ci.yml:30,35-37` não terá o arquivo de cache nem permitirá `npm ci` no checkout do Actions. O index preexistente do usuário permaneceu intacto.
- Não existe `tasks.md` para esta feature; os gates foram derivados de `.specs/features/commitlint-docs-ci/spec.md:85-87` e dos comandos efetivos em `.github/workflows/ci.yml:32-41`.

**Conclusão:** 5/5 critérios atendidos na árvore de trabalho. A execução remota do GitHub Actions dependerá de incluir o lockfile ao versionar a mudança.
