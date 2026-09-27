# Design

## Context

Ver [proposal.md](proposal.md) e [spec delta](specs/versionamento-por-sprint/spec.md). Hoje `version-preview.yml` chama `preview.sh` para qualquer PR aceito, e `version.mjs event` exige `Refs #N` inclusive para `release → develop`; `validate-sprint.sh` exige sub-issue da épica. `version-publish.yml` chama `publish.sh`, que invoca `prepare-release.sh` em **outro processo**, portanto o `unset GH_TOKEN GITHUB_TOKEN` na linha 45 não remove o token do processo de publicação. `prepare-release.sh` lê uma versão já registrada no `package.json`, e `publish.sh` cria tag/release no SHA do push; não há etapa de escrita de versão pós-merge. O contrato em `specs/001-versionamento-por-sprint/`, o delta em andamento `openspec/changes/versionamento-por-sprint/` e `docs/versioning.md` ainda descrevem prévia SemVer obrigatória e versão anterior ao merge. Os testes hospedados/fixtures citados na documentação pertencem ao consumidor LocalLabs, que não está neste checkout.

## Goals / Non-Goals

**Goals:**

- Manter um check de PR estável e obrigatório, que aceita os três tipos de transição conforme sua finalidade e não calcula uma versão candidata como gate.
- Registrar na branch principal as mudanças de versão que precisarem de commit, mantendo a revisão humana e a provenance do PR funcional; publicar sempre no SHA de origem efetivamente versionado.
- Diferenciar reexecução do push original, merge do PR de versionamento e recuperação de falha parcial sem criar bumps ou publicações duplicadas.

**Non-Goals:**

- Usar milestone `vX.Y.Z` como versão real obrigatória do projeto.
- Converter o changelog provisório em gate de integração ou exigir que todos os perfis mantenham arquivo de versão.
- Alterar proteção do consumidor, disponibilizar token de automação ou publicar no LocalLabs nesta etapa de planejamento.

## Decisions

### 1. Classificação de PR e gates por fase

Reaproveitar o caller de leitura e o arquivo `version-preview.yml` como check de validação de PR (avaliar nome do job/check já exigido antes de alterar seu identificador). Encaminhar de modo explícito `feature/* → release/v...`, `release/v... → develop` e `develop → default_branch` para regras próprias em `validate-sprint.sh`; `preview.sh` só tenta produzir guia de changelog na fase de homologação, em passo opcional separado do status obrigatório. Para feature, verificar issue vinculada, milestone e épica; para release → develop, verificar épica encerrada e milestone fechada após homologação breve; para develop → principal, verificar origem homologada integralmente e revisão humana por metadados do GitHub, mais branch protection e environment no consumidor. Usar contexto de PR/base/head da API para impedir que texto do corpo do PR seja a única fonte dos gates. O check requerido deve executar e concluir para as duas integrações, sem `if` que o deixe ausente/skipped na branch principal.

**Alternativa rejeitada:** Tratar qualquer PR como feature e apenas ignorar falhas no cálculo SemVer mantém o bloqueio indevido de `develop → main` e fragiliza os gates.

### 2. Duas fases de publicação pós-merge

Em push do merge homologado na principal, registrar SHA e PR originador. Para `standard-version` e `changesets`, calcular sobre o histórico integrado desde o último marco publicado, executar a ferramenta sem criar tag/release nem realizar commit direto na principal, incluir `package.json`, lockfile, changelog e arquivos Changesets modificados conforme o perfil, e abrir/atualizar um PR de versionamento exclusivo com referência verificável ao merge originador. Restringir mudanças nesse PR a artefatos de versão, exigir CI e revisão humana; o seu merge dispara uma segunda execução que verifica vínculo com a entrega homologada, versão persistida e SHA atual integrado e só então publica tag/release. Na primeira execução, registrar explicitamente estado `pending-version-pr`; não tratar esse estado como falha de publicação. Para `jgitver`/`go-gitsemver`, apurar versão estável no SHA integrado a partir do Git e publicar diretamente se o perfil não exigir escrita em arquivos. Validar comportamento real de versões derivadas, inclusive prerelease, em ensaio antes de ativar caller.

O caminho Node deve reconhecer tanto push funcional quanto push do PR de versionamento; a validação atual de `commits/$SHA/pulls` que só aceita heads `develop`/`release` precisa reconhecer também PR de versionamento **apenas** quando vinculável ao merge homologado e após review e checks. A idempotência começa consultando tag/release e PR de versionamento existente antes de recalcular: reexecutar push original não produz novo bump, push de versão não reabre outro PR. Se novas entregas entrarem na principal antes da publicação pendente, serializar por repositório/destino e atualizar/recalcular o PR de versão a partir do HEAD corrente após revalidar todos os gates, ou suspender com diagnóstico se isso não for seguro.

