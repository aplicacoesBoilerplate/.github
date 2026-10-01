# Pipeline Centralizada de Versionamento Specification

## Problem Statement

Os repositórios consumidores precisam calcular e publicar versões com suas ferramentas nativas sem replicar regras de governança. A implementação atual ainda não trata milestone como contrato opcional, não possui override protegido, não oferece environment opcional e não executa toda a suíte de versionamento na CI central.

## Goals

- [ ] Validar e publicar versões a partir do cálculo nativo do adaptador configurado pelo caller.
- [ ] Publicar uma tag e uma GitHub Release somente depois da integração validada em `master` e da CI do consumidor.
- [ ] Usar a milestone do pull request como contrato opcional de versão exata e tipo de incremento.
- [ ] Permitir divergência somente por um override com duas pessoas autorizadas e trilha de auditoria.
- [ ] Gerar um guia de homologação a partir do relatório nativo do adaptador em pull requests para `develop`.
- [ ] Entregar e verificar o primeiro perfil real com `go-gitsemver` sem alterar o projeto piloto nesta iteração.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Alterar o repositório `boilerplate-cli` | O piloto será integrado em uma iteração posterior. |
| Aprovação autônoma de environments por LLM | Exige GitHub App e deployment protection rule próprios. |
| Implementação completa dos perfis npm, Changesets e Java | Esta liberação comprova o contrato com Go e preserva a extensão existente. |
| Commit automático de changelog ou versão no consumidor | O perfil Go deriva estado do Git e não precisa de commit artificial. |
| Algoritmo SemVer alternativo dentro da pipeline | O adaptador configurado é a fonte do cálculo. |
| Criação automática de milestones ou alteração de seus metadados | A pipeline apenas lê e valida a milestone associada ao pull request. |
| Configurar regras remotas de proteção em todos os consumidores | A entrega documenta os checks e a configuração exigidos; a adoção remota ocorre por repositório. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Branch de publicação do primeiro caso de uso | `master` | É a branch principal definida pelo usuário para o MVP. | y |
| Branch de homologação | `develop` | É a branch adotada para homologação. | y |
| Milestone ausente | Aceitar o cálculo do adaptador sem revisão extra | A milestone é planejamento opcional, não requisito de toda publicação. | y |
| Formato da milestone presente | Título SemVer estável estrito no formato `vMAJOR.MINOR.PATCH` | Milestones não aceitam campos customizados e o título já representa a release planejada. | y |
| Conteúdo validado da milestone | Versão exata e tipo de incremento | O contrato precisa detectar tanto destino errado quanto categoria de mudança errada. | y |
| Primeiro versionamento sem tag estável | Publicar `v0.0.1`; usar `v0.0.0` somente como base matemática | O primeiro artefato real não deve ser `v0.0.0`. | y |
| Nome do label de exceção | `versioning:override` | Nome explícito, pesquisável e limitado ao domínio do check. | y |
| Autorização do override | Autor do label com `Maintain` ou `Admin`, seguido por aprovação de outra pessoa com `Maintain` ou `Admin` | Um label isolado pode ser aplicado por usuários com Triage e não constitui autorização. | y |
| Reavaliação do override | Invalidar e recalcular após commit, milestone, label ou review relevante | Uma aprovação antiga não deve autorizar conteúdo novo. | y |
| Environment de publicação | Opcional; quando omitido, publicar após CI | Evita revisão redundante e permite proteção adicional por consumidor. | y |
| Guia de homologação | Markdown e JSON derivados do relatório nativo, enriquecidos com metadados do PR e CI | Reaproveita a ferramenta e oferece formato humano e estruturado sem duplicar a lógica de versão. | y |
| Persistência do guia | Artifact da execução e resumo do check, sob a retenção configurada no GitHub Actions | Evita commits gerados e mantém a release final como registro durável. | y |
| Falha da API ou do adaptador | Falhar fechado sem tag ou release parcial | Versionamento e autorização não admitem suposição otimista. | y |
| Concorrência de publicação | Uma execução por repositório e branch, sem cancelar execução em andamento | Impede corrida entre tags e preserva uma publicação já iniciada. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Calcular a versão pelo adaptador nativo ⭐ MVP

