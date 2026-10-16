# Versionamento de packages: reconciliação e homologação

## Problem Statement

A issue #4 foi reaberta porque a implementação central ainda não comprova o fluxo completo dos consumidores. O PR #12 entrega Go, standard-version e jgitver; o PR #13 acrescenta Changesets/Turbo sobre uma base anterior do #12. Ambos aguardam revisão humana.

Esta especificação fecha a conciliação central e define o aceite remoto de PackagesJava e PackagesVue. Ela separa três resultados: código central verificado, integração homologada no consumidor e packages publicados e consumíveis. Um resultado não comprova automaticamente o seguinte.

**Status:** proposta para revisão do usuário, sem implementação autorizada por este documento.
**Data:** 2026-10-16. **Issue:** [#4](https://github.com/aplicacoesBoilerplate/.github/issues/4).
**Continuidade:** complementa `reconcile-native-profiles` e a feature `changesets-turbo` do PR #13; não invalida suas evidências nos respectivos SHAs.

## Goals

- [ ] Reconciliar o PR #13 com o #12 sem perder os três adaptadores existentes nem o contrato de segurança read/write.
- [ ] Entregar um caller por consumidor, com CI, prévia, publicação de versão e encadeamento explícito para distribuição.
- [ ] Homologar Maven com versão única e Vue com o plano coordenado de packages calculado pelo Changesets.
- [ ] Produzir evidências remotas, de recuperação e de consumo externo antes de propor o encerramento da issue #4.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Mudanças de funcionalidades/issues dos projetos piloto | Este chat cuida da pipeline e da sua integração, não do desenvolvimento dos produtos |
| Alterar pilotos durante a primeira etapa central | A adoção exige revisão da especificação e autorização explícita para as mudanças e publicações remotas |
| Merge, aprovação própria, bypass de proteção ou encerramento automático da issue | A revisão humana permanece obrigatória; cada operação remota precisa de autorização aplicável |
| Versões independentes dos módulos Java | O usuário escolheu uma versão conjunta para parent/BOM/core/starter |
| Converter Vue para versão única ou trocar Changesets por standard-version | Preservar o modelo real npm workspaces/Turbo/Changesets do consumidor |
| pnpm, Yarn, Gradle, prereleases e snapshots | Recorte inicial: npm com lockfile e Maven, versões estáveis |
| Recriar um algoritmo SemVer ou inferir versões por mensagens de commit fora do adaptador | A ferramenta nativa é a fonte do cálculo |
| Movimentar/excluir tags publicadas, sobrescrever versões no registry, migração massiva de histórico | Referências e coordenadas publicadas são imutáveis |
| Aprovação autônoma de environments por LLM | Evolução posterior; manter environment opcional e suas regras humanas quando configurado |
| Tornar a publicação de packages parte obrigatória de todos os adaptadores | Go e aplicações sem distribuição de biblioteca continuam usando o contrato central existente |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ordem de trabalho | Conciliação central, preparo dos callers/fixtures, homologação remota, distribuição e consumo externo | Avançar sem aguardar merge, sem tratar CI local como homologação remota | Proposto nesta especificação |
| Destino do trabalho Changesets | Continuar o PR #13 empilhado no #12; preservar histórico e enviar apenas fast-forward quando autorizado | Evitar uma implementação concorrente e respeitar a revisão aberta | Coerente com a orientação anterior; envio desta iteração exige confirmação |
| Execução | Implementação neste chat; revisão independente após a última tarefa | Preferência já expressa pelo usuário e gate obrigatório TLC | Herdado |
| Java | Maven, Java 21, jgitver 1.9.0 e versão conjunta dos quatro módulos | Modelo aprovado e perfil central já validado | Herdado |
| Vue | npm workspaces, package-lock.json e versões nativas por package; uma coordenação por monorepo | Configuração atual de PackagesVue e escopo do PR #13 | Base observada; confirmar a especificação |
| Milestone em lote Vue | Lote com mais de um package exige ausência de milestone; milestone presente bloqueia antes da escrita, sem override para esse formato não suportado | Um título SemVer não expressa várias versões; não inventar mapa/plano novo nesta entrega | Proposta a aprovar, preserva o limite documentado no PR #13 |
| Milestone com um release | Aplicar contrato existente: versão exata e incremento, sem substituir o cálculo nativo | Preservar a governança aprovada para versão única | Herdado; adaptação ao lote unitário proposta |
| Bootstrap | Escopo sem tag estável reconhecida aceita somente candidata nativa 0.0.1; nenhum reset de manifest ou criação de baseline automática | Regra aprovada de primeira versão; tags existentes exigem diagnóstico de escopo | Herdado |
| Registry do piloto | GitHub Packages npm e Maven, com permissões verificadas separadamente | É o destino configurado nos dois repositórios | Observado; publicação exige autorização específica |
| Migração do release Vue | Um único produtor de PR técnico, tags e GitHub Releases; retirar o produtor concorrente na adoção autorizada | O workflow atual já cria PRs de release e publica packages | Proposta técnica a aprovar |
| Distribuição | Etapa posterior explícita no caller, condicionada ao resultado completo da versão e ao published_sha | GitHub Release não é npm publish nem Maven deploy | Proposta a aprovar |
| Recuperação parcial no registry | Inspecionar coordenadas e digests; retomar só ausentes quando comprovadamente seguro; divergência ou estado não verificável exige intervenção | Publicação de vários packages não é transação atômica | Proposta conservadora a aprovar |
| Dados e retenção | Usar retenção configurada/default dos artifacts; registrar links e SHAs duráveis no relatório de aceite | Não exigir retenção infinita nem presumir que artifacts permanecerão disponíveis | Proposto |

**Open questions:** none — decisões anteriores preservadas; novos defaults estão identificados acima e precisam de aprovação antes do design e da implementação.

## Evidence Baseline

Observado em 2026-10-16, sujeito a nova leitura no início da execução:

| Fonte | Estado constatado | Implicação |
| --- | --- | --- |
| PR #12 | Aberto, sem merge, HEAD c7e610117edfbe8a6338ec0d3b6703156026ef70; CI 38837059222 aprovada nesse SHA | Base de implementação, não prova dos pilotos |
| PR #13 | Aberto, base codex/versioning-profiles, HEAD b1b2ec51906306c7afa5129f6557b30b9528f6b5 | Reconciliar contra o HEAD atual do #12; aprovação/CI antiga não cobre a conciliação |
| PackagesVue/master | Root privado; npm workspaces e Turbo; ui 1.1.1, utils/composables 0.0.1; tags por package nessas versões | Não reiniciar o versionamento; respeitar histórico por package |
| PackagesVue/release.yml | Fluxo próprio Changesets de preparação e publicação | Definir uma única autoridade para tags/Releases na migração |
| PackagesJava/master | Parent/BOM/core/starter; revision 0.0.1; tag 0.0.1; deploy acionado por push de v* | Alinhar prefixo e configuração nativa; não presumir que o deploy atual acompanhará a publicação central |

## User Stories

### P1: Conciliar sem regressão — PKG-01

**User Story**: Como mantenedor da pipeline, quero integrar Changesets ao registro modular existente sem criar outro fluxo concorrente.

**Acceptance Criteria**:
1. WHEN iniciar a conciliação THEN a entrega SHALL registrar os SHAs reais do #12 e #13 e identificar os pontos de integração antes de alterar código.
2. WHEN selecionar changesets THEN o registro SHALL resolver o quarto adaptador pelo mesmo contrato de dependências explícitas utilizado pelos demais perfis.
3. WHEN executar os testes após a conciliação THEN a suíte SHALL preservar os cenários aprovados de Go, standard-version e jgitver sem reduzir assertions ou desabilitar casos.
4. IF o remoto avançar desde a base registrada THEN a entrega SHALL parar o envio até reconciliar e repetir os gates do novo intervalo, sem force-push.

**Independent Test**: Suíte unificada e testes reais das quatro ferramentas, com SHAs do intervalo revisado registrados.

### P1: Plano nativo completo do monorepo — PKG-02

**User Story**: Como mantenedor Vue, quero que o Changesets coordene packages e dependentes sem cálculo paralelo na pipeline.

**Acceptance Criteria**:
1. WHEN coletar um plano Changesets THEN o adaptador SHALL preservar todos os releases retornados pelo plano nativo, incluindo dependentes e suas versões calculadas.
2. WHEN preparar versões THEN a etapa nativa SHALL gerar manifests, dependências internas, changelogs, consumo dos changesets e package-lock.json coerentes a partir do mesmo SHA funcional.
3. IF o plano nativo válido não contiver releases THEN a execução SHALL terminar com resultado no-release e sem criar PR técnico, tag, Release ou solicitação de distribuição.
4. IF a ferramenta falhar, o plano for inválido ou houver estado prerelease/snapshot THEN a execução SHALL bloquear sem fallback de versão e sem tratar a falha como plano vazio.
5. WHEN exportar um lote com mais de um release THEN o workflow SHALL retornar releases_json com os campos package, version, tag e release_url de cada release e manter vazios version, tag e release_url escalares.
6. WHEN exportar um lote com um único release THEN o workflow SHALL preencher releases_json e os outputs escalares com esse mesmo release, sem alterar o contrato dos adaptadores existentes.
7. WHEN existir package privado ou ignorado no workspace THEN o plano de distribuição SHALL respeitar sua elegibilidade nativa sem publicar o root privado por inferência.

**Independent Test**: Fixture npm/Turbo real com bump major de core e atualização nativa de dependente, plano vazio, configuração inválida e package privado.

### P1: PR técnico e fronteira de confiança — PKG-03

**User Story**: Como revisor, quero inspecionar uma única preparação técnica e impedir execução de código do consumidor com os privilégios do escritor central.

**Acceptance Criteria**:
1. WHEN integrar o PR funcional autorizado THEN a automação SHALL abrir ou reconciliar um único PR técnico por origem/plano e não publicar tag nem Release nesse estágio.
2. WHILE executar cálculo e geração nativos o job SHALL operar sem credenciais de escrita, App private key ou packages:write.
3. WHEN executar o escritor central THEN o job SHALL aplicar somente o bundle validado, sem executar npm install, Changesets, Maven, lifecycle scripts ou código/configuração do consumidor.
4. IF bundle, hashes, lista de arquivos, plano, head do PR ou SHA funcional divergirem da evidência validada THEN o escritor SHALL rejeitar a operação antes de qualquer escrita.
5. IF o bundle incluir path fora do workspace, symlink, arquivo não permitido ou alteração de código-fonte THEN o escritor SHALL rejeitá-lo antes de aplicar arquivos.
6. WHEN publicar após merge técnico THEN a validação SHALL exigir aprovação humana válida no head revisado e vínculo verificável com o SHA funcional e o plano de origem.
7. IF uma nova entrega funcional invalidar a origem do PR técnico THEN a publicação SHALL bloquear até regeneração e nova revisão conforme o contrato técnico existente.

**Independent Test**: Bundle adulterado, aprovação dismissed/bot/head antigo, origem avançada e binário nativo sentinela que falha se for chamado no escritor.

### P1: Governança e homologação consistentes — PKG-04

**User Story**: Como mantenedor, quero preservar as regras de entrega normal e hotfix ao adicionar monorepos.

**Acceptance Criteria**:
1. WHEN avaliar um PR develop -> master ou hotfix/* -> master THEN a policy SHALL aplicar os mesmos gates de CI, origem, versão e autorização, sem exceção automática para hotfix.
2. WHEN um PR de release única não possuir milestone THEN a policy SHALL aceitar o cálculo nativo sem exigir revisão extra por ausência desse metadado.
3. WHEN um PR de release única possuir milestone SemVer válida THEN a policy SHALL comparar tanto a versão exata quanto o tipo de incremento com o cálculo nativo.
4. IF a milestone de release única tiver título inválido THEN a policy SHALL bloquear sem permitir override dessa invalidade.
5. WHEN houver divergência de planejamento válida THEN o override SHALL exigir label aplicado por Maintain/Admin e aprovação posterior de outra pessoa Maintain/Admin no head atual, com evidência auditável.
6. IF um lote Changesets com mais de um release possuir milestone THEN a policy SHALL bloquear com diagnóstico de contrato não suportado e não selecionar arbitrariamente um package nem aceitar override de formato.
7. WHEN gerar prévia para develop THEN o guia Markdown/JSON SHALL derivar do relatório/changelog nativo e identificar packages, versões candidatas, PR e checklist sem afirmar que a homologação ocorreu.
8. WHERE publication_environment estiver configurado o fluxo SHALL respeitar seu gate antes da escrita; sem essa configuração, não haverá aprovação adicional de environment.

**Independent Test**: Matriz de rotas, milestones, override, remoção/troca de metadados, environment informado e omitido; validação do payload do guia.

### P1: Publicação de lote imutável e recuperável — PKG-05

**User Story**: Como operador, quero que retries recuperem um lote parcial sem duplicar nem mover releases.

**Acceptance Criteria**:
1. WHEN publicar um lote Changesets aprovado THEN cada release SHALL receber tag <package>@<version> e GitHub Release no mesmo SHA integrado do PR técnico.
2. WHEN iniciar escritas de um lote THEN o publicador SHALL verificar todos os conflitos conhecidos de tags/Releases antes da primeira escrita.
3. IF uma tag existente apontar para outro commit após peeling THEN o publicador SHALL bloquear sem mover ou apagar a referência.
4. WHEN reexecutar publicação idêntica completa THEN a execução SHALL reutilizar tags/Releases existentes sem duplicação.
5. IF uma falha ocorrer após publicação parcial THEN o relatório SHALL identificar entradas concluídas, pendentes e conflitantes sem afirmar atomicidade nem sucesso completo.
6. WHEN retomar uma publicação parcial consistente THEN a execução SHALL criar apenas entradas ausentes após revalidação dos objetos já publicados.
7. WHILE o lote estiver incompleto o workflow SHALL manter published_sha vazio e impedir que o caller inicie distribuição.
8. IF refs, aprovação ou metadados mudarem durante a espera pelo environment THEN o escritor SHALL revalidar o estado antes de escrever, tolerando somente objetos próprios idênticos de retry.

**Independent Test**: Falha injetada após a primeira tag e após a primeira Release, retry completo/parcial, conflito em package posterior e duas execuções concorrentes.

### P1: Callers e prontidão dos consumidores — PKG-06

**User Story**: Como responsável pelos consumidores, quero configuração curta e verificável, sem duplicar a lógica central.

**Acceptance Criteria**:
1. WHEN entregar exemplos THEN o repositório central SHALL oferecer um workflow caller por consumidor que coordene sua CI, prévia e publicação com os calleds fixados no mesmo SHA completo revisado e disponível no GitHub.
2. WHEN preparar PackagesJava THEN o roteiro SHALL verificar parent, BOM, core, starter, revision, tag_prefix, configuração jgitver e tag 0.0.1 existente antes de sugerir qualquer nova versão.
3. WHEN preparar PackagesVue THEN o roteiro SHALL inventariar packages, tags, versões no registry e o workflow release atual antes de escolher o plano de migração.
4. IF o escopo não tiver tag estável reconhecida e a versão nativa não for 0.0.1 THEN o gate SHALL bloquear com diagnóstico de bootstrap/escopo sem reiniciar manifests ou criar uma tag artificial.
5. WHEN migrar o consumidor Vue mediante autorização THEN a configuração SHALL manter uma única autoridade para PR técnico, tags e GitHub Releases e uma única etapa de distribuição por coordenada.
6. WHEN documentar o encadeamento de distribuição THEN o exemplo SHALL usar dependência explícita do resultado completo da versão e published_sha, sem depender de push de tag gerado por GITHUB_TOKEN.

**Independent Test**: Contratos YAML e exemplos, fixture de prefixo não reconhecido, inventário read-only dos pilotos e teste que comprova ausência de dois produtores concorrentes.

### P1: Distribuição e consumo externo como aceite separado — PKG-07

**User Story**: Como consumidor de biblioteca, quero instalar exatamente a versão aprovada, com dependências internas resolvidas.

**Acceptance Criteria**:
1. WHEN iniciar build para distribuição THEN o job SHALL fazer checkout de published_sha e verificar que as tags esperadas resolvem para esse commit antes de empacotar.
2. WHEN preparar a distribuição Maven THEN a validação SHALL comparar versão efetiva, POMs destinados ao registry e referências internas de parent/BOM/core/starter com a versão aprovada.
3. WHEN preparar a distribuição npm THEN a validação SHALL comparar nome, versão, arquivos e referências internas dos tarballs com releases_json e excluir packages não publicáveis.
4. WHILE executar build e testes do consumidor o job SHALL operar sem a credencial privilegiada do escritor central e sem credenciais de publicação no registry.
5. WHEN distribuir packages THEN a etapa de publicação SHALL receber somente credenciais necessárias ao registry e os artefatos previamente verificados, sem recalcular ou decidir uma nova versão.
6. IF uma coordenada já existir com conteúdo divergente ou identidade não verificável THEN a distribuição SHALL parar para intervenção humana sem sobrescrever nem desfazer tags/Releases.
7. WHEN executar o teste externo Java THEN um consumidor separado com repositório Maven local vazio SHALL resolver o BOM e o starter publicados e compilar uma aplicação mínima com suas dependências internas.
8. WHEN executar o teste externo Vue THEN um consumidor separado com cache npm isolado SHALL instalar as versões exatas publicadas, validar seus imports e tipos e concluir o build mínimo.
9. IF uma distribuição de vários packages terminar parcialmente THEN o relatório SHALL listar a situação por coordenada e exigir reconciliação explícita antes da retomada, sem redeploy indiscriminado.

**Independent Test**: Fixtures de empacotamento sem escrita remota; depois, ensaios autorizados no GitHub Packages e instalação externa sem cache, com logs sem tokens.

### P1: Evidência, revisão e encerramento — PKG-08

**User Story**: Como responsável pela issue, quero distinguir o que foi implementado, homologado e publicado antes de aprovar o encerramento.

**Acceptance Criteria**:
1. WHEN concluir a implementação central THEN o gate SHALL executar a suíte unificada, ferramentas reais e verificação independente com evidências por critério e mutantes comportamentais, antes de propor publicação remota.
2. WHEN registrar uma execução remota THEN o relatório SHALL identificar repositório, PR, SHA central, SHA consumidor, configuração, URL do run, outputs esperados/obtidos e resultado por cenário.
3. IF não houver execução remota do consumidor THEN o estado de sua homologação SHALL permanecer pendente, mesmo com fixtures e CI central aprovadas.
4. WHEN testar os pilotos THEN a matriz SHALL cobrir entrega normal, hotfix, milestones aplicáveis, override válido/inválido, environment omitido/configurado, retry e integridade do SHA, compartilhando casos de policy comuns sem exigir duplicação artificial em todos os projetos.
5. IF houver indisponibilidade de GitHub, ferramenta nativa ou registry THEN o relatório SHALL registrar falha/bloqueio sem marcar o cenário como aprovado e sem fallback de cálculo.
6. WHEN propor encerramento da issue #4 THEN o relatório SHALL reconciliar seu escopo original com PRs integrados, matriz de aceite e pendências, distinguindo os resultados central, integração e distribuição.

**Independent Test**: Matriz requisito -> teste -> evidência e um cenário deliberadamente não executado que deve continuar pendente no relatório.

## Edge Cases

- IF um pacote tiver apenas tag de outro namespace THEN o adaptador SHALL ignorar essa tag para seu cálculo e diagnosticar a ausência de baseline reconhecida.
- IF o lockfile ou a versão resolvida da CLI mudar entre cálculo e preparo THEN a validação SHALL invalidar o plano anterior antes da escrita.
- IF um artifact expirar antes da retomada THEN a execução SHALL exigir nova coleta/verificação da mesma origem em vez de reconstruir evidência por suposição.
- IF o registry rejeitar autenticação THEN a distribuição SHALL falhar sem registrar segredos e sem alterar o resultado já publicado no GitHub.
- IF um PR funcional não possuir changeset e a ferramenta nativa reportar erro THEN a execução SHALL preservar esse erro em vez de gerar um PATCH central.

## Implicit Requirement Dimensions

| Dimension | Coverage |
| --- | --- |
| Input validation and bounds | PKG-02/03: schema do plano, releases estáveis, paths restritos e hashes; preservar limites de tamanho/timeout já impostos pelos executores centrais |
| Failure and partial failure | PKG-05/07: lote e registry não atômicos; entradas concluídas e pendentes explícitas |
| Idempotency and retries | PKG-03/05/07: PR técnico por origem/plano, tags imutáveis, inventário antes de retomar |
| Auth boundaries and rate limits | PKG-03/04/07: read/write separados e credenciais mínimas; API indisponível/rate limit bloqueia sem bypass |
| Concurrency and ordering | PKG-03/05: origem e head atualizados, serialização por repo/destino existente e revalidação após environment |
| Data lifecycle and expiry | Artifacts com retenção configurada/default; relatório durável com links/SHAs; artifact expirado exige nova validação |
| Observability | PKG-05/08: resultado por package/coordenada, motivo, versão, origem e links sem tokens |
| External dependency failure | PKG-02/08: falha fechada de ferramenta, API e registry; nenhum fallback SemVer |
| State transition integrity | Funcional -> preparação -> review técnico -> merge técnico -> tags/Releases -> distribuição -> consumo externo; resultado completo antes do próximo estágio |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PKG-01 | Conciliação sem regressão | Specify | Pending |
| PKG-02 | Plano nativo do monorepo | Specify | Pending |
| PKG-03 | PR técnico e confiança | Specify | Pending |
| PKG-04 | Governança e homologação | Specify | Pending |
| PKG-05 | Publicação recuperável | Specify | Pending |
| PKG-06 | Callers e prontidão | Specify | Pending |
| PKG-07 | Distribuição e consumo externo | Specify | Pending |
| PKG-08 | Evidências e encerramento | Specify | Pending |

**Coverage:** 8 requisitos definidos; tarefas ainda não derivadas. Nenhum requisito está marcado como implementado por existir esta especificação.

## Delivery Boundaries

| Resultado | Trabalho previsto | Gate e autoridade |
| --- | --- | --- |
| A: Central pronta | Conciliar #13/#12, fixtures reais, exemplos e documentação no repositório .github | Aprovação desta spec -> design -> tarefas; implementação local; verificador independente obrigatório; push só autorizado |
| B: Consumidores homologados | Adoção remota nos pilotos, rotas/gates e identidade do SHA | Autorizar alterações/publicação nas branches dos pilotos; revisão humana e runs do GitHub; não usar checkout local como substituto do called remoto |
| C: Packages consumíveis | Distribuição npm/Maven e instalação externa | Autorizar credenciais/destino/publicação real; validar coordenadas e conteúdo; registrar falhas parciais |
| Encerramento da issue | Consolidar A/B e a evidência de C quando aprovada como parte do aceite ponta a ponta | Decisão humana com diferenças de escopo e pendências explícitas; não encerrar só por CI verde |

## Success Criteria

- [ ] Quatro adaptadores coexistem no mesmo contrato central e a CI hospedada passa no SHA efetivamente entregue.
- [ ] Changesets prepara um lote nativo completo, revisado uma vez e publicado no SHA técnico correto.
- [ ] Gates de milestone, override e hotfix não são contornados pela adição do adaptador.
- [ ] PackagesJava usa a versão conjunta sem referências internas antigas nos POMs distribuídos.
- [ ] PackagesVue preserva suas versões por package sem dois produtores de release concorrentes.
- [ ] Callers consomem um SHA central disponível no GitHub e usam outputs tipados para o formato único/lote.
- [ ] Ensaios remotos e consumo externo estão documentados ou explicitamente pendentes; não há sucesso presumido.
- [ ] Usuário recebe relatório final com recomendação fundamentada sobre o encerramento da issue #4.

## Sources

- [PR #12](https://github.com/aplicacoesBoilerplate/.github/pull/12), [CI c7e6101](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38837059222) e [PR #13](https://github.com/aplicacoesBoilerplate/.github/pull/13).
- [Spec Changesets no SHA original do #13](https://github.com/aplicacoesBoilerplate/.github/blob/b1b2ec51906306c7afa5129f6557b30b9528f6b5/.specs/features/changesets-turbo/spec.md): histórico, não evidência de conciliação.
- [PackagesVue package.json](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/package.json), [.changeset/config.json](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/.changeset/config.json) e [release.yml](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/.github/workflows/release.yml).
- [PackagesJava pom.xml](https://github.com/aplicacoesBoilerplate/PackagesJava/blob/master/pom.xml) e [deploy.yml](https://github.com/aplicacoesBoilerplate/PackagesJava/blob/master/.github/workflows/deploy.yml).
- [Changesets CLI oficial](https://changesets.dev/guide/cli): cálculo/preparo/publicação separados e namespace nativo de tags. A versão testada será fixada no design/lockfile; documentação atual não comprova compatibilidade de qualquer versão da CLI.
- [GitHub GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token): eventos originados por esse token não disparam outros workflows, exceto dispatch explícito suportado.

Context7 não está disponível nesta sessão. Pesquisa complementar limitada a fontes oficiais; a evidência de compatibilidade virá dos testes na versão efetivamente fixada.
