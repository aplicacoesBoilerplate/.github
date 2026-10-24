# Desenho: três consumidores, etapa 1

**Spec:** spec.md. **Status:** execução do escopo autorizada; defaults de produto registrados na spec e apresentados assincronamente.

## Architecture Overview

Um caller por aplicação aguarda sua CI e chama o mesmo called central por SHA remoto. O called mantém o modo single já validado e acrescenta configuração nativa para os casos que exigem manifest/extra-files. Distribuição é false por padrão e explícita nos pilotos. Não criar exemplos centrais por adaptador nem CLI distribuída.

```text
PR funcional + milestone -> merge humano -> CI -> called central
  -> single: Action oficial com release-type/release-as
  -> manifest nativo: Action oficial sem release-type, configs versionados no consumidor
  -> manifest raiz + override: SDK oficial, sem algoritmo de versão próprio
PR técnico -> revisão/CI/merge humano -> mesmo motor -> tag/GitHub Release
publish-artifacts=false -> zero registry/binários
```

## Approaches

| Approach | Trade-off | Decision |
| --- | --- | --- |
| Action para os modos suportados e ponte SDK oficial no override configurado | Mantém caminho já testado; pequena extensão TS para opções ausentes da action | Selecionado como solução técnica mínima |
| Fork da Action | Exige manutenção de distribuição e atualização própria | Rejeitado |
| Substituir todo o caminho já validado | Aumenta regressão sem necessidade | Rejeitado |

## Code Reuse Analysis

| Component | Reuse |
| --- | --- |
| Orquestrador TS | Manter factory e milestone; validar novos inputs e emitir modo/config/override. |
| Called | Manter CI/caminhos; condicionar publishers; adicionar SDK só para config raiz com milestone dinâmica. |
| Teste funcional existente | Acrescentar flags/configs e fixtures nativas Maven/workspace, preservando casos existentes. |
| Apps | Preservar builds, hooks e código funcional; substituir somente automações concorrentes do versionamento. |

## Components

| Component | Interface |
| --- | --- |
| Called | project-type, central-ref, publish-artifacts=false, config/manifest opcionais e política milestone/native. |
| SDK configurado | GitHub/Manifest públicos; fromManifest recebe override nativo apenas para raiz única; createReleases/createPullRequests na ordem da Action. |
| Maven | skip-snapshot e extra XML para revision; versão conjunta. |
| Vue | Grafo nativo dos workspaces reais, versões independentes e nós privados sem Release; sem raiz privada. |
| Go | Caller novo e CI preservada; integração legada aposentada, GoReleaser não acionado. |

## Risks & Concerns

| Concern | Location | Mitigation |
| --- | --- | --- |
| Publicação automática não tem opt-out | called:74 | Novo booleano fail-closed e três condições pós-tag cobertas. |
| Action ignora config-file com release-type e override no modo manifest | Action src/index.ts:82 | Escolha explícita de modo; API pública do SDK só onde indispensável. |
| Maven revision fica antiga | PackagesJava pom.xml:26 | Updater XML nativo junto de versões de POM. |
| Vue release difere da master antiga | PackagesVue release a846332/package.json | Inventário do worktree de integração antes de fixar paths e seeds. |
| Privados entram no grafo nativo | SDK node-workspace | Config explícita de nós privados sem tag/Release; nenhuma publicação na etapa 1. |
| Renomeação de componentes Vue | release workspaces | Baseline/manifest atuais e teste nativo contra downgrade; não reaproveitar tag antiga de outro nome. |
| Clones de aplicações sujos | Três clones principais | Worktrees novos; preservar código e branches existentes. |
| Merges pendentes | GitHub | PRs com revisão humana; não marcar publicação real como concluída antes da evidência. |

## Tech Decisions

SDK 17.3.0 é o mesmo motor travado pela Action consultada. Configs persistem no consumidor e são lidos pelo GitHub no commit integrado; não presumir que um JSON temporário configure o manifest remoto. A ponte não implementa parsing/bump/changelog/publicação próprios. Etapa 2 fica separada.
