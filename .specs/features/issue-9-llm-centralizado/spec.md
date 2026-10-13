# Pipeline reutilizável de LLM Specification

**Status:** Aprovado; implementação autorizada pelo mantenedor. **Issue:** #9. **Data:** 2026-10-12.
**Escopo desta iteração:** MVP local sequencial, com verificações contratuais e por impacto. Manual central extenso e testes documentais adiados pelo mantenedor em 2026-10-13; caller recebe instruções completas de configuração e consumo. Piloto e publicação dependem de provisionamento do consumidor.

## Problem Statement

Triagem e code review precisam acionar LLMs sem duplicar instalação, validação, execução e tratamento de resultados. O consumidor precisa controlar suas escolhas de modelo e autenticação. Uma sessão global compartilhada comprometeria isolamento, concorrência e autonomia das aplicações.

## Goals

- [ ] Um workflow central invocável por dois consumidores com configurações distintas e sem modificar o central.
- [ ] Credenciais, conta, política de invocação e recuperação sob responsabilidade de cada caller.
- [ ] Resultado estruturado rastreável ao repositório, SHA, configuração e revisão da automação.
- [ ] Scripts, dependências fixadas, exemplos e documentação com cenários verificáveis.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Cofre, conta ou sessão global para consumidores | Contraria a decisão do usuário |
| Aplicar patch, criar PR, fazer merge, comentar ou alterar Project | Responsabilidade de #7/#8 e dos callers |
| Login humano automático ou OAuth refresh implementado à mão | Renovação pertence ao Codex; recuperação pode exigir mantenedor |
| Provedores além de Codex e endpoints livres | MVP de um adaptador; evita framework sem consumidor validado |
| Manual central extenso e testes documentais | Mantenedor definirá formato após as issues atuais; instruções completas do caller permanecem no MVP |
| Faturamento API imposto ou fallback entre contas | O piloto usa a assinatura existente |
| Execução de scripts do repo com tokens presentes | Fora da fronteira de confiança do MVP |
| Garantia de exatamente uma cobrança por rerun | O provedor não oferece essa garantia neste contrato |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Configuração de invocação | Caller escolhe modo, modelos, esforço, template e auth explicitamente | Autonomia exigida pelo usuário | Sim |
| Credenciais | Somente secrets do próprio repositório consumidor, mapeadas nominalmente | Impede identidade central compartilhada | Sim |
| Adaptador genérico de autenticação | Central materializa credencial temporária fornecida pelo caller | Workflow chamado possui job próprio | Proposta |
| Auth do piloto | `chatgpt-session`, consumidor privado confiável, PAT próprio | Mantém decisão anterior sem cobrança separada | Sim; elegibilidade técnica requer piloto |
| API key | Opção explícita adicional, sem uso automático | Permite consumidor independente que já a possua | Proposta |
| Sessão antiga na fila | Recusar antes do CLI e exigir nova execução, sem prometer refresh de secrets pela API | REST não devolve plaintext e snapshots são antecipados | Proposta |
| Eventos do primeiro piloto | `workflow_dispatch` na branch padrão | Primeiro contrato verificável, triggers de domínio pertencem a #7/#8 | Proposta |
| Limites | 32 KiB de contexto, 64 KiB de instruções, 1 MiB de snapshot de arquivos, 1 MiB de resposta, 10 minutos de CLI | Dados de código substituem execução de ferramentas do consumidor; excesso falha sem truncamento | Confirmado para MVP; compatibilidade real no piloto |
| Dependências | Node 22, um adaptador Codex, versões exatas resolvidas e fixadas na implementação | Reutiliza stack de testes existente sem adotar latest | Proposta |
| Novos ciclos TLC | Todos os artefatos Draft entregues juntos para revisão | Usuário solicitou especificação completa nesta iteração | Sim |

**Open questions:** none — decisões não confirmadas estão explicitamente registradas como propostas nesta tabela; não equivalem à aprovação do piloto.

## User Stories

### P1: Configurar o acionamento no caller

**User Story:** Como mantenedor, quero escolher como minha aplicação chama Codex sem editar a automação compartilhada.

**Acceptance Criteria**:
1. WHEN um caller válido fornecer `config_path` e `context_json` THEN o workflow SHALL carregar a configuração e, se definido, o arquivo `template_path` da revisão confiável desse consumidor e enviar o prompt escolhido à LLM. (LLM-01)
2. IF modo, modelo, esforço, template, caminho ou limite forem inválidos THEN o workflow SHALL falhar com `INVALID_CONFIG` antes de disponibilizar credenciais ao CLI. (LLM-02)
3. WHEN `single` for selecionado THEN o executor SHALL realizar exatamente uma invocação de prompt. (LLM-03)
4. WHEN `decision-then-prompt` produzir decisão `proceed` válida THEN o executor SHALL realizar uma segunda invocação com o prompt configurado pelo caller. (LLM-04)
5. WHEN a decisão for `skip` ou `needs-human` THEN o executor SHALL encerrar sem segunda invocação com o mesmo estado de decisão. (LLM-05)

