# Triagem reutilizável de issues Specification

**Issue:** #7, `[PIPELINE] - Triagem das Issues`. **Status:** Especificação aprovada e implementação autorizada pelo mantenedor em 2026-10-14; design/tarefas devem cumprir seus gates TLC antes da execução.
**Base:** branch da issue #9, PR da central para `release/v1.0.0`. **Milestone:** v1.0.0; épica #3.

## Problem Statement

Novas issues precisam de análise consistente dos metadados, da necessidade de SDD e da base de entrega, sem repetir configuração de LLM em cada aplicação. A central da #9 já entrega executor e caller, mas seu contrato atual aceita somente `workflow_dispatch` na branch padrão e analisa essa branch. Triagem automática de issues e correções em uma release exigem uma adaptação explícita desse contrato, não apenas copiar o YAML.

A triagem será o primeiro consumidor real e responsável pelo piloto compartilhado LLM-24/T13, transferido da meta da #9 por solicitação do mantenedor. A entrega local da central está verificada; autenticação/inferência reais ainda não foram homologadas.

## Goals

- [ ] Oferecer workflow reutilizável de triagem, caller e configuração próprios do consumidor, reutilizando o executor da #9.
- [ ] Produzir planejamento rastreável ou proposta de correção por PR, sem merge automático.
- [ ] Validar necessidade de SDD e base Git Flow com metadados reais, não por conteúdo arbitrário da issue.
- [ ] Homologar a integração no piloto privado, incluindo sessão renovada, conflito, fila e recuperação.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Code review, comentários de review e diagnóstico de CI | Pertencem à #8 ou entregas posteriores; exemplos no body não definem o MVP |
| Harness, shell/plugins executados pela LLM | Central continua read-only e devolve proposta, não executa ações de domínio |
| Auth global, compartilhamento de sessão pessoal ou instalação automática de secrets | Identidade e provisionamento pertencem a cada consumidor |
| Merge/aprovação automática, fechamento da issue na abertura do PR | Revisão humana e Git Flow permanecem obrigatórios |
| SonarQube preventivo ou Request changes após merge | Fluxo corretivo da #5 permanece inalterado |
| Manual central extenso e testes de texto/documentação | T12 segue adiada; instruções completas do caller e testes contratuais permanecem |

## Necessidade de SDD

Consultar estado real: issue do tipo Feature no Project `GitHub Features` (12), Priority High, Size XL, Estimate 5 e Effort High. Status alterado de Prevented para In progress em 2026-10-14 por solicitação explícita do mantenedor, com leitura posterior confirmando a alteração. Bloqueios #9 e #5 preservados; entrega empilhada sem merge do PR da central. SDD é necessário: integração entre workflows, autenticação persistente, escrita GitHub e decisões sobre patches. Size/Estimate medem valor, não complexidade isolada. A dependência #5 não será removida por inferência; seu papel na habilitação do piloto será revisto no planejamento sem alterar o fluxo SonarQube.

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Primeiro piloto | Triagem será o consumidor real da #9; nenhuma execução real nesta fase | Transferência explícita do mantenedor | Sim |
| Gatilhos do MVP | `issues.opened` e `workflow_dispatch` com número da issue para recuperação/piloto | Preserva automação e permite homologação controlada, sem eventos acessórios | Proposto |
| Origem autorizada | Repositório privado não fork; autor da issue/operador com write, maintain ou admin confirmado via API | Issue body não autoriza consumo de credenciais ou publicação | Proposto |
| Rota simples | Apenas Bug/Task, Effort Low, Size XS/S, Estimate 1/2 coerentes, sem Release MAJOR/blocked-by aberto e base inequívoca | Evita tratar ausência de metadados como autorização automática | Proposto |
| Metadados ausentes/ambíguos | `needs-human`, sem patch/PR automático | Não inventar campos, vínculos ou privilégios | Proposto |
| Resultado de planejamento | Resumo SDD de triagem, não especificação TLC completa aprovada | O plano gerado é rascunho para revisão, não autorização de implementação | Proposto |
| Publicação da rota simples | PR draft até testes e revisão humana; erro de teste nunca libera aprovação/merge | Proposta gerada continua não confiável | Proposto |
| Repositório piloto | Escolha e credenciais pelo mantenedor antes da ativação; candidato Go CLI já mencionado não é seleção definitiva | Não provisionar nem selecionar remotamente por suposição | Pendente para ativação |
| Evolução do contrato central | Adaptação compatível para origem de issue e SHA de base validado; dispatch atual preservado | Central atual recusaria a integração direta | Proposto, revisar antes de código |

