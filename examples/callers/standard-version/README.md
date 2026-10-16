# Caller standard-version

Copie os dois workflows para `.github/workflows/` no consumidor. Instale
`standard-version@9.5.0` fixado nas `devDependencies`, commite `package-lock.json` ou
`npm-shrinkwrap.json` e configure a GitHub App com `Contents: write` e `Pull
requests: write`. Cadastre `VERSIONING_APP_ID` e `VERSIONING_APP_PRIVATE_KEY`
como secrets do consumidor. Ajuste branch, caminho, CI e environment.

O primeiro push funcional abre um PR técnico de manifests/changelog; o merge
revisado desse PR publica a tag no SHA versionado. Consulte o
[contrato completo](../../../docs/versioning.md#callers-node-e-maven).
Leia o [guia específico](../../../docs/versioning-standard-version.md) para
o bootstrap0.0.1, limites de arquivos, origem desatualizada e depreciação upstream.
O bootstrap suportado começa nos manifests0.0.0 e gera0.0.1 com alteração real.
`firstRelease` e bootstrap que apenas repete0.0.1 não são suportados.
