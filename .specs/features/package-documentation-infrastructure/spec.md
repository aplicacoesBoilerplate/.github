# Infraestrutura e documentação dos packages Java e Vue

**Status:** execução solicitada pelo usuário em 2026-10-25; contrato desta iteração, sem alterar o Go ou reabrir issue #4.

## Problem Statement

A master central 1bd925d acrescenta seleção de subdiretórios e validação de versões. Os dois callers ainda usam a revisão anterior. Java não tem site VitePress; Vue documenta automaticamente apenas três bibliotecas UI, sem versão, e seu build isolado pode omitir manifests em checkout limpo. O called documental só instala/builda dentro de docs-dir e não atende ao workspace Vue.

## Goals

- [ ] Atualizar os dois callers para o contrato central publicado, preservando versões Maven conjuntas e npm independentes.
- [ ] Documentar os quatro artefatos Java e cinco pacotes públicos Vue com versões do código documentado.
- [ ] Compilar e publicar ambos os sites pelo workflow documental central.
- [ ] Persistir cada entrega e suas evidências, preservando fontes funcionais e trabalho paralelo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Go/GoReleaser, distribuição npm/Maven, issues funcionais | Excluídos desta iteração pelo usuário. |
| Integrar features Java/Vue pendentes ou fazer merges por conta própria | Merges continuam humanos, conforme autorização anterior. |
| Framework próprio de temas, registry de templates ou versões históricas completas dos sites | Usar VitePress existente e pipeline central; evolução própria posterior. |
| Alterar políticas administrativas ou usar identidade humana | Usar agentegersonfribeiro-AI; publicar somente com permissões disponíveis. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Um site por repositório, páginas por pacote | Java quatro páginas, Vue cinco, preservando APIs UI existentes | Reaproveita o catálogo e evita nove deployments | Default técnico explícito |
| Referência central | 080df5aa1c803252ba91fa00ac529fc5e2006c47, incorporando masteracdb458 | Inclui contrato documental ampliado, release0.0.2 e correção GraphQL do usuário | Dentro do escopo autorizado |
| Versões exibidas | Versão do checkout; não afirmar disponibilidade em registry | Distribuição de pacotes permanece desligada | Dentro do escopo autorizado |
| Fonte Java | Manifest nativo raiz e docs/package.json sincronizados por extra-files | Uma versão conjunta sem parser XML próprio ou segundo motor | Default técnico explícito |
| Publicação | Pages via called; PR só build, deploy na master após merges humanos | Preservar proteções e autoridade combinadas | Confirmado na conversa |
| Permissões Pages | Administrador habilitou nos dois; API confirmou has_pages:true/build_type:workflow | Environment permite somente master; implantação aguarda promoção humana | Confirmado pelo usuário e nova consulta API |

**Open questions:** none — defaults de implementação explícitos acima; eventual impedimento administrativo será comprovado e apresentado com a entrega concreta.

## User Stories

### P1: Workflow documental reutilizável
**User Story:** Como mantenedor, quero publicar sites isolados e workspaces com o mesmo called.
**Acceptance Criteria:**
1. WHEN install-dir e build-script forem omitidos THEN o called SHALL continuar instalando em docs-dir e executando docs:build.
2. WHEN o consumidor declarar install-dir raiz e build-script build THEN o called SHALL instalar/buildar na raiz e publicar docs-dir/.vitepress/dist.
3. WHEN npm-version for informada THEN o workflow SHALL fixar essa versão antes de invocar npm dentro do consumidor.
4. WHILE o evento for PR o workflow SHALL fazer somente build, preservando deploy somente na master e permissões Pages mínimas.
**Independent Test:** Um fluxo funcional TS com dois projetos npm reais temporários, mais contrato de guards/permissões.

### P1: Documentar o conjunto Java
**User Story:** Como consumidor Java, quero saber instalar e usar cada artefato da versão documentada.
**Acceptance Criteria:**
1. The site SHALL conter páginas de parent, BOM, core e starter com somente APIs existentes.
2. WHEN o Release Please alterar a versão conjunta THEN os POMs, revision, manifest e JSONs de versão da documentação SHALL acompanhar a mesma versão.
3. WHEN o site for compilado THEN ele SHALL mostrar a versão do código e compilar os links com base /PackagesJava/.
**Independent Test:** VitePress real, reactor verify e ensaio nativo de extra-files nos arquivos reais em scratch.

