# Spec Delta

## Purpose

Permitir que repositórios privados executem prompts pelo Codex CLI em um workflow reutilizável, preservando com segurança a sessão ChatGPT entre runners efêmeros.

## ADDED Requirements

### Requirement: Contrato reutilizável de execução
O workflow SHALL aceitar um template de prompt versionado, parâmetros de execução, modelo e nível de raciocínio permitidos; SHALL retornar resultado e estado explícitos ao consumidor. Valores inválidos MUST falhar antes de acionar o modelo.

#### Scenario: Execução válida
- **WHEN** um consumidor privado confiável informa template e configurações válidas
- **THEN** o workflow executa uma única solicitação ao Codex CLI e disponibiliza resultado e estado ao consumidor

#### Scenario: Configuração inválida
- **WHEN** o consumidor informa template inexistente ou configuração fora dos valores documentados
- **THEN** o workflow falha sem executar a solicitação ao modelo

### Requirement: Uso restrito da sessão ChatGPT
O workflow SHALL restaurar a sessão do Codex a partir de uma secret do repositório consumidor privado. Ele MUST rejeitar contextos não confiáveis ou sem secrets e MUST impedir que sessão e PAT sejam exibidos em logs, outputs ou artefatos.

#### Scenario: Evento não confiável
- **WHEN** a chamada provém de fork, PR não confiável ou repositório público
- **THEN** o workflow não executa o Codex nem disponibiliza as credenciais

#### Scenario: Sessão ausente ou inválida
- **WHEN** a secret da sessão está ausente, malformada ou requer novo login humano
- **THEN** a execução falha com orientação para reconfiguração manual, sem declarar sucesso

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
