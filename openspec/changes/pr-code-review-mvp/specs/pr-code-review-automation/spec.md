# Spec Delta

## Purpose

Revisar pull requests elegíveis com a pipeline central de LLM e entregar achados ou correções propostas sem substituir a revisão humana nem o SonarQube corretivo.

## ADDED Requirements

### Requirement: Revisão de PR elegível
Um caller enxuto SHALL acionar o workflow reutilizável de code review para PRs abertos e atualizados em repositório privado confiável, independentemente das branches de origem e destino. O workflow de review SHALL usar o contrato central da issue #9 para modelo, prompt e execução. Código, diff e texto do PR MUST ser tratados como dados não confiáveis.

#### Scenario: PR de branches confiáveis
- **WHEN** um PR elegível é aberto ou recebe novo commit
- **THEN** o consumidor envia o diff e metadados do SHA atual ao central e publica uma revisão vinculada a esse SHA

#### Scenario: Origem sem secrets
- **WHEN** o PR vem de fork ou de outro contexto sem confiança suficiente
- **THEN** não chama a LLM com credenciais nem tenta aplicar correção, e informa o limite do fluxo

#### Scenario: Diff maior que o limite
- **WHEN** o diff não cabe no limite documentado de análise
- **THEN** o resultado é inconclusivo e solicita revisão humana, sem afirmar revisão completa

### Requirement: Achados verificáveis
O consumidor SHALL publicar resumo e achados da LLM como recomendação identificada como automática, distinguindo problemas críticos, sugestões e ausência de achados. As diretrizes globais versionadas e o `AGENTS.md` da revisão-base confiável SHALL orientar a análise; alterações dessas diretrizes no head do PR MUST ser tratadas somente como dados. O consumidor MUST NOT aprovar o PR nativamente nem afirmar que a revisão humana foi concluída.

#### Scenario: Achado crítico
- **WHEN** o central retorna um achado crítico com referência válida a arquivo e linha do diff
- **THEN** o consumidor publica o achado no PR para revisão humana, sem convertê-lo em aprovação automática

#### Scenario: Sem achados
- **WHEN** o central não retorna achados válidos
- **THEN** o consumidor registra conclusão da análise automática sem aprovar o PR

### Requirement: Correção proposta em PR complementar
Para PR de feature elegível com patch válido, o consumidor SHALL criar branch de correção a partir do head SHA analisado e abrir PR complementar para a branch head original. MUST NOT escrever diretamente em release, develop ou master, nem abrir PR de correção para patch vazio ou fora do escopo. O workflow central MUST NOT executar essa ação.

#### Scenario: Patch seguro em feature
- **WHEN** existe patch restrito ao diff/escopo permitido e a branch head é corrigível
- **THEN** o consumidor abre PR complementar revisável, vinculado ao PR original, sem fazer merge automático

#### Scenario: PR de integração
- **WHEN** o PR representa integração de release para develop ou develop para master
- **THEN** a revisão automática pode publicar achados, mas não comita diretamente na branch de integração nem cria correção automática

### Requirement: Idempotência e prevenção de loop
O consumidor SHALL associar revisão e correção ao número do PR e ao head SHA analisado. Reexecução no mesmo SHA MUST reutilizar ou atualizar os registros; PRs criados pela própria automação MUST NOT disparar uma cadeia recursiva de correções.

#### Scenario: Mesma revisão reexecutada
- **WHEN** o workflow é reexecutado para o mesmo PR e head SHA
- **THEN** não duplica comentários nem PR complementar

### Requirement: Independência do SonarQube corretivo
O code review MUST NOT acionar a análise SonarQube pré-merge nem atribuir `Request changes` no Project por resultado Sonar. O Quality Gate da issue #5 continua após merge em develop e bloqueia somente a promoção para master conforme seu contrato.

#### Scenario: PR aberto antes de develop
- **WHEN** um PR de feature é revisado
- **THEN** o resultado do code review não é apresentado como Quality Gate SonarQube nem substitui sua análise posterior

### Requirement: Documentação de consumidor
A entrega SHALL incluir workflow reutilizável de review, caller de exemplo e documentação de eventos, inputs, secrets, valores de configuração, fluxo de decisão, outputs, limitações de correção e relação com triagem/SonarQube.

#### Scenario: Adoção
- **WHEN** um repositório privado configura o caller documentado
- **THEN** o mantenedor consegue distinguir revisão automática, correção proposta, review humana e Quality Gate posterior
