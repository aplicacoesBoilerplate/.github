# Release Please nos três consumidores: etapa 1

**Status:** implementação da etapa 1 autorizada pelo usuário em 2026-10-24. Issue #4 permanece fechada. Etapa 2 não autorizada nesta entrega.

## Problem Statement

O piloto interno publicou v0.0.1 pelo Release Please. Os consumidores têm contratos diferentes: Maven multimódulo com versão conjunta, monorepo npm com versões independentes e aplicação Go com integração legada. O called atual aciona publicadores pós-tag sem opt-out e não expõe todas as configurações nativas necessárias.

## Goals

- [ ] Entregar o caller dentro de PackagesJava, PackagesVue e boilerplate-cli, consumindo o mesmo workflow central por SHA publicado.
- [ ] Preparar versão/changelog, PR técnico, tag e GitHub Release com o motor nativo, sem algoritmo próprio de versão.
- [ ] Impedir distribuição Maven/npm/Go na etapa 1, inclusive nos workflows antigos.
- [ ] Preservar o trabalho funcional existente e validar cada entrega com testes, revisão independente e commits publicados.

## Out of Scope

| Feature | Reason |
| --- | --- |
| npm publish, mvn deploy, GoReleaser, imagens e deploy | Etapa 2, separada pelo usuário. |
| Issues funcionais, actuator, interfaces ou versão embutida do CLI | O chat trata da integração central, não do desenvolvimento das aplicações. |
| Reabrir ou encerrar a issue #4 | Usuário determinou mantê-la fechada. |
| Merge/automerge, alteração de secrets ou regras administrativas | Merges continuam humanos; novas permissões administrativas dependem do usuário. |
| Exemplos de caller por adaptador no central | O caller reside na aplicação; manter apenas o exemplo genérico existente. |
| Promover releases de aplicações para master | Não integrar commits funcionais alheios para viabilizar o teste. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Escopo da etapa 1 | Versão, changelog, PR, tag e GitHub Release; distribuição desligada | Solicitação expressa do usuário | Sim |
| Java | Uma versão compartilhada; sem PR automático de SNAPSHOT nesta fase | Preserva a escolha anterior e o ciclo de dois PRs | Versão conjunta confirmada; SNAPSHOT é default técnico |
| Vue | Preservar versões independentes; milestone agrupa e o motor calcula por pacote | Uma versão escalar não representa os pacotes existentes | Pergunta assíncrona enviada; default recomendado |
| Bases dos consumidores | Branches de release remotas atuais, em worktrees novos | Preserva clones sujos e não promove trabalho funcional | Pergunta assíncrona enviada para Go; default conservador |
| Publicação central | Input booleano publish-artifacts=false por padrão e explícito em todos os pilotos | Falha fechada para a etapa 2 | Decisão técnica dentro do escopo |
| Extensibilidade | Action oficial para single/manifest nativo; ponte SDK oficial apenas quando necessário ao override Maven | Action v4 não encaminha override release-as no modo manifest | Fonte oficial verificada |
| Validação hospedada | Push/PRs e testes de leitura; após revisão, usuário integra PRs | Autoridade anterior de persistir progresso não transfere os merges | Confirmado na conversa |

**Open questions:** none — as decisões ainda não confirmadas têm default e justificativa explícitos na tabela e foram apresentadas assincronamente; nenhuma publicação externa será presumida como comprovada.

## User Stories

### P1: Separar versão e distribuição

**User Story:** Como mantenedor, quero liberar o versionamento sem publicar os artefatos da etapa 2.

**Acceptance Criteria:**
1. WHEN publish-artifacts for omitido THEN o called SHALL tratar a distribuição como desabilitada.
2. WHILE publish-artifacts for false o called SHALL executar zero publicadores npm, Maven ou GoReleaser, mesmo quando uma release for criada.
3. WHEN os três callers piloto forem preparados THEN cada caller SHALL declarar publish-artifacts false explicitamente.
4. The integração SHALL manter os publishers antigos fora dos gatilhos automáticos ativos da etapa 1.

**Independent Test:** Mesmo fluxo TS confere inputs, decisões e todas as condições pós-tag; inspeção dos workflows ativos dos consumidores.

### P1: Reaproveitar o motor e o contrato central

**User Story:** Como mantenedor, quero um único called com configurações dos consumidores, não cópias por linguagem.

**Acceptance Criteria:**
1. WHEN um caller consumir o central THEN uses e central-ref SHALL apontar para o mesmo SHA publicado no GitHub.
2. WHEN um PR funcional integrado iniciar a preparação THEN o central SHALL exigir milestone antes de qualquer chamada com escrita.
3. WHEN o PR técnico de release for integrado THEN o central SHALL preservar a versão preparada sem exigir outra milestone.
4. IF configuração ou política de versão for incompatível THEN o central SHALL falhar antes de chamar o motor com escrita.
5. The implementação SHALL usar Action/SDK oficial Release Please para calcular e gerar candidatos e publicações.
6. The mudança SHALL preservar o caller simple interno e os sete casos superiores existentes, ampliando o fluxo funcional sem multiplicar arquivos de teste.

**Independent Test:** Entrypoints reais e SDK nativo em fixture temporária, transporte sem rede e cenários de falha; CI hospedada no SHA publicado.

### P1: Versionar o reactor Maven

**User Story:** Como mantenedor do PackagesJava, quero versão conjunta coerente em todos os POMs e referências internas.

