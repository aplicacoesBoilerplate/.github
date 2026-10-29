# Publicação de Documentação

A pipeline centralizada compila documentação **VitePress** e publica no **GitHub Pages do repositório consumidor**. O checkout e o token pertencem ao consumidor.

## Preparar a aplicação consumidora

1. Adicione um projeto VitePress em `docs/`, com `package.json`, `package-lock.json` e o script `docs:build`.
2. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
3. Configure `base` no VitePress com o nome do repositório: por exemplo, `/minha-aplicacao/`. Para um site `organizacao.github.io`, use `/`.
4. Use a branch `master` para publicação. O workflow central atual limita o deploy a essa branch; trocar apenas o gatilho do caller para `main` não habilita a publicação.
5. Confira as regras do environment `github-pages`. Se houver aprovação obrigatória, o deploy aguardará essa aprovação.

```json
{
  "private": true,
  "scripts": { "docs:build": "vitepress build" },
  "devDependencies": { "vitepress": "^1.6.4" }
}
```

Execute `npm install` dentro de `docs/` e versione o lockfile. A pipeline usa Node.js 22 e `npm ci`.

## Caller copiável

Copie o exemplo para **`.github/workflows/documentacao.yml` no consumidor**:

<<< ../../examples/documentacao/.github/workflows/documentacao.yml

O exemplo fixa a release histórica `v0.0.1`, adequada ao projeto isolado original. Para usar todos os inputs descritos nesta página, substitua a referência por uma revisão publicada que contenha o contrato, como o SHA `4176883e69cf32fe36d1b893e246bbdc03885cf9` da release `v0.1.0`. Confira as [notas de versão](/releases) antes de atualizar. A branch `master` é mutável.

Não é necessário `secrets: inherit`: o workflow utiliza o `GITHUB_TOKEN` do consumidor com as permissões declaradas.

## Eventos e resultados

| Evento | Build | Upload e publicação |
| --- | --- | --- |
| Pull request | Sim | Não |
| Push na master com alteração em docs ou no caller | Sim | Sim |
| Execução manual selecionando master | Sim | Sim |
| Execução manual em outra branch | Sim | Não |

Em PRs de forks, as permissões de escrita podem ser reduzidas pelo GitHub; apenas o build é executado.

O input `docs-dir` identifica a pasta VitePress e sua saída `.vitepress/dist`. Ajuste também os filtros `paths` do caller. Os defaults continuam atendendo um projeto npm isolado em `docs/`.

| Input | Default | Uso |
| --- | --- | --- |
| docs-dir | docs | Raiz do conteúdo VitePress e da saída do site |
| install-dir | vazio | Diretório do lockfile e do build; vazio usa docs-dir |
| build-script | docs:build | Script npm responsável pelo site e suas dependências |
| npm-version | vazio | Versão exata exigida pelo consumidor; vazia usa a do Node22 |

Para um workspace como PackagesVue, informar `docs-dir: apps/docs`, `install-dir: .`, `build-script: build` e `npm-version: 10.9.4`. O build da raiz precisa produzir os manifests das bibliotecas antes do catálogo; compilar somente o app documental em checkout limpo pode gerar um catálogo vazio. Java usa os defaults com seu projeto VitePress isolado em `docs/`.

A versão npm é instalada em runner.temp antes de acessar o consumidor. O setup não consulta cache npm antecipadamente, pois isso poderia violar devEngines antes do pin. O build recebe DOCS_BASE com o caminho do repositório e DOCS_SOURCE_SHA com o commit executado; a configuração do consumidor pode usá-los para rotas e identificação do conteúdo.

Os novos inputs requerem uma revisão que contenha este contrato; fixe o SHA revisado do workflow no caller. A referência v0.0.1 do exemplo continua adequada somente ao layout isolado original. Não é necessário duplicar os passos de instalação, build ou Pages dentro das aplicações.

## Versão e notas deste catálogo

O Release Please atualiza `docs/package.json` e `docs/package-lock.json` pela configuração nativa do catálogo, mantendo as notas em `CHANGELOG.md` na raiz. A documentação lê a versão do package no build, sem consulta à API no navegador. O TXT de homologação foi removido.

Os filtros da pipeline deste catálogo incluem esses arquivos. Quando o PR técnico de release for integrado, o site acompanha a nova versão e suas notas. Consulte a versão exibida na navegação e as notas publicadas; a versão do código documentado não comprova que pacotes foram distribuídos em um registry.

## Conferência local e diagnóstico

No projeto isolado deste catálogo, execute `npm ci` e `npm run docs:build` dentro de `docs/`. Para visualizar o build, execute `npm run docs:preview` e abra a URL impressa, incluindo o prefixo `/.github/`. Em workspaces, use o diretório e o script definidos nos inputs do caller.

- **PR com build verde e deploy ignorado:** comportamento esperado; publicação depende de integração em master.
- **Site não encontrado no deploy:** confira Settings → Pages → Source e o environment `github-pages`.
- **Arquivos ou links sem o prefixo do repositório:** confira `base` no VitePress e `DOCS_BASE` no build.
- **Catálogo vazio no workspace:** compile bibliotecas/manifests antes de compilar o site.
- **Site ainda mostra a versão anterior:** confira o SHA do último deploy aprovado, o build da master e os arquivos de versão do checkout. Um build de PR não atualiza o site público.

Consulte [Notas de versão](/releases) e o [guia de versionamento](/pipelines/versionamento-release-please).
