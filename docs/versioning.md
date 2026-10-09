# Pipeline centralizada de versionamento

Os workflows deste repositório calculam, validam e publicam versões sem copiar
regras para os consumidores. O caller informa o adaptador, o projeto e a branch
principal. O workflow central é carregado na mesma revisão imutável declarada
em `uses`.

O perfil Go está homologado; esta revisão acrescenta coleta normalizada para
`standard-version` e `jgitver`. Changesets/Turbo continua em preparação. Os artefatos OpenSpec existentes
continuam como histórico; a especificação ativa está em
`.specs/features/centralized-versioning-pipeline/`.

## Ciclo de entrega

1. Em um PR para `develop`, `version-preview.yml` executa o adaptador em modo
   somente leitura. Ele publica `homologation.md` e `homologation.json` como
   artifact e escreve o resumo humano no check. Nenhum commit, tag ou release é
   criado.
2. Em um PR `develop → master` ou `hotfix/<nome> → master`, a prévia recalcula a versão e avalia a milestone
   atual do próprio PR.
3. Sem milestone, o cálculo do adaptador é autoritativo. Com milestone, o título
   deve ser SemVer estrito, como `v1.2.0`, e precisa coincidir com a versão exata
   e com o tipo de incremento calculado.
4. Depois do merge, o `push` em `master` executa primeiro a CI do consumidor. O
   publicador encontra o único PR integrado de `develop` ou `hotfix/<nome>` para `master`, recalcula a
   versão e reavalia a policy com os dados atuais da API.
5. Com Go ou jgitver, tag imutável e GitHub Release são criadas no SHA integrado.
   Para Go sem tags estáveis anteriores, somente `v0.0.1` é aceita.
6. Com `standard-version`, o merge funcional cria um PR técnico com `package.json`,
   lockfile e `CHANGELOG.md`; o job retorna `pending-version-pr`. Esse PR precisa
   passar pela CI e por revisão humana. Seu merge recalcula a versão no SHA
   funcional homologado e publica no **novo SHA integrado**, que contém os
   manifests. `Origin-SHA` e `Origin-PR` preservam a proveniência. O PR técnico
   nunca é substituído por um commit direto na principal.

O relatório nativo do `go-gitsemver`, inclusive `--explain`, é preservado no
`VersionReport` e serve de base para o guia e para as notas da release. O central
não implementa um segundo algoritmo de SemVer.

### Correções de produção (hotfix)

Crie `hotfix/<nome>` a partir da `master` atualizada e abra o PR para `master`.
Sem milestone, vale o cálculo nativo; com milestone, versão e incremento são
validados normalmente. Não há PATCH forçado nem dispensa de CI, proteção de
branch, review/override, environment configurado ou verificação de SHA.
Somente após integração e gates normais são criadas tag e Release.
`hotfix`, `hotfix/` sem nome e `feature/* -> master` continuam recusados.
O output da prévia identifica esse caminho como `hotfix-to-main`; ele usa a
mesma policy de `develop-to-main`, sem novo input de bypass no caller.

## Milestone e override auditável

Uma milestone presente é um contrato explícito. Título inválido ou divergência
de versão/incremento bloqueia o check. A exceção exige toda esta sequência:

1. Uma pessoa com papel efetivo `Maintain` ou `Admin` aplica o label
   `versioning:override`.
2. Outra pessoa com papel efetivo `Maintain` ou `Admin` aprova o PR depois do
   label e sobre o SHA atual.
3. O check confirma timeline, papéis atuais, identidades distintas, horários e
   SHA. Falha ou resposta incompleta da API bloqueia.

O GitHub permite que pessoas com papel `Triage` apliquem labels. Por isso, o
label sozinho nunca autoriza a exceção. Novo commit, remoção do label ou mudança
de milestone/review executa a avaliação novamente e invalida evidência antiga.
Não existem inputs `approved`, `force` ou `skip_validation`.

## Contratos reutilizáveis

### `version-preview.yml`

| Entrada | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `adapter` | sim | - | `go-gitsemver`, `standard-version` ou `jgitver`. |
| `target_branch` | sim | - | Branch principal protegida. |
| `project_path` | não | `.` | Diretório do projeto dentro do checkout. |
| `tag_prefix` | não | `v` | Prefixo **literal** da tag; Go exige `v`; Node/Maven podem usar `infra/v` quando a ferramenta nativa estiver alinhada. |

Saídas: `phase`, `version`, `bump`, `policy_outcome` e `summary`. O job possui
somente permissões de leitura: `contents`, `pull-requests`, `issues` e `checks`.

### `version-publish.yml`

