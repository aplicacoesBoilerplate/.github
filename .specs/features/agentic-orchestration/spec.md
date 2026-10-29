# Triagem unificada com GitHub Agentic Workflows

**Estado:** proposta para revisão. **Issue:** #7. **Profundidade:** complexa, por envolver múltiplos consumidores, credenciais, publicação e aprovação persistente.

## Problem Statement

O piloto existente analisa entradas controladas em dois workflows de leitura. Ainda não entrega uma triagem reutilizável de eventos reais com metadados, perfis por consumidor e encaminhamento para execução direta ou SDD. A evolução deve usar os mecanismos nativos do gh-aw com OpenCode, preservando contexto, autorização e rastreabilidade entre etapas.

## Goals

- [ ] Definir a entrada única e o resultado de triagem para issues, PRs e push.
- [ ] Separar evento/ação, perfil de inferência, capacidades e necessidade de SDD.
- [ ] Compartilhar configuração sem compartilhar credenciais entre consumidores.
- [ ] Encaminhar somente para workers conhecidos, com aprovação antes da implementação SDD.
- [ ] Homologar uma fatia real no próprio .github antes de anunciar adoção entre repositórios.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Copiar os YAMLs/modelos de exemplo literalmente | O usuário definiu que são referências de intenção |
| Criar outro executor/roteador TypeScript por padrão | Usar Markdown, imports, ferramentas e safe outputs nativos primeiro |
| Implementar integralmente code review e correções de push nesta primeira entrega de triagem | Nesta etapa são contratos de entrada/encaminhamento; workers terão entregas próprias |
| Instalar plugin SonarQube ou configurar servidor | Compatibilidade e infraestrutura ainda em estudo |
| Autoaprovação, merge e deploy autônomos | Autonomia autorizada é para analisar/corrigir e propor entregas |
| Autenticação Codex/auth.json ou credencial central compartilhada | Harness escolhido é OpenCode; autenticação pertence ao consumidor |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Harness e formato | OpenCode; Markdown/frontmatter compilado pelo gh-aw | Decisão expressa do usuário | Sim |
| Autonomia | Correções elegíveis nos três eventos, entregues por PR | Confirmação do usuário; preservar Git Flow | Sim |
| Provedor inicial | OpenRouter, sem fixar os modelos dos exemplos | Continuidade do recurso disponível; catálogo pertence ao consumidor | Proposta técnica |
| Seleção de projeto | Identificador configurado pelo consumidor; ambiguidade exige needs-human | Evitar campos conflitantes entre Projects | Proposta técnica |
| Falta de metadados/permissões | needs-human, sem escrita de código ou worker implementador | Não inventar dados de planejamento | Proposta técnica |
| Gate SDD | Aprovação sobre artefato e revisão exatos antes do worker | Evitar implementar conteúdo diferente do aprovado | Intenção confirmada; mecanismo no design |
| Consumidores privados | Gate nativo suportado pelo plano ou fluxo equivalente baseado em revisão humana verificável | Required reviewers de Environment não estão disponíveis em todos os planos/visibilidades | Proposta técnica a validar no design |
| Delegação | Workers de allowlist compilada, sem escolha livre de workflow/ref pela LLM | Compatibilidade e limite de autoridade | Proposta técnica a validar no design |
| Primeiro piloto | Próprio .github, caso real de issue com metadados | Consumidor confirmado anteriormente | Sim |
| Migração | Preservar histórico e substituir componentes antigos após validar equivalência | Substituição autorizada sem perda de trabalho | Sim |

**Open questions:** none no contrato funcional desta proposta; mecanismos de delegação entre repositórios, gate privado e ferramentas Projects V2 serão comprovados no design sob os defaults registrados acima. Nenhum mecanismo ainda não comprovado é tratado como disponível.

## User Stories

### P1: Consumidor aciona triagem contextual

**Acceptance Criteria**:

1. WHEN um caller autorizado receber issues, pull_request ou push THEN a entrada SHALL preservar repositório, tipo/ação do evento, ator, revisão de configuração e SHA analisado. (AOR-01)
2. WHEN o evento identificar uma issue ou PR THEN o agente SHALL consultar seus metadados reais no projeto configurado e registrar os valores disponíveis, distinguindo tipo, campos da organização e campos Projects V2. (AOR-02)
3. IF houver metadados necessários ausentes, projeto ambíguo ou permissão insuficiente THEN a triagem SHALL retornar needs-human com as lacunas, sem autorizar implementação. (AOR-03)
4. WHEN push não possuir issue/PR inequivocamente associado THEN a triagem SHALL preservar essa ausência sem inventar milestone, épica ou branch-base. (AOR-04)

**Independent Test:** acionar a entrada com issue completa, issue incompleta, PR e push sem vínculo; conferir identidade, valores consultados e bloqueio de encaminhamento indevido.

### P1: Escolher ação e perfil sem ampliar autoridade

**Acceptance Criteria**:

