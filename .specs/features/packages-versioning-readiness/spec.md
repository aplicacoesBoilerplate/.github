# Versionamento de packages: reconciliação e homologação

## Problem Statement

A issue #4 foi reaberta porque a implementação central ainda não comprova o fluxo completo dos consumidores. O PR #12 entrega Go, standard-version e jgitver; o PR #13 acrescenta Changesets/Turbo sobre uma base anterior do #12. Ambos aguardam revisão humana.

Esta especificação fecha a conciliação central e define o aceite remoto de PackagesJava e PackagesVue. Ela separa três resultados: código central verificado, integração homologada no consumidor e packages publicados e consumíveis. Um resultado não comprova automaticamente o seguinte.

O aditivo de 2026-10-19 inclui Release Please como quinto adaptador e a organização modular dos scripts, mantendo standard-version operacional para os consumidores existentes. Não substitui Changesets/Turbo no piloto Vue nem jgitver no piloto Java.

Na mesma data, o usuário escolheu TypeScript como linguagem da automação central para facilitar manutenção, contratos e encapsulamento. Essa escolha acrescenta PKG-11 e substitui apenas a decisão técnica anterior de implementar os módulos novos em JavaScript.

**Status:** especificação aprovada; implementação iniciada posteriormente a pedido do usuário. Critérios concluídos e evidências por tarefa estão em [tasks.md](tasks.md) e [implementation-log.md](implementation-log.md). A limitação de 2026-10-20 a apenas especificar foi cumprida naquela rodada e revogada pela autorização seguinte de implementação.
**Data:** 2026-10-16; aditivos em 2026-10-19 e 2026-10-20. **Issue:** [#4](https://github.com/aplicacoesBoilerplate/.github/issues/4).
**Continuidade:** complementa `reconcile-native-profiles` e a feature `changesets-turbo` do PR #13; não invalida suas evidências nos respectivos SHAs.

## Goals

- [ ] Reconciliar o PR #13 com o #12 sem perder os três adaptadores existentes nem o contrato de segurança read/write.
- [ ] Entregar um caller por consumidor, com CI, prévia, publicação de versão e encadeamento explícito para distribuição.
- [ ] Homologar Maven com versão única e Vue com o plano coordenado de packages calculado pelo Changesets.
- [ ] Produzir evidências remotas, de recuperação e de consumo externo antes de propor o encerramento da issue #4.
- [ ] Acrescentar release-please como opção explícita, preservando standard-version sem migração automática.
- [ ] Organizar scripts por responsabilidade e contratos reutilizáveis, sem duplicar policy ou comprometer a separação read/write.
- [ ] Migrar toda a automação central de versionamento em escopo para TypeScript, com tipagem estrita, distribuição compilada e compatibilidade dos consumidores; retirar seus scripts Shell do fluxo final.

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
| Remover standard-version ou migrar aplicações automaticamente | O usuário mantém aplicações legadas e pediu coexistência dos adaptadores |
| Habilitar todos os release-types, plugins e monorepos do Release Please de uma vez | O primeiro perfil proposto é Node/npm com um componente; ampliação exige testes e contrato próprios |
| Reescrita integral de uma vez, framework de plugins dinâmicos ou hierarquias obrigatórias de classes | TypeScript foi escolhido; a migração continua incremental e baseada em composição/contratos |
| Distribuir um produto CLI separado ou exigir sua instalação nas aplicações | Os entrypoints Node são internos ao checkout da pipeline central |
| Remover o shell do runner, launchers nativos de Maven/npm ou scripts de outros assuntos | A retirada abrange a implementação Shell própria de versionamento; YAML e ferramentas nativas continuam existindo |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ordem de trabalho | Conciliação central, preparo dos callers/fixtures, homologação remota, distribuição e consumo externo | Avançar sem aguardar merge, sem tratar CI local como homologação remota | Aprovado 2026-10-19; adições centrais precedem adoção dos novos perfis |
| Destino do trabalho Changesets | Continuar o PR #13 empilhado no #12; preservar histórico e enviar apenas fast-forward quando autorizado | Evitar uma implementação concorrente e respeitar a revisão aberta | Escopo aprovado 2026-10-19; não equivale a nova autorização de push |
| Execução | Implementação neste chat; revisão independente após a última tarefa | Preferência já expressa pelo usuário e gate obrigatório TLC | Herdado |
| Java | Maven, Java 21, jgitver 1.9.0 e versão conjunta dos quatro módulos | Modelo aprovado e perfil central já validado | Herdado |
| Vue | npm workspaces, package-lock.json e versões nativas por package; uma coordenação por monorepo | Configuração atual de PackagesVue e escopo do PR #13 | Aprovado 2026-10-19 |
| Milestone em lote Vue | Lote com mais de um package exige ausência de milestone; milestone presente bloqueia antes da escrita, sem override para esse formato não suportado | Um título SemVer não expressa várias versões; não inventar mapa/plano novo nesta entrega | Aprovado 2026-10-19 |
| Milestone com um release | Aplicar contrato existente: versão exata e incremento, sem substituir o cálculo nativo | Preservar a governança aprovada para versão única | Aprovado 2026-10-19 |
| Bootstrap | Escopo sem tag estável reconhecida aceita somente candidata nativa 0.0.1; nenhum reset de manifest ou criação de baseline automática | Regra aprovada de primeira versão; tags existentes exigem diagnóstico de escopo | Herdado |
| Registry do piloto | GitHub Packages npm e Maven, com permissões verificadas separadamente | É o destino configurado nos dois repositórios | Observado; publicação exige autorização específica |
| Migração do release Vue | Um único produtor de PR técnico, tags e GitHub Releases; retirar o produtor concorrente na adoção autorizada | O workflow atual já cria PRs de release e publica packages | Aprovado 2026-10-19 |
| Distribuição | Etapa posterior explícita no caller, condicionada ao resultado completo da versão e ao published_sha | GitHub Release não é npm publish nem Maven deploy | Aprovado 2026-10-19 |
| Recuperação parcial no registry | Inspecionar coordenadas e digests; retomar só ausentes quando comprovadamente seguro; divergência ou estado não verificável exige intervenção | Publicação de vários packages não é transação atômica | Aprovado 2026-10-19 |
| Dados e retenção | Usar retenção configurada/default dos artifacts; registrar links e SHAs duráveis no relatório de aceite | Não exigir retenção infinita nem presumir que artifacts permanecerão disponíveis | Aprovado 2026-10-19 |
| Coexistência Node | Seleção explícita entre standard-version e release-please; nenhuma substituição silenciosa ou fallback entre eles | Aplicações existentes precisam continuar funcionando | Solicitado pelo usuário 2026-10-19 |
| Perfil inicial Release Please | Adaptador release-please, estratégia nativa node, um componente npm com package-lock.json; versão upstream fixada no design | Reutilizar o contrato Node existente sem prometer todos os ecossistemas suportados pela ferramenta | Aprovado com a spec completa 2026-10-19 |
| Preparação Release Please | Planejamento nativo somente leitura; um PR técnico de release sob controle dos gates centrais; publicação somente pelo escritor central | O fluxo nativo também gerencia PRs/releases e não pode virar segundo produtor concorrente | Aprovado com a spec completa 2026-10-19 |
| Configuração Release Please | JSON nativo com paths confinados e conjunto suportado de opções documentado; extra-files/plugins fora desse conjunto rejeitados | Preservar cálculo nativo sem autorizar alterações arbitrárias de arquivos ou código do consumidor no escritor | Aprovado com a spec completa 2026-10-19 |
| Reuso semelhante a POO | Interfaces por contrato, encapsulamento, composição e dependências explícitas; classes apenas se trouxerem benefício demonstrável | Reaproveitar módulos JavaScript existentes sem construir uma hierarquia artificial | Aprovado com a spec completa 2026-10-19 |
| Ordem das adições | Consolidar pontos comuns durante a conciliação; depois incluir Release Please; caracterizar e verificar cada extração separadamente | Separar regressão de refatoração e comportamento novo, sem reescrita em bloco | Aprovado com a spec completa 2026-10-19 |
| Piloto Release Please | Sem aplicação piloto nova escolhida; validar primeiro em fixture Node real no .github | Não alterar aplicações ou inferir escolha de piloto nesta solicitação | Aprovado com a spec completa 2026-10-19 |
| Linguagem central | Toda lógica central em escopo termina em TypeScript; migração incremental, YAML mantido e chamadas finais diretas ao compilado Node | A última direção do usuário inclui o trabalho de master, PRs e local, substituindo Shell sem criar produto CLI | Escolha explícita, consolidada em 2026-10-20 |
| Distribuição TypeScript | Fontes e JavaScript compilado versionados juntos no repositório central; CI verifica correspondência e consumidores executam somente o compilado | Não exigir compilador/loader TS no consumidor ou no escritor privilegiado | Default técnico registrado no design |
| Compatibilidade de entrada | Preservar contratos workflow_call, outputs, efeitos e erros; caminhos internos .sh são retirados após atualizar todos os usos versionados | Caller não depende de caminho de script interno; pin antigo mantém sua implementação antiga | Refinamento da retirada de Shell solicitada pelo usuário |
| Metadados entre fases | PR funcional fornece milestone/override; PR técnico acrescenta revisão do bundle no head atual, sem apagar o contrato funcional | Evitar perda de governança quando existe PR técnico sem milestone | Precisão técnica da governança já aprovada |
| Limite desta rodada | Editar e validar apenas os artefatos TLC; parar antes de implementar ou publicar | Pedido explícito após a troca de modelo | Confirmado em 2026-10-20 |

**Open questions:** none — decisões de produto resolvidas ou defaults registrados. Design e tarefas tornam essas decisões revisáveis; esta rodada termina com o planejamento, sem autorizar sua execução automaticamente.

## Evidence Baseline

Pilotos observados em 2026-10-16; refs centrais reconfirmadas somente por leitura em 2026-10-20. Revalidar no início da execução:

| Fonte | Estado constatado | Implicação |
| --- | --- | --- |
| PR #12 | Aberto, sem merge, HEAD c7e610117edfbe8a6338ec0d3b6703156026ef70; CI 38837059222 aprovada nesse SHA | Base de implementação, não prova dos pilotos |
| PR #13 | Aberto, base codex/versioning-profiles, HEAD b1b2ec51906306c7afa5129f6557b30b9528f6b5 | Reconciliar contra o HEAD atual do #12; aprovação/CI antiga não cobre a conciliação |
| master central | 3511b1f1266a35d43ff12a81306514c44cc65fc5 | Inventariar diferenças relevantes para versionamento; não incorporar PRs de LLM/triagem/code review por proximidade |
| Planejamento local | codex/reconcile-native-profiles, HEAD 93f72bf antes desta rodada | Preservar os commits documentais e mudanças do usuário; nenhum código novo nesta rodada |
| PackagesVue/master | Root privado; npm workspaces e Turbo; ui 1.1.1, utils/composables 0.0.1; tags por package nessas versões | Não reiniciar o versionamento; respeitar histórico por package |
| PackagesVue/release.yml | Fluxo próprio Changesets de preparação e publicação | Definir uma única autoridade para tags/Releases na migração |
| PackagesJava/master | Parent/BOM/core/starter; revision 0.0.1; tag 0.0.1; deploy acionado por push de v* | Alinhar prefixo e configuração nativa; não presumir que o deploy atual acompanhará a publicação central |

## User Stories

### P1: Conciliar sem regressão — PKG-01

**User Story**: Como mantenedor da pipeline, quero integrar Changesets ao registro modular existente sem criar outro fluxo concorrente.

**Acceptance Criteria**:
1. WHEN iniciar a conciliação THEN a entrega SHALL registrar os SHAs reais de master, #12, #13 e trabalho local relevante, identificando os pontos de integração antes de alterar código e excluindo mudanças alheias ao versionamento.
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
3. WHEN executar o escritor central THEN o job SHALL aplicar somente o bundle validado, sem executar npm install, Changesets, Release Please, Maven, lifecycle scripts ou código/configuração do consumidor.
4. IF bundle, hashes, lista de arquivos, plano, head do PR ou SHA funcional divergirem da evidência validada THEN o escritor SHALL rejeitar a operação antes de qualquer escrita.
5. IF o bundle incluir path fora do workspace, symlink, arquivo não permitido ou alteração de código-fonte THEN o escritor SHALL rejeitá-lo antes de aplicar arquivos.
6. WHEN publicar após merge técnico THEN a validação SHALL exigir aprovação humana válida no head revisado e vínculo verificável com o SHA funcional e o plano de origem.
7. IF uma nova entrega funcional invalidar a origem do PR técnico THEN a publicação SHALL bloquear até regeneração e nova revisão conforme o contrato técnico existente.
8. WHEN consumir artifacts no escritor THEN a validação SHALL conferir repositório, run/job produtor, SHA central, SHA funcional e identidade do plano contra a execução esperada, sem aceitar apenas hashes fornecidos pelo próprio artifact como prova de origem.

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
9. WHEN existir PR técnico THEN a policy SHALL revalidar milestone e override no PR funcional de origem e exigir separadamente a revisão do head técnico, sem usar a ausência de milestone no PR técnico para dispensar a validação funcional.

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

### P1: Release Please sem regressão dos perfis existentes — PKG-09

**User Story**: Como mantenedor de aplicações Node, quero escolher Release Please para novas adoções e continuar usando standard-version nas aplicações existentes, com a mesma governança central.

**Acceptance Criteria**:
1. WHEN o caller selecionar release-please THEN o registro SHALL resolver um adaptador próprio sem invocar standard-version nem alterar a escolha de ferramenta de outro consumidor.
2. WHEN calcular uma candidata Release Please THEN o adaptador SHALL consumir o plano nativo de versão, changelog e atualizações de arquivos para o SHA funcional identificado, com a versão upstream fixada e registrada no relatório.
3. IF a configuração, o manifest nativo e o histórico de releases/tags do componente divergirem THEN o adaptador SHALL bloquear com diagnóstico antes de qualquer escrita, sem inventar baseline ou recorrer a outro adaptador.
4. WHEN o plano nativo não contiver release elegível THEN a execução SHALL retornar no-release sem abrir PR técnico, criar tag/Release ou disparar distribuição.
5. WHEN preparar uma release elegível THEN a automação SHALL criar ou atualizar um único PR técnico identificável por repositório, branch-alvo e componente, contendo somente as alterações nativas validadas e sem publicar a release nessa fase.
6. WHEN o PR técnico receber novo conteúdo ou nova origem funcional THEN a validação SHALL invalidar o plano e as aprovações da revisão anterior antes de permitir publicação.
7. WHEN publicar após merge técnico aprovado e CI correspondente aprovada THEN o publicador central SHALL criar ou reconciliar a tag e a GitHub Release no SHA integrado verificado, usando a versão e as notas nativas validadas.
8. WHEN avaliar milestone e override no perfil Release Please THEN a policy SHALL aplicar as mesmas regras de release única de PKG-04 sem usar a milestone para configurar release-as ou forçar o cálculo.
9. IF o escopo Release Please não possuir baseline estável reconhecida e a candidata nativa não for 0.0.1 THEN a execução SHALL bloquear sem sobrescrever a candidata com um cálculo central.
10. WHILE planejar versões ou materializar alterações nativas o adaptador SHALL operar sem permissões de escrita, e nenhuma chamada mutante de API será permitida nessa etapa.
11. IF um label nativo como autorelease: pending ou tagged estiver presente THEN a autorização SHALL continuar exigindo proveniência, diff, SHA e reviews verificados, sem tratar esse label como permissão ou prova de publicação.
12. WHEN o caller continuar selecionando standard-version THEN a execução SHALL preservar o comportamento já suportado, incluindo bootstrap, PR técnico, outputs e recuperação, sem migrar configuração, manifests ou histórico.
13. IF o consumidor solicitar release-type, plugin, extra-file ou formato de workspace fora do perfil suportado THEN o adaptador SHALL rejeitar a configuração com diagnóstico explícito antes da escrita.
14. WHEN documentar e testar o novo perfil THEN a entrega SHALL incluir caller e fixture Node com ferramenta real, cobrindo PATCH/MINOR/MAJOR em base estável, bootstrap, no-release, PR atualizado, merge aprovado, retry e conflito de tag sem publicação remota na fixture.

**Independent Test**: Release Please real fixado, transporte GitHub controlado que registra e proíbe mutações no planejamento; fixture Node com versões esperadas derivadas da spec e regressões do standard-version real. Merge técnico e publicação são testados com payloads de API verificáveis, sem presumir que mocks substituem uma futura homologação remota.

### P1: Scripts organizados por contrato e composição — PKG-10

**User Story**: Como mantenedor da pipeline, quero módulos com responsabilidades claras e recursos reutilizáveis para acrescentar adaptadores sem duplicar scripts e regras.

**Acceptance Criteria**:
1. WHEN executar qualquer um dos cinco adaptadores THEN a orquestração SHALL usar o mesmo contrato de contexto explícito e resultado normalizado de release única ou lote, sem exigir métodos artificiais de publicação nos coletores nativos.
2. WHEN selecionar uma ferramenta THEN o registro SHALL declarar suas capacidades de runtime, formato único/lote, geração de arquivos e tipo de tag, rejeitando capacidade não suportada em vez de inferi-la apenas pelo ID.
3. WHEN dois ou mais adaptadores precisarem executar processos ou consultar Git/API THEN os módulos SHALL reutilizar as portas comuns de execução, paths, Git e transporte por dependências explícitas, sem manter cópias das mesmas operações em cada adaptador.
4. WHEN avaliar governança THEN todos os adaptadores SHALL usar a policy compartilhada de milestone/override e os validadores comuns de proveniência, sem manter uma segunda implementação dessas regras no adaptador.
5. WHEN compartilhar preparo de PR técnico, bundle ou publicação THEN os serviços comuns SHALL receber dados validados e capacidades explícitas, mantendo os formatos nativos dentro de seus próprios adaptadores.
6. WHEN um módulo de domínio ou adaptador for importado THEN ele SHALL permanecer sem efeitos de processo, filesystem ou rede até uma chamada explícita com o contexto e dependências necessários.
7. WHEN concluir a migração central THEN os workflows de versionamento SHALL chamar entrypoints Node compilados diretamente, sem executar ou importar os scripts .sh próprios de versionamento e sem regras de negócio Shell embutidas no YAML.
8. IF uma capacidade ausente, um resultado inválido ou um path fora do escopo for recebido THEN a camada comum SHALL falhar antes de qualquer escrita, sem fallback para outro adaptador.
9. WHEN extrair um comportamento compartilhado THEN a tarefa SHALL incluir testes de caracterização antes da mudança e testes de contrato após a extração, preservando outputs públicos, códigos de erro e as proteções existentes.
10. WHEN provar extensibilidade THEN um adaptador substituto registrado no teste SHALL executar pelo contrato comum sem alterar a policy ou os publicadores, mantendo rejeitados IDs arbitrários fornecidos pelo caller.
11. WHEN concluir a reorganização THEN os READMEs de workflows e scripts SHALL documentar responsabilidades, fluxo, dependências, fronteira read/write, como adicionar adaptador e quais contratos/testes devem passar.
12. WHEN reportar conclusão THEN a entrega SHALL apresentar os gates dos cinco perfis, testes dos módulos compartilhados e revisão independente, sem usar redução de linhas ou adoção de classes como substituto de evidência funcional.

**Independent Test**: Contratos com adaptador substituto e dependências sentinela; importações sem I/O; fixtures reais dos cinco perfis; cenários negativos de segurança e mutantes de policy/SHA detectados após a refatoração. Interfaces TypeScript descrevem módulos/objetos; o JavaScript compilado é o executável distribuído. Composição é o padrão, sem herança obrigatória.

### P1: Automação central em TypeScript — PKG-11

**User Story**: Como mantenedor, quero trabalhar em TypeScript para explicitar contratos, encapsular responsabilidades e detectar incompatibilidades durante o desenvolvimento sem aumentar as exigências dos consumidores.

**Acceptance Criteria**:
1. WHEN concluir a reorganização THEN toda a lógica central de versionamento em escopo SHALL possuir fontes TypeScript com strict habilitado e contratos explícitos de adaptadores, contexto, planos, portas e resultados, sem implementação de negócio paralela em Shell ou JavaScript manual.
2. WHEN compilar a automação THEN o build SHALL bloquear emissão em caso de erro de tipo e produzir JavaScript ESM para o runtime Node central, sem exigir um loader TypeScript em execução.
3. WHEN entregar uma revisão central THEN a CI SHALL verificar que o JavaScript distribuído corresponde aos fontes TypeScript e lockfile da mesma revisão, rejeitando saídas ausentes, divergentes ou extras.
4. WHEN um consumidor executar o workflow central THEN o job SHALL usar o JavaScript distribuído no SHA selecionado sem instalar TypeScript ou compilar os fontes da automação nesse job.
5. WHEN o escritor privilegiado executar THEN o job SHALL permanecer sem compilação, instalação de dependências ou execução de ferramentas nativas do consumidor, preservando a fronteira read/write.
6. WHEN migrar um módulo legado THEN a compatibilidade SHALL preservar inputs/outputs dos workflows, exports JS utilizados e códigos de erro já suportados, com testes de caracterização; caminhos internos .sh serão substituídos em todos os usos versionados e documentados como retirados.
7. WHEN receber JSON de ferramenta, arquivo, artifact ou API THEN o sistema SHALL validar os dados em runtime antes de tratá-los como contrato de domínio, sem usar cast de TypeScript como validação.
8. WHEN verificar contratos TypeScript THEN os testes SHALL demonstrar rejeição de capacidades/contextos incompatíveis e executar as fixtures comportamentais contra o JavaScript efetivamente distribuído.
9. WHEN documentar a automação THEN os READMEs SHALL distinguir fontes editáveis, saídas geradas, comandos de typecheck/build/testes e responsabilidades das classes/interfaces, sem apresentar o compilado como fonte de manutenção manual.
10. WHEN verificar o encerramento da migração THEN o gate SHALL conferir o inventário de módulos/entrypoints e rejeitar lógica legada ativa, referências a .sh centrais ou fachadas JS com regras próprias, mantendo os entrypoints Node como recurso interno sem distribuição de CLI independente.

**Independent Test**: Testes de compilação positivos/negativos, fixture de dist divergente/ausente/extra rejeitada, contratos de workflow sem compilador nos jobs consumidores, validação runtime de JSON inválido e regressões contra o compilado. Classes são permitidas para encapsular comportamento; composição continua preferida à herança obrigatória.

## Edge Cases

- IF um pacote tiver apenas tag de outro namespace THEN o adaptador SHALL ignorar essa tag para seu cálculo e diagnosticar a ausência de baseline reconhecida.
- IF o lockfile ou a versão resolvida da CLI mudar entre cálculo e preparo THEN a validação SHALL invalidar o plano anterior antes da escrita.
- IF um artifact expirar antes da retomada THEN a execução SHALL exigir nova coleta/verificação da mesma origem em vez de reconstruir evidência por suposição.
- IF o registry rejeitar autenticação THEN a distribuição SHALL falhar sem registrar segredos e sem alterar o resultado já publicado no GitHub.
- IF um PR funcional não possuir changeset e a ferramenta nativa reportar erro THEN a execução SHALL preservar esse erro em vez de gerar um PATCH central.
- IF uma action ou bot Release Please externo competir pelo mesmo componente THEN a adoção SHALL bloquear até existir uma única autoridade de PR técnico e de tag/Release.
- IF o plano Release Please for calculado com histórico diferente do snapshot de origem THEN a execução SHALL invalidar o plano antes de aplicar o bundle ou publicar.

## Implicit Requirement Dimensions

| Dimension | Coverage |
| --- | --- |
| Input validation and bounds | PKG-02/03/09/10: schemas nativos e contrato comum, opções permitidas, releases estáveis, paths restritos e hashes; preservar limites de tamanho/timeout já impostos pelos executores centrais |
| Failure and partial failure | PKG-05/07: lote e registry não atômicos; entradas concluídas e pendentes explícitas |
| Idempotency and retries | PKG-03/05/07/09: identidade e atualização do PR técnico, origem/plano, tags imutáveis, inventário antes de retomar |
| Auth boundaries and rate limits | PKG-03/04/07/09/10: read/write separados e credenciais mínimas; planejamento Release Please sem chamadas mutantes; API indisponível/rate limit bloqueia sem bypass |
| Concurrency and ordering | PKG-03/05/09: origem e head atualizados, serialização por repo/destino existente e revalidação após environment; PR atualizado exige nova revisão |
| Data lifecycle and expiry | Artifacts com retenção configurada/default; relatório durável com links/SHAs; artifact expirado exige nova validação |
| Observability | PKG-05/08: resultado por package/coordenada, motivo, versão, origem e links sem tokens |
| External dependency failure | PKG-02/08/09/10: falha fechada de ferramenta, API e registry; nenhum fallback SemVer ou troca silenciosa de adaptador |
| State transition integrity | Funcional -> preparação -> review técnico -> merge técnico -> tags/Releases -> distribuição -> consumo externo; resultado completo antes do próximo estágio |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PKG-01 | Conciliação sem regressão | Tasks | In Tasks |
| PKG-02 | Plano nativo do monorepo | Tasks | In Tasks |
| PKG-03 | PR técnico e confiança | Tasks | In Tasks |
| PKG-04 | Governança e homologação | Tasks | In Tasks |
| PKG-05 | Publicação recuperável | Tasks | In Tasks |
| PKG-06 | Callers e prontidão | Tasks | In Tasks |
| PKG-07 | Distribuição e consumo externo | Tasks | In Tasks |
| PKG-08 | Evidências e encerramento | Tasks | In Tasks |
| PKG-09 | Release Please coexistente | Tasks | In Tasks |
| PKG-10 | Contratos e composição dos scripts | Tasks | In Tasks |
| PKG-11 | TypeScript e distribuição compilada | Tasks | In Tasks |

**Coverage:** 11 requisitos mapeados ao design e às tarefas. A matriz por critério está em [tasks.md](tasks.md). In Tasks indica planejamento, não implementação ou teste aprovado.

## Delivery Boundaries

| Resultado | Trabalho previsto | Gate e autoridade |
| --- | --- | --- |
| A: Central pronta | Conciliar master/#13/#12/local, migrar toda a lógica central em escopo para TS, acrescentar Release Please, fixtures reais, exemplos e documentação no .github | Planejada nesta rodada; futura execução local, verificador independente e CI no SHA publicado; nenhuma implementação agora |
| B: Consumidores homologados | Adoção remota nos pilotos, rotas/gates e identidade do SHA | Autorizar alterações/publicação nas branches dos pilotos; revisão humana e runs do GitHub; não usar checkout local como substituto do called remoto |
| C: Packages consumíveis | Distribuição npm/Maven e instalação externa | Autorizar credenciais/destino/publicação real; validar coordenadas e conteúdo; registrar falhas parciais |
| Encerramento da issue | Consolidar A/B e a evidência de C quando aprovada como parte do aceite ponta a ponta | Decisão humana com diferenças de escopo e pendências explícitas; não encerrar só por CI verde |

## Success Criteria

- [ ] Cinco adaptadores coexistem no mesmo contrato central e a CI hospedada passa no SHA efetivamente entregue.
- [ ] Changesets prepara um lote nativo completo, revisado uma vez e publicado no SHA técnico correto.
- [ ] Gates de milestone, override e hotfix não são contornados pela adição do adaptador.
- [ ] PackagesJava usa a versão conjunta sem referências internas antigas nos POMs distribuídos.
- [ ] PackagesVue preserva suas versões por package sem dois produtores de release concorrentes.
- [ ] Callers consomem um SHA central disponível no GitHub e usam outputs tipados para o formato único/lote.
- [ ] Ensaios remotos e consumo externo estão documentados ou explicitamente pendentes; não há sucesso presumido.
- [ ] Usuário recebe relatório final com recomendação fundamentada sobre o encerramento da issue #4.
- [ ] Release Please preserva os gates centrais e o fluxo de PR técnico; standard-version continua selecionável e testado sem migração forçada.
- [ ] Serviços compartilhados são verificados por contrato, possuem dependências explícitas e estão documentados; adaptadores não duplicam regras centrais.
- [ ] Typecheck estrito, compilação e verificação de correspondência dos arquivos distribuídos passam; os consumidores não precisam de compilador TypeScript.
- [ ] O inventário da migração não possui lógica legada ativa nem chamadas a .sh centrais; a pipeline executa os entrypoints internos Node sem exigir um produto CLI nas aplicações.

## Sources

- [PR #12](https://github.com/aplicacoesBoilerplate/.github/pull/12), [CI c7e6101](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38837059222) e [PR #13](https://github.com/aplicacoesBoilerplate/.github/pull/13).
- [Spec Changesets no SHA original do #13](https://github.com/aplicacoesBoilerplate/.github/blob/b1b2ec51906306c7afa5129f6557b30b9528f6b5/.specs/features/changesets-turbo/spec.md): histórico, não evidência de conciliação.
- [PackagesVue package.json](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/package.json), [.changeset/config.json](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/.changeset/config.json) e [release.yml](https://github.com/aplicacoesBoilerplate/PackagesVue/blob/master/.github/workflows/release.yml).
- [PackagesJava pom.xml](https://github.com/aplicacoesBoilerplate/PackagesJava/blob/master/pom.xml) e [deploy.yml](https://github.com/aplicacoesBoilerplate/PackagesJava/blob/master/.github/workflows/deploy.yml).
- [Changesets CLI oficial](https://changesets.dev/guide/cli): cálculo/preparo/publicação separados e namespace nativo de tags. A versão testada será fixada no design/lockfile; documentação atual não comprova compatibilidade de qualquer versão da CLI.
- [GitHub GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token): eventos originados por esse token não disparam outros workflows, exceto dispatch explícito suportado.
- [standard-version upstream](https://github.com/conventional-changelog/standard-version): depreciação declarada e indicação de Release Please como alternativa; isso não garante manutenção futura do pacote original nem autoriza substituição automática por forks.
- [Release Please oficial](https://github.com/googleapis/release-please): ferramenta baseada em PRs de release, com publicação no registry separada. Fonte consultada em 2026-10-19.
- [Configuração de manifest](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md) e [customização](https://github.com/googleapis/release-please/blob/main/docs/customizing.md): selecionar e fixar apenas o perfil suportado no design.
- [Planejamento nativo e mutações separados no código upstream](https://github.com/googleapis/release-please/blob/main/src/manifest.ts): a integração deve provar o modo somente leitura na versão fixada; a documentação de main não substitui o teste desse comportamento.
- [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html), [noEmitOnError](https://www.typescriptlang.org/tsconfig/noEmitOnError.html) e [módulos Node](https://www.typescriptlang.org/docs/handbook/modules/reference.html): referências para o desenho da compilação, não evidência de implementação executada.

Context7 não está disponível nesta sessão. Pesquisa complementar limitada a fontes oficiais; a evidência de compatibilidade virá dos testes na versão efetivamente fixada.
