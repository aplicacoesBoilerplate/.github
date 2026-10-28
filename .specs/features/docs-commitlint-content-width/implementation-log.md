# Evidências da melhoria documental

## D1: configuração Commitlint

Concluída em 2026-10-27, partindo da master 9884bd9. O guia mostra o objeto CJS completo antes do YAML e explica os dois caminhos de criação.

Gate executado com Node 24.19.0 e Commitlint 17.4.4 instalados:

- Extração dos blocos Markdown confirmou a ordem `js`, `yaml`.
- Objeto CJS avaliado em VM igual ao exportado por `config/commitlint/commitlint.config.cjs`.
- YAML parseado igual ao `.pre-commit-config.yaml` real, incluindo o caminho de `--config`.
- `docs: completar configuração local`: exit 0.
- `invalid: testar regra de tipo`: exit 1, regra `type-enum`.
- `git diff --check` aprovado. Nenhum teste existente alterado ou novo teste permanente criado.

## D2: largura do conteúdo

Baseline medida no navegador antes da alteração: conteúdo limitado a 688 px em viewports de 1440 e 1920 px; em 960 px, 544,8 px. Inspeção do tema VitePress 1.6.4 confirmou teto de largura, padding duplicado e margem externa da grade de 1440 px.

O CSS usa toda a largura da grade, retira padding duplicado da coluna central e mantém gutter de 24 px em desktop. As regras móveis existentes foram preservadas.

| Viewport | Largura final do conteúdo | Rolagem horizontal da página |
| ---: | ---: | --- |
| 390 px | 327,2 px | Não |
| 768 px | 688 px | Não |
| 960 px | 624,8 px | Não |
| 1440 px | 833,6 px | Não |
| 1920 px | 1313,6 px | Não |

O navegador confirmou `overflow-x: auto` nos dois exemplos e o menu móvel aberto com links acessíveis. Sidebar e índice permanecem visíveis nas duas larguras maiores. Build VitePress aprovado com renderização de todas as páginas. Captura visual em `docs-commitlint-content-width/commitlint-desktop.jpg` na pasta de visualizações do chat.

## Fontes consultadas

Context7 indisponível entre as ferramentas da sessão. Conferidos o código local do VitePress 1.6.4 e as referências oficiais: https://commitlint.js.org/reference/configuration.html e https://vitepress.dev/guide/extending-default-theme.

## Checkpoint remoto em 2026-10-28

- Commits D1 `4abc037` e D2 `a1d76c4` persistidos em `codex/docs-commitlint-content-width`.
- PR 29 para master: https://github.com/aplicacoesBoilerplate/.github/pull/29.
- Usuário escolheu `v1.0.1`; milestone 4 criada e vinculada ao PR.
- CI 40522960312 aprovada no produto `a1d76c4`: 86 testes, 86 aprovados, zero falhas ou skips, tipos e reprodução dos workflows existentes aprovados.
- Documentação 40522960096: build aprovado; deploy corretamente ignorado por ser PR.
- Higiene de título e validação de versão também aprovadas. Validação de versão 40785377014 aprovada após vínculo da milestone.
- Revisão independente PASS: quatro critérios atendidos; duas mutações do snippet detectadas em memória, sem alterar fontes; build independente aprovado. Relatório canônico em `validation.md`, com evidências por critério. `validate_state.py` aprovado sem erros.
- O checkpoint final altera somente registros TLC. Nenhum merge, tag, release ou deploy executado pelo agente.
