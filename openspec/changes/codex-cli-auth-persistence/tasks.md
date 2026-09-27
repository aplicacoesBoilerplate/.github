# Tasks

## 1. Contrato e validação

- [ ] 1.1 Criar workflow reutilizável com inputs, secrets e envelope de outputs explícitos; verificar sintaxe do workflow e correspondência com a delta spec.
- [ ] 1.2 Criar tabela de roteamento por tarefa/etapa, catálogo mínimo de templates e validação de modelo, esforço e parâmetros; verificar seleção e rejeição de valores inválidos em testes sem invocar o Codex.
- [ ] 1.3 Aplicar filtros de repositório privado e evento confiável antes de restaurar secrets; verificar em testes que fork, PR não confiável e contexto público falham sem execução.
- [ ] 1.4 Versionar cópia integral do `AGENTS.md` global fornecido pelo mantenedor e carregar o `AGENTS.md` da revisão-base confiável do consumidor; verificar equivalência da cópia aprovada, composição das fontes e rejeição do head não confiável.
- [ ] 1.5 Configurar limite de instruções suficiente para as duas camadas e falhar se excedido; verificar com fixtures que não ocorre truncamento silencioso e identificar referências a skills indisponíveis no runner.

## 2. Sessão e execução

- [ ] 2.1 Restaurar secret da sessão em diretório temporário restrito e executar Codex CLI não interativo em modo read-only; verificar com fixture falsa que nenhum segredo aparece em logs, outputs ou artefatos.
- [ ] 2.2 Produzir decisão/resultado estruturados e artefato de patch opcional sem modificar o checkout; verificar em teste que o caller consegue consumir outputs e artefato em job posterior.
- [ ] 2.3 Configurar grupo de concorrência por repositório com `queue: max` e sem cancelamento do job em andamento; verificar configuração e comportamento de duas chamadas no piloto.
- [ ] 2.4 Persistir a sessão atualizada na secret do próprio consumidor com chave pública e PAT fine-grained; verificar API simulada, criptografia, falhas de permissão e ausência de vazamento.
- [ ] 2.5 Fazer sucesso depender tanto da resposta válida quanto da persistência confirmada, com limpeza do diretório temporário; verificar matrizes de falha do Codex, autenticação e API em testes.

## 3. Adoção e validação

- [ ] 3.1 Documentar workflow central, roteamento, valores admitidos e impacto das configurações, secrets, limites, outputs/artefato e recuperação; verificar que cada input/output possui descrição e exemplo.
- [ ] 3.2 Documentar origem, sincronização versionada, precedência e limite das diretrizes globais e do consumidor, deixando explícito que alterações na máquina pessoal não se propagam automaticamente; verificar exemplo de `AGENTS.md` do consumidor.
- [ ] 3.3 Criar workflow consumidor privado de exemplo e documentação do caller, sem credenciais reais; verificar parsing e ausência de secrets versionadas.
- [ ] 3.4 Executar verificações estáticas e testes locais sem credenciais; verificar que o contrato e cenários negativos passam.
- [ ] 3.5 Quando houver repositório privado piloto e credenciais fornecidas pelo proprietário, executar duas chamadas sequenciais e uma falha controlada de escrita; verificar persistência entre jobs e logs sem segredos. Registrar essa etapa como pendente externa até o piloto existir.