### P1: Documentar os cinco packages Vue
**User Story:** Como consumidor Vue, quero páginas por pacote sem perder previews e APIs existentes.
**Acceptance Criteria:**
1. The site SHALL cobrir composables, utils, ui-core, ui-prime-vue e ui-vuetify, preservando o catálogo gerado UI.
2. WHEN a documentação for compilada THEN cada página de pacote SHALL apresentar a versão de seu package.json no mesmo checkout, sem usar schemaVersion ou versão do app privado como versão da biblioteca.
3. WHEN a pipeline começar com checkout limpo THEN ela SHALL construir os manifests UI antes do catálogo e gerar saída não vazia com base /PackagesVue/.
4. The conteúdo SHALL informar que composables e utils ainda não exportam APIs nesta branch, sem incorporar os PRs funcionais pendentes.
**Independent Test:** Build real completo do workspace, versões renderizadas e nove páginas de entrada mínimas nos dois sites.

### P1: Adotar o contrato atual de versionamento
**User Story:** Como mantenedor, quero os dois consumidores ligados à implementação central atual.
**Acceptance Criteria:**
1. WHEN os callers forem atualizados THEN uses e central-ref SHALL fixar a mesma revisão publicada e usar config-file/manifest-file/project-path atuais.
2. The callers SHALL preservar a CI antecedente e publish-artifacts=false; Java mantém versão conjunta e Vue componentes independentes.
3. The mudança SHALL preservar fontes funcionais, branches/PRs existentes e o piloto Go sem alteração.
**Independent Test:** Configs/callers reais, gates Maven/npm e diff por repositório.

### P1: Entrega e publicação verificáveis
**User Story:** Como mantenedor, quero inspecionar o conteúdo compilado e a publicação sem confundir etapas.
**Acceptance Criteria:**
1. WHEN uma tarefa passar pelo gate THEN código, teste/status SHALL ser commitados e publicados antes da próxima tarefa.
2. WHEN a implementação terminar THEN um Verifier independente SHALL conferir requisitos, gates e sensor em scratch.
3. WHEN o deploy estiver disponível THEN a entrega SHALL registrar URL e run; IF merges ou configuração Pages impedirem publicação THEN ela SHALL registrar a pendência concreta sem declarar site publicado.
**Independent Test:** SHAs/PRs/CI, conteúdo HTML real, relatório independente e preflight Pages.

## Edge Cases

- IF o build Vue não produzir manifests UI THEN o gate SHALL rejeitar catálogo vazio.
- IF a versão Java documental divergir do manifest THEN o build SHALL falhar.
- IF um pacote Vue não tiver exports THEN sua página SHALL indicar esse estado sem inventar APIs.
- IF Pages estiver ausente ou sem autorização THEN a entrega SHALL preservar artefatos/evidências e informar a ação administrativa necessária.

## Implicit Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Auth/external writes | AI, privilégios mínimos; nenhuma mudança de política ou merge implícito. |
| Source/version lifecycle | Dados do checkout, sem alegar registry publicado; versões calculadas somente pelo motor nativo. |
| Data safety | Worktrees existentes limpos; preservar clones sujos e features pendentes; sem Go. |
| Failure/observability | Gates reais e URLs/runs; publicação exige evidência de deploy, não só build. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PDOC-01 | Called documental | Execute | Implementado e gates aprovados; revisão independente pendente |
| PDOC-02 | Java | Execute | Quatro páginas/versões/SDK/loader/reactor aprovados e publicados no PR36 |
| PDOC-03 | Vue | Execute | Reparo b33547d publicado no PR39 após verify17/HTML/negativos de CI; revalidação independente limpa em andamento |
| PDOC-04 | Contrato de versão | Execute | Callers fixados em080df5a, versão/distros preservadas; revisão pendente |
| PDOC-05 | Evidência/publicação | Execute | Verifier e CI final em andamento; Pages habilitado, deploy pendente de merges humanos |

## Success Criteria

- [ ] Called compatível com site isolado e workspace, testado.
- [ ] Dois callers atuais, nove páginas de pacote e sites com versões corretas compilados.
- [ ] Gates locais/hospedados e revisão independente registrados, sem distribuição de pacotes.
- [ ] Sites publicados com URL/run ou publicação explicitamente pendente por autoridade administrativa/merges humanos.
