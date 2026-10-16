# Design

## Context

Ver proposta e delta spec. A issue #9 define um `workflow_call` central que autentica o Codex, escolhe template/modelo e retorna decisão/resultado; o checkout do job central não é compartilhado com jobs do consumidor. O padrão Git Flow é feature → release → develop → master. O exemplo de YAML no body da issue #7 é ilustrativo e usa nomes de modelos, labels e branches que não são contratos deste repositório.

## Goals / Non-Goals

**Goals:** entregar workflow de triagem reutilizável e caller enxuto de issue aberta, com rota de planejamento ou correção, saída auditável e PR revisável quando houver mudança elegível.

**Non-Goals:** responder a comentários de review ou falhas de CI neste MVP, executar instruções arbitrárias do body, autoaprovar, automesclar, fechar issues ao abrir PR ou escrever na secret de autenticação fora do workflow central.

## Decisions

### 1. Consumidor orquestra; central decide e gera proposta

O caller de cada repositório privado declara `issues.opened`, passa o contexto ao workflow reutilizável de triagem e concede só as permissões necessárias. Esse workflow chama, por job aninhado, o workflow central da issue #9. A política global versionada no central decide necessidade de SDD, rota, template, modelo e esforço; o workflow de triagem valida que a decisão retornada é permitida para seu contexto. O central retorna estado/decisão/resumo e, na rota de correção, artefato de patch opcional. Alternativa rejeitada: duplicar instalação do Codex, heurísticas de SDD e seleção de modelos em cada caller.

### 2. Roteamento conservador por metadados reais

`Size`/`Estimate` medem valor agregado, não complexidade, mas são sinais de necessidade de SDD conforme o arquivo global. `Release` MAJOR e `Effort` High/Team determinam planejamento; Size M+ e valores excepcionais de Estimate reforçam essa decisão; Effort Medium combina sinais; Low só habilita proposta de correção quando os demais metadados não exigirem SDD. Milestone/base ambígua impede PR. Os nomes de labels são configuráveis pelo consumidor e não são inferidos do exemplo da issue. Alternativa de considerar tudo sem label como simples foi rejeitada por ampliar mudanças automáticas.

### 3. Duas saídas, um vínculo idempotente

O caller marca seu comentário e branch/PR com um identificador estável da issue e revisão da entrada. Reexecução atualiza o comentário/PR correspondente em vez de duplicar. Planejamento publica um resumo estruturado com contexto, proposta, riscos e próximos passos; pode incluir link para artefato SDD, sem criar código. Correção aplica o patch proposto só após validação de formato, caminhos e escopo, e verifica alterações reais. Alternativa de colar patch da LLM diretamente num shell foi rejeitada.

### 4. PR respeita origem e revisão humana

A base padrão é `release/<milestone>` obtida da milestone confiável da issue. Um empilhamento usa base explícita e validada na configuração do caller, nunca texto livre do body. Branch de correção parte da base confirmada; PR usa `Refs #N`, não `Closes #N` para base intermediária, e solicita revisão humana. Testes são definidos pelo repositório consumidor e rodam em job sem sessão Codex/PAT. Falha de teste mantém PR como proposta não aprovada ou impede sua criação conforme configuração documentada; nunca faz merge automático.

### 5. Segurança e permissões por fase

Somente repositórios privados confiáveis recebem as secrets da issue #9. O job de publicação recebe permissões mínimas de issues/contents/PR, sem PAT de atualização de secrets. Body, comentários e patch são dados não confiáveis. O evento do MVP é `issues.opened`; handlers extras descritos no exemplo original ficam fora desta primeira entrega. Os filtros impedem loop por comentário ou PR gerado pela automação.

## Risks / Trade-offs

- [Correção gerada por LLM pode estar errada] → PR sem autoaprovação, testes do consumidor e revisão humana obrigatória.
- [Base de release pode não existir ou milestone pode ser ambígua] → não criar PR e registrar necessidade de correção de metadados.
- [Patch pode tentar alterar workflow/secret ou caminho fora do escopo] → allowlist de caminhos, validação de diff e aplicação sem credenciais.
- [Reexecução simultânea pode duplicar PR] → concorrência por issue e busca por marcador estável antes da escrita.
- [Integração com a issue #9 ainda é planejada] → testes de contrato com fixtures e piloto privado só após homologação do central.

## Migration Plan

1. Implementar e testar o caller com resultado simulado do central, sem secrets.
2. Documentar workflow reutilizável, caller, gatilhos, opções, resultados e padrão de called no repositório; registrar adaptação da skill de CI/CD como entrega coordenada quando a localização/versionamento dessa skill estiver confirmado.
3. Habilitar em um consumidor privado piloto após a issue #9 estar operacional; verificar planejamento, correção e reexecução.
4. Se houver comportamento inadequado, desabilitar o caller; PRs criados permanecem para decisão humana, sem merge automático.
