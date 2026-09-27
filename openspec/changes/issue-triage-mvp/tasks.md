# Tasks

## 1. Contrato de triagem

- [ ] 1.1 Criar workflow reutilizável de triagem e caller de exemplo `issues.opened` com filtros de repositório privado e permissões mínimas; verificar sintaxe, chamada aninhada e origem inelegível.
- [ ] 1.2 Coletar metadados reais e consumir a decisão SDD da política global versionada no central, sem confundir Size/Estimate com complexidade; verificar Release MAJOR, Effort High/Team/Medium/Low, dados ausentes e milestone ambígua com fixtures.
- [ ] 1.3 Integrar o contrato da issue #9 para enviar contexto e consumir decisão, resumo e patch opcional; verificar interface com resultado simulado e sem secrets reais.

## 2. Resultados e entrega

- [ ] 2.1 Publicar comentário/SDD de planejamento com marcador estável; verificar que reexecução atualiza o registro sem duplicá-lo.
- [ ] 2.2 Validar patch, caminhos e escopo em ambiente sem credenciais antes de aplicar; verificar rejeição de arquivo proibido, patch inválido e alteração vazia.
- [ ] 2.3 Criar branch e PR para release ou base empilhada explícita, com `Refs` e revisão humana; verificar destino, vínculo da issue e ausência de auto-merge.
- [ ] 2.4 Serializar execuções por issue e recuperar PR existente; verificar que duas chamadas para a mesma revisão não criam PR duplicado.

## 3. Documentação e piloto

- [ ] 3.1 Documentar workflow, called de exemplo, metadados, rotas, valores admitidos, permissões e falhas; verificar que cada configuração e saída tem explicação.
- [ ] 3.2 Registrar o padrão de called reutilizável na documentação de CI/CD do repositório e a alteração necessária na skill global apropriada; verificar revisão do texto e localização confirmada antes de editar a skill fora deste change.
- [ ] 3.3 Rodar validação estática e testes sem credenciais das rotas e idempotência; verificar todos os cenários da delta spec.
- [ ] 3.4 Após a issue #9 estar operacional, executar piloto privado para uma issue de planejamento e uma correção simples; verificar comentário, PR e logs sem credenciais.
