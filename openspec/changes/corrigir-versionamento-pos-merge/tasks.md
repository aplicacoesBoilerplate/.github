# Tasks

## 1. Validação contextual de PRs (prioridade imediata)

- [x] 1.1 Ajustar leitura do evento em `scripts/versioning/version.mjs` e as funções de `validate-sprint.sh` para classificar feature → release, release → develop e develop → branch principal usando origem/destino e metadados do GitHub; verificar fixtures de cada transição e rejeição de combinação desconhecida.
- [x] 1.2 Preservar validação de sub-issue, épica e milestone apenas na entrega de feature, e exigir épica encerrada e milestone concluída no PR release → develop; verificar que ambos passam sem versão candidata e que feature sem vínculo ou release não encerrada falha.
- [x] 1.3 Validar no PR develop → branch principal conclusão da épica/milestone, homologação e review vigentes, sem exigir sub-issue ou versão no projeto; verificar aprovação e rejeição explícitas nos cenários de integração.
- [x] 1.4 Adaptar `scripts/versioning/preview.sh` e `.github/workflows/version-preview.yml` para produzir o check de leitura exigido em PRs de integração, incluindo base/head `main` ou `master`, sem prévia SemVer como gate; verificar que o job não fica skipped/ausente na proteção da branch principal e não cria tag/release.
- [x] 1.5 Implementar resumo/changelog provisório opcional em passo não bloqueante apenas para homologação em `develop`; verificar que falta/erro da ferramenta de changelog não impede o check obrigatório nem altera arquivos versionados.

## 2. Preparação da versão após merge (prioridade imediata)

- [x] 2.1 Separar em `prepare-release.sh` e `publish.sh` a detecção do push do PR funcional e do PR de versionamento, verificando PR originador, SHA integrado, revisão e gates via API; verificar rejeição de evento de PR, branch incorreta, SHA divergente e PR de versão sem proveniência.
- [x] 2.2 Preparar `standard-version` após o merge funcional sobre commits ainda não publicados, sem tag/commit direto, incluindo `package.json`, lockfile e changelog aplicáveis; verificar vários PRs na mesma release branch sem tag intermediária, um único incremento e ausência de versão pré-merge.
- [x] 2.3 Preparar `changesets` após merge para pacote selecionado, incluindo versão, lockfile e arquivos de changelog/changeset afetados; verificar tag planejada `@scope/name@versão`, pacote correto e ausência de segunda alteração no reprocessamento.
- [x] 2.4 Criar/atualizar PR de versionamento pós-merge para perfis que escrevem arquivos, limitando diff a artefatos de versão e exigindo checks/review antes da tag; verificar estado `pending-version-pr` na primeira execução, reutilização do mesmo PR na reexecução e bloqueio se a base avançar sem reconciliação.
- [x] 2.5 Tratar no merge do PR de versionamento a leitura da versão persistida e verificação do vínculo com PR funcional homologado, integridade do diff e SHA final; verificar publicação no commit versionado e que push original reexecutado não abre outro PR.
- [ ] 2.6 Validar `jgitver` e `go-gitsemver` como perfis derivados de Git no commit integrado, sem escrita artificial, com falha acionável para prerelease/instalação ausente; verificar versão e SHA calculados com ferramentas reais no ensaio hospedado.

## 3. Publicação segura e contrato de consumo

- [ ] 3.1 Preservar `GH_TOKEN` no job que chama `gh api` em `publish.sh` e documentar/testar com execução real que o `unset` do subprocesso não o removia; verificar criação de tag e GitHub Release com autenticação válida, sem atribuir falsamente ao `unset` uma falha inexistente.
- [x] 3.2 Revalidar em `publish.sh` tag, SHA, versão e destino da release antes e após tentativas create-only; verificar `published`, `already-published`, `conflict` e recuperação de tag correta sem release, sem sobrescrever referências divergentes.
- [ ] 3.3 Ajustar `.github/workflows/version-publish.yml`, saídas e caller de exemplo para as fases de preparação/publicação e a checagem de PR de versionamento, com permissões separadas, environment protegida e `concurrency` por destino; verificar YAML/contrato, checks disparados pela identidade de automação e ausência de escrita no PR de feature.
- [ ] 3.4 Atualizar `docs/versioning.md` e `specs/001-versionamento-por-sprint/` com gatilhos dos três tipos de PR, versionamento pós-merge, `changelog_path` apenas leitor, diferenças entre SHA funcional/versionado e migração de saídas anteriores; verificar que nenhum exemplo obriga `bump`, `candidate_version` ou atualização antes do merge.
- [ ] 3.5 Conciliar o delta e tarefas ainda abertos em `openspec/changes/versionamento-por-sprint/` com este contrato antes de sincronizar ou arquivar mudanças, preservando uma única versão canônica dos requisitos; verificar que não restam exigências incompatíveis de prévia SemVer obrigatória/versão pré-merge.

## 4. Testes locais e preparação do laboratório

- [ ] 4.1 Atualizar fixtures/testes simulados dos quatro perfis para as três transições de PR, PR de versionamento, reexecução e colisão; rodar suíte e verificação de contrato e confirmar ausência de publicação em falhas de gate.
- [ ] 4.2 Escrever roteiro em `docs/versioning.md` com configuração passo a passo de LocalLabs: revisão compartilhada existente em SHA/tag, `develop`, `release/vX.Y.Z`, milestone, épica e sub-issues por rodada, branch protection da principal, environment com aprovação e credencial capaz de disparar checks; verificar checklist de eventos e resultados esperados para cada perfil.
- [ ] 4.3 Preparar caller de ensaio a partir de `tests/versioning/fixtures/caller.yml` para instalação em `.github/workflows/` do consumidor e CI própria com build/testes TypeScript, Spring Boot e verificações de Go/Node; verificar que cada check aparece no PR e que o compartilhado não assume a execução desses builds.
- [ ] 4.4 Descrever matriz manual hospedada: primeiro PRs e homologação dos quatro perfis sem publicação; depois uma rodada de publicação por perfil com tag/versão distinta, conferindo SHA, release, changelog opcional, idempotência, falha parcial e tag divergente; verificar evidências por URL/check/SHA registradas após cada rodada.
- [ ] 4.5 Após as correções e a disponibilização de revisão fixa e acesso de escrita, executar o roteiro hospedado no LocalLabs com aprovação humana e registrar resultados; verificar especialmente standard-version com vários PRs sem tag intermediária e que nenhuma rodada publica tag de outro perfil.
