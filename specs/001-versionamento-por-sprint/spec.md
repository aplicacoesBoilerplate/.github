# Feature Specification: Versionamento por sprint

**Feature Branch**: `feature/issue-2` | **Created**: 2026-09-23 | **Revised**: 2026-09-24

**Status**: Liberação inicial Go em homologação; issue #2 permanece aberta para os demais perfis

**Input**: [Issue #2](https://github.com/ModulosTestesAutomatizados/.github/issues/2) e a decisão posterior registrada em [OpenSpec](../../openspec/changes/corrigir-versionamento-pos-merge/proposal.md). A versão anterior desta especificação exigia prévia de SemVer e atualização de versão antes do merge; essas premissas foram substituídas pela decisão do responsável.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Checks de entrega e homologação por fase (Priority: P1)

Como mantenedor quero validar PRs de feature, de release para homologação e de homologação para a branch principal segundo a finalidade de cada transição, sem antecipar a versão do projeto.

**Why this priority**: O check exigido na proteção da branch principal atualmente rejeita a integração homologada por exigir sub-issue de feature.

**Independent Test**: Abrir PRs nas três transições e conferir passagem/rejeição de vínculo e gates sem criar tag, release ou mudar versão.

**Acceptance Scenarios**:

1. **Given** uma feature com sub-issue vinculada à épica e milestone, **When** é enviada à release, **Then** o check passa sem publicar.
2. **Given** PR de release para `develop` com épica encerrada e milestone concluída após homologação breve, **When** é revisado, **Then** o check passa sem exigir sub-issue, homologação completa de develop nem prévia SemVer.
3. **Given** PR de `develop` para a branch principal com épica/milestone encerradas e homologação/revisão aprovadas, **When** o check obrigatório roda, **Then** ele passa sem exigir sub-issue ou versão registrada no projeto.
4. **Given** vínculo de feature ou evidência de homologação exigida ausente, **When** o check roda, **Then** ele falha com causa específica e não publica.
5. **Given** ferramenta que não gera changelog provisório, **When** ocorre a homologação, **Then** a falta de guia não impede o check obrigatório.

---

### User Story 2 - Versionamento definitivo depois da integração (Priority: P1)

Como mantenedor quero que a versão real seja calculada após o merge na principal e que os arquivos alterados por Node sejam revistos em PR posterior, para que tag e GitHub Release correspondam à versão efetivamente integrada.

**Why this priority**: A implementação atual só lê a versão Node já integrada, contrariando o fluxo decidido.

**Independent Test**: Integrar PR funcional sem bump e verificar PR de versão pós-merge nos perfis Node; somente após merge desse PR publicar tag no commit versionado. Para Go/Java, conferir versão derivada e tag no SHA funcional.

**Acceptance Scenarios**:

1. **Given** integração homologada de projeto que altera arquivos de versão, **When** a automação processa o merge, **Then** abre PR de versionamento sujeito a CI/revisão e não cria tag antes de seu merge.
2. **Given** PR de versionamento aprovado e integrado, **When** a publicação executa, **Then** tag e release apontam ao commit que contém versão/changelog aplicáveis.
3. **Given** perfil que deriva versão do histórico, **When** a integração homologada é concluída, **Then** publica no SHA integrado sem alteração artificial de arquivo.
4. **Given** vários PRs na mesma release branch sem tag intermediária, **When** `standard-version` processa a integração final, **Then** considera o conjunto ainda não publicado uma vez, sem segundo incremento em reexecução.

---

### User Story 3 - Reconciliação e ensaio do consumidor (Priority: P2)

Como mantenedor quero reexecutar a publicação sem corromper tags e validar no GitHub cada adaptador antes de adotá-lo em consumidores reais.

**Why this priority**: Os testes locais utilizam ferramentas simuladas e não observam permissões, checks ou ambientes hospedados.

**Independent Test**: Por perfil, executar uma rodada no LocalLabs com versão/tag própria, reexecutar publicação e induzir conflito controlado, observando SHA e release remotos.

**Acceptance Scenarios**:

1. **Given** tag e release corretas, **When** ocorre reexecução, **Then** retorna estado existente sem novo PR, bump ou release.
2. **Given** tag já apontando a outro SHA, **When** a publicação tenta reutilizar a versão, **Then** sinaliza conflito e preserva referência existente.
3. **Given** tag correta e release ausente, **When** a publicação é repetida, **Then** completa apenas a release após conferir o mesmo SHA.
4. **Given** quatro adaptadores no mesmo laboratório, **When** as rodadas usam versões/tags distintas, **Then** cada publicação pertence ao perfil e ao commit selecionados.

### Edge Cases

- PR de versionamento não comprovadamente relacionado ao merge funcional é rejeitado.
- Falta de token no job publicador, ferramenta ausente ou versão instável produz diagnóstico antes da escrita.
- Nova entrega antes do merge do PR de versão exige atualização segura ou suspensão diagnosticada.
- A milestone `vX.Y.Z` nomeia a sprint, não fixa a versão de cada projeto.
- `changelog_path` lê arquivo já presente no commit publicável; não gera changelog de homologação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A solução DEVE disponibilizar um check de leitura para feature → release, release → develop e develop → branch principal, com validações específicas por transição.
- **FR-002**: Feature DEVE referenciar sub-issue da épica/milestone; integração release → develop DEVE exigir épica encerrada e milestone fechada, sem issues abertas.
- **FR-003**: Integração develop → principal DEVE comprovar épica/milestone concluídas e homologação/revisão exigidas no consumidor, sem exigir sub-issue de feature.
- **FR-004**: Nenhum PR funcional DEVE exigir prévia SemVer, alteração de versão ou changelog provisório; changelog para homologação é opcional e não bloqueante.
- **FR-005**: Versão definitiva DEVE ser calculada após merge na principal com um dos quatro perfis, sem derivá-la da milestone.
- **FR-006**: Perfis que alteram arquivos DEVEM registrar versão/changelog após o merge funcional em PR sujeito à proteção da principal, publicando apenas depois de seu merge. Perfis derivados de Git não DEVEM exigir commit artificial.
- **FR-007**: Tag e release DEVEM apontar ao SHA publicável com a versão persistida (quando houver), somente depois dos gates exigidos pelo consumidor.
- **FR-008**: Reexecução, concorrência e falhas parciais DEVEM preservar tags e releases; conflitos DEVEM ser comunicados sem sobrescrita.
- **FR-009**: A interface DEVE documentar gatilhos, inputs/outputs, permissões e referência fixa do workflow; o consumidor DEVE executar build/testes próprios.
- **FR-010**: O perfil Go DEVE usar o JSON nativo de `go-gitsemver` no SHA integrado, validar `SemVer` e `Sha` e registrar a explicação do cálculo, sem algoritmo paralelo, PR artificial ou `versioning_token`.
- **FR-011**: O publicador DEVE retornar `published_sha` em publicação ou reconciliação; uma reexecução antiga válida DEVE ser reconciliada antes de comparar com tags posteriores. Erro de API/autenticação não pode ser interpretado como ausência de recurso.
- **FR-012**: O caller Go DEVE depender de CI Go de teste, análise e build do mesmo push. A concorrência é configurada somente no workflow central, por repositório e branch, sem cancelar execuções anteriores.

### Key Entities

- **Sprint de homologação**: milestone, épica, release branch, evidências e PRs associados; independente da versão real do consumidor.
- **Entrega integrada**: PR homologado, SHA do merge funcional e vínculo verificável à sprint.
- **PR de versionamento**: mudança de arquivos gerada após integração, com vínculo à entrega e status de revisão.
- **Publicação**: versão, SHA publicável, tag, GitHub Release e estado reconciliado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: As três transições válidas de PR passam pelo check obrigatório em cada rodada de ensaio, sem tags/releases antes do merge.
- **SC-002**: A primeira liberação publica Go no SHA correto no LocalLabs com aprovação humana. `jgitver`, Changesets/Turbo e `standard-version` exigem rodadas posteriores antes de concluir a issue #2; nenhum PR com gate pendente publica.
- **SC-003**: Dez reexecuções e duas execuções concorrentes preservam tags existentes e não duplicam releases ou PRs de versionamento.
- **SC-004**: O mantenedor identifica causa e ação de retomada no resultado de falha sem depender de logs locais simulados.

## Assumptions

- A branch principal é descoberta/configurada pelo consumidor (`main` ou `master`); proteção de branch e aprovação de ambiente permanecem sob controle humano.
- LocalLabs pode usar branches, milestones e tags de ensaio distintas sem preservar um roadmap de produção.
- A milestone `v1.0.0` do ensaio Go não fixa a versão inicial da aplicação; o bootstrap `v0.0.1` usa configuração nativa temporária no LocalLabs.
- A mudança OpenSpec [corrigir-versionamento-pos-merge](../../openspec/changes/corrigir-versionamento-pos-merge/specs/versionamento-por-sprint/spec.md) detalha os cenários normativos desta correção; os demais artefatos Spec Kit devem permanecer alinhados a ela.
