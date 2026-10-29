# Design do MVP Agentic

Status: execução autorizada pelo usuário; escopo ampliado para toda a arquitetura em 2026-10-28.

## Architecture Overview

Caller YAML do consumidor → coordenador workflow_call → triagem Markdown compilada → decisão JSON no terminal noop → jobs condicionais → worker direto ou spec → pacote de aprovação → implementador protegido por Environment.

O coordenador usa GitHub Actions nativo para dependências, modelos e autorização. A LLM recomenda a rota, mas não escolhe um uses/ref ou um modelo fora do catálogo do caller. Não criar scripts TypeScript nem suíte nova. A validação funcional é o piloto.

## Components

- shared/agentic-runtime.md: OpenCode/AWF fixado, chave placeholder, permissões por papel; GitHub MCP somente leitura; sem tokens GitHub no filho nativo.
- shared/agentic-{low,medium,high,ultra}.md: orientações por perfil DRY; turnos e timeout são inputs limitados do consumidor. Modelo permanece input do consumidor.
- agentic-route.md: consulta contexto/metadados por ferramentas GitHub; retorna decisão JSON no terminal noop.
- agentic-direct.md: corrige issue, PR ou push; cria PR ou propõe atualização do PR, sem merge.
- agentic-specify.md: produz somente artefatos .specs em PR de especificação.
- agentic-implement.md: inicia somente após Environment; recebe SHA exato do PR de especificação.
- agentic-orchestrator.yml: valida envelope/rota com ações nativas, resolve modelos de catálogo fixo e prepara aprovação do SHA da spec.
- Caller de exemplo/piloto: eventos e credenciais explícitos, opt-in; sem ativação automática antes de preparar as permissões e Environment.

## Tech Decisions

Escolhida coordenação YAML com calleds Markdown. Alternativa call-workflow permite fan-out nativo, mas encaminha argumentos da LLM e dificulta vincular o modelo e o SHA real do PR de spec criado depois da inferência. O coordenador fixa esses valores após a publicação. Não usar dispatch assíncrono no caminho crítico para evitar perda do vínculo do run.

O gate deve proteger a entrada do implementador, inclusive chamadas diretas. Configurar Environment real com required reviewers; o workflow verifica a proteção e falha caso esteja ausente. Consumidores privados sem esse recurso não devem executar SDD até terem aprovação equivalente implementada.

## Risks & Concerns

- Ferramenta Projects V2/permissões depende do token do consumidor: retornar needs-human quando indisponível.
- OpenCode custom engine e detector precisam de compilação real; escrita não será liberada silenciosamente se detector não suportar o engine.
- Piloto anterior omitiu noop: resultado só é aceito se o terminal existir e o contrato JSON passar.
- Modelos fora do catálogo de preços AWF falham; o modelo gratuito do piloto tem preço zero explícito, nunca fallback global.
- Aprovação e base são estados externos: revalidar o PR e sua base depois da aprovação.
- Casos de corrida, dedup e loops serão observados no piloto; não alegar homologação só por compile.

## Validation

Compilação strict/validate e inspeção dos locks; piloto com issue/PR/push, rota direta, spec sem implementação, aprovação e revisão divergente. Sem novos testes de TS ou documentação.

## Ajustes comprovados durante compilação

- O schema não aceita outputs autorais em workflow_call Markdown; o coordenador lê o artifact terminal e usa o output nativo created_pr_number para a spec.
- O detector custom engine:false ainda gerou uma conclusão dependente de resultado inexistente. O MVP desativa esse detector e usa publication_gate nativo (patch, terminal e identidade), exigido explicitamente antes da escrita. Não simular veredito AI nem exigir credencial Copilot.
- Comentários HTML são removidos pelo sanitizador. A deduplicação usa marcador textual Agentic delivery no PR; retomada de implementação usa Re-run failed jobs do run original.
- O implementador lê a spec aprovada fora do checkout de produto e trabalha no base_sha para evitar misturar o PR documental no patch.
- OpenCode v2 fixado não recebe aliases #rapido/#ultra inventados; o caller seleciona IDs reais do provedor por perfil, inclusive sufixos suportados, e limites de turnos/tempo.
- Query GraphQL validada contra a issue7 real: campos da organização e item Projects disponíveis. Nenhum modelo ou publicador foi executado nessa consulta.
