# Triagem Context

**Gathered:** 2026-10-13. **Status:** Especificação e design aprovados em 2026-10-14; implementação autorizada, plano de tarefas em revisão antes de código.

## Feature Boundary

Triagem reutilizável de issues, planejamento SDD ou proposta simples por PR, usando a central da #9. Primeiro consumidor/piloto real; code review e harness ficam fora.

## Implementation Decisions

- Mantenedor aprovou o design com autorização para seguir em 2026-10-14. Execução permanece sequencial, sem desenvolvimento paralelo de branches. Verificação independente ao final permanece obrigatória.

- Em 2026-10-14, mantenedor aprovou a especificação e autorizou implementar; solicitou In progress no Project e entrega empilhada, sem aceitar ou integrar o PR da central.

- Mantenedor solicitou publicar progresso da #9 via PR e iniciar TLC da triagem.
- Mantenedor explicitamente transferiu LLM-24/T13 para a próxima entrega: encerrar meta de entrega local não afirma homologação real.
- Branch existente da #7 empilhada por merge não destrutivo sobre #9, preservando histórico e planejamento anterior.
- Caller controla autenticação, modelo, esforço e prompts; reuso de código público não compartilha conta ChatGPT.
- Testes devem detectar falhas relevantes, sem metas numéricas nem testes de documentação; instruções do caller permanecem completas.

## Propostas para revisão

- Gatilhos: issue aberta + acionamento manual para recuperação; origem/ator confiáveis antes de secrets.
- Rota simples conservadora por metadados; planejamento obrigatório pela política SDD; ausência/ambiguidade demanda humano.
- PR draft para base release/empilhamento validada; sem merge automático, fechamento prematuro ou force-push.
- A extensão de origem/SHA na central é um pré-requisito explicitamente modelado, não implementado nesta fase.
- Contrato atual de summary tem limite de 4000 caracteres e patch v1 até 1 MiB: design deve respeitar esses limites ou propor evolução compatível revisada, não prometer SDD ilimitado.

## Deferred Ideas

Harness, eventos acessórios do exemplo da issue, code review, manual central extenso. Repositório piloto e provisionamento pelo mantenedor antes da ativação, sem leitura de auth pessoal.
