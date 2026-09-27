# Modelo de dados: Versionamento por sprint

Não há banco de dados. Os objetos abaixo representam entradas e estados observáveis.

## Sprint

Campos: `milestone` (obrigatório, formato `vMAJOR.MINOR.PATCH`), `epicIssue` (referência),
`releaseBranch` (`release/<milestone>`), `homologated` (verdadeiro antes de publicar).
Uma sprint agrega várias issues/PRs; seu identificador não substitui a versão do consumidor.

## Validação de PR

Campos: `repository`, `prNumber`, `baseRef`, `headRef`, `headSha`, `phase`
(`feature-to-release|release-to-develop|develop-to-main|version-pr`),
`epicIssue`, `milestone`, `diagnostics`. Check somente leitura; guia de changelog
de homologação é informativo e não compõe o status requerido.

## Entrega integrada e PR de versão

Entrega: `functionalMergeSha`, `originalPrNumber`, `homologationEvidence`.
PR de versão: `originalPrNumber`, `functionalMergeSha`, `baseSha`, `versionCommitSha`,
`adapter`, `state` (`pending|merged`). Só há PR de versão para perfil que altera
arquivos; revisão/CI no consumidor antecede publicação.

## Publicação

Campos: `repository`, `targetRef`, `commitSha` (SHA funcional ou SHA versionado),
`version`, `tag`, `releaseUrl`, `changelogPath` (opcional),
`state` (`pending-version-pr|published|already-published|conflict|failed`). Uma tag identifica no máximo um
commit; `published` só ocorre se tag/release e commit coincidirem. Reexecutar no mesmo commit
devolve a mesma publicação; divergência leva a `conflict` sem escrita forçada.

## Transições

`PR validado → homologação em develop → PR principal aprovado → merge →
preparação de versão (se necessária) → PR versionado aprovado e integrado → publicado`.
Erros de vínculo/gates bloqueiam a transição; conflito preserva a última
publicação íntegra para correção manual.
