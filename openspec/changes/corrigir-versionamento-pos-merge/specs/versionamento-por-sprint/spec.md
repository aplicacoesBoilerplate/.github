# Spec Delta

## Purpose

Permitir que consumidores validem entregas e homologações de uma sprint sem antecipar versão e publiquem versões rastreáveis somente depois da integração na branch principal, respeitando as ferramentas de cada projeto.

## ADDED Requirements

### Requirement: Validação contextual de PRs sem versionamento antecipado
A solução MUST distinguir PR de feature para `release/vMAJOR.MINOR.PATCH`, PR de `release/vMAJOR.MINOR.PATCH` para `develop` e PR de `develop` para a branch principal configurada. MUST exigir épica encerrada e milestone concluída antes do PR release → develop. MUST fornecer um check de leitura para cada transição elegível, sem exigir `bump` ou versão candidata, sem alterar arquivos, criar tags ou releases.

#### Scenario: Entrega de feature vinculada à sprint
- **WHEN** um PR de feature é aberto para a branch de release e referencia sub-issue da épica da milestone correspondente
- **THEN** o check confirma sub-issue, épica e milestone da release e permite a análise da entrega sem publicação

#### Scenario: Feature sem vínculo válido
- **WHEN** um PR de feature não referencia sub-issue vinculada à épica e milestone da release
- **THEN** o check falha com diagnóstico da relação ausente, sem tag ou release

#### Scenario: Entrega da release em develop após homologação breve
- **WHEN** um PR de `release/vMAJOR.MINOR.PATCH` para `develop` referencia a épica encerrada e milestone fechada, sem issues abertas
- **THEN** o check usa os critérios de integração, não exige sub-issue de feature, homologação completa de develop nem prévia SemVer, e passa sem publicação

#### Scenario: Integração homologada na branch principal
- **WHEN** um PR de `develop` para a branch principal referencia a épica da sprint e tem os gates de homologação e revisão exigidos pelo consumidor
- **THEN** o check exigível na proteção da branch principal passa sem exigir sub-issue ou versão preparada no PR

#### Scenario: Integração sem evidência exigida
- **WHEN** um PR de integração não permite verificar a épica, a milestone ou a aprovação de homologação quando exigível na transição para a branch principal
- **THEN** o check falha com motivo específico e não desencadeia publicação

### Requirement: Changelog provisório não bloqueante
A solução MUST permitir um resumo ou changelog provisório como guia para o PR de homologação, se a ferramenta do perfil o disponibilizar sem publicar versão. MUST NOT tornar esse artefato ou uma prévia SemVer condição para aprovação de PR de feature ou de integração.

#### Scenario: Ferramenta sem changelog de homologação
- **WHEN** não é viável gerar changelog provisório para o perfil durante a homologação
- **THEN** o PR ainda pode passar nos checks obrigatórios de vínculo e homologação e não recebe versão ou tag antecipada

### Requirement: Versionamento pós-merge por perfil
A solução MUST iniciar o cálculo da versão definitiva somente após o merge do PR de integração na branch principal configurada, suportando `standard-version`, `changesets`, `jgitver` e `go-gitsemver`. MUST persistir alterações de versão/changelog produzidas por ferramentas que alteram arquivos em um commit integrado na branch principal antes de publicar; MUST NOT exigir que o PR funcional já contenha a versão futura, nem fabricar atualização de arquivo para perfis derivados de Git.

#### Scenario: Ferramenta altera arquivos do consumidor
- **WHEN** uma entrega homologada foi integrada e o perfil produz modificações de versão ou changelog
- **THEN** a automação prepara essas modificações depois do merge, submete-as aos gates da branch principal e só permite publicação no commit versionado integrado

#### Scenario: Ferramenta deriva versão de Git
- **WHEN** uma entrega homologada foi integrada e o perfil deriva versão estável de histórico e tags
- **THEN** a publicação pode usar o próprio commit integrado, sem commit artificial de versão

#### Scenario: Alteração de versão pendente de aprovação
- **WHEN** o commit de versionamento ainda não passou pelos gates da branch principal
- **THEN** nenhum tag ou GitHub Release é criado

#### Scenario: Perfil inválido ou versão instável
- **WHEN** o adaptador não é suportado, falta ferramenta ou o resultado não pode ser publicado como versão estável
- **THEN** a publicação para com diagnóstico acionável e não cria tag nem release

### Requirement: Publicação segura e vinculada ao commit versionado
A solução MUST restringir publicação à branch principal após merge e aprovação/homologação, criar tag e GitHub Release somente para o SHA que contém a versão aplicável e preservar tags existentes. `changelog_path` MUST ser opcional e apenas consumir arquivo existente, sem exigir changelog de homologação.

Na primeira liberação, `go-gitsemver` MUST calcular no SHA integrado com a configuração nativa do consumidor, fornecer `SemVer` e `Sha` conferidos e explicar o cálculo. O caller Go MUST depender da CI Go do mesmo push. A saída `published_sha` MUST ser preenchida em publicação ou reconciliação; a concorrência MUST ficar só no workflow central por repositório/branch, sem cancelamento. PR `release → principal` MUST NOT ser elegível como merge funcional.

#### Scenario: Publicação íntegra
- **WHEN** a versão pós-merge está pronta e o SHA publicável foi integrado na branch principal
- **THEN** tag e release correspondem à mesma versão e ao SHA publicável, com changelog quando houver

#### Scenario: Reexecução no mesmo commit
- **WHEN** a tag e a release já correspondem à versão e ao SHA publicável
- **THEN** a execução informa publicação já existente sem duplicar release nem recalcular segunda versão

#### Scenario: Reexecução após uma versão posterior
- **WHEN** a tag e a release de um SHA antigo continuam corretas, mas outra versão já foi publicada
- **THEN** a execução antiga retorna `already-published` e `published_sha` original antes de aplicar a regra de progressão de versão

#### Scenario: Falha da API ao consultar tag ou release
- **WHEN** a API retorna erro de autenticação ou serviço em vez de HTTP 404
- **THEN** a execução falha sem criar tag ou release e sem tratar o recurso como ausente

#### Scenario: Tag existente em outro commit
- **WHEN** a tag desejada aponta para SHA divergente
- **THEN** a execução relata conflito e não move a tag nem altera a release existente

#### Scenario: Falha entre tag e release
- **WHEN** uma tag correta foi criada e a release ainda não existe
- **THEN** a reexecução valida o mesmo SHA e pode completar só a release, sem refazer o versionamento

### Requirement: Consumo e homologação reproduzíveis
A solução MUST documentar entradas, saídas, permissões, gatilhos e referência fixa dos workflows compartilhados, e fornecer roteiro de ensaio hospedado com os quatro perfis em consumidor de laboratório. A CI de cada consumidor MUST testar/buildar o projeto com as ferramentas próprias; o workflow compartilhado de versionamento não substitui esses checks.

#### Scenario: Quatro perfis em um laboratório
- **WHEN** o mantenedor ensaia `standard-version`, `changesets`, `jgitver` e `go-gitsemver` no mesmo repositório
- **THEN** pode executar quatro rodadas separadas com versões/tags distintas e comprovar gates, publicação, reexecução e conflito sem colisão entre perfis

#### Scenario: Vários PRs antes da publicação standard-version
- **WHEN** múltiplas entregas entram na mesma release branch sem tag intermediária
- **THEN** a versão pós-merge reflete o conjunto de entregas ainda não publicado e não sofre incremento duplicado em reexecuções
