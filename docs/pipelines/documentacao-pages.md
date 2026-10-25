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

O exemplo fixa a release publicada `v0.0.1`. Depois que `v0.0.2` for publicada, o consumidor pode atualizar a referência após revisão. Também é possível fixar um SHA completo. A branch `master` é mutável.

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

Os filtros da pipeline deste catálogo incluem esses arquivos. Quando o PR técnico de release for integrado, o site acompanha a nova versão e suas notas. A próxima entrega está planejada para **v0.0.2**, pela milestone correspondente; **v1.0.0** permanece reservada para a conclusão do escopo planejado.

Consulte [Notas de versão](/releases) e o [guia de versionamento](/pipelines/versionamento-release-please).
