# Spec Delta

## Purpose

Permitir que repositórios privados executem prompts pelo Codex CLI em um workflow reutilizável, preservando com segurança a sessão ChatGPT entre runners efêmeros.

## ADDED Requirements

### Requirement: Contrato reutilizável de execução
O workflow SHALL aceitar tipo de tarefa, contexto e parâmetros permitidos; SHALL selecionar template, modelo e nível de raciocínio segundo regras documentadas, com overrides validados; SHALL retornar estado, decisão e resultado estruturados ao consumidor. Valores inválidos MUST falhar antes de acionar o modelo.

#### Scenario: Execução válida
- **WHEN** um consumidor privado confiável informa tarefa e configurações válidas
- **THEN** o workflow seleciona template e modelo, executa uma única solicitação ao Codex CLI e disponibiliza decisão, resultado e estado ao consumidor

#### Scenario: Configuração inválida
- **WHEN** o consumidor informa tarefa desconhecida, template não permitido ou configuração fora dos valores documentados
- **THEN** o workflow falha sem executar a solicitação ao modelo

### Requirement: Separação entre decisão e ação
O workflow central MUST limitar-se à preparação, execução e resposta da LLM. Ele SHALL entregar conteúdo de alteração proposto, quando solicitado, como dado validável para o consumidor; MUST NOT aplicar mudanças no checkout, criar branches ou PRs, comentar em issues/PRs nem atualizar status de Project.

#### Scenario: Proposta de alteração
- **WHEN** a LLM propõe uma correção para triagem ou code review
- **THEN** o workflow devolve uma decisão estruturada e um artefato de patch opcional, sem alterar código ou estado do GitHub

#### Scenario: Decisão sem alteração
- **WHEN** a LLM conclui que nenhuma mudança é necessária ou que é necessária revisão humana
- **THEN** o workflow devolve o estado correspondente sem criar patch ou realizar ação no repositório

### Requirement: Uso restrito da sessão ChatGPT
O workflow SHALL restaurar a sessão do Codex a partir de uma secret do repositório consumidor privado. Ele MUST rejeitar contextos não confiáveis ou sem secrets e MUST impedir que sessão e PAT sejam exibidos em logs, outputs ou artefatos.

#### Scenario: Evento não confiável
- **WHEN** a chamada provém de fork, PR não confiável ou repositório público
- **THEN** o workflow não executa o Codex nem disponibiliza as credenciais

#### Scenario: Sessão ausente ou inválida
- **WHEN** a secret da sessão está ausente, malformada ou requer novo login humano
- **THEN** a execução falha com orientação para reconfiguração manual, sem declarar sucesso

### Requirement: Diretrizes de execução em camadas
O workflow SHALL aplicar uma cópia integral e versionada do `AGENTS.md` global aprovado pelo mantenedor e carregar as instruções `AGENTS.md` da revisão confiável do repositório consumidor quando disponíveis. Ele MUST NOT depender de acesso à máquina pessoal durante o job, truncar silenciosamente as instruções, nem tratar as instruções de um PR não confiável como política da automação. Restrições de credenciais, permissões e escrita MUST ser impostas pelo workflow independentemente do texto dessas diretrizes.

#### Scenario: Consumidor com instruções próprias
- **WHEN** o repositório consumidor tem `AGENTS.md` na revisão-base confiável
- **THEN** a invocação do Codex considera essas diretrizes junto da base comum versionada

#### Scenario: Instrução maliciosa no PR
- **WHEN** um PR altera `AGENTS.md` ou inclui texto que contradiz limites de segurança
- **THEN** a automação não eleva permissões, não expõe secrets e não usa a alteração do PR como política confiável

#### Scenario: Limite de instruções atingido
- **WHEN** a combinação do arquivo global e das diretrizes do consumidor excede o limite configurado
- **THEN** a execução falha com diagnóstico sem omitir regras silenciosamente

### Requirement: Persistência da sessão renovada
Após uso do Codex, o workflow SHALL preservar a versão atualizada da sessão na mesma secret do repositório consumidor. O token usado para essa escrita MUST ser distinto da sessão Codex e ter acesso apenas aos repositórios necessários com permissão de escrita de secrets. Uma falha de persistência MUST tornar a execução malsucedida, mesmo se o prompt tiver produzido resposta.

#### Scenario: Sessão atualizada
- **WHEN** o Codex altera a sessão e a API do GitHub aceita a escrita criptografada
- **THEN** a execução subsequente pode restaurar a nova sessão da secret

#### Scenario: Escrita recusada
- **WHEN** o PAT está ausente, expirado ou sem permissão para atualizar a secret
- **THEN** o workflow falha de modo explícito e não declara autenticação persistida

### Requirement: Exclusão mútua por sessão
Execuções que compartilham a mesma secret de sessão MUST ser serializadas e não podem cancelar uma execução em andamento para substituí-la. Se a fila atingir o limite da plataforma, a chamada excedente MUST aparecer como não executada, nunca como sucesso.

#### Scenario: Duas chamadas simultâneas
- **WHEN** duas chamadas no mesmo consumidor tentam usar a mesma sessão
- **THEN** a segunda espera a primeira concluir a persistência antes de restaurar a sessão

#### Scenario: Fila esgotada
- **WHEN** a fila da plataforma não admite mais chamadas
- **THEN** a chamada excedente não usa uma cópia antiga da sessão e não é apresentada como executada com sucesso

### Requirement: Exemplo e documentação de consumo
A entrega SHALL incluir documentação do contrato central, um workflow consumidor privado de exemplo e documentação desse consumidor, incluindo entradas, valores admitidos, efeitos de cada configuração, provisionamento manual inicial e recuperação de falhas.

#### Scenario: Adoção por consumidor
- **WHEN** um mantenedor segue o exemplo documentado em um repositório privado
- **THEN** consegue configurar as duas secrets, acionar o workflow e interpretar seus estados sem depender de detalhes internos não documentados
