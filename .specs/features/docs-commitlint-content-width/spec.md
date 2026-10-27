# Commitlint completo e documentação mais larga

## Problem Statement

A página de configuração menciona dois arquivos, mas contém apenas o YAML do pre-commit. O caminho do hook aponta para uma pasta que a instrução de cópia não explica. O tema acumula padding horizontal e limita o conteúdo a 688 px, mesmo em monitores largos.

## Goals

- [x] D1: documentar a configuração CJS completa antes do YAML, com caminhos coerentes.
- [x] D2: ampliar o conteúdo de desktop preservando navegação e uso no celular.

## Out of Scope

Alterar regras do Commitlint, versões de dependências, hooks, workflows, aplicações consumidoras ou fazer merge/deploy.

## Assumptions & Open Questions

| Decision | Default | Reason |
| --- | --- | --- |
| Configuração publicada | Mesmo objeto de config/commitlint/commitlint.config.cjs | Evitar regras divergentes entre guia e repositório |
| Layout | Usar largura disponível, gutter de 24 px em desktop, retirar padding interno duplicado e teto de 688 px | Priorizar texto e exemplos sem remover sidebar ou índice |
| Celular | Preservar regras abaixo de 960 px | Manter margens, menu e rolagem interna dos exemplos |

**Open questions:** none. As duas alterações foram solicitadas explicitamente.

## User Stories

### DOCS-01: Configuração copiável

1. WHEN o leitor abrir a página de configuração THEN o guia SHALL apresentar primeiro config/commitlint/commitlint.config.cjs completo e depois .pre-commit-config.yaml na raiz, mantendo o caminho referenciado pelo hook.
2. WHEN o leitor executar o exemplo CJS THEN o Commitlint SHALL aceitar uma mensagem convencional válida e rejeitar um tipo inválido com type-enum, usando as mesmas regras do arquivo real.

### DOCS-02: Espaço para o conteúdo

1. WHEN a página for exibida em 1440 e 1920 px THEN o conteúdo SHALL ocupar pelo menos 800 e 1200 px respectivamente, com sidebar e índice visíveis e sem rolagem horizontal da página.
2. WHEN a página for exibida em 390, 768 e 960 px THEN o conteúdo SHALL permanecer dentro da viewport, com menu acessível e exemplos longos roláveis dentro do bloco de código.

## Execution Plan

1. D1: editar somente docs/pipelines/pre-commit-config.md; conferir objeto CJS, YAML e execução real do Commitlint; commit documental.
2. D2: editar somente docs/.vitepress/theme/custom.css; build VitePress e inspeção responsiva no navegador; commit de layout.
3. Verificação independente, relatório e checkpoint TLC; publicar branch/PR para revisão humana conforme autorização de persistência da sessão.

## Verification

Sem novos testes permanentes para esta mudança documental e visual reversível. Usar Commitlint real, build existente, medidas do DOM em cinco larguras e revisão independente. O sensor reintroduz localmente uma regra incorreta no snippet em scratch e comprova que a comparação com a configuração real falha.

## Requirement Traceability

| Requirement | Delivery | Evidence |
| --- | --- | --- |
| DOCS-01 | D1 | Objeto CJS e YAML comparados aos arquivos reais; Commitlint aceitou mensagem válida e rejeitou tipo inválido |
| DOCS-02 | D2 | Build VitePress aprovado; DOM em 390/768/960/1440/1920 px, menu móvel e rolagem dos exemplos conferidos |
