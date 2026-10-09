# Scripts da pipeline centralizada de versionamento

Esta pasta implementa as regras executadas pelos
[workflows centrais](../../.github/workflows/README.md). O YAML coordena a
execução; os scripts calculam, coletam evidências, validam e publicam. Não são
pipelines independentes: são componentes da mesma automação, versionados junto
dos calleds e reutilizados por todos os consumidores.

O contrato normalizado oferece **Go, standard-version e jgitver**; Changesets/Turbo
permanece pendente. Leia também o
[guia de adoção e contratos](../../docs/versioning.md), o
[exemplo Go](../../examples/callers/go/README.md) e a
[especificação TLC](../../.specs/features/centralized-versioning-pipeline/spec.md).
Os artefatos OpenSpec são históricos, não o contrato ativo deste MVP.

## 1. Por que a lógica não está inteira no YAML?

O workflow define gatilhos, runner, checkouts, instalações, permissões,
dependências entre jobs, environment e upload de artifacts. Os scripts cuidam
das decisões que precisam ser testadas com dados e cenários negativos.

Essa divisão permite executar fixtures locais sem abrir PRs nem publicar no
GitHub, usar a mesma policy na prévia e após o merge, e isolar coleta de API de
decisões puras. Centralização significa **uma implementação compartilhada**,
não obrigatoriamente um único arquivo.

Há três formas diferentes de reutilização:

| Construção | O que acontece |
| --- | --- |
| `jobs.<job>.uses: .../workflow.yml@<SHA>` | O caller chama um workflow reutilizável, com seu próprio conjunto de jobs. |
| `steps[].uses: actions/checkout@<SHA>` | Uma etapa executa uma action. |
| `steps[].run: bash caminho/script.sh` | Uma etapa executa um processo no runner; Bash interpreta o arquivo disponível no checkout. |

Um job que chama um called não recebe etapas `steps` adicionais; encadeie outro
job com `needs` quando necessário. `with` fornece inputs ao called, que os
converte em variáveis de ambiente para o script.

## 2. Como os arquivos chegam ao runner

O called obtém o checkout da aplicação e um segundo checkout da automação em
`.shared-versioning`, usando `job.workflow_repository` e `job.workflow_sha`.
Isso mantém scripts e workflow na mesma revisão selecionada pelo caller.

Depois executa, por exemplo:

```yaml
env:
  GH_TOKEN: ${{ github.token }}
  ADAPTER: ${{ inputs.adapter }}
  TARGET_BRANCH: ${{ inputs.target_branch }}
  PROJECT_PATH: ${{ inputs.project_path }}
run: bash .shared-versioning/scripts/versioning/preview.sh
```

O diretório de trabalho padrão é o workspace da aplicação. Os scripts localizam
seus auxiliares usando `BASH_SOURCE`, mas consultam o Git da aplicação, não o
Git da pasta `.shared-versioning`. Portanto, estar localizado no checkout
central não significa calcular a versão do repositório central.

`bash arquivo.sh` não depende de o arquivo estar marcado como executável.
Arquivos `.mjs` são módulos JavaScript executados com `node`; não são YAML.
Os entrypoints Bash usam `set -euo pipefail` para propagar erros, rejeitar
variáveis obrigatórias ausentes e evitar que erros de pipelines sejam ocultos.
Não há serviço contínuo: cada execução ocorre no runner de um job.

Não passe texto de PR diretamente como comando shell. Os workflows atuais
passam configurações por `env`; coletores e módulos usam dados JSON e argumentos.
Não coloque PATs em YAML, documentação ou arquivos versionados.

## 3. Mapa da implementação ativa