**User Story**: Como mantenedor de uma aplicação, quero selecionar o adaptador no caller para que a aplicação preserve sua convenção nativa de versionamento.

**Why P1**: Todo check, guia e publicação depende de uma versão calculada por uma única fonte confiável.

**Acceptance Criteria**:

1. WHEN o caller invocar o workflow com `adapter: go-gitsemver` THEN a pipeline SHALL executar o binário em revisão fixa contra o SHA avaliado e consumir sua saída JSON nativa.
2. The pipeline SHALL normalizar a saída do adaptador para versão candidata, SHA calculado, tipo de incremento e relatório explicativo sem recalcular a versão por algoritmo próprio.
3. IF o adaptador retornar SemVer instável, SHA diferente, JSON inválido ou erro de execução THEN a pipeline SHALL falhar antes de criar tag ou GitHub Release.
4. IF o repositório não possuir tag SemVer estável THEN a pipeline SHALL aceitar somente `v0.0.1` como primeira versão publicável e SHALL usar `v0.0.0` apenas como base interna da comparação.
5. IF o caller informar adaptador desconhecido ou `project_path` fora do checkout THEN a pipeline SHALL falhar com diagnóstico sem executar comando proveniente do pull request.

**Independent Test**: Executar a fixture real do Go para bootstrap, patch, minor, major, SHA divergente e configuração inválida.

### P1: Validar a milestone no pull request final ⭐ MVP

**User Story**: Como responsável por uma release, quero comparar o planejamento do pull request com a versão calculada para impedir uma publicação diferente da intenção registrada.

**Why P1**: A milestone é o contrato humano que conecta planejamento e release real sem substituir o adaptador.

**Acceptance Criteria**:

1. WHEN um pull request para `master` não possuir milestone THEN o check SHALL aceitar a versão e o tipo de incremento calculados pelo adaptador sem exigir revisão adicional de versão.
2. WHEN um pull request para `master` possuir milestone com título `vMAJOR.MINOR.PATCH` THEN o check SHALL comparar o título com a versão candidata exata.
3. WHEN um pull request para `master` possuir milestone válida THEN o check SHALL comparar o incremento entre a última tag estável e a milestone com o incremento informado pelo adaptador.
4. IF a milestone presente não usar SemVer estável estrito THEN o check SHALL falhar com a milestone recebida e o formato esperado.
5. IF a versão exata ou o tipo de incremento divergir THEN o check SHALL bloquear o merge e registrar versão planejada, versão calculada, incremento planejado e incremento calculado.
6. WHEN a milestone for adicionada, removida ou substituída THEN o check SHALL recalcular o resultado com os metadados atuais do pull request.

**Independent Test**: Simular pull requests sem milestone, com milestone idêntica, inválida, divergente e alterada após a primeira avaliação.

### P1: Autorizar uma divergência de forma auditável ⭐ MVP

**User Story**: Como maintainer, quero autorizar uma divergência intencional sem permitir que um colaborador comum burle o check.

**Why P1**: Releases excepcionais precisam continuar possíveis sem transformar o override em um input controlável pelo caller.

**Acceptance Criteria**:

1. IF um pull request divergente não possuir o label `versioning:override` THEN o check SHALL permanecer bloqueado.
2. WHEN o label `versioning:override` estiver presente THEN o check SHALL identificar pela timeline quem aplicou o evento de label relevante.
3. IF o autor do label não possuir papel efetivo `Maintain` ou `Admin` no repositório THEN o check SHALL permanecer bloqueado e registrar a tentativa não autorizada.
4. IF não existir review `APPROVED` posterior ao label por outra pessoa com papel efetivo `Maintain` ou `Admin` THEN o check SHALL permanecer bloqueado.
5. WHEN o autor autorizado aplicar o label e outra pessoa autorizada aprovar depois THEN o check SHALL aceitar a divergência e registrar as duas identidades, horários e valores comparados.
6. IF a mesma pessoa aplicar o label e aprovar o pull request THEN o check SHALL permanecer bloqueado.
7. WHEN novos commits forem adicionados ou milestone, label ou review relevante mudar THEN o check SHALL invalidar a autorização anterior e reavaliar toda a sequência.
8. IF a API do GitHub não confirmar timeline, papel efetivo ou review THEN o check SHALL falhar fechado.

