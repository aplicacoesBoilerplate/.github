# Templates de issues e PRs

Este repositório público `ModulosTestesAutomatizados/.github` distribui por padrão os
formulários em `.github/ISSUE_TEMPLATE/` e o arquivo `.github/PULL_REQUEST_TEMPLATE.md`
para repositórios da organização que não tenham templates próprios. O conteúdo dos
formulários ajuda a registrar a entrega; não altera automaticamente Issue Fields,
milestones, relações entre issues ou valores em Projects.

## Escolha do formulário

| Opção | Issue Type | Uso | Estimate orientado |
| --- | --- | --- | --- |
| Épica de release (`issuePai.yml`) | Release | Agrupa entregas de uma milestone; título **idêntico** ao da milestone, como `v1.0.0` | **10**, somente para épicas |
| Release não épica (`release.yml`) | Release | Entrega PATCH, MINOR ou MAJOR sem ser a issue pai da sprint | **7**, **8** ou **9**, respectivamente |
| Feature (`feature.yml`) | Feature | Nova entrega de valor | **1–5** conforme Size |
| Task (`task.yml`) | Task | Trabalho da sprint; selecionar valor conforme natureza da tarefa | Sem default fixo; **0** em homologação |
| Hotfix (`hotfix.yml`) | Hotfix | Correção urgente de produção | **6**, Size variável |
| Bug da CLI (`issueCLI.yml`) | Bug | Problema específico da CLI Boilerplate Go | Valor a avaliar, sem default |

`Size` representa **valor agregado, não esforço técnico**: XS é entrega mínima (docs,
DX, modelagem); S é ajuste pequeno (cores, labels, contratos); M é feature padrão;
L é funcionalidade elaborada (novo serviço ou rota); XL é recurso novo de grande porte
(microserviço, infraestrutura, cloud ou CLI). Para features, XS/S/M/L/XL correspondem
a Estimate 1/2/3/4/5. Homologação usa Estimate 0. `Effort` mede trabalho necessário
em separado: não o deduza de Size ou Estimate. Priority também é independente.

**Exemplos:** `v1.0.0` é épica (Issue Type Release, Release MAJOR, Estimate 10, Size XL,
Effort Team); uma entrega MINOR que não seja épica recebe Estimate 8, não 10;
uma feature Size M recebe Estimate 3; uma correção emergencial recebe Estimate 6
independentemente de seu Size. A issue [#4](https://github.com/ModulosTestesAutomatizados/.github/issues/4)
é uma Task de categoria Templates, com título `[TEMPLATES] - issues e PR's`:
o prefixo representa seu **label**, não seu Issue Type.

Nos formulários de sub-issue, substitua `[LABEL]` pelo nome em maiúsculas do label
selecionado (`[TEMPLATES]`, `[PIPELINES]` etc.) e complete o título. Indique a issue
épica e milestone no corpo e, **após criar**, selecione a milestone na barra lateral
e adicione a issue como sub-issue da épica. No formulário da épica, substitua
`vX.Y.Z` pelo nome **exato** da milestone, e iguale as datas de início e de entrega
nos metadados correspondentes, quando disponíveis.

## Metadados: o que é automático

Os formulários preenchem o título inicial e o Issue Type organizacional (`Release`,
`Feature`, `Task`, `Hotfix` ou `Bug`). Labels padrão só são aplicados se existirem
no repositório consumidor: este catálogo usa `bug` no formulário da CLI e não
presume label temático para todas as equipes. O próprio título `[LABEL]` é uma
**instrução editável**, não uma verificação automática do label escolhido.

O GitHub também aceita a chave `projects` em um Issue Form, mas o criador precisa
de acesso de escrita ao Project especificado. Estes defaults **não** a utilizam:
`ModulosTestesAutomatizados/6` (GitHub Features) não é o Project de todos os
repositórios consumidores. Um formulário copiado para um repositório específico
pode acrescentá-la se o Project, owner e permissões forem os corretos.

Após criar uma issue, preencha conforme o tipo:

1. **Issue**: escolha o label da categoria, a milestone e, para sub-issues, o parent.
   Confirme assignee e Issue Type nativo no repositório da organização.
2. **Issue Fields da organização**, quando disponíveis: `Release` = MAJOR na épica;
   na release não épica, PATCH/MINOR/MAJOR de acordo com a entrega. Para um hotfix,
   escolha o Issue Field `Hotfix` aplicável (`Release` ou `Fix`); `Estimate`, `Size`,
   `Effort`, `Priority`, `Start date` e `Target date` seguem as regras acima.
3. **Project da issue**, se houver um Project apropriado para aquele repositório:
   adicione o item e preencha seus **próprios** campos `Estimate`, `Size`, `Effort`,
   `Priority`, `Start date` e `Target date`. Um campo do Project e um Issue Field com
   o mesmo nome são distintos e não sincronizam automaticamente. Não reutilize
   IDs de campos ou opções de outro Project/organização.

Formulários não atribuem milestone, parent, valores de Issue Fields nem valores de
campos do Project. Sem Project ou permissão, a issue ainda pode ser criada e as
instruções do corpo continuam disponíveis; complete apenas os metadados existentes.
Automatizar essa complementação exigiria uma integração **opt-in** com contrato e
permissões próprios, não incluída nestes templates.

## Pull requests

O template único de PR inclui `Realização`, `Fontes modificados`, `p/ teste` e
`O que há de novo`. Informe a issue relacionada, resultados e evidências de teste,
solicite review ao responsável e compare labels, milestone e campos aplicáveis
da issue e do PR onde o GitHub permitir. Para PR intermediário para `release/*`
ou `develop`, use `Refs #N` sem fechar a issue. Use `Closes #N` apenas se o merge
na branch padrão realmente deva fechá-la (neste repositório, `master`).

## Adoção e migração

O GitHub herda a pasta padrão de Issue Forms **somente** se o repositório da
organização não tiver formulários válidos ou configuração própria em
`.github/ISSUE_TEMPLATE/`. Se tiver qualquer conteúdo válido nessa pasta, o GitHub
usa a pasta **local inteira** em vez de mesclar defaults. Para adotar alguns
formulários em um consumidor com templates locais, copie explicitamente os arquivos
desejados para a pasta local e adapte tipos, labels e Projects. Um PR template
local de mesmo tipo substitui o default correspondente. Workflows deste
repositório especial não são executados automaticamente pelos consumidores.

Na migração dos pilotos, `issuePai.yml` continua sendo a única opção de épica,
agora com `body` de formulário válido; `release: "MAJOR"` (chave inválida) vira
instrução de preenchimento manual do Issue Field `Release`. `issueCLI.yml`
continua pedindo comando, ecossistema e logs obrigatórios; não assuma que o
label `triage` existe em todos os repositórios. Para validar, consulte
[`quickstart.md`](../specs/003-templates-issues-prs/quickstart.md).

Fontes: [sintaxe dos formulários](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) e
[defaults da organização](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file).
