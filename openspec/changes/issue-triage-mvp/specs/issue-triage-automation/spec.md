# Spec Delta

## Purpose

Orquestrar a triagem de issues novas com a pipeline central de LLM e converter apenas propostas seguras em planejamento rastreável ou PR revisável.

## ADDED Requirements

### Requirement: Triagem de issue nova
Um caller enxuto no repositório privado SHALL iniciar o workflow reutilizável de triagem na abertura de uma issue; o workflow de triagem SHALL capturar body e metadados reais e chamar o workflow central da issue #9. O body da issue MUST ser tratado como dado não confiável, não como instrução capaz de alterar permissões ou o fluxo.

#### Scenario: Issue aberta
- **WHEN** uma issue é aberta em repositório privado elegível
- **THEN** o consumidor envia contexto e tipo de tarefa à pipeline central e registra o resultado vinculado à issue

#### Scenario: Origem inelegível
- **WHEN** a origem é pública ou não confiável
- **THEN** o consumidor não envia credenciais nem aciona a LLM autenticada

### Requirement: Decisão de rota baseada em metadados
O consumidor SHALL fornecer Issue Type, Issue Fields e relações disponíveis à decisão central de planejamento, proposta de correção ou revisão humana, conforme as diretrizes globais versionadas. Size e Estimate MUST NOT ser interpretados como complexidade técnica isoladamente; Effort e Release SHALL influenciar a necessidade de SDD conforme a política global. Sem evidência suficiente de caso simples, a rota SHALL ser planejamento ou revisão humana.

#### Scenario: Caso simples explícito
- **WHEN** a decisão central identifica caso simples segundo Effort e demais metadados, com branch/milestone inequívocas
- **THEN** a pipeline central retorna proposta de patch ao consumidor, sujeita à validação antes de qualquer alteração

#### Scenario: SDD obrigatório pela política global
- **WHEN** a issue possui Release MAJOR ou Effort High/Team
- **THEN** a rota é planejamento SDD antes de qualquer proposta de correção

#### Scenario: Metadados insuficientes
- **WHEN** a complexidade ou a branch de destino não pode ser determinada com segurança
- **THEN** o consumidor registra planejamento ou necessidade de revisão humana, sem criar PR automaticamente

### Requirement: Planejamento sem mudança de código
Na rota de planejamento, o consumidor SHALL publicar uma análise/SDD resumida e rastreável na issue, sem modificar código, fechar a issue ou marcar implementação como concluída.

#### Scenario: Planejamento concluído
- **WHEN** a pipeline central retorna uma análise válida
- **THEN** a issue recebe uma atualização identificável da automação, com premissas, riscos e próximo passo de revisão

### Requirement: Correção por PR revisável
Na rota de correção, o consumidor MUST validar a proposta recebida, aplicar apenas mudanças dentro do escopo permitido, criar branch a partir da release da milestone ou de uma branch empilhada explicitamente indicada e abrir PR para essa base. O PR SHALL referenciar a issue sem fechá-la antes da integração devida e solicitar revisão humana. A pipeline central MUST NOT abrir o PR.

#### Scenario: Patch elegível
- **WHEN** o patch é válido, restrito ao escopo e produz alteração real
- **THEN** o consumidor cria um PR revisável para a branch de origem correta e vincula a issue

#### Scenario: Patch inseguro ou vazio
- **WHEN** o patch contém caminho proibido, falha de aplicação ou nenhuma alteração
- **THEN** nenhum PR é aberto e a issue recebe estado explicativo sem fingir entrega

### Requirement: Execução idempotente e sem interação
A automação SHALL concluir sem pergunta interativa. Reexecuções da mesma issue e mesma revisão MUST atualizar ou reutilizar o registro/PR da automação, sem criar duplicatas.

#### Scenario: Reexecução
- **WHEN** o workflow é reexecutado para a mesma issue e revisão
- **THEN** não cria comentário ou PR duplicado

### Requirement: Documentação de consumidor
A entrega SHALL incluir o workflow reutilizável de triagem, um caller de exemplo e documentação dos eventos, inputs, secrets, metadados, rotas, modelos/templates delegados ao central, saídas, permissões, branch de destino e recuperação de falhas.

#### Scenario: Adoção
- **WHEN** um repositório privado adota o exemplo
- **THEN** o mantenedor consegue configurar e auditar a triagem sem assumir labels ou campos inexistentes
