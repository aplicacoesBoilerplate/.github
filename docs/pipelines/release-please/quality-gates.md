# Quality gates e proteção da master

Os workflows publicam resultados. A ruleset torna esses resultados obrigatórios. Ter npm test na CI não bloqueia merge se o check não estiver cadastrado como requisito da branch.

## Situação confirmada do catálogo

Em 24/10/2026, a ruleset `blockMasterWithPush_OnlyPR` está ativa, sem bypass, e contém:

- PR obrigatório, com zero aprovações humanas mínimas.
- Bloqueio de force push e exclusão.
- Branch atualizada antes de integrar.
- Status obrigatório `Validate repository`, associado ao GitHub Actions.

O alvo é a branch padrão. Confira que a padrão permanece master; para fixar a proteção independentemente de futuras trocas da branch padrão, selecione explicitamente master.

O check Validate repository executa npm test e typecheck do projeto ci-scripts. Ele foi observado com sucesso no head remoto do PR #19 antes do envio das melhorias locais.

## Adicionar checks à ruleset

1. Abra Settings → Rules → Rulesets e edite sua regra.
2. Confirme Enforcement status = Active e o alvo master.
3. Marque Require status checks to pass.
4. Em Add checks, pesquise `Validate repository` e selecione o resultado.
5. Se a interface não sugerir o nome, cadastre o nome exato e confirme sua inclusão.
6. Selecione GitHub Actions como origem esperada quando essa opção estiver disponível.
7. Mantenha Require branches to be up to date before merging e salve.
8. Reabra a regra para conferir se o requisito foi persistido.

A regra atual já contém Validate repository. Uma lista vazia de sugestões não significa que o workflow não existe. Use o nome do check na aba Checks do PR, não o nome do arquivo YAML nem apenas o título CI do workflow.

Para reusable workflows, o nome pode ser composto por `job chamador / job reutilizado`. Copie o nome realmente emitido; não invente um nome para um workflow que ainda não executou.

Depois que o preview novo do Release Please for publicado e executar em um PR, cadastre também seu check. Não exija já um check que a revisão remota ainda não emite. O nome completo deve vir da execução real.

## O que exigir antes do merge

| Check | Requisito recomendado | Motivo |
| --- | --- | --- |
| Validate repository | Obrigatório no catálogo | Testes dos scripts e typecheck |
| CI do consumidor | Obrigatório no consumidor | Build, testes e validação do produto |
| Preview de versão | Obrigatório após disponibilização | Conflitos, ambiguidade e tags existentes |
| Validação do título | Conforme política do repositório | Conventional Commits e rastreabilidade |
| Distribuição/deploy pós-merge | Não exigir como check de PR | Só roda após integrar e criar release |

Não exija um nome genérico build sem conferir seus gatilhos. Filtros por caminhos/branch ou instruções skip podem impedir a emissão e deixar o requisito pendente.

Para impedir push direto, mantenha PR obrigatório e a lista de bypass vazia. Não habilite Restrict updates indiscriminadamente: essa opção pode reservar todas as atualizações aos atores de bypass e impedir o fluxo pretendido.

## PR humano e PR técnico

A ruleset exige os mesmos nomes de check para os PRs que atingem a branch. Ela não decide quais comandos são necessários para um tipo de PR.

Podemos dispensar os testes das ferramentas centrais num PR técnico que apenas altera versões, mas essa é uma condição do workflow, não um bypass administrativo ao bot. O fluxo deve:

1. Identificar o PR técnico por identidade confiável, repositório, branch e labels esperadas.
2. Conferir os caminhos alterados; alterações nas ferramentas voltam a exigir seus testes.
3. Manter um check estável que reporte o resultado da política.
4. Preservar validações de versões, lockfiles e build do consumidor pertinentes aos arquivos gerados.

Só olhar o prefixo release-please da branch é insuficiente. Um contribuidor pode escolher esse nome. A política de tags continua necessária no segundo PR: uma tag manual pode surgir entre o preview e o merge.

A CI entregue hoje não implementa essa dispensa de testes. O comportamento atual é rodá-los também no PR técnico. Essa diferença precisa ser implementada e validada antes de adotar uma política de dispensa.

Um job ignorado por condição pode reportar sucesso; um workflow que não dispara pode deixar checks pendentes. Se usar um agregador com needs, ele precisa verificar falhas/cancelamentos dos jobs dependentes, inclusive quando usa always(). Não transforme skip em aprovação automática de uma falha.

## Aprovação humana

PR obrigatório e aprovação de reviewer são configurações diferentes. Com zero aprovações mínimas, o autor pode integrar após os gates. Com uma ou mais, outra pessoa habilitada precisa aprovar: o autor não pode aprovar seu próprio PR.

Não conceda bypass a todos os administradores ou ao bot apenas para resolver a falta de check. Isso permitiria contornar também os bloqueios desejados.

## Verificação após salvar

Abra um PR de trabalho e confira a caixa de merge. Ela deve mostrar os checks exigidos. Uma falha real em teste deve bloquear; após correção e nova execução, o bloqueio correspondente deve desaparecer.

Não é necessário criar um teste permanente defeituoso para demonstrar isso. Use um PR de teste controlado, revise os logs e descarte o teste de demonstração antes de integrar.

## Fontes

- [Criar e editar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
- [Regras disponíveis e origem dos checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
- [Checks pendentes ou workflows ignorados](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
