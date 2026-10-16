# standard-version: versão e PR técnico

Este perfil preserva o cálculo e o changelog nativos de standard-version9.5.0.
Entrega um PR técnico revisável antes de criar a tag e a GitHub Release.
Não executa `npm publish` e não modifica aplicações piloto nesta entrega.
Leia o [contrato comum](versioning.md), o [caller](../examples/callers/standard-version/README.md)
e o [mapa dos scripts](../scripts/versioning/README.md).

## Suporte e pré-requisitos

O [upstream declara standard-version depreciado](https://github.com/conventional-changelog/standard-version).
O adaptador solicitado continua disponível; isso não constitui garantia de
correções futuras da dependência. Uma migração de ferramenta será outra decisão.
Use Node24, fixe `standard-version: 9.5.0` em devDependencies e mantenha lockfile npm.
O chamado faz `npm ci --ignore-scripts` somente no job de leitura.
Registro privado, forks e autenticação particular exigem ensaio próprio.

Arquivos permitidos no projeto: `package.json`, `package-lock.json`,
`npm-shrinkwrap.json` e `CHANGELOG.md`. O perfil exige ao menos um lockfile npm.
Outro `infile`, `bumpFiles`, pnpm ou Yarn não é suportado por este fluxo técnico.
Não ofereça comandos ou flags arbitrários ao chamado para contornar essa lista.
Configurações `.versionrc*`, presets e updaters continuam código do consumidor;
revise-os mesmo sendo executados em job de leitura, não em sandbox.

## Primeira versão

Sem tag estável alcançável no `tag_prefix`, a ferramenta nativa precisa produzir
`0.0.1`. O central nunca substitui o resultado. O bootstrap suportado começa
com `package.json` e lockfile em `0.0.0` e um commit `fix:` que faça o nativo
incrementar para `0.0.1`. Os manifests precisam ser efetivamente alterados;
o teste real cobre tanto o cálculo padrão quanto `releaseAs: 0.0.1` temporário.
Uma configuração que produza
`1.0.0` ou `0.1.0` será bloqueada, mesmo sem milestone.
Verifique o dry-run local no histórico real antes da primeira entrega.
As opções de bootstrap pertencem ao consumidor e devem ser temporárias;
não deixe `releaseAs` fixo depois da primeira versão.

`firstRelease`/`--first-release` não é suportado por este adaptador: a ferramenta
nativa deixa de emitir a linha de incremento exigida pelo normalizador.
Se os manifests já estiverem em `0.0.1`, o padrão calcula `0.0.2` e será bloqueado
por ausência de tag anterior. Forçar `releaseAs: 0.0.1` nessa situação não é um
bootstrap suportado: com arquivos já formatados, o guard recusa package.json sem
alteração. Uma reformatação incidental não deve ser usada como autorização.
Não contorne o guard nem configure firstRelease para tentar publicar essa entrega.
Repos com versões/pacotes existentes exigem inventário e migração explícita antes
de ativar o fluxo; não crie ou mova tags cegamente para satisfazer o check.

## Fluxo e SHAs

1. PR para develop: prévia e guia de homologação. Não cria PR técnico ou Release.
2. PR develop/hotfix para master: mesma policy de milestone e override dos demais perfis.
3. Merge funcional + CI aprovada: leitor calcula dry-run e gera arquivos com
   `--skip.commit --skip.tag --tag-prefix`. Não cria commit/tag e não recebe App token.
4. O leitor materializa relatório, snapshot Git e bundle de arquivos. O bundle
   contém projeto, versão, prefixo, SHA funcional, paths, hashes antes/depois e bytes.
5. Após environment opcional, escritor confere todos os arquivos antes de escrevê-los.
   Aceita no máximo4 arquivos/10MiB de bytes (16MiB de JSON), sem traversal/symlink,
   sem executar standard-version, npm ou hooks do consumidor.
6. App com `Contents: write`/`Pull requests: write` cria branch
   `versioning/standard-version/<12 caracteres do Origin-SHA>` e PR para master.
   App ID e chave privada vêm dos secrets do caller, nunca do job de cálculo.
   Retorna `outcome=pending-version-pr` e `version_pr_url`, sem Release.
7. O PR técnico passa pela CI e precisa de aprovação humana no head atual.
   Review de bot, review dismissed, pedido de mudanças posterior ou head antigo
   não autoriza a publicação. A avaliação usa o estado efetivo de cada revisor.
8. Depois do merge técnico, o leitor recalcula no `Origin-SHA` funcional e verifica
   os manifests/changelog integrados. O escritor revalida a policy da origem
   e publica a tag/Release no **SHA do merge técnico**, não no SHA funcional.

O corpo do PR guarda `Origin-PR`, `Origin-SHA`, `Adapter`, `Project`, `Tag-Prefix`
e `Version`. Alterar metadados, arquivos fora da lista ou versão bloqueia o check.
O SHA funcional precisa ser o pai imediato do merge técnico. Suportam-se merge
normal, squash e rebase de commit único; se master avançar com outra entrega,
feche/regere o PR técnico a partir do novo cálculo e obtenha nova revisão.
Não force um PR obsoleto. A prévia não certifica automaticamente uma base que
mude depois dela; o gate pós-merge continua obrigatório.

## Reexecução e falhas

PR técnico já aberto retorna o mesmo URL, sem duplicação. Uma branch remota
criada sem PR após falha parcial não é sobrescrita por force-push: investigue
o estado antes de reexecutar. PR técnico fechado/mesclado não é recriado
silenciosamente pelo push funcional antigo.

Tag e Release no mesmo SHA retornam `already-published`. Tag correta sem Release
permite recuperar a Release faltante, desde que o push ainda seja atual.
Push antigo só reconcilia publicação já completa, nunca cria ou completa estado.
Conflito de versão/SHA, API indisponível, refs alteradas e evidência inválida
bloqueiam sem mover tags. A concorrência do escritor é serializada por repo/branch.

## Testes e adoção

`node tests/versioning/run.mjs --local` inclui fluxo legado e por artifacts,
com o binário nativo desativado no escritor. `real-standard-version.mjs`
executa9.5.0, comprova versão1.1.0, changelog/manifests, ausência de commit/tag
e replay byte a byte. Também recalcula a origem após tag no descendente.
`node tests/versioning/real-standard-bootstrap.mjs` cobre duas gerações/replays
0.0.0->0.0.1 e quatro rejeições: default já0.0.1, firstRelease nos dois valores
iniciais e same-version com manifests formatados. A instalação tem manifest
temporário e `npm --prefix` absoluto, com prefixo e binário confinados no fixture.
Essas provas não substituem uma execução remota no consumidor com a sua App.

Em ensaio autorizado, confira: primeiro push sem Release; PR técnico com arquivos
esperados; bloqueio de bot/review antigo; bloqueio quando outra entrega avançar
master; merge revisado gerando tag no SHA técnico; retry sem novas escritas;
milestone ausente, coincidente, inválida e divergente com/sem override; prefixo
literal consistente e environment opcional. Registre PR, SHAs, versão, artifacts
e execução antes/depois. Não use token de produção em simulações manuais locais.