**Open questions:** none; decisões ainda não aprovadas estão registradas com defaults e justificativas acima. Seleção do piloto é uma condição explícita de ativação, não impedimento para revisar esta proposta.

## User Stories

### P1: Disparar triagem confiável e reutilizar a central

**User Story:** Como mantenedor, quero encaminhar uma issue elegível à central com configuração própria para reutilizar autenticação, modelos e prompts sem compartilhar identidade global.

**Acceptance Criteria:**

1. WHEN uma issue for aberta em consumidor elegível THEN a triagem SHALL iniciar exatamente uma execução lógica identificada por repositório e issue. (TRI-01)
2. WHEN o mantenedor disparar recuperação manual THEN a triagem SHALL consultar a issue pelo número no repositório corrente, sem aceitar body/metadados fornecidos como substitutos da API. (TRI-02)
3. IF a origem for pública, fork, PR, evento não permitido ou ator sem autorização THEN a triagem SHALL recusar a execução antes de materializar credenciais da LLM. (TRI-03)
4. WHEN a triagem invocar a central THEN o caller SHALL fornecer explicitamente modalidade, secrets próprios, modelo, esforço e template versionado; nenhuma autenticação SHALL ficar no repositório público central. (TRI-04)
5. WHEN contexto for preparado THEN a triagem SHALL tratar body como dado não confiável, limitar body UTF-8 a 16 KiB e contexto completo a 32 KiB, recusando excesso sem truncamento. (TRI-05)
6. WHEN a central receber a nova origem permitida THEN o adaptador SHALL validar evento real, workflow/configuração da branch padrão e repositório antes de aceitar a chamada, preservando as garantias do dispatch existente. (TRI-06)
7. WHEN uma base de release ou empilhamento for analisada THEN a integração SHALL vincular resultado ao SHA exato dessa base e registrar separadamente a revisão confiável de configuração, sem atribuir patch de outra revisão à base. (TRI-07)

**Independent Test:** Caller simulado chama a orquestração verdadeira; modelo/prompt próprios chegam à LLM falsa e origens inelegíveis não disponibilizam auth. Testar o adaptador de issue sem enfraquecer os testes existentes de dispatch.

### P1: Decidir necessidade de SDD e entregar resultado rastreável

**User Story:** Como mantenedor, quero diferenciar planejamento, proposta simples e intervenção humana com os nossos metadados, mantendo revisão e branch corretas.

**Acceptance Criteria:**

1. WHEN dados forem coletados THEN a triagem SHALL consultar tipo, milestone, épica, bloqueios e campos configurados do Project/organização e registrar sua origem, sem fabricar valores. (TRI-08)
2. IF Release for MAJOR, Effort High/Team ou metadados completos não habilitarem a rota simples definida em TRI-10 THEN a triagem SHALL selecionar planejamento SDD antes de qualquer proposta de correção. (TRI-09)
3. IF tipo for Bug/Task, Effort Low, Size XS/S e Estimate 1/2 coerentes, sem sinal obrigatório de SDD e sem bloqueio aberto THEN a triagem SHALL permitir rota de proposta simples somente com base inequívoca. (TRI-10)
4. IF o caso não satisfizer a rota simples nem tiver metadados completos THEN a triagem SHALL retornar `needs-human`, explicando as informações faltantes sem editar código. (TRI-11)
5. WHEN a rota for planejamento THEN a triagem SHALL publicar comentário identificado com contexto, necessidade de SDD, proposta, riscos e próximos passos, marcando-o como rascunho não aprovado e sem patch de código. (TRI-12)
6. WHEN a rota produzir patch THEN a triagem SHALL validar envelope, identidade, hashes, caminhos e aplicabilidade sobre o SHA de base antes de qualquer escrita remota. (TRI-13)
7. WHEN a base for resolvida THEN a triagem SHALL usar `release/<milestone>` existente ou empilhamento explícito na configuração confiável, nunca uma branch indicada pelo body da issue. (TRI-14)
8. WHEN um patch válido produzir alteração real THEN a triagem SHALL criar branch dedicada e PR draft para a base validada, vincular `Refs #N`, milestone e solicitar reviewer humano configurado sem fechar a issue. (TRI-15)
9. IF patch for vazio, proibido, inaplicável ou base tiver avançado THEN a triagem SHALL não publicar PR e registrar necessidade de nova análise. (TRI-16)
10. WHEN verificações do consumidor executarem código proposto THEN o job SHALL usar comandos da configuração confiável e não receber sessão Codex, PAT de secrets ou credenciais de escrita. (TRI-17)
11. IF verificação do consumidor falhar THEN o PR SHALL permanecer draft sem sinal de aprovação automática, com falha rastreável. (TRI-18)

