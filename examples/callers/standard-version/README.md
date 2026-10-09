# Caller standard-version

Copie os dois workflows para `.github/workflows/` no consumidor. Instale
`standard-version` nas `devDependencies`, commite `package-lock.json` ou
`npm-shrinkwrap.json` e configure a GitHub App com `Contents: write` e `Pull
requests: write`. Cadastre `VERSIONING_APP_ID` e `VERSIONING_APP_PRIVATE_KEY`
como secrets do consumidor. Ajuste branch, caminho, CI e environment.

O primeiro push funcional abre um PR técnico de manifests/changelog; o merge
revisado desse PR publica a tag no SHA versionado. Consulte o
[contrato completo](../../../docs/versioning.md#callers-node-e-maven).
