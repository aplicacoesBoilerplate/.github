# Piloto remoto gh-aw no próprio .github

**Status:** preparação autorizada em 2026-10-26 após o piloto local aprovado.

## Problem Statement

O piloto local comprovou OpenCode/OpenRouter com triagem e revisão, mas não validou o sandbox nem a compilação do gh-aw. Precisamos de workflows manuais revisáveis e reproduzíveis para começar essa homologação no próprio .github.

## Goals

- [ ] Gerar e compilar dois callers manuais com a configuração do consumidor existente.
- [ ] Manter credenciais fora do processo agente, com AWF ativo e permissões GitHub somente leitura.
- [ ] Preparar validação de integridade, artefatos, CI e instruções para o primeiro acionamento remoto.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Comentários, PRs, atualização de issues/Projects ou eventos automáticos | Primeiro piloto remoto valida transporte, isolamento e resultados controlados. |
| Scanner/MCP SonarQube, provedores adicionais e detector para publicação | Servidor em preparação; nenhuma publicação do agente habilitada nesta etapa. |
| Declarar sucesso remoto antes de uma execução real | Compilação e testes locais apenas deixam o piloto pronto. |
| Merge da entrega ou criação automática da secret pelo agente | Merge humano; usuário informou que ainda precisa cadastrar a secret. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Consumidor | aplicacoesBoilerplate/.github | Decisão explícita anterior do usuário | Sim |
| Modelo e provedor | JSON do consumidor já existente; OpenCode/OpenRouter | Continuação autorizada do piloto local | Sim |
| Credencial remota | Secret API_KEY_OPENROUTER cadastrada pelo usuário | Variável local não é enviada ao Actions; bot não tem administração de secrets | Sim, cadastro pendente |
| Primeiro acionamento | workflow_dispatch, somente leitura e artefatos | Permite homologar sem autorizar escrita por modelo | Default técnico comunicado |
| Engine | Sample gh-aw32ecafbc, com política nativa de ferramentas restringida localmente | Sample upstream permite escrita/shell por padrão | Default técnico |
| Compatibilidade | Família técnica openai com baseURL OpenRouter e Chat Completions | Adaptador upstream suporta essa rota via AWF; não representa troca para provedor OpenAI | Verificado na fonte |
| Detector | safe-outputs ausente por completo | Não há publicação para detectar; não desativar detector de fluxos com escrita | Verificado na fonte |
| Ambiente local | Compilação Windows; Docker daemon indisponível | Execução AWF/Linux permanece evidência remota futura | Verificado |

**Open questions:** none; defaults técnicos explícitos, cadastro e execução reais permanecem pendentes.

## User Stories

### P1: Preparar callers reproduzíveis

**Acceptance Criteria**:

1. WHEN o consumidor gerar workflows THEN o gerador SHALL preservar modelo, prompt, contexto e nome da credencial por processo, sem ler valores de autenticação. (ARP-01)
2. WHEN os workflows forem compilados THEN o compilador SHALL produzir locks com acionamento exclusivamente manual, contents read e sem jobs de escrita ou detector Copilot. (ARP-02)
3. WHILE o agente executar the engine SHALL usar a rota AWF OpenRouter/api/v1 com chave placeholder e política nativa que nega shell/escrita/acesso externo. (ARP-03)

**Independent Test:** executar o harness com fronteiras simuladas e inspecionar configurações efetivas; compilar com gh-aw fixado e conferir o grafo de jobs/credenciais.

### P1: Produzir evidência sem aprovar trabalho adulterado

**Acceptance Criteria**:

1. WHEN o runtime preparar a análise THEN o validador SHALL registrar SHA e hashes dos arquivos que correspondem ao contexto compilado. (ARP-04)
2. IF arquivos versionados, inputs ou estado do workspace mudarem durante a análise THEN o validador SHALL falhar antes de registrar integridade aprovada. (ARP-05)
3. WHEN a preparação terminar THEN a entrega SHALL incluir CI de reprodução, instruções da secret e do acionamento, e estado explícito de execução remota pendente até existir run real. (ARP-06)

**Independent Test:** executar guard em fixture Git e adulterar arquivo; conferir locks/artefatos e instruções concretas do primeiro run.

## Edge Cases

- IF o consumidor selecionar engine/provedor não homologado nesta rota THEN o gerador SHALL falhar sem fallback.
- IF conteúdo versionado tentar introduzir expressão Actions ou macro gh-aw na entrada do modelo THEN o gerador SHALL rejeitar a interpolação.
- IF uma secret estiver ausente ou o provedor limitar a inferência THEN o workflow SHALL falhar sem interpretar isso como análise aprovada.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ARP-01 | Callers | Execute | Pending |
| ARP-02 | Callers | Execute | Pending |
| ARP-03 | Callers | Execute | Pending |
| ARP-04 | Evidência | Execute | Pending |
| ARP-05 | Evidência | Execute | Pending |
| ARP-06 | Evidência | Execute | Pending |

## Success Criteria

- [ ] Locks compilados e verificados, sem desligar sandbox/firewall ou exigir chave Copilot.
- [ ] Contratos, integridade e regressões existentes aprovados com revisão independente.
- [ ] Primeiro teste remoto desbloqueável pelo cadastro da secret e integração/revisão humana necessária.

## Limites e falhas

Reutilizar limites do piloto local para contexto/diretrizes. Uma análise manual por workflow, timeout8min, max-turns4; serializar por consumidor. Sem retry/fallback adicional ao harness. Artefatos retidos por3dias. Não guardar chave em arquivo. Falha de provedor não é aprovação. Cadastro de secret e run remoto não são simulados. Sonar continua not-run.
