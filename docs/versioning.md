# Versionamento compartilhado por sprint

Os workflows reutilizáveis de `.github/workflows/` são chamados explicitamente pelo
consumidor; o checkout de `.shared-versioning` usa a **mesma revisão** da chamada
(`job.workflow_sha`). Os scripts em `scripts/versioning/` são executados a partir
dessa revisão compartilhada: o consumidor não precisa copiá-los.

## Fluxo e gates

| Transição | Check de leitura (`version-preview.yml`) | Escrita |
| --- | --- | --- |
| `feature/* → release/vX.Y.Z` | Sub-issue da épica e milestone da sprint | Nenhuma |
| `release/vX.Y.Z → develop` | Épica encerrada e milestone concluída após homologação breve; inicia homologação completa em develop | Nenhuma; guia provisório opcional |
| `develop → main/master` | Épica/milestone concluídas, PR de release já integrado a `develop`, review vigente e `Homologação: aprovada` no PR final | Nenhuma no PR |
| `versioning/* → main/master` | Verifica proveniência do merge homologado e limita o diff a arquivos de versão | Nenhuma antes de checks/review |
| `push` após merge funcional na principal | Reconfere milestone, épica, review, homologação e SHA | Node abre PR de versão; Go/Java podem publicar direto |
| `push` após merge do PR de versão | Reconfere vínculo à entrega e diff integrado | Publica tag/release no SHA **versionado** |

`vX.Y.Z` da milestone nomeia a sprint e **não determina** a versão da aplicação.
Prévia de SemVer, versão em arquivo e changelog não são exigidos nos PRs funcionais.
O guia provisório usa títulos dos commits desde `develop`, não publica artefatos e
pode falhar sem bloquear o check obrigatório. O arquivo indicado por
`changelog_path` só é lido no commit publicável; se não existir, a release usa
um resumo da sprint.

O consumidor precisa de branch protection com status de PR, CI e revisão
humana, além de environment `homologation` com aprovação para publicar. O
registro `Homologação: aprovada` no PR final deve ser feito após a validação
humana e não substitui aprovação da environment. `develop → main/master` é
aceito apenas se o PR de `release/vX.Y.Z → develop` pertence ao histórico e foi
aprovado; PR de versão exige review independente.

## Contrato `workflow_call`

| Workflow | Entradas | Saídas | Permissões do caller |
| --- | --- | --- | --- |
| `version-preview.yml` | `adapter`, `release_branch`, `target_branch`; `project_path` opcional | `phase`, `summary` | `contents: read`, `pull-requests: read`, `issues: read` |
| `version-publish.yml` | `adapter`, `release_branch`, `target_branch`, `homologation_environment`; `project_path`, `changelog_path` opcionais | `version`, `tag`, `published_sha`, `release_url`, `version_pr_url`, `outcome` | `contents: write`, `pull-requests: read`, `issues: read` |

`version-publish.yml` aceita o secret opcional `versioning_token`. Para Node,
ele é **obrigatório na prática**: use token de GitHub App (ou credencial de
automação com `contents: write` e `pull-requests: write`) capaz de abrir PR e
disparar os checks sob as proteções do consumidor. O `GITHUB_TOKEN` do job
continua disponível para `gh api`, tag e GitHub Release. **Go não precisa de
`versioning_token` nem de PR de versão.** O antigo `unset` em
`prepare-release.sh` rodava em um subprocesso e **não** removia o token de
`publish.sh`; portanto comentá-lo não corrigia uma falha real de autenticação.
Não transmitir token de escrita a PR de feature ou fork.

`outcome` pode ser `pending-version-pr`, `published`, `already-published` ou
`conflict`. Na primeira fase Node, `version_pr_url` identifica a aprovação
pendente; após merge, `tag`, `published_sha` e `release_url` são preenchidos. Nenhuma tag é
sobrescrita. Reexecução do mesmo SHA completa somente release ausente ou retorna
`already-published`; tag noutro commit retorna conflito. Em caso de avanço da
branch antes do PR de versão, a execução interrompe e pede novo cálculo/review.
`published_sha` permanece vazio quando não houve publicação nem reconciliação.
Uma execução antiga validada pode retornar `already-published` mesmo quando
existem tags posteriores. Falhas de autenticação/API encerram a execução;
somente HTTP 404 significa ausência de tag ou release.

## Perfis e arquivos

