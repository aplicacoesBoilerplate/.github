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

O input opcional `docs-dir` permite mudar a pasta da documentação. Ao alterá-lo, ajuste os filtros `paths` do caller. A pasta precisa conter o projeto npm, o lockfile e o script `docs:build`.

## Versão e notas deste catálogo

O Release Please atualiza `docs/package.json` e `docs/package-lock.json` pela configuração nativa do catálogo, mantendo as notas em `CHANGELOG.md` na raiz. A documentação lê a versão do package no build, sem consulta à API no navegador. O TXT de homologação foi removido.

Os filtros da pipeline deste catálogo incluem esses arquivos. Quando o PR técnico de release for integrado, o site acompanha a nova versão e suas notas. A próxima entrega está planejada para **v0.0.2**, pela milestone correspondente; **v1.0.0** permanece reservada para a conclusão do escopo planejado.

Consulte [Notas de versão](/releases) e o [guia de versionamento](/pipelines/versionamento-release-please).
