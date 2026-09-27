# Feature Specification: Templates de issues e PRs

**Feature Branch**: `feature/issue-4` (PR diretamente para `master`)

**Created**: 2026-09-23

**Status da especificação**: pronta para implementação (issue #4 no Project [GitHub Features](https://github.com/orgs/ModulosTestesAutomatizados/projects/6), Status `Backlog` na consulta de 2026-09-24)

**Input**: [Issue #4 — Templates de issues e PRs](https://github.com/ModulosTestesAutomatizados/.github/issues/4), sub-issue da épica #1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar entrega com contexto mínimo (Priority: P1)

Como pessoa que abre um card, quero escolher um template para épica, release, feature,
task ou hotfix que já indique título e campos necessários para triagem e planejamento.

**Why this priority**: Evita cards incompletos e funciona mesmo sem automação de metadados.

**Independent Test**: Criar um card de cada tipo e verificar campos obrigatórios, título,
descrição e indicação dos metadados que ainda exigem preenchimento.

**Acceptance Scenarios**:

1. **Given** épica de sprint, **When** o formulário é preenchido, **Then** título coincide
   com milestone e há orientação para release MAJOR, Estimate 10, Size XL, Effort Team e datas.
2. **Given** sub-issue de feature, task ou hotfix, **When** é criada, **Then** título inicia
   com o nome do label escolhido em maiúsculas entre colchetes (ex.: `[TEMPLATES]`), e
   corpo contém contexto, entrega e premissas.
3. **Given** campo obrigatório vazio, **When** se tenta criar, **Then** o formulário exige
   correção dos dados suportados; metadados externos são explicitados como pendências.

---

### User Story 2 - Revisar PR com evidências padronizadas (Priority: P2)

Como revisor, quero um template de PR com realização, fontes, instruções de teste e novidade
para conferir a entrega e comparar metadados com a issue relacionada.

**Why this priority**: Facilita review e homologação mesmo sem automação de issue fields.

**Independent Test**: Abrir PR vinculado a issue e verificar as seções presentes e
instruções claras para fornecer evidência e metadados correspondentes.

**Acceptance Scenarios**:

1. **Given** PR para sub-issue, **When** é aberto, **Then** o corpo pede vínculo, realização,
   fontes modificados, procedimento de teste e novidades.
2. **Given** PR com metadados diferentes dos da issue, **When** o autor preenche o template,
   **Then** uma verificação visível solicita alinhamento antes da revisão.

---

### User Story 3 - Completar metadados com segurança (Priority: P3)

Como mantenedor, quero que os campos nativos e compartilháveis sejam preenchidos pelo
formulário e os restantes sinalizados, sem adicionar issues ao Project de outro domínio.

**Why this priority**: Expande o benefício para a organização sem afirmar suporte inexistente.

**Independent Test**: Criar issues/PRs em repositório com e sem Project, verificando
tipo/labels nativos e instruções para os metadados que exigem preenchimento posterior.

**Acceptance Scenarios**:

1. **Given** tipo organizacional disponível, **When** um formulário é usado, **Then** o tipo
   correspondente é atribuído, com exceção da épica e release não épica que compartilham
   `Release`; o restante dos valores é instruído sem pressupor automação.
2. **Given** repositório sem Project ou autorização necessária, **When** formulário é usado,
   **Then** criação continua possível e pendências são explicitadas sem vincular itens incorretos.

### Edge Cases

- Templates existentes `issueCLI.yml` (bug específico da CLI) e `issuePai.yml` precisam ser
  preservados ou migrados com equivalência explícita, sem duplicar épicas.
- Issue Type `Release` existe tanto para épica quanto para release não épica; somente a
  épica recebe Estimate 10 e o nome exato do milestone.
- Labels inexistentes no consumidor não são aplicados; o formulário não deve presumir
  assignees ou Project específicos de um único produto.
- Quando um consumidor possuir templates de issue locais, a pasta de defaults não é mesclada.
- Issue Fields e campos de Project diferem entre organizações; não pressupor equivalência
  entre campos com mesmo nome.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEVEM existir entradas distintas e descobríveis para épica, release não épica,
  feature, task, hotfix e PR, sem dois formulários com a mesma finalidade.
- **FR-002**: Formulários de issue DEVEM apresentar título orientado pela categoria e corpo com
  contexto, entrega e premissas, exigindo os campos disponíveis que são necessários à triagem.
- **FR-003**: Épica DEVE instruir coincidência com milestone, datas equivalentes, Release
  MAJOR, Size XL, Estimate 10 e Effort Team; PR/sub-issues não podem herdar esse padrão.
- **FR-004**: A escala DEVE tratar Size XS–XL como valor agregado; Estimate 0 é homologação,
  1–5 acompanha Size para features, 6 é Hotfix, 7/8/9 representam PATCH/MINOR/MAJOR e 10
  é exclusivo da épica; release não épica não pode receber 10 automaticamente.
- **FR-005**: Sub-issues DEVEM orientar título com marcador `[LABEL]`, a substituir pelo
   nome do label selecionado em maiúsculas, e vínculo à épica/milestone; hotfix deve pedir
   contexto de emergência e escopo de correção.
- **FR-006**: Template de PR DEVE incluir seções `Realização`, `Fontes modificados`,
  `p/ teste` e `O que há de novo`, além de issue vinculada, review e metadados equivalentes.
- **FR-007**: O título inicial, Issue Type e labels compartilháveis DEVEM ser preenchidos
  no formulário. O vínculo automático a um Project somente DEVE ocorrer se ele for comum a
  todos os consumidores e a pessoa tiver permissão; valores de Issue Fields e de Project,
  parent, milestone e datas DEVEM constar como pendência manual neste escopo.
- **FR-008**: A documentação DEVE explicar como os defaults do repositório público
   `.github` são herdados pela organização, quando templates locais prevalecem e como
   migrar os dois templates piloto sem perda de funcionalidade.

### Key Entities

- **Template de issue**: tipo, campos obrigatórios e regra de título/corpo.
- **Escala de valor**: correspondência entre classe de entrega, Size e Estimate.
- **Template de PR**: seções de revisão e relacionamento com a issue.
- **Metadados pendentes**: conjunto de valores que requer preenchimento na issue/Project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em cinco cenários de issue (épica, release, feature, task, hotfix), 100% dos
  formulários expõem as instruções e campos obrigatórios do respectivo tipo.
- **SC-002**: Em dez cards/PRs amostrais, 100% exibem o vínculo correto e a escala aplicável
  ou apontam explicitamente o metadado pendente.
- **SC-003**: Em PR de teste, todos os quatro blocos de relatório aparecem por padrão e
  um revisor consegue localizar evidências em até três minutos.
- **SC-004**: A migração preserva 100% das informações exigidas nos templates piloto para
  as jornadas que permanecerem disponíveis.

## Assumptions

- Formulários GitHub suportam tipo e associação a Project; esta última depende de permissão
  de escrita e não deve fixar Project #6 em todos os repositórios. Issue Fields, valores de
  Project, milestone e sub-issue exigem complemento manual nesta entrega.
- A regra de título `[LABEL]` é uma orientação para substituição manual, pois o formulário
  não consegue calcular o valor do label selecionado dinamicamente.
- Labels e tipos organizacionais só são atribuídos automaticamente após validação de que
  existem no repositório consumidor.