| Adaptador | Projeto selecionado | Preparação pós-merge |
| --- | --- | --- |
| `standard-version` | Diretório com `package.json` e lockfile | Atualiza `package.json`/lockfile/changelog em PR, sem tag ou commit direto na principal. Usa commits desde último marco publicado, incluindo vários PRs da mesma release. |
| `changesets` | Monorepo com `.changeset/config.json` | A coordenação de pacotes dependentes e lockfile ainda será concluída antes da liberação deste perfil; não adotar callers independentes por pacote. |
| `jgitver` | Módulo Maven com `pom.xml` e `.mvn/extensions.xml` | Lê versão estável derivada do Git no commit integrado; prerelease é recusada. |
| `go-gitsemver` | Projeto Go | Usa `go-gitsemver` na revisão `680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6`, consome `SemVer` e `Sha` do JSON nativo e registra `--explain`; prerelease ou SHA divergente falham. |

Adaptador desconhecido, caminho fora do checkout e versão instável falham antes
de publicar. A CI de build/teste (TypeScript, Spring Boot, Go e Node) pertence
ao **consumidor**, não ao workflow de versionamento. Para configurações de
`standard-version` que atualizam outros arquivos além dos acima, estenda e
revise a lista de artefatos permitidos antes da adoção.

## Caller Go copiável da primeira liberação

O [diretório `examples/callers/go/`](../examples/callers/go/) contém três arquivos
para copiar ao **repositório consumidor**: `.github/workflows/go-publish.yml`
(caller da prévia e da publicação), `.github/workflows/go-ci.yml` (teste, análise
e build do mesmo push) e `.github/GitVersion.yml` (configuração nativa do
go-gitsemver). Os scripts e workflows centrais permanecem neste repositório.
O caller usa a revisão fixa `8b0c6a372ab560400a735bbe42a8a39af823cacf`
nas duas chamadas; ela é ancestral da `master` central. Para uma nova revisão,
altere **ambas** as referências somente após revisão e homologação. Não use
`@master` como contrato de consumo.

### O que configurar no consumidor

1. Copie os três arquivos, ajuste a CI para o `go.mod` e comandos reais do
   projeto e configure o repositório para permitir Actions reutilizáveis da
   organização. O projeto Go deve possuir `go.mod`; o runner instala
   go-gitsemver na revisão fixa `680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6`.
   O consumidor não precisa adicionar essa ferramenta ao `go.mod`.
2. No caller, configure `project_path` (diretório relativo ao checkout, `.` para
   raiz), `release_branch` (sprint atual, como `release/v1.0.0`),
   `target_branch` (branch **padrão** protegida, `main` ou `master`) e
   `homologation_environment` (nome exato do environment protegido). Mude
   `on.push.branches` e o `if` de `go-ci` junto com `target_branch`. A prévia e
   a publicação devem receber os mesmos valores de projeto e branches.
3. Configure branch protection/rulesets para revisão humana e checks da prévia
   e da CI nas integrações; crie o environment indicado com aprovação humana e
   limite de deployment à branch principal. Prepare milestone e épica da sprint.
   A milestone precisa estar fechada e sem issues abertas para publicar. O
   fluxo exigido é `feature → release → develop → principal`; no corpo do PR
   final, registre `Homologação: aprovada` após validar, além de aprovar o
   deployment. Um comentário isolado não satisfaz o gate atual.
4. Integre por PR, confira que a CI do push passou, aprove o deployment e
   verifique tag/release no SHA do merge. A publicação só ocorre em `push` na
   branch padrão e após os gates; a prévia de PR não escreve. O `GITHUB_TOKEN`
   do job usa `contents: write`, `pull-requests: read`, `issues: read`; Go não
   requer PAT, secret adicional nem PR artificial de versão. Não duplique a
   concorrência no caller: o central serializa por repositório e branch.

| Entrada do workflow | Valor Go | Impacto de alterar |
| --- | --- | --- |
| `adapter` | `go-gitsemver` | Seleciona a ferramenta e o formato da tag `vX.Y.Z`; outro valor muda o perfil de versionamento. |
| `project_path` | `.` ou subdiretório Go | Define onde o adaptador roda; caminho inválido ou fora do checkout falha. Ajuste a CI para o mesmo módulo. |
| `release_branch` | `release/vX.Y.Z` | Identifica a sprint e a proveniência dos PRs; **não** determina a versão da aplicação. Atualize por sprint nos dois jobs. |
| `target_branch` | `main` ou `master` | Deve coincidir com a branch padrão e com o gatilho de push; divergência bloqueia publicação. |
| `homologation_environment` | `homologation` ou outro nome protegido | Seleciona o gate humano antes da escrita; nome incorreto pode não aplicar a proteção pretendida. |
| `changelog_path` | Omitido ou caminho relativo | Se o arquivo existir no commit publicável, seu conteúdo alimenta a release; caso contrário é usado resumo da sprint. |