**Independent Test**: Cobrir label aplicado por Triage, aprovação anterior ao label, mesma pessoa nas duas ações, dois maintainers válidos e invalidação por novo commit.

### P1: Guiar a homologação em develop ⭐ MVP

**User Story**: Como homologador, quero um resumo gerado a partir da ferramenta da aplicação para testar a entrega sem depender de um changelog commitado.

**Why P1**: O guia reduz o custo de homologação e cria uma entrada estruturada para automações futuras.

**Acceptance Criteria**:

1. WHEN um pull request tiver `develop` como destino THEN a pipeline SHALL executar o adaptador configurado em modo somente leitura no SHA do pull request.
2. WHEN o adaptador produzir seu relatório nativo THEN a pipeline SHALL preservá-lo como fonte da seção de versionamento do guia.
3. WHEN o guia for gerado THEN a pipeline SHALL produzir `homologation.md` e `homologation.json` com versão candidata, explicação nativa, SHA, pull request, mudanças entregues, resultado conhecido da CI e checklist de homologação.
4. WHEN o guia for gerado THEN a pipeline SHALL publicar o resumo humano no check e SHALL enviar os dois arquivos como artifact sem criar commit no consumidor.
5. IF o relatório nativo não estiver disponível THEN a pipeline SHALL falhar o check em vez de inventar uma explicação de versão.
6. The guide SHALL distinguir fatos coletados de itens sugeridos no checklist para que uma LLM futura não trate sugestões como resultados executados.

**Independent Test**: Gerar os dois formatos em uma fixture Go e verificar conteúdo, equivalência semântica e ausência de alterações no Git.

### P1: Publicar após integração e CI ⭐ MVP

**User Story**: Como mantenedor, quero que a publicação aconteça somente depois do merge validado em `master` para garantir que a release corresponda ao código integrado.

**Why P1**: Tags e GitHub Releases são efeitos externos duráveis e não podem antecipar a integração.

**Acceptance Criteria**:

1. WHEN a CI do consumidor concluir com sucesso após um push resultante de merge em `master` THEN o caller SHALL poder invocar o workflow reutilizável de publicação para o SHA integrado.
2. IF a execução não corresponder a um push em `master` associado a um pull request integrado de `develop` THEN a pipeline SHALL recusar a publicação.
3. WHEN a publicação iniciar THEN a pipeline SHALL recalcular a versão e revalidar milestone ou override contra o pull request integrado antes de escrever no repositório.
4. WHERE `publication_environment` for informado, a publicação SHALL aguardar e respeitar as regras do environment do consumidor.
5. WHERE `publication_environment` for omitido, a publicação SHALL prosseguir automaticamente depois da CI e dos checks exigidos.
6. WHEN todos os gates passarem THEN a pipeline SHALL criar uma tag imutável e uma GitHub Release no SHA integrado usando o relatório normalizado como base das notas.
7. IF a tag ou release já existir e corresponder à mesma versão e SHA THEN a pipeline SHALL retornar `already-published` sem duplicar nem alterar o artefato.
8. IF a tag ou release existente apontar para versão ou SHA diferente THEN a pipeline SHALL falhar sem force-push, sobrescrita ou publicação parcial adicional.
9. WHILE uma publicação do mesmo repositório e branch estiver em andamento, outra publicação SHALL aguardar sem cancelar a primeira.
10. The publication workflow SHALL limitar permissão de escrita a `contents: write` no job que cria tag e release.

**Independent Test**: Simular evento inválido, CI falha, environment omitido e presente, primeira publicação, reexecução idempotente e colisão de tag.

### P1: Verificar a automação central ⭐ MVP

**User Story**: Como mantenedor da pipeline central, quero que suas próprias regras sejam testadas antes do merge para não distribuir um caller quebrado aos consumidores.

**Why P1**: Um defeito central afeta todos os repositórios que reutilizam o workflow.