**Independent Test:** Dois consumidores sintéticos selecionam modelos e templates diferentes; a mesma revisão central respeita ambos. CLI falso registra zero, uma ou duas chamadas conforme o caso.

### P1: Executar com credenciais isoladas por consumidor

**User Story:** Como proprietário, quero controlar o acesso da minha aplicação sem disponibilizar uma identidade global.

**Acceptance Criteria**:
1. The workflow SHALL usar somente credenciais explicitamente fornecidas pelo caller para a modalidade selecionada. (LLM-06)
2. IF a modalidade selecionada não tiver a credencial requerida ou houver credenciais de modalidades conflitantes THEN o workflow SHALL falhar com `AUTH_CONFIG_ERROR` sem fallback. (LLM-07)
3. WHILE uma sessão ChatGPT estiver em uso THEN o workflow SHALL manter exclusão mútua por repositório e nome de secret, com `cancel-in-progress: false`. (LLM-08)
4. IF o timestamp de atualização da secret não for estritamente anterior à criação da execução THEN o workflow SHALL recusar o snapshot com `AUTH_SNAPSHOT_STALE` antes de invocar Codex. (LLM-09)
5. WHEN Codex alterar uma sessão válida THEN o adaptador SHALL persistir o novo conteúdo somente na secret nomeada do repositório corrente com o PAT desse consumidor. (LLM-10)
6. IF a persistência falhar ou a secret mudar externamente durante o job THEN o workflow SHALL terminar como falha de autenticação persistente, sem liberar resultado utilizável. (LLM-11)
7. WHEN o job terminar normalmente ou por erro tratável THEN o executor SHALL remover os diretórios temporários de credenciais. (LLM-12)

**Independent Test:** Dois repositórios fictícios usam tokens diferentes; a API simulada rejeita qualquer operação fora do repositório corrente. Fixtures cobrem fila, refresh, falha de escrita, sessão inalterada e limpeza.

### P1: Conter autoridade e compor diretrizes

**User Story:** Como mantenedor, quero reutilizar minhas regras e obter propostas sem conceder escrita à LLM.

**Acceptance Criteria**:
1. IF a chamada vier de fork, evento não permitido, revisão de workflow não confiável ou repositório público usando sessão ChatGPT THEN o preflight SHALL recusá-la com `UNTRUSTED_CONTEXT`. (LLM-13)
2. The executor SHALL rodar Codex com checkout de leitura, sem tokens de escrita GitHub no ambiente do processo do modelo. (LLM-14)
3. WHEN preparar as instruções THEN o executor SHALL combinar o AGENTS.md global integral versionado com as instruções da revisão confiável do consumidor, registrando os hashes das fontes. (LLM-15)
4. IF instruções ultrapassarem 64 KiB ou referenciarem arquivos fora das raízes permitidas THEN o preflight SHALL falhar com `INSTRUCTIONS_INVALID`, sem truncamento silencioso. (LLM-16)

**Independent Test:** Fixtures com AGENTS aninhado, override, symlink externo, alteração hostil no contexto e excesso de tamanho validam limites antes da chamada.

### P1: Consumir um resultado verificável

**User Story:** Como pipeline de triagem/review, quero receber resultado e proposta de patch sem compartilhar o filesystem do executor.

**Acceptance Criteria**:
1. WHEN uma resposta válida for concluída THEN o workflow SHALL publicar um envelope v1 com estado, decisão, repositório, SHA de fonte, SHA da automação, hash da configuração e nome de artefato distinto por run, tentativa e `invocation_id` do caller. (LLM-17)
2. IF a resposta violar o schema ou exceder 1 MiB THEN o workflow SHALL falhar com `INVALID_RESULT` sem artefato de sucesso. (LLM-18)
3. WHEN houver patch proposto THEN o workflow SHALL entregá-lo apenas como dado vinculado ao SHA de fonte, mantendo o checkout sem alterações. (LLM-19)
4. IF houver timeout de 600 segundos ou erro do provedor THEN o executor SHALL falhar com `TIMEOUT` ou `PROVIDER_ERROR`, sem repetição automática do prompt. (LLM-20)
5. The workflow SHALL publicar somente arquivos explicitamente permitidos de resultado, com retenção de um dia e sem credenciais ou logs brutos do CLI. (LLM-21)

**Independent Test:** CLI falso devolve JSON válido, inválido, excessivo, patch e timeout; job consumidor valida envelope e identidade antes de considerar o resultado.

### P1: Adotar e manter o contrato

**User Story:** Como consumidor, quero exemplos, dependências e recuperação documentados para configurar minha própria execução.

**Acceptance Criteria**:
1. The entrega SHALL incluir workflow central, scripts auxiliares, dependências fixadas e instruções completas do caller sobre configuração, credenciais, modelos/modos, consumo de resultados e recuperação; o manual central extenso será entregue posteriormente. (LLM-22)
2. The entrega SHALL incluir caller de exemplo para sessão ChatGPT e variação opt-in de API key com configuração pertencente ao consumidor. (LLM-23)
3. WHEN validar o piloto privado THEN a homologação SHALL registrar duas execuções sequenciais e cenários de snapshot antigo e persistência recusada, sem registrar valores de secrets. (LLM-24)