**Independent Test:** Metadados reais simulados determinam as rotas; patch aceito gera PR na base correta e patch inválido não gera escrita. Testar efeito produzido, não apenas contagem de chamadas.

### P1: Recuperar sem duplicatas e homologar o piloto

**User Story:** Como mantenedor, quero executar novamente sem duplicar entregas e comprovar a integração com uma sessão real antes de ampliar adoção.

**Acceptance Criteria:**

1. WHILE a mesma issue estiver em execução THEN a triagem SHALL serializar publicação por repositório/issue e reutilizar comentário/PR identificados, sem sobrescrever modificações humanas. (TRI-19)
2. WHEN entrada mudar THEN a triagem SHALL revalidar hash do body/metadados e SHA da base antes de publicar; resultado antigo SHALL ser recusado com `STALE_TRIAGE_INPUT`. (TRI-20)
3. IF escrita GitHub falhar parcialmente THEN a recuperação SHALL consultar os recursos já criados pelo marcador antes de repetir operações, sem retry cego de criação ou inferência. (TRI-21)
4. IF modelo, autenticação, persistência ou publicação falhar THEN a triagem SHALL terminar com erro explícito sanitizado, sem perguntas interativas ou resultado falso de sucesso. (TRI-22)
5. WHEN um consumidor adotar a triagem THEN a entrega SHALL disponibilizar caller com eventos, inputs/secrets, modelos/prompts, permissões, campos, bases, resultados e recuperação documentados, sem testes de texto documental. (TRI-23)
6. WHEN o piloto for homologado THEN o mantenedor SHALL registrar duas execuções reais novas sequenciais da mesma integração, saída válida e ausência de secrets em logs/artefatos; refresh real SHALL ser demonstrado ou registrado como pendente, nunca simulado como evidência real. (TRI-24)
7. WHEN snapshot antigo ou conflito/falha de persistência for exercitado no piloto THEN a integração SHALL recusar resultado utilizável e demonstrar recuperação por nova execução/sessão atual, preservando LLM-09/11/12/24. (TRI-25)

**Independent Test:** Reexecução/erro parcial não duplica comentário/PR. Piloto real privado usa o mesmo caller entregue, não um workflow descartável; fixtures não satisfazem TRI-24/25.

## Edge Cases

- Issue fechada durante execução: revalidar estado e não publicar nova proposta automática (TRI-20).
- Metadados/Project inacessíveis: `needs-human` quando não for possível decidir; falha de autenticação/API não vira autorização (TRI-08/11/22).
- Size/Estimate contraditórios ou nome de campo inexistente: registrar ambiguidade, sem inferir complexidade por label solta (TRI-10/11).
- Timeout, cancelamento e snapshot renovado na fila: preservar políticas da central, sem ignorar conflitos ou usar auth pessoal (TRI-22/25).
- Branch/PR já criado e comentário faltante: recuperar recursos próprios por marcador, não repetir entrega nem forçar push (TRI-19/21).

## Implicit-Requirement Dimensions