| Entrada | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `adapter` | sim | - | Adaptador calculador. |
| `target_branch` | sim | - | Branch principal protegida. |
| `project_path` | não | `.` | Diretório do projeto dentro do checkout. |
| `tag_prefix` | não | `v` | Mesmo prefixo usado na prévia e pela ferramenta nativa. |
| `publication_environment` | não | `''` | Gate adicional do consumidor. |
| `changelog_path` | não | `''` | Complemento opcional às notas nativas. |
| secrets `versioning_app_id` / `versioning_app_private_key` | só Node | - | GitHub App instalada no consumidor, com `Contents: write` e `Pull requests: write`; o job emite token efêmero para abrir o PR técnico. |

Saídas: `version`, `tag`, `published_sha`, `release_url`, `version_pr_url` e `outcome`.
`outcome` é `pending-version-pr`, `published`, `already-published` ou `conflict`.
`published_sha` só é preenchido depois de publicação/reconciliação; no Node ele
é o SHA do merge técnico, enquanto `Origin-SHA` identifica o merge funcional
homologado. Somente o job de publicação
recebe `contents: write`; as demais permissões são leitura. A concorrência é
serializada por repositório e branch, sem cancelar uma publicação em andamento.

Se `publication_environment` estiver vazio, o gate de environment é ignorado e
a publicação segue automaticamente após CI e checks. Com um nome, o job espera
as regras configuradas no consumidor, como revisores obrigatórios ou uma regra
de proteção via GitHub App. Consulte a documentação de
[environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

### Migração

Substitua `homologation_environment` por `publication_environment`. O input
antigo era obrigatório; o novo é opcional. Remova `release_branch` e qualquer
lógica de épica ou texto `Homologação: aprovada` do caller. Go/jgitver não usam
`versioning_token` antigo do caller. Para standard-version, forneça App ID e
chave privada; o called emite uma credencial efêmera na execução de publicação.

## Caller Go

Copie [`examples/callers/go/`](../examples/callers/go/) para o consumidor. O
exemplo inclui CI Go reutilizável, caller e `.github/GitVersion.yml`. Ajuste
`project_path`, `target_branch`, versão do Go e comandos reais de CI. Mantenha a
mesma revisão SHA nos dois workflows centrais e nunca use `@master`.

Para exigir aprovação adicional, acrescente apenas ao job `publish`:

```yaml
with:
  adapter: go-gitsemver
  project_path: .
  target_branch: master
  publication_environment: production
```

O caller deve encaminhar `opened`, `reopened`, `synchronize`, `edited`,
`labeled`, `unlabeled`, `milestoned` e `demilestoned`, além de reviews
`submitted` e `dismissed`. O job de prévia deve conceder `checks: read` porque o
workflow reutilizável não pode elevar permissões omitidas pelo caller. A
publicação só pode ser chamada em `push` para `master` e deve declarar
`needs: go-ci`.

## Callers Node e Maven

Os diretórios [`examples/callers/standard-version/`](../examples/callers/standard-version/)
e [`examples/callers/jgitver/`](../examples/callers/jgitver/) contêm workflows
copiáveis de prévia, CI no mesmo push e publicação. Ajuste `project_path`,
`target_branch`, o gatilho de `push`, comandos de CI e as versões de Node/Java
antes de instalar em outro consumidor. Os dois `uses` centrais de cada caller
devem apontar para o **mesmo SHA revisado**; nunca use `@master`.

Para Node, registre `standard-version` nas `devDependencies` e commite um
lockfile (`package-lock.json` ou `npm-shrinkwrap.json` no perfil de atualização
atual). O chamado instala dependências com `npm ci --ignore-scripts`; o cálculo
usa `standard-version --dry-run --skip.commit --skip.tag` e a preparação usa
`--skip.commit --skip.tag`. O comando nativo é a fonte da versão e do changelog;
o central valida que `package.json`, lockfile e `CHANGELOG.md` concordam antes
do PR e novamente antes de publicar. Configurações que escrevem outros
`bumpFiles`, outro changelog ou lockfiles pnpm/Yarn exigem estender a lista
permitida e os testes **antes** de ativar o caller. A GitHub App deve estar
instalada no consumidor, com escrita em Contents e Pull requests. Cadastre o
App ID e a chave privada como secrets do consumidor; o called emite e revoga um
token por execução. O `GITHUB_TOKEN` continua com leitura de PR e escrita em
Contents no job de publicação. Não passe credenciais ao job de prévia.

O PR técnico `versioning/standard-version/<Origin-SHA>` leva versão, projeto e
prefixo no corpo. Se já estiver aberto, a reexecução retorna o mesmo URL. Se
o PR for alterado, o check recusa arquivos fora de manifests/changelog, versão
divergente ou origem diferente. Após aprovação e merge, o publicador recalcula
o dry-run no SHA funcional anterior, revalida a policy original e publica no
merge técnico. A tag nunca é movida. Caso a branch principal avance antes do
PR técnico, recalcule e obtenha nova revisão; não force a publicação antiga.

Para Maven, inclua no consumidor `pom.xml`, `.mvn/extensions.xml` com a versão
fixada da extensão jgitver e, se necessário, `.mvn/jgitver.config.xml`. O
coletor executa o Maven do consumidor para obter `project.version` no SHA
avaliado com `JGITVER_BRANCH` da principal; versões `-SNAPSHOT` ou qualquer
prerelease são recusadas. jgitver deriva a versão do Git e **não altera o POM**
no fluxo de publicação. O caller deve executar testes/verify antes do called.

### Prefixos de artefatos de infraestrutura

`tag_prefix` aceita um prefixo literal como `v` ou `infra/v`, composto de letras,
números, ponto, sublinhado, hífen e barra interna; é recusado se vazio, terminar
em barra/ponto ou contiver `..`. Ele delimita quais tags alcançáveis contam como
base e forma a tag publicada. Use o mesmo valor na prévia e publicação e alinhe
a configuração nativa. Em standard-version, `--tag-prefix` recebe esse valor;
em jgitver, configure `regexVersionTag` na configuração Maven para reconhecer
o prefixo adotado. Por exemplo, `infra/v([0-9]+\\.[0-9]+\\.[0-9]+)` reconhece
tags `infra/v1.2.3`. Trocar o prefixo após releases anteriores faz o adaptador
ignorar essas tags e pode provocar versão repetida: faça uma migração explícita
com teste de histórico. O perfil Go permanece em `v` porque sua configuração
nativa e a reconciliação estão homologadas com esse formato.

As [opções de standard-version](https://github.com/conventional-changelog/standard-version#configuration)
vivem em `package.json` ou `.versionrc*` do consumidor. `--dry-run` calcula sem
escrever; `skip.commit`/`skip.tag` deixam o commit e a tag para os gates do
GitHub. `tagPrefix` muda a família de tags; `infile`/`bumpFiles` alteram os
arquivos escritos e requerem revisão do contrato acima. A
[extensão jgitver](https://github.com/jgitver/jgitver-maven-plugin#configuration)
usa `.mvn/jgitver.config.xml`: `regexVersionTag` seleciona tags, `strategy`
e `policy` afetam o cálculo, e `useSnapshot` pode produzir uma versão que o
publicador estável rejeita. Essas escolhas ficam no consumidor e devem ser
validadas no ensaio real antes de fixar um novo SHA de caller.

Changesets/Turbo continua fora da liberação: a preparação precisa coordenar
pacotes dependentes, seus manifests, changelogs e lockfile como uma unidade.
Não use callers independentes por pacote nem selecione `changesets` apenas por
ele ainda aparecer em scripts auxiliares.

## Proteção de branches

Configure rulesets ou branch protection no repositório consumidor. A
[documentação de rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
descreve a precedência e os alvos das regras.

Para `develop` e `master`:

- exija pull request antes do merge e pelo menos uma aprovação;
- bloqueie force-push e exclusão;
- restrinja atualizações diretas para que pessoas sem bypass não façam push;
- exija conversas resolvidas e a CI do ecossistema adotado;
- exija o check de prévia central nas transições cobertas pelo caller.

Confira os nomes exatos apresentados pelo primeiro PR antes de cadastrá-los
como required status checks. O ruleset é o mecanismo que impede merge enquanto
o check da policy está vermelho. Não conceda bypass amplo a desenvolvedores.

## Idempotência e falhas

Antes de qualquer escrita, o publicador consulta tag e release. Tag e release
idênticas em versão e SHA retornam `already-published`. Uma tag correta sem
release cria somente a release. Tag em outro SHA, release sem tag verificável
ou release divergente retorna conflito sem force-push nem sobrescrita. Corridas
de criação são consultadas novamente por até dez tentativas.

Erros de API, associação ausente ou ambígua, branch/SHA remoto divergente,
saída nativa inválida e prerelease falham fechados antes da escrita.

## Verificação

Use Git Bash no Windows e inclua `C:\Program Files\Git\bin` no `PATH`.

```bash
node tests/versioning/run.mjs --local
python -c "import glob,yaml; [yaml.safe_load(open(p,encoding='utf-8')) for p in glob.glob('.github/workflows/*.yml')]"
```

O teste real exige Go e o adaptador fixado:

```bash
go install github.com/MyCarrier-DevOps/go-gitsemver@680c1c12d9a4f573a8da1b2e3ccebb3571b1cab6
node tests/versioning/run.mjs --real-go
```

A CI central executa as fixtures locais, standard-version real, jgitver real
com Maven e o adaptador Go fixado. Os fixtures locais simulam a API do GitHub,
falhas parciais, dez reexecuções, colisões e corridas. Esses testes não
substituem um ensaio hospedado de publicação em um consumidor Node ou Maven.
