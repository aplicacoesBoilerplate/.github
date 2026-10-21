# Caller Changesets/Turbo

Copie **os dois** workflows deste diretório para `.github/workflows/` no
consumidor. Há um único caller para o monorepo: o Changesets calcula e prepara
o lote completo de workspaces, inclusive dependentes. Não crie um caller por
pacote.

Pré-requisitos: npm workspaces em `package.json` na raiz, `package-lock.json`
commitado, `@changesets/cli` em `devDependencies`, `.changeset/config.json` e
changesets `.md` para as alterações. Configure o script `build` do root para a
build real do Turbo, por exemplo `turbo run build`. Ajuste CI, branch principal,
environment e Node antes de copiar. A versão da CLI deve ficar fixada no
lockfile; o called executa `npm ci --ignore-scripts`.

Instale uma GitHub App no consumidor com `Contents: write` e `Pull requests:
write`; cadastre `VERSIONING_APP_ID` e `VERSIONING_APP_PRIVATE_KEY` como
secrets. O merge funcional abre um PR técnico `versioning/changesets/<SHA>`.
Revise manifests, dependências internas, changelogs e lockfile; após aprovação
e merge, o called publica uma tag e GitHub Release por pacote no SHA técnico.

Quando há vários pacotes, use `needs.publish.outputs.releases_json` nos jobs
posteriores. `version`, `tag` e `release_url` ficam vazios nesse caso;
`published_sha` só é preenchido depois de todo o lote. As referências `uses`
dos dois workflows centrais devem permanecer no mesmo SHA completo da revisão
aprovada. Consulte [o contrato central](../../../docs/versioning.md#caller-changesetsturbo).