| Arquivo | Entrada principal | Responsabilidade |
| --- | --- | --- |
| [preview.sh](preview.sh) | Evento de PR e checkout do head | Selecionar a fase, calcular versão, coletar snapshot e gerar guia ou avaliar policy. |
| [resolve-adapter.sh](resolve-adapter.sh) | Adaptador, caminho e workspace | Seleção permitida de ferramenta, confinamento do projeto e conversão de caminhos Windows/Node. Biblioteca carregada com `source`. |
| [collect-version-report.sh](collect-version-report.sh) | Caminho de saída, adaptador, branch e SHA | Executar Go, standard-version ou jgitver nativo e produzir relatório normalizado. |
| [version-report.mjs](version-report.mjs) | Saída nativa e Git local | Validar SemVer/SHA/prefixo, encontrar a maior tag estável alcançável e normalizar `VersionReport`. |
| [collect-origin-report.sh](collect-origin-report.sh) | SHA funcional e caminho de saída | Recalcular standard-version no commit homologado, sem tocar na principal. |
| [validate-version-pr.sh](validate-version-pr.sh) | PR técnico Node | Conferir proveniência, versão nativa e manifests antes da tag. |
| [version-pr.mjs](version-pr.mjs) | PR técnico e arquivos de versão | Validar metadados, diff e versões persistidas. |
| [collect-pr-policy.sh](collect-pr-policy.sh) | Número do PR ou `--commit <SHA>` | Coletar PR, milestone, timeline, reviews e papéis atuais; produzir snapshot. |
| [release-policy.mjs](release-policy.mjs) | Relatório, snapshot e fase | Avaliar milestone e override, sem chamadas externas ou publicação. |
| [homologation-guide.mjs](homologation-guide.mjs) | Relatório, snapshot e diretório | Gerar Markdown/JSON distinguindo fatos de verificações ainda pendentes. |
| [release-gates.sh](release-gates.sh) | Evento push, checkout e API | Validar branch padrão, SHA remoto, único PR integrado e policy antes de publicar. Biblioteca carregada com `source`. |
| [publish.sh](publish.sh) | Gates validados e GitHub API | Reconciliar tag/Release, escrever apenas o necessário e retornar o resultado. |

### Auxiliares e perfil pendente

Os arquivos abaixo complementam a implementação. A presença de Changesets não
significa suporte normalizado a Turbo neste contrato.

| Arquivo | Finalidade existente |
| --- | --- |
| [prepare-release.sh](prepare-release.sh) | Preparação anterior com seleção de perfis e avaliação de versão. |
| [prepare-version-pr.sh](prepare-version-pr.sh) | Criar o PR técnico de standard-version após merge funcional; exige token de GitHub App. |
| [validate-sprint.sh](validate-sprint.sh) | Validações anteriores de branch de release, issues e épica. |
| [homologation-guide.sh](homologation-guide.sh) | Guia provisório anterior baseado no log; diferente do renderer `.mjs` ativo. |
| [version.mjs](version.mjs) | Utilitários SemVer do fluxo anterior; não confundir com `version-report.mjs`. |
| [install-node.sh](install-node.sh) | Instalação de dependências Node com lockfile. |
| [verify-version-files.mjs](verify-version-files.mjs) | Restrição dos arquivos alterados em um PR técnico de versão. |
| [sync-npm-lock.mjs](sync-npm-lock.mjs) | Sincronização de versão no lockfile npm. |

`resolve-adapter.sh` ainda reconhece Changesets, mas o coletor o recusa. Não
troque apenas `adapter` no caller esperando suporte completo a Turbo.

## 4. Fluxo de prévia e homologação

```text
evento de PR -> version-preview.yml -> preview.sh
  -> resolve-adapter.sh / collect-version-report.sh -> version-report.json
  -> collect-pr-policy.sh -> pr-policy.json
  -> PR para develop: homologation-guide.mjs -> Markdown/JSON + summary
  -> PR final: release-policy.mjs -> decisão da milestone/override
```

`preview.sh` exige um evento com número, branches e SHAs do PR. Confere que
`git rev-parse HEAD` coincide com o head atual e usa esse SHA para o adaptador.

As fases atuais são:

- `release-to-develop`: PR cuja base é `develop` e origem não é `develop`.
  Esse é o nome interno da fase; o código não restringe a origem ao prefixo
  `release/`. Produz o guia de homologação, não aplica o contrato de publicação.
- `develop-to-main`: origem `develop`, base igual a `target_branch`.
- `hotfix-to-main`: origem não vazia `hotfix/<nome>`, base igual ao alvo.

As duas últimas compartilham a mesma policy. `feature/* -> master`, `hotfix`
literal e `hotfix/` vazio são recusados. Hotfix deve ser criado a partir da
master publicada; Git não armazena um campo permanente "branch de origem".
Os gates verificam branches do PR e sua integração, enquanto a origem em master
é uma convenção operacional exercitada no teste de merge real.

O adaptador executa:

```bash
go-gitsemver --branch "$TARGET_BRANCH" --commit "$GITHUB_SHA" -o json --explain
```

A saída JSON e a explicação nativa são preservadas. A pipeline **não escolhe
uma nova versão por um algoritmo paralelo**. Classifica o incremento entre a
base e a candidata para comparação com o planejamento.

