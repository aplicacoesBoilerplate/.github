# Pipeline centralizada de versionamento

Os workflows deste repositório calculam, validam e publicam versões sem copiar
regras para os consumidores. O caller informa o adaptador, o projeto e a branch
principal. O workflow central é carregado na mesma revisão imutável declarada
em `uses`.

O MVP libera o perfil Go com `go-gitsemver`. Os artefatos OpenSpec existentes
continuam como histórico; a especificação ativa está em
`.specs/features/centralized-versioning-pipeline/`.

## Ciclo de entrega

1. Em um PR para `develop`, `version-preview.yml` executa o adaptador em modo
   somente leitura. Ele publica `homologation.md` e `homologation.json` como
   artifact e escreve o resumo humano no check. Nenhum commit, tag ou release é
   criado.
2. Em um PR `develop → master`, a prévia recalcula a versão e avalia a milestone
   atual do próprio PR.
3. Sem milestone, o cálculo do adaptador é autoritativo. Com milestone, o título
   deve ser SemVer estrito, como `v1.2.0`, e precisa coincidir com a versão exata
   e com o tipo de incremento calculado.
4. Depois do merge, o `push` em `master` executa primeiro a CI do consumidor. O
   publicador encontra o único PR integrado `develop → master`, recalcula a
   versão e reavalia a policy com os dados atuais da API.
5. Com os gates aprovados, a tag imutável e a GitHub Release são criadas no SHA
   integrado. Sem tags estáveis anteriores, somente `v0.0.1` é aceita.

O relatório nativo do `go-gitsemver`, inclusive `--explain`, é preservado no
`VersionReport` e serve de base para o guia e para as notas da release. O central
não implementa um segundo algoritmo de SemVer.

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
| `adapter` | sim | - | No MVP, `go-gitsemver`. |
| `target_branch` | sim | - | Branch principal protegida. |
| `project_path` | não | `.` | Projeto Go dentro do checkout. |

Saídas: `phase`, `version`, `bump`, `policy_outcome` e `summary`. O job possui
somente permissões de leitura: `contents`, `pull-requests`, `issues` e `checks`.

### `version-publish.yml`

| Entrada | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `adapter` | sim | - | Adaptador calculador. |
| `target_branch` | sim | - | Branch principal protegida. |
| `project_path` | não | `.` | Projeto Go dentro do checkout. |
| `publication_environment` | não | `''` | Gate adicional do consumidor. |
| `changelog_path` | não | `''` | Complemento opcional às notas nativas. |

Saídas: `version`, `tag`, `published_sha`, `release_url` e `outcome`. `outcome`
é `published`, `already-published` ou `conflict`. Somente o job de publicação
recebe `contents: write`; as demais permissões são leitura. A concorrência é
serializada por repositório e branch, sem cancelar uma publicação em andamento.

Se `publication_environment` estiver vazio, o gate de environment é ignorado e
a publicação segue automaticamente após CI e checks. Com um nome, o job espera
as regras configuradas no consumidor, como revisores obrigatórios ou uma regra
de proteção via GitHub App. Consulte a documentação de
[environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

### Migração

Substitua `homologation_environment` por `publication_environment`. O input
antigo era obrigatório; o novo é opcional. Remova também `release_branch`,
`versioning_token` e qualquer lógica de épica ou texto `Homologação: aprovada`
do caller. Essas entradas não pertencem ao contrato final do MVP.

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
`labeled` e `unlabeled`, além de reviews `submitted` e `dismissed`. A publicação
só pode ser chamada em `push` para `master` e deve declarar `needs: go-ci`.

## Proteção de branches

Configure rulesets ou branch protection no repositório consumidor. A
[documentação de rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
descreve a precedência e os alvos das regras.

Para `develop` e `master`:

- exija pull request antes do merge e pelo menos uma aprovação;
- bloqueie force-push e exclusão;
- restrinja atualizações diretas para que pessoas sem bypass não façam push;
- exija conversas resolvidas e a CI Go;
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

A CI central executa os dois modos separadamente. Os fixtures locais simulam a
API do GitHub, falhas parciais, dez reexecuções, colisões e corridas. O teste
real valida a revisão fixada do adaptador Go.