1. WHEN a triagem concluir THEN o resultado SHALL conter status, ação proposta, tier, perfil resolvido, necessidade de SDD, justificativa e lacunas, vinculados ao evento e ao SHA. (AOR-05)
2. WHEN um processo selecionar um perfil THEN a execução SHALL usar modelo, variante, limites e orçamento definidos pelo consumidor para esse perfil. (AOR-06)
3. IF diretrizes ou metadados exigirem SDD THEN a triagem SHALL escolher a rota de especificação independentemente do tier sugerido. (AOR-07)
4. IF modelo, perfil, workflow ou capacidade não pertencerem ao catálogo permitido THEN o encaminhamento SHALL falhar sem fallback silencioso. (AOR-08)

**Independent Test:** configurar perfis distintos e verificar a seleção efetiva; tentativa de escapar do catálogo e classificação low com SDD obrigatório devem impedir rota direta.

### P1: Encaminhar para execução direta ou especificação

**Acceptance Criteria**:

1. WHEN uma demanda elegível não exigir SDD THEN a entrada SHALL encaminhar no máximo uma vez ao worker direto permitido para a ação do evento. (AOR-09)
2. WHEN uma demanda exigir SDD THEN a entrada SHALL encaminhar ao worker de especificação sem iniciar implementação de código de produção. (AOR-10)
3. WHILE a especificação não tiver aprovação humana válida the workflow SHALL impedir o início do worker implementador SDD. (AOR-11)
4. IF a spec, a configuração ou a base divergirem da identidade aprovada THEN o workflow SHALL recusar implementar sob a aprovação antiga. (AOR-12)

**Independent Test:** observar o grafo de execução e os artefatos: rota direta única, rota SDD sem código, gate pendente e rejeição de revisão alterada.

### P1: Operar com isolamento e evidência

**Acceptance Criteria**:

1. WHEN um consumidor invocar a central THEN a execução SHALL receber somente credenciais explicitamente fornecidas por esse consumidor. (AOR-13)
2. WHILE o agente executar the workflow SHALL manter permissões e ferramentas restritas ao papel, separando edição local de patch das credenciais de publicação. (AOR-14)
3. IF houver falha do modelo, saída contratual inválida ou terminal obrigatório ausente THEN o workflow SHALL falhar sem publicar sucesso ou acionar o próximo worker. (AOR-15)
4. WHEN uma execução for repetida ou receber evento gerado pelo próprio agente THEN o fluxo SHALL impedir duplicação da mesma entrega e correções recursivas além do limite configurado. (AOR-16)
5. WHEN a entrega inicial for validada THEN o repositório SHALL incluir fontes Markdown, locks reproduzíveis, perfis compartilhados, caller de exemplo e instruções de configuração e diagnóstico. (AOR-17)

**Independent Test:** simular credencial ausente, saída inválida, falta de terminal e repetição; compilar os locks reais e executar um piloto autorizado, conferindo resposta, encaminhamento e resultado completo.

## Edge Cases

- IF dados de issue, PR ou código contiverem instruções para alterar credenciais ou política THEN o agente SHALL tratá-los como dados não confiáveis, sem substituir configuração autorizada.
- IF a base ou o head mudar antes da publicação THEN o worker SHALL recusar publicar a proposta antiga.
- IF um worker configurado ainda não estiver disponível THEN a triagem SHALL registrar encaminhamento indisponível, sem simular execução concluída.
- IF o Sonar estiver desabilitado ou indisponível THEN o resultado SHALL distinguir not-run/inconclusivo de Quality Gate aprovado.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AOR-01 | Entrada | Specify | Pending review |
| AOR-02 | Entrada | Specify | Pending review |
| AOR-03 | Entrada | Specify | Pending review |
| AOR-04 | Entrada | Specify | Pending review |
| AOR-05 | Decisão | Specify | Pending review |
| AOR-06 | Decisão | Specify | Pending review |
| AOR-07 | Decisão | Specify | Pending review |
| AOR-08 | Decisão | Specify | Pending review |
| AOR-09 | Encaminhamento | Specify | Pending review |
| AOR-10 | Encaminhamento | Specify | Pending review |
| AOR-11 | Encaminhamento | Specify | Pending review |
| AOR-12 | Encaminhamento | Specify | Pending review |
| AOR-13 | Operação | Specify | Pending review |
| AOR-14 | Operação | Specify | Pending review |
| AOR-15 | Operação | Specify | Pending review |
| AOR-16 | Operação | Specify | Pending review |
| AOR-17 | Operação | Specify | Pending review |

## Success Criteria

- [ ] Entrada nativa compilável e reutilizável, sem exigir um executor paralelo TypeScript.
- [ ] Metadados reais influenciam decisões sem permitir ignorar SDD ou inventar autorização.
- [ ] Rotas e gates demonstrados com revisão/SHA corretos; nenhum worker implementador começa antes da aprovação exigida.
- [ ] Piloto real concluído com terminal e evidências, não apenas resposta textual.
- [ ] Testes e revisão independente comprovam os contratos e falhas relevantes, sem metas de quantidade ou testes de prosa.

## Fronteira SonarQube

Análise de branch/PR é futura integração condicionada à compatibilidade do servidor/plugin e à identidade do commit. Complementa o code review. O fluxo aprovado após merge em develop permanece: falha bloqueia master, mantém épica Done e gera Hotfix On hold na mesma milestone. Nenhuma instalação ou mudança de servidor faz parte desta especificação inicial de triagem.