No PR para develop, são acrescentados assuntos de commits do intervalo
`baseSha..headSha`, resultados conhecidos de check-runs e um checklist sugerido.
Não é uma análise automática de impacto nem comprovação de homologação.
A sugestão atual é um smoke test genérico, sempre marcado como pendente.
Não há chamada a LLM nesta implementação.

O renderer escapa texto no Markdown e gera `homologation.md` e
`homologation.json`. O resumo vai para `GITHUB_STEP_SUMMARY`; o workflow faz
upload dos dois arquivos, com nome que inclui PR e tentativa. O limite local
combinado padrão é 10 GiB (`VERSIONING_ARTIFACT_MAX_BYTES`); esse controle não
substitui limites/retenção configurados no GitHub. Em excesso de tamanho, a
prévia falha depois de preservar o summary. Não são criados commits de changelog
no consumidor, comentários automáticos ou tasks de LLM.

## 5. Dados e decisões

### VersionReport, schemaVersion 1

Campos: `adapter`, `sha`, `branch`, `baseVersion`, `candidateVersion`, `tag`,
`bump` e `native` (`format`, `result`, `explanation`).

`baseVersion` é a maior versão SemVer estável dentre tags alcançáveis pelo SHA
avaliado; não é necessariamente a tag mais recente por data nem a última
GitHub Release. O prefixo do caller delimita a família de tags. Sem tag estável,
a base matemática é `0.0.0`; a exigência de primeiro artefato `v0.0.1` se
aplica ao perfil Go. Node/Maven seguem a versão nativa estável.
Prereleases não fazem parte deste MVP.

Em reexecução de um commit já tagueado, o adaptador pode retornar `Sha` vazio.
Isso só é aceito se a tag exata da candidata existir localmente e apontar para
o SHA solicitado. Não é permissão para ignorar a identidade do commit.

### Snapshot do PR

Contém repositório, número, `headSha`, `headBranch`, `baseBranch`, `mergedAt`,
`mergeCommitSha`, milestone opcional e evidências do override. A coleta consulta
PR, timeline e reviews paginados, além dos papéis atuais dos atores pertinentes.
Não deriva o planejamento de issues filhas, épicas ou Issue Fields.

Com `--commit`, o coletor exige exatamente um PR integrado, com origem
`develop` ou `hotfix/<nome>`, base correta e `merge_commit_sha` igual ao commit.
Zero ou múltiplas associações falham fechadas.

### Policy de release

| Situação | Resultado |
| --- | --- |
| Sem milestone | `adapter-authoritative`: aceitar o cálculo nativo, sem aprovação extra de planejamento. |
| Título estrito `vMAJOR.MINOR.PATCH`, versão e incremento coincidentes | `matched`. |
| Milestone válida, mas divergente, com override autorizado | `overridden`. |
| Milestone inválida ou divergência sem autorização válida | `blocked`. |

Milestone inválida **não pode ser contornada** por override. O incremento
planejado é derivado da base até a versão do título e comparado ao calculado.
Sem milestone não se exige override, mas CI e demais gates continuam valendo.
O resultado registra versões/incrementos planejados/calculados, razões e auditoria.

### Override auditável

1. Um Maintain/Admin aplica `versioning:override`.
2. Outra pessoa Maintain/Admin aprova depois do label, sobre o head atual.
3. Timeline, papel atual, ordem temporal, identidades e commit são conferidos.

Label aplicado por Triage/Write não autoriza a exceção. Remoção/reaplicação do
label muda a evidência vigente. O coletor usa o estado efetivo mais recente de
review por pessoa; review dismissed, antigo ou de outro SHA não basta.
Falha de API não é aprovação. Não há `force`, checkbox ou input do caller que
substitua essa autorização.

## 6. Fluxo de publicação após merge

```text
push na branch alvo -> caller: go-ci -> version-publish.yml
  -> environment-gate, se informado
  -> publish.sh -> release-gates.sh
     -> conferir default branch, checkout e SHA remoto
     -> coletar único PR integrado e recalcular relatório
     -> release-policy.mjs, phase=publication
  -> Go/Maven: reconciliar tag/Release
  -> Node: abrir PR técnico; após review/merge, recalcular origem e reconciliar tag/Release
```

O caller deve declarar `needs` para a CI do mesmo push (`go-ci`, `node-ci` ou
`maven-ci`). Esse encadeamento é o gate de CI da
aplicação; `release-gates.sh` não executa testes Go por conta própria.
Proteção de branch/required checks é configuração do consumidor, não algo
instalado por estes scripts.