**Independent Test:** Mantenedor configura um piloto privado usando somente a documentação e executa a matriz; teste offline valida os mesmos contratos sem LLM real.

## Edge Cases

- Configuração ausente, path traversal, symlink, modelo desconhecido e template de PR: LLM-02/13/16.
- Sessão copiada entre máquinas, expirada, revogada ou malformed: LLM-07/09/11; recuperação humana documentada.
- Cancelamento forçado ou runner perdido depois do refresh: LLM-11/12; limpeza em best effort, resultado não utilizável, verificar/reprovisionar sessão.
- Resposta `skip` é sucesso técnico sem autorização para alterar código: LLM-05/17.
- Rerun preserva run_id e incrementa run_attempt; pode gerar nova resposta/custo: LLM-17/20. Consumidor deduplica ações por recurso e SHA, separadamente da identidade da tentativa.
- Duas chamadas no mesmo run usam `invocation_id` distintos; colisão de nome de artefato falha sem overwrite: LLM-02/17/21.
- Falha de upload torna o resultado indisponível; consumidor exige sucesso do job e artefato correspondente: LLM-17/21.

## Implicit Requirements Sweep

| Dimension | Coverage |
| --- | --- |
| Input validation & bounds | LLM-02/16/18; schema fechado, limites em bytes |
| Failure / partial-failure states | LLM-07/11/12/18/20 |
| Idempotency / retry / duplicate handling | LLM-10/17/20; nenhuma ação de domínio no central |
| Auth boundaries & rate limits | LLM-06/07/13/14; 429 falha explícita, sem fallback |
| Concurrency / ordering | LLM-08/09/11; lock único por sessão |
| Data lifecycle / expiry | LLM-12/21; um dia de retenção, sem cache de credencial |
| Observability | LLM-17/21; códigos de erro e hashes públicos |
| External-dependency failure | LLM-11/20/24 |
| State-transition integrity | LLM-03/04/05/17; falha não vira decisão favorável |

## Requirement Traceability

| Requirement ID | Story | Phase | Status | Tasks |
| --- | --- | --- | --- | --- |
| LLM-01 | Caller | Execute | Implemented: T1/T7/T9; final verification pending | T1, T7, T9 |
| LLM-02 | Caller | Execute | Implemented: T1/T2; final verification pending | T1, T2 |
| LLM-03 | Caller | Execute | Implemented: T7; final verification pending | T7 |
| LLM-04 | Caller | Execute | Implemented: T7; final verification pending | T7 |
| LLM-05 | Caller | Execute | Implemented: T7; final verification pending | T7 |
| LLM-06 | Auth | Execute | Implemented: T4/T9; final verification pending | T4, T9 |
| LLM-07 | Auth | Execute | Implemented: T4; final verification pending | T4 |
| LLM-08 | Auth | Execute | Implemented: T9; final verification pending | T9 |
| LLM-09 | Auth | Execute | Implemented: T5; final verification pending | T5 |
| LLM-10 | Auth | Execute | Implemented: T6; final verification pending | T6 |
| LLM-11 | Auth | Execute | Implemented: T6/T9; final verification pending | T6, T9 |
| LLM-12 | Auth | Execute | Implemented: T4/T9; final verification pending | T4, T9 |
| LLM-13 | Segurança | Execute | Implemented: T2/T9; final verification pending | T2, T9 |
| LLM-14 | Segurança | Execute | Implemented: T7/T9; final verification pending | T7, T9 |
| LLM-15 | Diretrizes | Execute | Implemented: T3; final verification pending | T3 |
| LLM-16 | Diretrizes | Execute | Implemented: T3; final verification pending | T3 |
| LLM-17 | Resultado | Execute | Implemented: T8/T9; final verification pending | T8, T9 |
| LLM-18 | Resultado | Execute | Implemented: T8; final verification pending | T8 |
| LLM-19 | Resultado | Execute | Implemented: T7/T8; final verification pending | T7, T8 |
| LLM-20 | Resultado | Execute | Implemented: T7; final verification pending | T7 |
| LLM-21 | Resultado | Execute | Implemented: T8/T9; final verification pending | T8, T9 |
| LLM-22 | Adoção | Execute | Partial: T10 complete; extensive manual deferred | T10, T11; T12 deferred |
| LLM-23 | Adoção | Design | In Tasks | T11 |
| LLM-24 | Piloto | Design | In Tasks | T13 |

**Coverage:** 24 total, 24 mapped to tasks, 0 unmapped. Verificação final depende das evidências do piloto e do Verifier independente.

## Success Criteria

- [ ] Dois consumidores usam a mesma revisão central com configuração e credenciais próprias.
- [ ] Testes negativos impedem invocação indevida, resultado inválido e escrita cruzada de secrets.
- [ ] Piloto comprova funcionamento e recuperação; testes simulados não substituem essa evidência.
- [ ] Verificação independente TLC conclui a implementação contra estes critérios e registra evidência.
