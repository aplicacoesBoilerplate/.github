# Evidências de validação: templates de issues e PRs

Data: 2026-09-24 · branch `feature/issue-4` · PR previsto para `master`.

## Verificações executadas

- Parser YAML (`yaml` já presente em `.opencode/node_modules`) analisou os seis formulários
  sem erro nem chave duplicada: `issuePai`, `release`, `feature`, `task`, `hotfix`, `issueCLI`.
- Verificados nos seis arquivos: `name`, `description`, `body`, tipo organizacional,
  nomes exclusivos no seletor, IDs de campos únicos, campos obrigatórios, dropdowns
  obrigatórios e ausência de `projects`/assignee globais ou chaves desconhecidas.
- Conferidos `title: vX.Y.Z` na única épica e prefixo `[LABEL]` editável nos demais
  formulários de entrega; CLI mantém comando, ecossistema e logs obrigatórios.
- Confirmados no Markdown do PR os blocos `Realização`, `Fontes modificados`,
  `p/ teste` e `O que há de novo`, além do vínculo e da distinção entre `Refs`/`Closes`.
- `openspec validate standardize-issue-pr-templates --strict`: válido.
- `git diff --check`: sem erros de espaço. Git pode informar conversão LF/CRLF no Windows;
  isso não indica erro no conteúdo.

## Cenários de uso para homologação após publicar os defaults

O roteiro em [quickstart.md](quickstart.md) foi revisado: abertura dos cinco formulários,
teste de obrigatoriedade, vínculo da épica/feature, hotfix, release não épica, piloto da
CLI, PR e caso de repositório com/sem Project ou templates próprios. A criação de
issues/PRs **de ensaio na UI não foi executada**: nenhum repositório de ensaio foi
indicado para esta tarefa, e os defaults da organização somente passam a vigorar após
merge na branch padrão. Não foram criadas issues de teste no repositório principal.

Na homologação, utilizar repositório de ensaio com permissões adequadas, registrar
capturas da experiência de preenchimento e conferir o efeito de `type`, milestone e
Project separadamente. A revisão da interface do GitHub é complementar à validação
estática acima.