Há **dois SHAs diferentes**: aprovação é vinculada a `headSha` do PR; cálculo,
tag e Release após merge usam `mergeCommitSha`. Eles podem ser distintos em
um merge normal. `phase=publication` compara relatório com o SHA integrado,
mas mantém a aprovação ligada ao head revisado.

O gate também consulta a branch padrão do repositório e o SHA remoto atual.
Um push direto sem PR integrado elegível é recusado. Se master já avançou para
outro commit, uma execução antiga apenas reconcilia tag e Release já completas
no SHA antigo e retorna `already-published`; nenhuma escrita é permitida.

Environment é opcional. Vazio, o job de environment é skipped e a publicação
pode seguir; informado, o job aguarda as regras do environment do consumidor.
Isso não remove CI nem policy. A aprovação de environment **não é** o override
da milestone. Não existe aprovação autônoma por LLM nesta entrega.

### Reconciliação antes de escrita

| Estado remoto | Ação |
| --- | --- |
| Sem tag nem Release | Criar tag no SHA integrado e depois Release. |
| Tag no SHA correto, sem Release | Criar somente Release; recuperar falha parcial. |
| Tag e Release com versão/SHA idênticos | `already-published`, sem novas escritas. |
| Tag em outro SHA, Release sem tag verificável ou Release divergente | `conflict`, falhar sem sobrescrever. |

As consultas tratam 404 como ausência; outros erros bloqueiam. Em corrida de
criação, o publicador consulta novamente até dez vezes para confirmar o objeto
criado. Não move tags, não apaga Releases e não força push. O workflow serializa
execuções por repositório/branch, sem cancelar uma publicação em andamento.

As notas contêm versão, SHA, explicação e JSON nativos. `changelog_path`, quando
informado e existente, acrescenta um arquivo do consumidor; deve permanecer
dentro do workspace. Não existe geração automática de binários Go ou upload
de assets de distribuição neste MVP.

## 7. Configurações, runtime e outputs

| Variável | Uso |
| --- | --- |
| `ADAPTER` | `go-gitsemver`, `standard-version` ou `jgitver`. |
| `TAG_PREFIX` | Prefixo literal; padrão `v`, Go exige `v`. |
| `VERSIONING_TOKEN` | GitHub App token para abrir PR técnico Node; não usado por Go/Maven. |
| `TARGET_BRANCH` | Branch de publicação; deve ser a default branch no pós-merge. |
| `PROJECT_PATH` | Diretório relativo do projeto, padrão `.`; sem `..` ou escape do workspace. |
| `GH_TOKEN` | Token para API, fornecido pelo workflow como `github.token`. Nunca imprimir. |
| `GITHUB_REPOSITORY` | Repositório consumidor. |
| `GITHUB_SHA` | SHA avaliado: head na prévia, integrado na publicação. |
| `GITHUB_EVENT_PATH` | JSON do evento de PR, obrigatório na prévia. |
| `GITHUB_EVENT_NAME` / `GITHUB_REF_NAME` | Restringir publicação a push na branch alvo. |
| `GITHUB_WORKSPACE` | Raiz do checkout consumidor. |
| `VERSIONING_OUTPUT_DIR` | Diretório dos arquivos da prévia; workflow usa `runner.temp/versioning`. |
| `VERSIONING_ARTIFACT_MAX_BYTES` | Limite local dos dois guias; não é input público do called. |
| `CHANGELOG_PATH` | Complemento opcional às notas, vindo de `changelog_path`. |
| `GITHUB_OUTPUT` | Arquivo de comunicação das saídas da etapa ao workflow. |
| `GITHUB_STEP_SUMMARY` | Arquivo de resumo Markdown da execução. |

Scripts exigem Bash, Git, Node compatível com os módulos `.mjs`, GitHub CLI
(`gh`) e ferramentas GNU usadas pelo Bash. O called prepara Node 24 e instala
as dependências do consumidor para standard-version; prepara Java 17 para
jgitver; e instala Go e o adaptador go-gitsemver na revisão
`680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6` para o perfil Go. Os calleds
usam runner Ubuntu e não oferecem contrato de execução arbitrária em Windows
ou self-hosted.

Saídas da prévia: `phase`, `version`, `bump`, `policy_outcome`, `summary`.
Na homologação, `policy_outcome` é `not-applicable`.
Saídas de publicação: `version`, `tag`, `published_sha`, `release_url`, `version_pr_url`, `outcome`.
Erros prévios aos resultados podem terminar sem outputs completos; não trate
output ausente como sucesso. O processo retornar zero é necessário, mas a
proteção de merge depende de tornar o check obrigatório no consumidor.

