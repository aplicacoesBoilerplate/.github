# Compatibilidade com o PR #13

O PR #13 não está certificado contra esta conciliação e não deve ser integrado
sem adaptar os contratos abaixo. Nenhum arquivo ou branch desse PR foi alterado.

Em2026-10-15, o PR12 remoto permanece em `fcf31e0`, branch
`codex/versioning-profiles`; o PR13 tem base nessa branch e head
`b1b2ec51906306c7afa5129f6557b30b9528f6b5` (`codex/changesets-turbo`).
O comparativo usa implementação reconciliada `11fa3c699b3ade5396e4d59ceb3845de80980a35`.

`git merge-tree --write-tree HEAD b1b2ec5` foi executado sem aplicar merge no
checkout. Retornou conflito nos seguintes arquivos de código:

- `.github/workflows/version-preview.yml`
- `.github/workflows/version-publish.yml`
- `scripts/versioning/collect-version-report.sh`
- `scripts/versioning/homologation-guide.mjs`
- `scripts/versioning/prepare-version-pr.sh`

Um merge posterior também precisa conciliar documentação e testes. Arquivos
mesclados automaticamente não estão certificados apenas por não conflitar.

## Contratos a preservar ao atualizar o PR13

| Área | Adaptação necessária |
| --- | --- |
| Registro | Acrescentar descritor Changesets à allowlist e coletor próprio; não restaurar cálculo monolítico Bash. |
| VersionReport | Preservar schema1, prefixos/identidade nativa e Properties/SHA do Maven. Changesets exige evidência por pacote sem afrouxar validações dos outros três perfis. |
| Materialização | Modelar bundle restrito de manifests/changelogs/lock do monorepo; o bundle Node atual é deliberadamente single-project/npm. |
| Read/write | Calcular e gerar arquivos somente no leitor; escritor não pode executar Changesets/npm/pnpm/configuração do consumidor com token de escrita. |
| Git/PR | Definir refs necessárias ao cálculo Changesets e preservar verificação de origem, snapshots, revisão efetiva e merge técnico atual. |
| Guia | Acrescentar evidência por pacote sem perder Properties/derived Maven ou o formato Go/Node existente. |
| API/outputs | Preservar outputs existentes, App restrita à preparação técnica e policy comum, sem inputs de bypass. |
| CI | União das suítes; executar Changesets real e as três ferramentas existentes, mais sensor independente de regressões. |

O PR12 continua destinado a Go, standard-version e jgitver. O PR13 deve atualizar
sua base após esta entrega e resolver os contratos na própria branch. Este
relatório não autoriza seu merge, nem afirma que o monorepo passou nos gates novos.
