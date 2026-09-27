# Spec Delta

## Purpose

Garantir que somente um commit de `develop` com Quality Gate SonarQube aprovado possa ser promovido a `master`, rastreando reprovações pós-merge por uma Hotfix separada da épica da release.

## ADDED Requirements

### Requirement: Analisar o commit integrado em develop
O workflow reutilizável SHALL analisar o SHA exato recebido de um `push` em `develop` após integração de uma `release/*` ou `hotfix/*` de homologação. Ele MUST NOT usar um checkout de outro commit nem executar a análise como gate preventivo de PR de feature.

#### Scenario: Integração de release
- **WHEN** uma release é mesclada em `develop` e o caller recebe o evento `push`
- **THEN** a análise é associada ao SHA integrado e registra o PR de origem quando ele é identificável

#### Scenario: SHA ou origem divergente
- **WHEN** o checkout não corresponde ao SHA do evento ou a origem do merge não pode ser verificada
- **THEN** o workflow retorna resultado inconclusivo e não publica uma aprovação do Quality Gate

### Requirement: Distinguir aprovação, reprovação e inconclusão
O resultado publicado SHALL distinguir `PASS`, `FAIL` e `INCONCLUSIVE`, identificando repositório, projeto SonarQube, SHA, instante e URL da análise quando disponível. `PASS` significa aprovação do Quality Gate configurado; não exige que cada métrica individual seja 100%. Falha de autenticação, indisponibilidade, timeout ou ausência de análise MUST NOT ser convertida em `FAIL` confirmado nem em `PASS`.

#### Scenario: Quality Gate aprovado
- **WHEN** o SonarQube confirma a aprovação da análise do SHA solicitado
- **THEN** o resultado para aquele SHA é `PASS` com evidência consultável

#### Scenario: Quality Gate reprovado
- **WHEN** o SonarQube confirma a reprovação da análise do SHA solicitado
- **THEN** o resultado para aquele SHA é `FAIL` com evidência consultável

#### Scenario: SonarQube indisponível
- **WHEN** o resultado não pode ser confirmado por erro ou timeout
- **THEN** o resultado é `INCONCLUSIVE`, a promoção continua bloqueada e nenhuma Hotfix é criada como se houvesse uma reprovação comprovada

### Requirement: Manter a decisão vinculada ao SHA atual
Uma análise de um SHA antigo MUST NOT autorizar a promoção de outro SHA. Antes de registrar uma Hotfix corretiva automática, o workflow SHALL confirmar que o SHA reprovado ainda é o `develop` atual; execuções concorrentes ou repetidas MUST NOT sobrescrever uma conclusão mais nova.

#### Scenario: Develop avançou durante a análise
- **WHEN** a análise do SHA anterior termina após `develop` avançar
- **THEN** ela permanece como evidência histórica, não aprova o novo SHA e não cria automaticamente uma Hotfix para o estado novo

### Requirement: Criar Hotfix corretiva idempotente
Para um `FAIL` confirmado do SHA atual, o workflow SHALL localizar o PR de integração `release/* → develop` ou `hotfix/* → develop`, identificar sem ambiguidade a épica da release e conferir a milestone nos metadados da épica. Ele SHALL criar no mesmo repositório uma issue do tipo `Hotfix`, inicialmente aberta e com Status `On hold` no Project V2, vinculada à mesma milestone, inclusive se ela estiver fechada. A issue SHALL referenciar o SHA, PR de origem, épica e análise reprovada. Reexecuções da mesma falha MUST NOT criar outra Hotfix aberta.

#### Scenario: Primeira reprovação confirmada
- **WHEN** o SHA atual reprova, a épica e a milestone são verificadas e não há Hotfix aberta para a mesma falha
- **THEN** uma Hotfix `On hold` é criada na milestone da épica com os vínculos de rastreabilidade

#### Scenario: Reexecução da mesma reprovação
- **WHEN** a análise reprovada é processada novamente e a Hotfix correspondente ainda está aberta
- **THEN** o workflow reutiliza a Hotfix existente e não cria duplicata

#### Scenario: Metadados ausentes ou ambíguos
- **WHEN** não há vínculo verificável entre PR, épica e milestone, ou o Project V2 não permite definir `On hold`
- **THEN** a promoção permanece bloqueada, o impedimento é relatado e nenhuma milestone ou Status é presumido

### Requirement: Preservar o estado da release
A reprovação pós-merge SHALL manter a épica da release fechada e em `Done` no Project V2, sem reabrir sua milestone ou atribuir `Request changes` à épica ou a outras issues. O merge já realizado em `develop` não SHALL ser revertido automaticamente.

#### Scenario: Reprovação após encerramento da release
- **WHEN** a Hotfix corretiva é criada para uma release concluída
- **THEN** a épica continua `Done`, a milestone continua fechada e a contagem de issues abertas da milestone pode aumentar

### Requirement: Bloquear promoção insegura
O caller de promoção SHALL produzir um check obrigatório para PR `develop → master` que somente aprova quando o head do PR é o SHA atual de `develop`, o mesmo SHA tem `PASS` confirmado e não há Hotfix corretiva aberta na milestone correspondente. Resultado ausente, `FAIL`, `INCONCLUSIVE`, SHA obsoleto, vínculo de milestone ambíguo ou erro de consulta MUST bloquear a promoção.

#### Scenario: Promoção elegível
- **WHEN** o PR aponta para o SHA atual aprovado e não existe Hotfix corretiva aberta na milestone
- **THEN** o check de promoção é aprovado, sem dispensar revisão e homologação dos demais gates

#### Scenario: Gate reprovado ou pendente
- **WHEN** não existe `PASS` confirmado para o head exato do PR ou existe Hotfix corretiva aberta
- **THEN** o check de promoção falha e impede o merge em `master` quando configurado como obrigatório

### Requirement: Concluir Hotfix somente após nova aprovação
A Hotfix de homologação SHALL partir do SHA reprovado em `develop` e retornar por PR revisado a `develop`. Uma nova análise SHALL avaliar o SHA resultante. A automação MUST NOT fechar a Hotfix apenas pelo merge ou por texto `Closes`; seu encerramento e Status `Done` exigem confirmação explícita após `PASS`.

#### Scenario: Correção mesclada sem aprovação
- **WHEN** a Hotfix é mesclada em `develop`, mas o novo SHA ainda não tem `PASS`
- **THEN** a Hotfix permanece aberta e a promoção continua bloqueada

### Requirement: Configuração reutilizável e segura
O workflow SHALL receber do caller somente a configuração e os segredos necessários ao projeto consumidor, documentar as permissões exigidas e não expor credenciais em logs, outputs ou artefatos. SHALL existir um caller de exemplo para análise e promoção e documentação da limitação de edição do SonarQube, incluindo a necessidade de tratar `develop` como branch principal do projeto SonarQube quando a edição não oferece análise de branches.

#### Scenario: Consumidor configura o contrato
- **WHEN** um repositório consumidor fornece projeto SonarQube, endpoint e credenciais adequados
- **THEN** consegue chamar análise e check de promoção sem copiar a lógica interna do workflow central

#### Scenario: Credencial obrigatória ausente
- **WHEN** uma credencial necessária está ausente
- **THEN** a execução falha de modo explícito e não publica aprovação