Permissões da prévia: leitura de contents, PRs, issues e checks. Publicação:
contents escrita; PRs/issues leitura. O caller deve concedê-las explicitamente,
pois o called não pode elevar permissões. Não é necessário PAT pessoal no
caller atual; permissões da CLI do desenvolvedor para abrir PR são outro assunto.

## 8. Execução local e testes seguros

Use as fixtures como primeiro contato. Elas criam repositórios temporários e
simulam a API; não criam Releases reais no GitHub:

```bash
node tests/versioning/run.mjs --local
node tests/versioning/workflow-contract.mjs
node tests/versioning/release-policy.mjs
```

Para o adaptador real, após disponibilizar Go e instalar a revisão fixada:

```bash
go install github.com/MyCarrier-DevOps/go-gitsemver@680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6
node tests/versioning/run.mjs --real-go
```

O binário deve estar no PATH (normalmente `go env GOPATH` seguido de `/bin`).
No Windows, use Git Bash, não o `bash.exe` do WSL sem distribuição funcional:

```powershell
$env:PATH = 'C:\Program Files\Git\bin;' + $env:PATH
node tests/versioning/run.mjs --local
```

Não execute `publish.sh` manualmente com token de produção para aprender seu
funcionamento: ele escreve na API quando os gates passam. Não fabrique variáveis
para contornar gates. `source release-gates.sh` apenas carrega a função; chamar
`validate_release_gates` faz a avaliação. O publisher chama-a normalmente.

As fixtures locais cobrem runner, normalização, adaptadores, policy, guia,
workflow/caller, coleta, prévia e pós-merge. Incluem hotfix real a partir de
master, merge não fast-forward, SHAs distintos, aprovações inválidas, falhas
parciais, corridas e repetições sem novas escritas. O teste Go real usa o binário
nativo, mas não prova permissões ou execução hospedada no consumidor.
A [verificação independente](../../.specs/features/centralized-versioning-pipeline/validation.md)
registra alcance e limitações da evidência.

## 9. Diagnóstico

| Sintoma | Conferir |
| --- | --- |
| Script não encontrado | Segundo checkout, revisão do called, path `.shared-versioning` e diretório de trabalho. |
| Adaptador não encontrado | Instalação fixada e PATH; não substituir por comando fornecido pelo PR. |
| Transição não suportada | Branches reais do PR e nome não vazio `hotfix/<nome>`. |
| Snapshot/SHA divergentes | Checkout do head na prévia; checkout integrado na publicação; review deve continuar no head. |
| Milestone bloqueada | Título estrito, versão exata e incremento; título inválido não aceita override. |
| Override bloqueado | Ator do label, papéis atuais, segundo aprovador, ordem temporal e SHA vigente. |
| API 403 / resposta incompleta | Permissões do token da execução; não converter indisponibilidade em aprovação. |
| PR integrado ausente/ambíguo | Associação do commit, base, origem permitida e `merge_commit_sha`. |
| SHA remoto avançou | Execução antiga versus branch padrão atual; não reaproveitar relatório antigo. |
| Environment aguardando | Regras no consumidor; não alterar a policy para dispensar o gate. |
| Tag/Release em conflito | Versão e SHA remotos; intervenção humana, nunca mover a tag automaticamente. |
| Artifacts grandes | Tamanho dos dois guias, limite local, summary preservado e limites do GitHub. |

## 10. Evolução sem duplicar lógica

Novos adaptadores precisam implementar um contrato normalizado, preservar
evidência nativa e ganhar testes próprios. Novos callers devem apenas selecionar
inputs, permissões, eventos e CI; não recalcular versão nem implementar override.
Mudanças de schema, policy ou guards exigem testes negativos e revisão independente.
Manter scripts e called na mesma revisão evita mistura de versões.

A adoção no `boilerplate-cli`, a consolidação do arquivo `go-ci`, a revisão por
LLM e a aprovação automática de environments são próximos trabalhos, não
funcionalidades já entregues por estes scripts.

## Referências

- [Voltar ao catálogo dos workflows](../../.github/workflows/README.md).
- [Guia de adoção](../../docs/versioning.md).
- [Run e shell no GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun).
- [Calleds, outputs e restrições de permissões](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
- [Comandos de comunicação com o runner](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands).