**Acceptance Criteria:**
1. WHEN a milestone especificar uma versão THEN o candidato Maven SHALL usar essa versão no parent, nos módulos e na propriedade revision.
2. WHEN a versão mudar THEN as dependências internas via revision SHALL continuar apontando para os artefatos da mesma versão.
3. WHEN o ciclo de release terminar THEN o motor SHALL evitar um terceiro PR automático de SNAPSHOT nesta etapa.
4. The CI Maven SHALL continuar executando verify sem deploy.

**Independent Test:** Estratégia Maven e extra XML nativos aplicados a POMs reais equivalentes ao consumidor; mvn verify do worktree.

### P1: Versionar o workspace npm

**User Story:** Como mantenedor do PackagesVue, quero preservar os componentes independentes e suas dependências.

**Acceptance Criteria:**
1. WHEN um pacote mudar THEN o motor SHALL calcular sua versão independentemente, sem impor a mesma versão escalar a todo o monorepo.
2. WHEN uma dependência interna mudar THEN o plugin nativo SHALL atualizar seus consumidores e o lockfile coerentemente.
3. The integração SHALL preservar nomes, versões e privacidade dos workspaces da branch real de integração.
4. The integração SHALL excluir a raiz privada da lista de componentes publicáveis e impedir tags/Releases dos nós privados auxiliares.
5. WHEN o novo caller ficar ativo THEN os workflows e gates de Changesets SHALL deixar de competir pelo cálculo e pela publicação automática.

**Independent Test:** Manifest/node-workspace nativos com versões iniciais distintas e nós privados; gate npm do consumidor e contratos da CI.

### P1: Migrar a integração Go

**User Story:** Como mantenedor do CLI, quero consumir o novo fluxo sem promover ou alterar suas features.

**Acceptance Criteria:**
1. WHEN o novo caller ficar ativo THEN a automação antiga go-gitsemver SHALL deixar de escrever tags ou releases nesse fluxo.
2. The integração SHALL preservar testes, lint, vet e build Go existentes e não alterar o comportamento do aplicativo.
3. WHILE a entrega estiver na branch de release o agente SHALL manter a promoção para master sob decisão humana.
4. The caller Go SHALL selecionar project-type go e não executar GoReleaser na etapa 1.

**Independent Test:** Suíte Go e contrato do caller; histórico e workflows preservados no worktree isolado.

### P1: Entrega auditável dos três pilotos

**User Story:** Como mantenedor, quero inspecionar os PRs e as evidências reais sem confundir teste local com publicação.

**Acceptance Criteria:**
1. WHEN uma tarefa passar pelo gate THEN seu código, testes e status SHALL ser commitados atomicamente e persistidos no remoto.
2. WHEN a implementação terminar THEN um Verifier independente SHALL executar gates e sensor isolado antes da entrega final.
3. The relatório SHALL distinguir prontidão local, CI hospedada e ciclo real após os merges humanos.
4. IF um merge humano ou uma permissão externa estiver pendente THEN o relatório SHALL manter essa evidência como pendente, sem declarar a meta integralmente concluída.

**Independent Test:** Comparar SHAs locais/remotos, checks dos PRs e evidências por consumidor; nunca inferir sucesso de uma publicação a partir de um mock.

## Edge Cases

- IF um config tentar aplicar versão escalar a múltiplos componentes independentes THEN o central SHALL rejeitar o override antes da escrita.
- IF o caminho de config sair do repositório THEN o central SHALL rejeitar a entrada.
- IF uma publicação de pacote estiver desabilitada THEN uma release_created true SHALL continuar sem acionar distribuição.
- IF o histórico de tags de um pacote renomeado não corresponder ao novo componente THEN o bootstrap SHALL preservar sua versão atual, sem downgrade nem movimentação de tags existentes.

## Implicit Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Inputs/auth | Configs relativos validados; leitura em PR, escrita somente após CI/merge; sem novos secrets de registry. |
| Falhas/externos | Erro explícito sem publicação presumida; permissões e merges humanos registrados. |
| Retry/concorrência | Motor oficial preserva seu comportamento; nenhuma rotina própria para mover tags. Hardening adicional fora desta etapa. |
| Ciclo de vida | Preservar tags, branches, clones sujos e histórico OpenSpec/TLC. |
| Observabilidade/transições | Evidências por SHA e separação entre candidato, release publicada e distribuição desligada. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RPIL-01 | Distribuição desligada | Execute | Implementing: gate central pronto; callers e automações legadas pendentes |
| RPIL-02 | Contrato central e motor nativo | Design | Pending |
| RPIL-03 | Maven compartilhado | Design | Pending |
| RPIL-04 | npm independente | Design | Pending |
| RPIL-05 | Go sem efeitos funcionais | Design | Pending |
| RPIL-06 | Entrega e evidências | Design | Pending |

## Success Criteria

- [ ] Central publicado com opt-out seguro de distribuição e contratos raiz/manifest testados.
- [ ] Três aplicações entregues em branches/PRs, cada uma com caller próprio e referência central imutável igual à dos scripts.
- [ ] Gates pertinentes dos quatro repositórios executados e revisão independente registrada.
- [ ] Nenhum pacote Maven/npm ou binário Go publicado pelo agente.
- [ ] Ciclos reais de PR/tag/Release registrados após os merges humanos; enquanto faltarem, a meta permanece em andamento.

## References

- Piloto interno: https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1.
- Action v4: https://github.com/googleapis/release-please-action/blob/5c625bfb5d1ff62eadeeb3772007f7f66fdcf071/src/index.ts.
- SDK 17.3: https://github.com/googleapis/release-please/blob/891bcf6253b390e39df9ff3e1c059a836bd39c98/src/manifest.ts.
- Context7 indisponível; pesquisa feita no código local e em fontes oficiais imutáveis.
