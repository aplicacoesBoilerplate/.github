# Design

## Context

Ver [proposal.md](proposal.md). O repositório `ModulosTestesAutomatizados/.github` é público, usa `master` como branch padrão e serve defaults de arquivos de comunidade para repositórios da organização. Há dois pilotos: `issueCLI.yml` com comando/ecossistema/logs e `issuePai.yml` sem `body` e com chave `release` inválida. A especificação prévia do Spec Kit está em `specs/003-templates-issues-prs/`.

## Goals / Non-Goals

**Goals:** maximizar dados nativos confiáveis no formulário, separar épica de release não épica, preservar o relato de bug da CLI e indicar exatamente quais dados exigem edição posterior.

**Non-Goals:** alterar automaticamente Projects de todos os repositórios da organização, fixar IDs/assignees de um consumidor genérico, ou presumir que formulários criam parent/milestone/Issue Fields. Uma integração automatizada opcional somente deve ser publicada quando possuir contrato próprio e testes em um consumidor real.

## Decisions

1. **Reaproveitar pilotos.** Corrigir `issuePai.yml` como única épica, com `body` válido, título `vX.Y.Z`, tipo `Release` e label somente se compartilhada. Preservar campos obrigatórios de `issueCLI.yml` e remover valores vazios incompatíveis. Alternativa de criar novo arquivo de épica duplicaria a opção.
2. **Usar recursos nativos onde são previsíveis.** `name`, `description`, `body` são obrigatórios; `title`, `labels` e `type` são opcionais e `projects` apenas quando o Project certo é o mesmo para todos os consumidores e o criador tem permissão. Nenhum Project será fixado globalmente. Alternativa de chave personalizada `release` não é suportada.
3. **Dados não nativos aparecem como instrução de preenchimento posterior.** Separar Issue Fields organizacionais de campos Project V2, sem confundir IDs ou valores; orientar milestone, parent/sub-issue, datas, Release, Hotfix, Estimate, Size, Effort e Priority conforme o tipo. Forms não conseguem derivar o título de um label dinâmico; prefixo `[LABEL]` orienta substituição manual (por exemplo, `[TEMPLATES]`), sem impor `[TASK]` a todas as tasks. Alternativa de automação genérica silenciosa introduziria associação errada e exigiria permissão transversal.
4. **PR como Markdown único.** O arquivo `.github/PULL_REQUEST_TEMPLATE.md` oferece blocos de relatório e checklist de conferência; GitHub não tem form YAML para PR. Explicar referência `Refs #N` para bases intermediárias e `Closes #N` somente quando o merge na branch padrão de fato encerrar a issue.
5. **Defaults documentados com precedência real.** Se um consumidor possuir formulários ou configuração próprios em `.github/ISSUE_TEMPLATE`, os defaults dessa pasta não são mesclados; PR local de mesmo tipo substitui default. Workflows de `.github` não são automaticamente executados nos consumidores.

## Risks / Trade-offs

- [Labels/tipos não disponíveis em outro contexto] → utilizar apenas tipo organizacional verificado e labels compartilhadas verificadas, documentar remoção quando consumidor externo copiar.
- [Metadados ainda manuais] → instruções específicas por tipo e checklist no PR; projeto de automação futura com contrato/permissão próprios, sem prometer preenchimento implícito.
- [Templates padrão não aparecem no consumidor com pasta local] → documentação de precedência, exemplos de cópia/adoção e verificação em consumidor representativo.
- [Migração do piloto altera a experiência] → comparar campos antes e depois, manter a opção de bug da CLI e o caminho de épica.

## Migration Plan

1. Revisar piloto, issue #4 e escala; atualizar artefatos Spec Kit para refletir chaves `type`/`projects` suportadas.
2. Ajustar pilotos, adicionar quatro forms, PR e documentação na branch `feature/issue-4`; validar YAML, UX de chooser e conteúdo em repositório de teste quando possível.
3. Abrir PR de `feature/issue-4` diretamente para `master` neste repositório especial; somente após revisão/merge passam a valer novos defaults da organização. Reversão: reverter o commit de templates na master, preservando o histórico.
