# Tasks

## 1. Contratos e validações comuns

- [ ] 1.1 Criar fixtures de callers de prévia/publicação em `tests/versioning/fixtures/`, com contexto de PR e pós-merge, referência fixa e permissões mínimas; verificar que os exemplos são legíveis por validador YAML e não incluem segredos reais.
- [ ] 1.2 Implementar em `scripts/versioning/resolve-adapter.sh` a seleção fechada dos quatro perfis, validação de `project_path` dentro do checkout e detecção da ferramenta instalada; verificar perfil desconhecido, travessia de diretórios e ferramenta ausente com casos negativos.
- [ ] 1.3 Implementar em `scripts/versioning/validate-sprint.sh` conferência de issue/milestone `vMAJOR.MINOR.PATCH`, `release/<milestone>` e commits interpretáveis; verificar PR válido, sem issue e com commit inválido com diagnósticos acionáveis.

## 2. Prévia de sprint

- [ ] 2.1 Implementar em `scripts/versioning/preview.sh` cálculo não destrutivo por perfil e normalização de `bump`, `candidate_version` e `summary`; verificar quatro fixtures de consumidor e ausência de mudanças no checkout e nas tags.
- [ ] 2.2 Criar `.github/workflows/version-preview.yml` com `workflow_call`, inputs `adapter`, `release_branch`, `project_path`, saídas do contrato e permissões somente leitura; verificar sintaxe e que PRs válidos, empilhados e malformados não conseguem publicar.
- [ ] 2.3 Cobrir atualização do PR e alteração de base/commits em `tests/versioning/preview-scenarios.md` e cenários automatizados cabíveis; verificar recálculo da prévia e erro explícito sem tag/release.

## 3. Publicação pós-integração

- [ ] 3.1 Implementar em `scripts/versioning/prepare-release.sh` leitura da versão/changelog já integrados por perfil e rejeição de versão inconsistente ou ausente, sem gerar commit após merge; verificar as quatro fixtures e o caso de arquivo de versão divergente.
- [ ] 3.2 Implementar no fluxo de publicação a validação do evento pós-merge, branch configurada e SHA integrado antes de permitir escrita; verificar rejeição de evento de PR, branch incorreta e SHA não integrado.
- [ ] 3.3 Implementar em `scripts/versioning/publish.sh` criação de tag sem force-push e GitHub Release no commit verificado, com changelog opcional e saídas `version`, `tag`, `release_url`, `outcome`; verificar publicação íntegra e que a tag resolve para o SHA integrado.
- [ ] 3.4 Criar `.github/workflows/version-publish.yml` com `workflow_call`, inputs `adapter`, `release_branch`, `project_path`, `target_branch`, `changelog_path`, `contents: write` restrito e saídas do contrato; verificar validação YAML e que uma chamada fora do destino não publica.
- [ ] 3.5 Configurar na fixture de caller pós-merge os gates protegidos de review/homologação e `concurrency` por repositório/destino sem cancelamento; verificar que publicação pendente de gate não cria tag/release e que publicação aprovada prossegue.

## 4. Concorrência, documentação e validação de consumo

- [ ] 4.1 Adicionar em `scripts/versioning/publish.sh` consulta e reconciliação de tag/release remotos antes e após tentativa de criação, com resultados `already-published`/`conflict` e sem sobrescrita; verificar reexecução no mesmo commit e tag divergente preservada.
- [ ] 4.2 Tratar falha parcial (tag criada, release ausente) e divergências de versão/tag/release no workflow e script, com diagnóstico e recuperação explícitos; verificar conclusão segura para mesmo SHA e bloqueio de referências inconsistentes.
- [ ] 4.3 Documentar em `docs/versioning.md` os quatro perfis, preparação anterior ao merge, inputs/outputs, instalação de ferramentas, permissões, gates e referência estável revisada; verificar que cada perfil inclui caller mínimo de prévia e publicação.
- [ ] 4.4 Criar validação de sintaxe e contrato para YAML/`workflow_call` em `tests/versioning/validate-contract.sh`; executá-la e verificar presença das entradas/saídas obrigatórias e ausência de permissão de escrita na prévia.
- [ ] 4.5 Executar o guia `specs/001-versionamento-por-sprint/quickstart.md` em consumidores de ensaio dos quatro perfis e registrar evidências em `tests/versioning/validation-results.md`; verificar PRs válidos/inválidos sem publicação, merge aprovado, dez reexecuções e duas tentativas concorrentes sem mover tags ou duplicar releases.
