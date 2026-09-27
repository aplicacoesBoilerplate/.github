# Tasks

## 1. Base e consistência

- [x] 1.1 Conferir os campos dos pilotos `.github/ISSUE_TEMPLATE/issueCLI.yml` e `.github/ISSUE_TEMPLATE/issuePai.yml` contra `specs/003-templates-issues-prs/contracts/templates.md`; verificar que comando, ecossistema e logs continuam obrigatórios após a migração.
- [x] 1.2 Documentar em `docs/templates.md` a escala Size/Estimate e a distinção entre esforço e valor; conferir os exemplos de homologação, feature, hotfix, release não épica e épica com a issue #4.

## 2. Formulários de issues

- [x] 2.1 Corrigir `.github/ISSUE_TEMPLATE/issuePai.yml` para um formulário válido de épica com `body`, `type: Release` e metadados exclusivos orientados; verificar sintaxe e ausência da chave `release` inválida.
- [x] 2.2 Criar `.github/ISSUE_TEMPLATE/release.yml` para release não épica com `type: Release`, opções PATCH/MINOR/MAJOR e valores 7/8/9; verificar conteúdo e obrigatoriedade da escolha.
- [x] 2.3 Criar `.github/ISSUE_TEMPLATE/feature.yml` com `type: Feature`, prefixo editável `[LABEL]` e escala XS–XL/Estimate 1–5; verificar campos essenciais obrigatórios.
- [x] 2.4 Criar `.github/ISSUE_TEMPLATE/task.yml` com `type: Task`, prefixo editável `[LABEL]` e escolha de valor sem Estimate fixo; verificar campos essenciais obrigatórios.
- [x] 2.5 Criar `.github/ISSUE_TEMPLATE/hotfix.yml` com `type: Hotfix`, prefixo editável `[LABEL]`, impacto, urgência e Estimate 6 com Size variável; verificar campos essenciais obrigatórios.
- [x] 2.6 Preservar `.github/ISSUE_TEMPLATE/issueCLI.yml` e corrigir somente erros de schema comprovados; comparar `git diff` e conferir comando, ecossistema e logs.

## 3. PR e adoção

- [x] 3.1 Criar `.github/PULL_REQUEST_TEMPLATE.md` com vínculo, quatro blocos de relatório, revisão de metadados e instrução de fechamento apenas no merge à branch padrão; conferir a prévia do Markdown.
- [x] 3.2 Completar `docs/templates.md` com precedência do `.github` público, caso de consumidor com templates locais, limitações de Issue Fields/Project e preenchimento manual; conferir que `projects` não está fixado globalmente.

## 4. Validação e entrega

- [x] 4.1 Validar o YAML dos seis formulários e os campos exigidos no contrato; executar `git diff --check` e registrar resultados de validação em `specs/003-templates-issues-prs/validation-results.md`.
- [x] 4.2 Revisar os cenários de `specs/003-templates-issues-prs/quickstart.md` em repositório de ensaio se disponível, anotando os passos não executados sem criar issues de teste no repositório principal; verificar as evidências registradas.
- [x] 4.3 Revisar `git diff` da branch `feature/issue-4`, publicar o commit e abrir PR de `feature/issue-4` diretamente para `master` em `ModulosTestesAutomatizados/.github`; verificar URL, base e arquivos do PR.
