# Tasks

## 1. Contrato do caller

- [ ] 1.1 Criar workflow reutilizável de review e caller de exemplo para PR aberto, sincronizado ou reaberto, sem filtro de branch de negócio; verificar sintaxe, chamada aninhada e cenários de feature/integração/fork/bot.
- [ ] 1.2 Capturar diff e head SHA com limite explícito, usando instruções globais versionadas e `AGENTS.md` da revisão-base; verificar que PR grande vira inconclusivo e que `AGENTS.md` alterado no head não vira política.
- [ ] 1.3 Integrar o contrato da issue #9 para enviar contexto e consumir achados/patch opcional; verificar com fixtures sem autenticação real.

## 2. Publicação e correção

- [ ] 2.1 Validar achados contra arquivo/linha do diff e publicar resumo automático vinculado ao SHA; verificar achado crítico, ausência de achados e referência inválida.
- [ ] 2.2 Implementar idempotência por PR e head SHA e ignorar PR complementar criado pelo bot; verificar reexecução sem comentário/PR duplicado ou loop.
- [ ] 2.3 Validar patch e escopo em job sem secrets; verificar rejeição de caminho proibido, patch vazio e head SHA obsoleto.
- [ ] 2.4 Criar branch e PR complementar para branch head de feature elegível, sem push direto no PR original; verificar vínculo, revisão humana e ausência de auto-merge.
- [ ] 2.5 Garantir que PR de integração gere somente achados, sem correção automática; verificar release→develop e develop→master com fixtures.

## 3. Documentação e validação

- [ ] 3.1 Documentar called, eventos, configurações, decisões, outputs, origem das diretrizes, permissões e relação com triagem/SonarQube; verificar que cada opção tem efeito descrito.
- [ ] 3.2 Rodar validação estática e testes de contrato/segurança sem secrets; verificar cenários da delta spec e ausência de acionamento Sonar pré-merge ou alteração Project por Quality Gate.
- [ ] 3.3 Após homologação das issues #9 e #7, executar piloto privado com PR de feature e PR de integração; verificar comentários, PR complementar, idempotência e revisão humana.
