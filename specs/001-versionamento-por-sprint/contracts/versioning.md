# Contrato proposto: workflows de versionamento

## Check de PR: `.github/workflows/version-preview.yml`

- `workflow_call` com `adapter` obrigatório (`standard-version|changesets|jgitver|go-gitsemver`),
  `release_branch` obrigatório, `target_branch` configurável e `project_path` opcional (default `.`).
- Caller executa em `pull_request` (`opened`, `synchronize`, `reopened`) com `contents: read`,
  `pull-requests: read`, `issues: read`; PR de fork não recebe credencial de publicação.
- Saídas: `phase`, `summary` e, quando houver, `homologation_guide` opcional.
  Feature → release exige sub-issue/milestone; release → develop exige épica encerrada e milestone concluída;
  develop → principal exige épica/milestone concluídas e homologação/revisão.
- O check é somente leitura; não calcula versão definitiva, não cria tag/release nem
  modifica arquivos do consumidor. Changelog provisório não é gate.

## Publicação: `.github/workflows/version-publish.yml`

- `workflow_call` com `adapter`, `release_branch`, `project_path` e `target_branch`
  obrigatórios; `changelog_path` opcional. Requer `contents: write` apenas na chamada de
  publicação; restrição por branch/ambiente cabe ao consumidor.
- Caller dispara após merge para `target_branch` (branch padrão), requer ambiente protegido
  `homologation_environment` e utiliza `concurrency` por repositório/destino. Primeiro
  push homologado prepara PR de versão para Node, ou publica direto se versão deriva de Git.
  Merge do PR versionado valida vínculo à entrega e publica no SHA versionado.
- Saídas: `version`, `tag`, `release_url`, `version_pr_url`, `outcome`
  (`pending-version-pr|published|already-published|conflict`).
- Tag existente no mesmo commit é reconciliada; tag noutro commit interrompe sem overwrite.
  Configuração ausente ou gate pendente falha sem efeitos irreversíveis.
- `project_path` escolhe um pacote em monorepos Changesets; nesse perfil tag/release são
  `@scope/name@versão` por pacote, não uma versão única do monorepo inteiro.
- `changelog_path` só lê arquivo existente no commit publicável, não gera changelog.

## Compatibilidade e integração

Caller fixa SHA ou referência estável revisada **já existente**, nunca uma branch de desenvolvimento; a versão
do contrato é independente do SemVer da constituição. Exemplos dos quatro perfis são
documentados em `docs/versioning.md`. Os caminhos acima são interfaces propostas, não arquivos
existentes no repositório nesta etapa de planejamento.
