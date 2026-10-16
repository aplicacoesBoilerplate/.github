# Contexto: versionamento de packages

**Data:** 2026-10-16.
**Status:** proposta aguardando revisão do usuário; design e tarefas ainda não iniciados.
**Spec:** [spec.md](spec.md).

## Feature Boundary

Concluir a conciliação central Changesets/Turbo e definir o aceite de integração e distribuição de PackagesJava e PackagesVue. A primeira execução ocorre apenas no repositório .github. Não inclui desenvolvimento das funcionalidades dos pilotos.

## Implementation Decisions

### Decisões já tomadas pelo usuário

- A pipeline central é responsável pelas regras; callers repassam configuração e encadeiam CI.
- O adaptador nativo calcula; milestone opcional valida versão exata e incremento, sem impor uma versão ao adaptador.
- Override exige autor do label Maintain/Admin e aprovação posterior de outra pessoa Maintain/Admin no head atual. Milestone inválida não é contornável.
- develop -> master e hotfix/* -> master seguem os mesmos gates.
- Primeira versão de escopo sem tags estáveis reconhecidas é 0.0.1, nunca uma tag 0.0.0.
- Environment de publicação é opcional.
- Java é Maven com uma versão conjunta por repositório; o piloto é PackagesJava.
- Este chat não implementa funcionalidades/issues dos pilotos.
- Implementação será feita neste chat, sem delegar lotes por padrão; revisão independente é o gate final TLC.
- A issue #4 foi reaberta; não considerar PR aberto ou CI central verde como homologação completa.

### Proposta desta iteração

- Aproveitar o PR #13 existente sobre o #12, sem criar fluxo concorrente e sem reescrever histórico.
- Executar primeiro conciliação, testes e templates no .github; só depois alterar pilotos mediante autorização aplicável.
- Preservar versões por package no Vue, conforme Changesets atual. A decisão de versão conjunta para Java não se estende automaticamente ao Vue.
- Manter o limite de milestone em lotes Changesets: mais de um release com milestone bloqueia. Não criar mapa de versões novo nesta entrega.
- Separar GitHub tag/Release de distribuição no registry; encadear por resultado completo e published_sha.
- Testar consumo externo com cache isolado; falha parcial não provoca rollback de tags nem sobrescrita de coordenadas.

### Alternativas consideradas

| Abordagem | Consequência | Recomendação |
| --- | --- | --- |
| Conciliar o adaptador no contrato existente e homologar em etapas | Reaproveita PRs e gates; permite avançar localmente sem merge | Adotar |
| Criar pipeline separada só para packages | Duplica policy, segurança e recuperação | Não adotar |
| Migrar Vue para versão única para reutilizar o perfil escalar | Muda o produto e histórico sem necessidade técnica | Não adotar |

### Agent's Discretion

Ainda não há delegação nova de decisões de produto. O design poderá escolher componentes e testes dentro das regras aprovadas, sem ampliar adaptadores, package managers ou privilégios.

### Declined / Undiscussed Gray Areas -> Assumptions

Novos defaults estão integralmente enumerados em Assumptions & Open Questions da spec. Em especial: milestone de lote, ordem A/B/C, consolidação do release Vue e tratamento conservador de coordenadas já publicadas. Nenhum deles está marcado como aprovação do usuário.

## Specific References

- PR #12 c7e610117edfbe8a6338ec0d3b6703156026ef70; PR #13 b1b2ec51906306c7afa5129f6557b30b9528f6b5.
- PackagesVue possui tags próprias por package; PackagesJava tem tag 0.0.1 sem prefixo v. Preservar ambas as histórias e verificar as bases antes da adoção.
- Guias nativos e changelogs devem ser reaproveitados na homologação, não substituídos por um algoritmo central.

## Deferred Ideas

- Versionamento independente dos módulos Java, pnpm/Yarn, Gradle, prereleases e aprovação de environments por LLM.
- Campos/mapas de versão para milestones de monorepo. O recorte atual não define um novo formato de planejamento por package.