**Acceptance Criteria**:

1. WHEN houver pull request ou push nas branches monitoradas deste repositório THEN a CI central SHALL executar a suíte `tests/versioning` além dos testes Maven ou npm detectados.
2. WHEN a suíte central executar THEN ela SHALL cobrir os cenários positivos e negativos de milestone, override, guia, idempotência e publicação.
3. WHEN o teste real de Go executar em ambiente compatível THEN ele SHALL instalar a revisão fixada de `go-gitsemver` e verificar bootstrap, patch, minor, major e sprint combinada.
4. IF qualquer teste de versionamento falhar THEN o check obrigatório da CI SHALL falhar.
5. The repository SHALL fornecer um caller Go copiável que repasse configuração ao workflow central sem conter a lógica de cálculo, autorização ou publicação.
6. The documentation SHALL identificar os checks obrigatórios e as proteções contra push direto que cada consumidor deve configurar em `develop` e `master`.

**Independent Test**: Executar a mesma suíte declarada na CI e validar estaticamente os workflows e o caller de exemplo.

---

## Edge Cases

- IF existirem várias tags estáveis THEN a pipeline SHALL selecionar a maior versão SemVer alcançável no histórico do SHA avaliado.
- IF a maior tag global não estiver no histórico do SHA avaliado THEN a pipeline SHALL ignorá-la na determinação da base.
- IF o pull request integrado não puder ser associado sem ambiguidade ao SHA publicado THEN a pipeline SHALL recusar a publicação.
- IF o label de override for removido depois da aprovação THEN o check SHALL invalidar a exceção.
- IF a permissão de um participante for rebaixada antes da avaliação THEN o check SHALL usar o papel efetivo atual e SHALL bloquear a autorização inválida.
- IF a GitHub Release for criada mas a resposta final da API se perder THEN a reexecução SHALL reconciliar tag, release e SHA antes de decidir o resultado.
- IF o artifact de homologação exceder os limites do GitHub Actions THEN a pipeline SHALL falhar com diagnóstico e SHALL manter o resumo textual disponível no check.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Adaptador fechado, caminho confinado, milestone SemVer estrita, SHA conferido. |
| Failure / partial-failure states | Falha fechada; publicação reconcilia tag, release e SHA antes de repetir. |
| Idempotency / retry / duplicate handling | Reexecução retorna `already-published` apenas para versão e SHA idênticos. |
| Auth boundaries & rate limits | Permissões mínimas; override exige dois Maintain/Admin; erro ou limite da API bloqueia. |
| Concurrency / ordering | Publicação serializada por repositório e branch; aprovação deve ocorrer depois do label. |
| Data lifecycle / expiry | Guias seguem retenção de artifacts; tag e release são o registro durável. |
| Observability | Check summary, artifacts Markdown/JSON e diagnóstico com planejado, calculado e autorizadores. |
| External-dependency failure | Falhas do GitHub ou adaptador bloqueiam; nenhum fallback inventa versão ou autorização. |
| State-transition integrity | PR valida, merge dispara push, CI antecede publicação, reexecução reconcilia estado. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| VER-01 | P1: Adaptador nativo | Tasks | In Tasks |
| VER-02 | P1: Milestone | Tasks | In Tasks |
| VER-03 | P1: Override | Tasks | In Tasks |
| VER-04 | P1: Homologação | Tasks | In Tasks |
| VER-05 | P1: Publicação | Tasks | In Tasks |
| VER-06 | P1: CI central | Tasks | In Tasks |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] A fixture Go sem tag produz `v0.0.1` e uma execução repetida não duplica a publicação.
- [ ] Todo cenário de milestone produz resultado determinístico e diagnóstico com versão e incremento.
- [ ] Nenhum usuário abaixo de Maintain consegue tornar válido um override.
- [ ] Um novo commit invalida uma autorização de divergência anterior.
- [ ] Pull requests para `develop` recebem guia Markdown e JSON sem alteração no working tree.
- [ ] O workflow só publica depois do merge em `master`, da CI e do environment quando configurado.
- [ ] A CI central executa e bloqueia por falhas na suíte completa de versionamento.
