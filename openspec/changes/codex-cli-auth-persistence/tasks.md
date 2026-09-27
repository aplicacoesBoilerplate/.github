# Tasks

## 1. Contrato e validação

- [ ] 1.1 Criar workflow reutilizável com inputs, secrets e outputs explícitos; verificar sintaxe do workflow e correspondência com a delta spec.
- [ ] 1.2 Criar catálogo mínimo de templates e validação de template, modelo, esforço e parâmetros; verificar rejeição de valores inválidos em testes sem invocar o Codex.
- [ ] 1.3 Aplicar filtros de repositório privado e evento confiável antes de restaurar secrets; verificar em testes que fork, PR não confiável e contexto público falham sem execução.

## 2. Sessão e execução

- [ ] 2.1 Restaurar secret da sessão em diretório temporário restrito e executar Codex CLI não interativo em modo sem escrita; verificar com fixture falsa que nenhum segredo aparece em logs ou outputs.
- [ ] 2.2 Configurar grupo de concorrência por repositório com `queue: max` e sem cancelamento do job em andamento; verificar configuração e comportamento de duas chamadas no piloto.
- [ ] 2.3 Persistir a sessão atualizada na secret do próprio consumidor com chave pública e PAT fine-grained; verificar API simulada, criptografia, falhas de permissão e ausência de vazamento.
- [ ] 2.4 Fazer sucesso depender tanto da resposta válida quanto da persistência confirmada, com limpeza do diretório temporário; verificar matrizes de falha do Codex, autenticação e API em testes.

## 3. Adoção e validação

- [ ] 3.1 Documentar workflow central, valores admitidos e impacto das configurações, secrets, limites e recuperação; verificar que cada input/output possui descrição e exemplo.
- [ ] 3.2 Criar workflow consumidor privado de exemplo e documentação do caller, sem credenciais reais; verificar parsing e ausência de secrets versionadas.
- [ ] 3.3 Executar verificações estáticas e testes locais sem credenciais; verificar que o contrato e cenários negativos passam.
- [ ] 3.4 Quando houver repositório privado piloto e credenciais fornecidas pelo proprietário, executar duas chamadas sequenciais e uma falha controlada de escrita; verificar persistência entre jobs e logs sem segredos. Registrar essa etapa como pendente externa até o piloto existir.