**Alternativas rejeitadas:** exigir que o PR funcional já contenha versão (contraria a decisão do usuário), fazer push direto para branch protegida (contorna revisão) ou publicar no SHA funcional apesar de o `package.json` versionado só existir em commit posterior (perde consistência).

### 3. Escrita isolada e token persistente no ponto de uso

Separar permissões de leitura/validação de PR das de criação de PR de versão e publicação. O token do job de publicação deve permanecer acessível às operações `gh api` de gate e de tag/release; remover o `unset` obsoleto do subprocesso é limpeza opcional, não correção de autenticação. A identidade usada para abrir PR de versionamento deve disparar CI e respeitar proteção/revisão do consumidor (GitHub App ou credencial de automação apropriada quando o `GITHUB_TOKEN` não disparar os eventos necessários). Nunca conferir confiança ao código de PR de fork com credencial de escrita. `changelog_path` apenas lê arquivo já presente no SHA publicável; caso contrário, o corpo usa o resumo da entrega.

**Alternativa rejeitada:** usar o mesmo token de escrita no check de PR de feature ampliaria acesso a código não confiável.

### 4. Reconciliação e contrato do caller

Manter as consultas remotas e a criação create-only de tags em `publish.sh`; conferir versão publicada, SHA de tag, existência e destino da release antes de reportar `already-published`. Reportar `conflict` se a tag divergir e concluir release ausente apenas para a mesma versão/SHA. Expor saídas/documentação distintas para `pending-version-pr`, `published`, `already-published` e `conflict`. Atualizar caller de `pull_request` para contemplar os três PRs e PR de versionamento (com regras próprias), caller de `push` na principal para as duas fases, e exemplos para `main` e `master` via `target_branch`. Fixar SHA ou tag do compartilhado que **já exista**, não o `@v1` ilustrativo; mover caller para o caminho de workflows do LocalLabs só no ensaio posterior às correções.

**Alternativa rejeitada:** desabilitar o check de PR na proteção de main mascararia a validação incorreta em vez de resolvê-la.

### 5. Validação hospedada isolada por rodada

Usar LocalLabs como laboratório de quatro perfis: branches/milestones/épicas/sub-issues novas e valores de tag diferentes para cada rodada (inclusive `@scope/name@X.Y.Z` do Changesets). Registrar resultados de PRs inválidos, aprovação/rejeição de environment, versão em SHA correto, changelog ausente, reexecução, falha entre tag/release e tag divergente. A CI do consumidor executa build/testes TypeScript e Spring Boot, bem como verificações relevantes de Go/Node; testes simulados do compartilhado validam contrato e falhas sem substituir os runs hospedados. Para `standard-version`, ensaiar múltiplos PRs na mesma release branch sem tag intermediária e conferir incremento único após integração final.

**Alternativa rejeitada:** tentar publicar a mesma tag `vX.Y.Z` para adaptadores diferentes no mesmo repositório criaria conflito real por definição.

## Risks / Trade-offs

- [O antigo delta OpenSpec e a spec de referência exigem prévia e versão antes do merge] → Reconciliar requisitos contraditórios com o contrato aqui antes de sincronizar/arquivar qualquer mudança; manter um único texto canônico.
- [PR de versionamento aberto com `GITHUB_TOKEN` não dispara checks esperados ou a proteção proíbe a credencial] → Ensaiar com identidade de automação capaz de disparar eventos, sem dispensar aprovação humana; documentar configuração no consumidor.
- [Novos merges durante PR de versão aberto mudam base e cálculo] → Serializar, comparar SHA de origem e base; recalcular com cuidado ou falhar para retomar manualmente antes de publicar.
- [Ferramentas derivadas de Git calculam prerelease ou diferentes versões conforme posição da tag] → Ensaiar a execução real por perfil; exigir versão estável calculável antes de criar referência e diagnosticar configurações incompatíveis.
- [Token removido em subprocesso parece causa de falha de publicação] → Testar `gh api` real no processo que cria tag/release; documentar que o `unset` atual em processo filho não altera o token de `publish.sh`.

## Migration Plan

1. Corrigir o contrato de PR e a publicação pós-merge no compartilhado, com testes locais de gates e reconciliação. Reconciliar a mudança antiga e o material em `specs/001-versionamento-por-sprint/` com este contrato antes de adotar uma spec principal.
2. Disponibilizar SHA/tag fixa revisada do compartilhado; atualizar documentação e fixture de caller. Desativar a exigência das saídas antigas `bump`/`candidate_version` nos consumidores antes de trocar a revisão compartilhada.
3. Após obter permissão de escrita no LocalLabs, configurar branches/proteções, environment, identidade de automação e CI do consumidor; habilitar primeiro só a validação de PR dos quatro perfis e observar os checks exigidos.
4. Habilitar publicação de um perfil por vez, com tag distinta e revisão dos SHAs, gates e reexecuções. Para rollback, voltar os callers à revisão anterior sem mover tags/releases já criadas e resolver PRs de versionamento pendentes explicitamente.