As saídas da prévia são `phase` (transição reconhecida) e `summary` (gates). Na
publicação, `version` é `X.Y.Z`, `tag` é `vX.Y.Z`, `published_sha` é o SHA que
recebeu a tag e `release_url` é o link da GitHub Release. `outcome` distingue
`published`, `already-published`, `pending-version-pr` (perfil Node) e
`conflict`; `version_pr_url` só se aplica ao PR de versão Node. Jobs posteriores
devem depender de `publish` e usar, por exemplo,
`needs.publish.outputs.version`, `.tag`, `.published_sha`, `.release_url` e
`.outcome`. Confira `published_sha == github.sha` e `outcome` igual a
`published` ou `already-published` antes de distribuir artefatos. GoReleaser
pode ser acionado nesse mesmo workflow com essas saídas, sem esperar outro
evento de tag criado por `GITHUB_TOKEN`.

### Configuração nativa do go-gitsemver

O exemplo `.github/GitVersion.yml` reproduz o **perfil permanente** homologado
no LocalLabs, sem opções temporárias de bootstrap. A configuração fica no
consumidor, não no workflow central. A [referência oficial da revisão
fixa](https://github.com/MyCarrier-DevOps/go-gitsemver/blob/680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6/docs/CONFIGURATION.md)
documenta todos os valores. Estas são as decisões que mais afetam esta
integração:

| Opção | Valores úteis / padrão nativo | Impacto no caller Go |
| --- | --- | --- |
| `mode` | `Mainline`, `ContinuousDelivery` (padrão), `ContinuousDeployment` | `Mainline` aplica o maior incremento dos commits desde a tag uma vez; os outros modos podem produzir prereleases, recusadas pelo publicador estável. |
| `base-version` | SemVer; padrão `1.0.0` | Base quando não há tag. `0.0.0` permitiu iniciar o laboratório abaixo de `1.0.0`; não substitui `next-version`. |
| `next-version` | SemVer; ausente por padrão | Força exatamente a próxima versão até ser removido; use só para bootstrap controlado, pois deixá-lo causa conflito na publicação seguinte. |
| `tag-prefix` | Regex; padrão `[vV]` | Determina quais tags a ferramenta lê. O publicador Go cria `vX.Y.Z`; um padrão incompatível faz a ferramenta ignorar releases anteriores. |
| `commit-message-incrementing` | `Enabled` (padrão), `Disabled`, `MergeMessageOnly` | `Enabled` considera commits; `Disabled` ignora `fix:`/`feat:`; `MergeMessageOnly` considera apenas mensagens de merge. |
| `commit-message-convention` | `Both` (padrão), `ConventionalCommits`, `BumpDirective` | Controla quais mensagens elevam patch/minor/major; `Both` aceita Conventional Commits e diretivas de bump. |
| `mainline-increment` | `Aggregate` (padrão), `EachCommit` | Em `Mainline`, `Aggregate` aplica o maior incremento da rodada uma vez; `EachCommit` incrementa por commit e pode produzir outra versão. |
| `branches.main.regex` | Regex para `master`/`main` | Deve reconhecer a branch definida em `target_branch`; regex divergente aplica outro perfil de branch. |
| `branches.main.is-mainline` / `tag` | `true` / `''` no exemplo | Marca a principal como tronco e evita sufixo prerelease; sufixo não vazio é rejeitado na publicação. |
| `branches.release.is-release-branch` | `false` no exemplo; padrão nativo `true` | Impede que `release/vX.Y.Z` forneça a versão-base da aplicação. A sprint não impõe SemVer. |
| `branches.*.increment` | `None`, `Major`, `Minor`, `Patch`, `Inherit` | Define o incremento de base da branch; mudar pode alterar a versão mesmo sem modificar o caller. |

Para reproduzir **somente o primeiro bootstrap** `v0.0.1` do laboratório, foram
usados `base-version: 0.0.0`, `next-version: 0.0.1` e
`commit-message-incrementing: Disabled`. Remova `next-version` e
`commit-message-incrementing: Disabled` logo após `v0.0.1`; a segunda rodada
com `fix:` produziu `v0.0.2`. Em outro consumidor, escolha a base pelo
histórico de tags existente e examine `go-gitsemver --explain` antes de ativar
publicação. O central consome o JSON nativo (`SemVer`, `Sha`) no SHA integrado;
não calcula incrementos por conta própria. Prerelease, SHA divergente e
configuração inválida bloqueiam a escrita.

Na revisão fixada de `go-gitsemver`, a consulta de um commit já tagueado pode
retornar `Sha` vazio mesmo com `SemVer` correto. Para uma reexecução, o
publicador só aceita esse caso quando a tag `v<SemVer>` aponta exatamente para
`GITHUB_SHA`; ele também confere a referência e a release remotas antes de
retornar `already-published`. Um SHA divergente continua bloqueado.

### Evidência hospedada no LocalLabs

O [primeiro push publicado](https://github.com/GersonTekSystem/LocalLabs/actions/runs/36266024805/attempts/1)
criou a [release v0.0.1](https://github.com/GersonTekSystem/LocalLabs/releases/tag/v0.0.1)
no SHA integrado `db1700045c6e618f539b3de6258e4877ffc85069`. Sua
reexecução revelou o `Sha` vazio do adaptador em commit já tagueado e falhou
sem mover a tag. Após a correção, o fluxo revisado
([PRs #10–#12](https://github.com/GersonTekSystem/LocalLabs/pull/12)) removeu
o bootstrap temporário e publicou a
[release v0.0.2](https://github.com/GersonTekSystem/LocalLabs/releases/tag/v0.0.2)
no SHA `fcb456ea9689f9c554e5ec335435fb024faa8a1d`, calculado pelo
Conventional Commit `fix:`. A
[tentativa 2](https://github.com/GersonTekSystem/LocalLabs/actions/runs/36268700982/attempts/2)
da segunda execução retornou `already-published` após nova aprovação do
ambiente, sem criar tag ou release adicional. A evidência de PRs, configuração,
aprovações e SHAs está na
[sub-issue #9 do LocalLabs](https://github.com/GersonTekSystem/LocalLabs/issues/9#issuecomment-5849547858).

Os ensaios hospedados extensos de dez reexecuções, concorrência, recuperação
de release e conflito remoto continuam como trabalho da issue central #2.

## Roteiro de homologação no LocalLabs

1. Com acesso de escrita, crie `develop` e uma `release/vX.Y.Z` **distinta por
   rodada**. Crie a milestone `vX.Y.Z`, épica de mesmo título e sub-issues de
   features. Configure regras de proteção da principal e `develop`: review
   humano, status do check `validate-pr / preview` (confira nome exato no GitHub)
   e CI própria. Crie environment `homologation` com revisores obrigatórios.
2. Instale ferramentas/build do perfil e habilite apenas o job de PR. Mova o
   caller de ensaio de `tests/versioning/fixtures/caller.yml` do consumidor para
   `.github/workflows/`; a ref do compartilhado deve existir. Abra feature →
   release, release → develop e develop → principal, conferindo sucesso, falha
   por vínculo ausente e ausência de tags. O guia de homologação é opcional.
3. Após aprovação, habilite **um** perfil de publicação. Para Node, confira
   merge funcional → PR de versão → CI/review → merge → tag/release no SHA do
   commit versionado. Para Go/Java derivados de Git, confira tag/release no SHA
   funcional e versão estável. Repita para `standard-version`, `changesets`,
   `jgitver` e `go-gitsemver`, com versões/commits diferentes. Em
   `standard-version` inclua vários PRs na mesma release sem tag intermediária.
4. Repita a publicação dez vezes, ensaie concorrência e uma tag divergente em
   rodada isolada; confira que tags jamais se movem e release não duplica. Para
   falha após criar tag, retome apenas a release com SHA idêntico.
5. Registre por rodada URLs de PRs/checks, aprovação de environment, SHA de
   integração/versão, tag, GitHub Release, idempotência e diagnóstico de conflito
   em `LocalLabs/tests/versioning/validation-results.md`.

### Verificações locais do compartilhado

```bash
node tests/versioning/pr-check.mjs
node tests/versioning/post-merge.mjs
bash -n scripts/versioning/*.sh
openspec validate corrigir-versionamento-pos-merge --strict
```

Os ensaios locais simulam a API GitHub e o adaptador; eles não substituem o
ensaio hospedado com ferramentas reais e proteções configuradas.
