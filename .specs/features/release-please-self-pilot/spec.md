# Piloto do Release Please no próprio repositório das pipelines

**Data:** 2026-10-23  
**Issue:** [Versionamento por sprint](https://github.com/aplicacoesBoilerplate/.github/issues/4)  
**Base examinada:** `master`, commit `e05a76af07096e2cc4350af02896a68b11386bd5`.  
**Status:** Execução aprovada. Autorizados commits e push da branch de teste e execução no runner do GitHub Actions. Merge em master, tag, Release e alterações de secrets/proteções continuam fora da autorização.

## Problem Statement

A nova master centraliza o versionamento no Release Please. Sua CI passa sete testes que executam o gerador de configuração e conferem declarações do workflow. Essa evidência não demonstra a execução da Action, a abertura de um PR de release ou a publicação de uma tag.

O próprio `aplicacoesBoilerplate/.github` será o primeiro consumidor da pipeline central. Isso permite validar o ciclo real de release das pipelines sem publicar pacotes npm, Maven ou binários Go e sem modificar aplicações externas.

## Goals

- [x] Preparar um caller de teste do próprio repositório que reutilize a CI e exercite o contrato do workflow central disponível aos demais projetos.
- [x] Disponibilizar o modo nativo `simple` do Release Please para atualizar `version.txt` e `CHANGELOG.md`, sem distribuição de pacotes.
- [x] Cobrir localmente os caminhos reais de checkout, a configuração efetivamente entregue à Action e os limites de escrita.
- [x] Definir um roteiro verificável para o ciclo PR funcional, PR de release, merge humano, tag e GitHub Release.
- [x] Executar o mesmo teste funcional no runner hospedado, distinguindo essa evidência da publicação real de PR/tag/Release, ainda pendente.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Merge, PR de release, tag ou Release nesta iteração | O usuário autorizou somente publicar a branch de teste e executar o teste no Actions. A prova de publicação real exige autorização posterior. |
| Publicação npm, Maven, GoReleaser ou containers neste piloto | A entrega versionada é o conjunto de pipelines, não um pacote de aplicação. |
| Alterar boilerplate-cli, PackagesJava ou outros consumidores | O primeiro piloto será este repositório. Particularidades de linguagem ficam para depois. |
| Corrigir GitHub Pages ou adquirir plano pago | A falha da documentação foi explicitamente separada do versionamento. |
| Retomar os adaptadores anteriores ao Release Please | A proposta segue a nova master. O trabalho anterior permanece preservado em seu histórico e worktree. |
| Homologação em develop, override auditável e automerge | Não são necessários para comprovar este piloto. Não serão apresentados como recursos entregues. |
| Criar App, PAT, secrets ou regras de proteção | Requisitos externos serão documentados e conferidos antes do piloto, sem alterá-los automaticamente. |
| Encerrar a issue de versionamento | A aprovação deste piloto não comprova os consumidores Go, Java e Node nem encerra a issue inteira. |
| Governança de milestones e conflitos | Verificar 100% de conclusão, fechar milestones, restringir abertura de PR e criar guardas avançadas ficam para versão futura, por decisão do usuário. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Primeiro consumidor | O próprio `aplicacoesBoilerplate/.github` | Decisão expressa do usuário; evita depender agora de outra aplicação. | Sim, conversa |
| Limite operacional atual | Arquivos e commits locais, push da branch de teste e execução no Actions; nenhum merge, tag ou Release | O usuário ampliou expressamente a autorização para testar no runner hospedado. | Sim, conversa |
| Motor de versão | Somente Release Please | Preserva a mudança de abordagem adotada na master. | Sim, conversa |
| Estratégia do piloto | `simple`, com `version.txt` e `CHANGELOG.md` | Não exige transformar este repositório em um pacote npm. | Proposta técnica para conferência |
| Milestone na preparação do PR de release | Exigir milestone válida no PR funcional de origem, inclusive hotfix, usando sua versão exata como `release-as` | A entrega que alimenta a criação ou atualização do PR de release não é aceita sem milestone. | Sim, esclarecimento expresso do usuário |
| Milestone no merge do PR de release | Não repetir a exigência nem extrair outra versão de milestone no PR técnico reconhecido como release | É o segundo momento da mesma entrega já planejada, não uma nova entrega funcional sem milestone. CI, revisão e integridade continuam exigidas. | Sim, esclarecimento expresso do usuário |
| Primeira versão | Sem tags anteriores, cenário inicial `v0.0.1`; `0.0.0` pode ser somente base local | Na consulta de 2026-10-23 não foram retornadas tags nem Releases; preserva a primeira versão definida anteriormente pelo usuário. | Conferir no início do piloto |
| Autenticação inicial | Usar `GITHUB_TOKEN` e permitir a aprovação humana dos workflows do PR, se exigida pelo GitHub | Evita exigir novas credenciais para o primeiro piloto. Falta de permissão não pode ser tratada como sucesso. | Proposta técnica para conferência |
| CI do PR criado por automação | Considerar a possível necessidade de um usuário aprovar a execução dos workflows | A documentação atual do GitHub prevê essa aprovação para eventos de PR produzidos com `GITHUB_TOKEN`. | Confirmado na documentação; conferir no repositório |
| Revisão e merge | Sempre humanos nesta etapa | Criar o PR de release não autoriza integrá-lo automaticamente. | Preserva o fluxo adotado |
| Ambientes protegidos | Não criar nem exigir um environment novo no piloto | Mantém o teste focado na integração básica. Proteções existentes continuam respeitadas. | Proposta técnica para conferência |
| Milestones concorrentes | Não acrescentar uma nova guarda neste MVP; tratar na evolução de governança | O usuário priorizou comprovar a pipeline existente antes dessa complexidade. | Adiado pelo usuário |
| Versão já publicada ou regressiva | Não implementar política adicional neste MVP nem mover tags existentes | O motor continua sendo o Release Please; novos controles de governança ficam para depois. | Adiado pelo usuário |
| Commit do cenário positivo | Usar um commit `fix:` ou `feat:` e squash merge com cabeçalho Conventional Commits preservado | A milestone, sozinha, não demonstra que há mudanças elegíveis para gerar um PR de release. | Proposta técnica para conferência |

**Open questions:** none - all resolved or logged above. Aprovar o escopo não significa que os defaults ainda não discutidos tenham sido individualmente confirmados.

### Dois momentos da mesma entrega

1. **Preparação do PR de release:** a pipeline recebe a entrega funcional integrada e exige a milestone de seu PR de origem para preparar ou atualizar o PR técnico com a versão planejada.
2. **Merge do PR de release:** a pipeline conclui a mesma entrega e publica a versão preparada. Não exige uma nova milestone nem repete sua extração nesse PR técnico. Essa dispensa não torna a milestone opcional para entregas funcionais.

Essa é uma regra da nossa orquestração. Não é uma exigência universal do Release Please. A sugestão de restaurar milestone opcional foi retirada após o esclarecimento do usuário.

## User Stories

### P1: Versionar as próprias pipelines sem publicar pacotes

**User Story**: Como mantenedor, quero usar este repositório como consumidor para validar o Release Please antes de integrar aplicações externas.

**Why P1**: É o recorte escolhido para o primeiro piloto.

**Acceptance Criteria**:
1. WHEN o caller deste repositório selecionar `project-type: simple` THEN a pipeline SHALL selecionar a estratégia nativa `simple` do Release Please.
2. WHEN a estratégia `simple` preparar um PR de release THEN o resultado SHALL conter a versão candidata em `version.txt`.
3. WHEN a estratégia `simple` preparar um PR de release THEN o resultado SHALL conter as notas da entrega em `CHANGELOG.md`.
4. WHILE `project-type` for `simple` a pipeline SHALL executar zero etapas de publicação em registries ou GoReleaser.

**Independent Test**: Gerar a configuração em diretório temporário e validar o contrato do caller e das condições de distribuição. Conferir os arquivos do PR somente na etapa remota autorizada.

### P1: Executar o contrato real entre caller, checkout e Action

**User Story**: Como mantenedor, quero testar o encadeamento utilizado pelo GitHub para que uma expressão regular no YAML não esconda um caminho inválido.

**Why P1**: A análise reproduziu um teste textual verde com o arquivo de entrada do workflow inexistente no layout de checkout.

**Acceptance Criteria**:
1. WHEN o teste local reproduzir o checkout central em `.ci-scripts` THEN o teste SHALL executar o orquestrador no caminho efetivamente declarado pelo workflow.
2. IF a referência de caller apontar para um arquivo inexistente no repositório THEN o teste de contrato SHALL terminar com falha.
3. WHEN a milestone funcional for `v0.0.1` THEN o contrato efetivo da Action SHALL receber `release-as` igual a `0.0.1`.
4. WHEN o piloto invocar a Action THEN o contrato efetivo SHALL selecionar `release-type` igual a `simple`.
5. The pipeline SHALL usar o mesmo workflow central para o piloto e para os demais consumidores, sem uma cópia especial da implementação.
6. WHEN o piloto executar os scripts centralizados THEN o checkout desses scripts SHALL usar o mesmo SHA da revisão do caller e do called em teste, sem resolver novamente a master mutável.

**Independent Test**: Analisar a configuração estruturada do YAML e executar o script em uma árvore temporária equivalente ao checkout. Um JSON apenas gerado em disco não comprova a configuração consumida pela Action.

### P1: Preservar os limites de versão e merge

**User Story**: Como mantenedor, quero que a release respeite a milestone e o merge humano, sem inventar outro algoritmo de versionamento.

**Why P1**: O piloto deve comprovar a abordagem atual, não substituir suas regras por uma implementação paralela.

**Acceptance Criteria**:
1. WHEN um PR funcional elegível com commit `fix:` ou `feat:` e milestone SemVer válida for integrado em `master` THEN o fluxo SHALL usar a versão da milestone como versão desejada do PR de release.
2. IF um PR funcional não tiver milestone válida THEN a validação SHALL falhar antes da chamada com escrita ao Release Please.
3. WHEN um PR for fechado sem merge THEN a pipeline SHALL criar zero PRs de release, tags e Releases.
4. WHILE o PR de release não tiver sido integrado por um humano o fluxo SHALL publicar zero tags e Releases para sua versão candidata.
5. WHEN o PR reconhecido como release for integrado THEN o fluxo SHALL executar o Release Please sem repetir a validação de milestone nesse PR técnico.
6. WHEN o PR reconhecido como release for integrado THEN o fluxo SHALL publicar a versão preparada no PR sem sobrescrevê-la por uma nova extração de milestone.

**Independent Test**: Eventos simulados de PR funcional, PR técnico e fechamento sem merge; reconhecimento de PR técnico não comprovado apenas por texto livre no título do PR.

### P1: Produzir evidência local sem simular sucesso ponta a ponta

**User Story**: Como mantenedor, quero distinguir testes automatizados locais de uma release realmente publicada no GitHub.

**Why P1**: Evita repetir a confusão entre testes do orquestrador e integração real.

**Acceptance Criteria**:
1. WHEN a suíte local terminar THEN o relatório SHALL identificar separadamente os testes de domínio, os testes de contrato e o estado da validação remota.
2. IF a Action não tiver sido executada num piloto remoto autorizado THEN o relatório SHALL registrar a integração ponta a ponta como `PENDENTE`.
3. WHEN o teste funcional exercitar falhas essenciais de caminho, milestone e configuração THEN cada cenário negativo SHALL terminar com falha observável no componente validado.
4. The suíte local SHALL preservar os sete testes existentes, acrescentando cobertura sem desativar suas asserções.
5. The suíte local SHALL executar sem credenciais capazes de criar PR, tag ou Release nos cenários simulados.
6. The cobertura nova SHALL permanecer concentrada no teste funcional de `ci-scripts/tests/release-please.test.ts`, sem criar arquivos de teste por função ou adaptador.
7. WHEN o teste preparar a versão do piloto THEN o cálculo, o changelog e os dados de release SHALL ser produzidos pela estratégia real `simple` do Release Please, com entradas simuladas e chamadas de rede proibidas.

**Independent Test**: Executar a suíte e a verificação de tipos em cópias temporárias; conferir o relatório e a ausência de chamadas de escrita.

### P1: Validar o ciclo remoto somente depois de autorização

**User Story**: Como mantenedor, quero reproduzir a entrega normal no próprio repositório e inspecionar os resultados reais antes de adotar o fluxo em aplicações.

**Why P1**: Só a execução no GitHub comprova eventos, permissões e os artefatos publicados.

**Acceptance Criteria**:
1. WHILE não existir autorização explícita para a etapa remota o agente SHALL executar zero pushes, criações de PR, merges, alterações de secrets e publicações de Release.
2. WHEN uma entrega funcional autorizada com commit `fix:` ou `feat:` preservado no squash merge for integrada THEN o piloto SHALL produzir um PR de release com versão e notas inspecionáveis.
3. WHEN o PR de release autorizado e com CI aprovada for integrado THEN a tag publicada SHALL apontar para o SHA integrado daquele PR de release.
4. WHEN a tag e a Release forem publicadas THEN a evidência SHALL registrar os links do PR, da execução e da Release, além da versão e do SHA alvo.
5. IF a CI do PR automatizado exigir aprovação de execução THEN o roteiro SHALL orientar a ação humana necessária sem dispensar a CI.

**Independent Test**: Executar o roteiro manual no GitHub após autorização; antes disso, todos os critérios que exigem escrita remota permanecem não verificados.

### P2: Reexecutar sem sobrescrever uma versão existente (futuro, fora do MVP)

**User Story**: Como mantenedor, quero que uma reexecução ou falha parcial não destrua uma release já publicada.

**Why P2**: Retry e concorrência fazem parte do uso normal do Actions, mas os controles adicionais foram adiados pelo usuário. Esta seção registra a proposta futura e não condiciona a prontidão local do MVP.

**Acceptance Criteria**:
1. WHEN o mesmo evento de merge for reprocessado THEN o fluxo SHALL manter no máximo um PR de release aberto para a mesma linha de release.
2. WHEN uma publicação já concluída for reprocessada THEN o fluxo SHALL preservar a tag e a Release existentes sem duplicá-las.
3. IF uma tag desejada já apontar para outro SHA THEN o fluxo SHALL falhar sem mover ou excluir a tag existente.
4. IF o GitHub negar permissão ou falhar durante a operação THEN a execução SHALL reportar o erro sem declarar a integração aprovada.
5. WHEN duas execuções de release para o mesmo repositório e branch ocorrerem simultaneamente THEN o fluxo SHALL serializar as operações de escrita.
6. IF uma nova entrega solicitar versão diferente daquela de um PR de release aberto THEN o fluxo SHALL falhar preservando esse PR para decisão humana.
7. IF uma nova entrega funcional solicitar uma versão igual ou inferior à última publicada THEN o fluxo SHALL falhar sem alterar a publicação existente.

**Independent Test**: Contratos locais para as guardas controladas pelo workflow e ensaios com respostas simuladas para os estados externos. Reexecução real e consistência dos resultados serão verificadas no piloto remoto autorizado.

## Edge Cases

- IF `project-type` não for suportado THEN o orquestrador SHALL falhar antes de chamar o motor de release.
- IF uma milestone contiver versão SemVer inválida THEN o orquestrador SHALL falhar antes de produzir parâmetros de publicação.
- IF uma chamada externa falhar no piloto remoto THEN a evidência SHALL registrar a falha sem apresentar um resultado local como publicação comprovada.
- IF a versão inicial não tiver uma tag anterior THEN o cenário inicial SHALL produzir `v0.0.1`, nunca uma tag `v0.0.0`.

## Implicit Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Validação de entradas | Estratégia suportada, milestone SemVer e identificação do PR técnico; RPSP-01 a RPSP-03 e Edge Cases. |
| Falha e falha parcial | MVP distingue erro de sucesso; reconciliação adicional permanece em RPSP-06, futura. |
| Idempotência | Não acrescentar writer próprio nem mover tags; política adicional RPSP-06 futura. |
| Autenticação e limites | Menor privilégio necessário, nenhuma credencial de publicação em testes locais; RPSP-04 a RPSP-06. Rate limit é falha externa, sem retry ilimitado. |
| Concorrência e ordem | Evolução de governança RPSP-06 futura; não declarar essa prova entregue no MVP. |
| Ciclo de vida | Tags e Releases são preservadas. Artefatos de teste seguem a retenção existente do Actions; nenhuma rotina nova de limpeza remota. |
| Observabilidade | Categorias de teste, estado remoto e links com SHA; RPSP-04 e RPSP-05. |
| Dependências externas | Permissões, indisponibilidade e CI automatizada explicitadas, sem substituir resultado real por simulação; RPSP-05 e RPSP-06. |
| Transições de estado | PR funcional integrado, PR de release pendente, merge humano e publicação; RPSP-03 e RPSP-05. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RPSP-01 | Piloto simple sem publicação de pacotes | Execute | Implementing: contrato e SDK; publicação real pendente |
| RPSP-02 | Contrato real entre caller, checkout e Action | Execute | Implementing: paths e bindings; Action hospedada pendente |
| RPSP-03 | Milestone e limites de merge | Execute | Implementing: eventos simulados; merges reais pendentes |
| RPSP-04 | Evidência local e separação de cobertura | Execute | Verified by independent review and hosted run 40033980369 |
| RPSP-05 | Ciclo remoto autorizado e rastreável | Specify | Pending |
| RPSP-06 | Retry, concorrência e falhas: evolução fora do MVP | Future | Pending |

**Coverage:** 6 requisitos identificados. T1 executa o contrato e o SDK real sem rede; T2/T3 entregam o caller de teste hospedado e o roteiro. RPSP-05 permanece pendente de autorização para o ciclo real de publicação; RPSP-06 é futuro.

**Evidência hospedada:** [run 40033980369](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40033980369), SHA `b6493740679134fc540c27344e4d8ec28cc23004`: sete testes aprovados, zero skips e typecheck aprovado. Não houve execução da Action com escrita nem publicação real; os resultados pendentes no relatório independente continuam pendentes.

## Success Criteria

- [x] Caller simple e orquestrador passam nos testes locais de caminhos, parâmetros e falhas.
- [x] Os sete testes existentes continuam passando e a checagem de tipos termina com código 0.
- [x] Revisão independente confirma que o piloto não pode publicar pacotes.
- [x] O roteiro de teste diferencia preparação local de execução remota autorizada.
- [ ] Após autorização específica, há evidência de PR de release, merge humano, tag no SHA correto e Release.
- [x] Não há alterações nas aplicações externas nem fechamento automático da issue de versionamento.

## Evidence and References

- [CI examinada: sete testes aprovados](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40017226181).
- [Teste atual do workflow: inspeção textual](https://github.com/aplicacoesBoilerplate/.github/blob/e05a76af07096e2cc4350af02896a68b11386bd5/ci-scripts/tests/release-please.test.ts#L87-L102).
- [Called atual e caminhos de checkout](https://github.com/aplicacoesBoilerplate/.github/blob/e05a76af07096e2cc4350af02896a68b11386bd5/.github/workflows/version-release-please-called.yml#L24-L54).
- [Release Please: estratégia simple](https://github.com/googleapis/release-please/blob/v17.3.0/src/strategies/simple.ts).
- [Action v4: entradas oficiais release-type e release-as](https://github.com/googleapis/release-please-action/blob/v4/README.md#action-inputs).
- [GitHub: chamada de workflows reutilizáveis](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#calling-a-reusable-workflow).
- [GitHub: eventos produzidos por GITHUB_TOKEN e aprovação de workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow). Esta documentação mais recente prevalece sobre a frase genérica de ausência de gatilho no README da Action.

Context7 não está disponível nesta sessão. A pesquisa usou o código do repositório e as fontes oficiais acima. O trabalho anterior continua separado e não é declarado concluído por esta especificação.