| Dimension | Resolução |
| --- | --- |
| Input validation & bounds | TRI-03/05/13, limites centrais vigentes |
| Failure / partial-failure states | TRI-16/18/21/22 |
| Idempotency / retry / duplicate handling | TRI-19/20/21; chave issue + hash entrada/base para resultado, marcador estável issue para recursos |
| Auth boundaries & rate limits | TRI-03/04/17/22; sem fallback, 403/429 falham sem sucesso |
| Concurrency / ordering | TRI-19 e serialização de sessão existente na central |
| Data lifecycle / expiry | Retenção central de artefatos 1 dia; comentários/PRs são auditoria permanente, temporários removidos |
| Observability | TRI-12/15/22/24: vínculos e erros sanitizados, sem payload de auth |
| External-dependency failure | TRI-08/21/22/25; falha não vira rota simples |
| State-transition integrity | TRI-15/18/20: draft não equivale a Ready/Done; não editar status por suposição |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TRI-01 | Origem | Specify | Pending review |
| TRI-02 | Origem | Execute | Coleta implementada T2; integração workflow pendente |
| TRI-03 | Origem | Execute | Guard de coleta T2; integração central pendente |
| TRI-04 | Reuso | Execute | Central/configuração própria T3; caller de triagem pendente |
| TRI-05 | Contexto | Execute | Config/coleta T1/T2 implementadas; integração pendente |
| TRI-06 | Contrato central | Execute | Origem de issue/runner T3; workflow de domínio pendente |
| TRI-07 | Contrato central | Execute | SHAs separados/envelope v2 T3; inspector de consumidor pendente |
| TRI-08 | Metadados | Execute | Coleta/proveniência/paginação T2; validação final pendente |
| TRI-09 | SDD | Execute | Política implementada T1; integração pendente |
| TRI-10 | Rota simples | Execute | Política implementada T1; integração pendente |
| TRI-11 | Intervenção humana | Execute | Política implementada T1; publicação pendente |
| TRI-12 | Planejamento | Specify | Pending review |
| TRI-13 | Patch | Execute | Envelope/base/caminhos/aplicabilidade T3/T4; consumo/publicação pendentes |
| TRI-14 | Base | Execute | Candidato resolvido T1; consulta remota/publicação pendentes |
| TRI-15 | PR | Specify | Pending review |
| TRI-16 | Recusa | Execute | Preparação isolada recusa patch vazio/proibido/inaplicável T4; publicação pendente |
| TRI-17 | Verificações | Execute | Git sem secrets/hooks e sem executar produto T4; job de checks pendente T6 |
| TRI-18 | Verificações | Specify | Pending review |
| TRI-19 | Idempotência | Specify | Pending review |
| TRI-20 | Entrada atual | Specify | Pending review |
| TRI-21 | Recuperação | Specify | Pending review |
| TRI-22 | Falhas | Specify | Pending review |
| TRI-23 | Caller | Specify | Pending review |
| TRI-24 | Piloto | Specify | Pending review |
| TRI-25 | Piloto | Specify | Pending review |

**Coverage:** 25 requisitos definidos; design e tarefas dependem da revisão desta proposta. Nenhum requisito implementado ou homologado nesta fase.

## Success Criteria

- [ ] Um consumidor privado usa triagem → central com suas configurações e credenciais.
- [ ] Planejamento útil e correção simples por PR são demonstráveis sem merge/fechamento automático.
- [ ] Origens, entradas, patches e resultados divergentes são recusados com testes relevantes.
- [ ] TRI-24/25 comprovam o piloto real transferido da central.
- [ ] Verificação independente TLC confirma a entrega após implementação; aprovação desta spec não é evidência de execução.

## Fontes e compatibilidade

Body e metadados atuais da issue #7; diretrizes globais completas versionadas em `scripts/llm/instructions/AGENTS.md`; contrato atual `scripts/llm/preflight.mjs`, `result.mjs` e schema v1; caller da #9. Planejamento OpenSpec anterior é histórico, não contrato concorrente desta revisão TLC.

Context7 não está disponível nesta sessão; documentação primária GitHub foi consultada como fallback: [reuso e contexto do caller](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations), [workflows aninhados e permissões](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows). Não haverá passagem implícita de secrets nem elevação de permissões entre níveis.
