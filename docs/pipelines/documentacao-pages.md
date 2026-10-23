# Publicação de Documentação

A pipeline `documentacao-pages.yml` compila projetos baseados em **VitePress** e faz o deploy automático no **GitHub Pages** sempre que alterações na pasta `docs/` são integradas na branch `master`[cite: 3].

## Uso como Workflow Reutilizável (Caller)

Qualquer repositório da organização pode publicar sua própria documentação VitePress chamando esta pipeline:

```yaml
name: Publicar Docs no GitHub Pages

on:
  push:
    branches: [master]
    paths: ['docs/**']

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  publish-docs:
    uses: aplicacoesBoilerplate/.github/.github/workflows/documentacao-pages.yml@master
    with:
      docs-dir: 'docs'
```
