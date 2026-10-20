# Contexto: versionamento de packages

**Data:** 2026-10-16; aditivo em 2026-10-19.
**Status:** especificação inteira, incluindo Release Please/modularização e defaults, aprovada expressamente em 2026-10-19 com solicitação de implementação local. Design registrado em design.md aguardando revisão TLC; tarefas e código ainda não iniciados.
**Spec:** [spec.md](spec.md).

## Feature Boundary

Concluir a conciliação central Changesets/Turbo e definir o aceite de integração e distribuição de PackagesJava e PackagesVue. A primeira execução ocorre apenas no repositório .github. Não inclui desenvolvimento das funcionalidades dos pilotos.

O aditivo mantém esse escopo e inclui Release Please e modularização dos scripts comuns. Não inicia migração automática de aplicações nem troca os adaptadores aprovados para Java/Vue.

O usuário escolheu TypeScript para aproximar a manutenção da automação da programação habitual da equipe. O código central novo será escrito em TS; compilado JavaScript e entrypoints compatíveis preservam o consumo dos workflows.

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
- O conteúdo anterior da especificação e seus defaults estão aprovados, conforme confirmação expressa em 2026-10-19. Não reabrir essas decisões pela adição de um adaptador.
- Acrescentar Release Please sem remover standard-version, pois existem consumidores legados.
- Organizar e reutilizar os scripts com princípios próximos a POO, respeitando os recursos comuns a vários adaptadores.
- Usar TypeScript em vez de manter JavaScript como linguagem dos módulos novos; migrar os existentes conforme a reorganização, sem reescrita integral de uma vez.

### Escopo anterior aprovado

- Aproveitar o PR #13 existente sobre o #12, sem criar fluxo concorrente e sem reescrever histórico.
- Executar primeiro conciliação, testes e templates no .github; só depois alterar pilotos mediante autorização aplicável.
- Preservar versões por package no Vue, conforme Changesets atual. A decisão de versão conjunta para Java não se estende automaticamente ao Vue.
- Manter o limite de milestone em lotes Changesets: mais de um release com milestone bloqueia. Não criar mapa de versões novo nesta entrega.
- Separar GitHub tag/Release de distribuição no registry; encadear por resultado completo e published_sha.
- Testar consumo externo com cache isolado; falha parcial não provoca rollback de tags nem sobrescrita de coordenadas.

### Aditivo Release Please e modularização

- PKG-09 especifica seleção explícita, cálculo e arquivos nativos, PR técnico atualizável, publicação central e compatibilidade com standard-version.
- PKG-10 especifica encapsulamento, contrato de adaptador, registro de capacidades, composição e injeção explícita de processos/Git/API.
- Propor inicialmente Release Please para um componente Node/npm com lockfile. Os demais release-types e monorepos da ferramenta não ficam automaticamente certificados; Changesets continua dono do piloto Vue.
- O planejamento Release Please não pode chamar APIs mutantes nem receber token de escrita. O escritor central aplica o bundle e publica após gates, sem executar a ferramenta/configuração do consumidor.
- Extrair serviços de processos/paths, leitura Git/API, policy, bundle/PR técnico e publicação quando houver uso real por mais de um perfil. Não criar classes apenas para simular POO.
- Preservar os entrypoints e outputs públicos existentes. A redução de duplicação será acompanhada de testes de caracterização e contratos, não de uma meta artificial de redução de linhas.
- Os detalhes de versão upstream, opções aceitas, caminhos permitidos e APIs de planejamento serão fechados no design com evidência da versão escolhida.
- PKG-11 cobre TypeScript estrito, build bloqueado por erro de tipo, distribuição compilada e validação runtime. O compilador pertence à automação central, não às aplicações consumidoras.
- YAML continua a orquestrar os jobs; Bash limita-se aos entrypoints necessários. Interfaces/classes e composição organizam a lógica, sem impor classe base única.
- O design prevê src e dist no mesmo SHA e CI de correspondência. Não executar compilador ou loader TS no escritor privilegiado.

### Alternativas do aditivo

| Abordagem | Consequência | Recomendação |
| --- | --- | --- |
| Adaptador Release Please com serviços comuns por composição | Reusa gates sem acoplar a policy ao ciclo nativo de uma ferramenta | Adotar como default técnico proposto |
| Action Release Please completa em paralelo ao publicador central | Pode abrir/publicar por fora dos gates e competir com o fluxo existente | Não adotar |
| Hierarquia única de classes para todos os scripts | Exige herança artificial para ferramentas com ciclos distintos | Não adotar; classes continuam possíveis onde forem úteis |

### Alternativas consideradas

| Abordagem | Consequência | Recomendação |
| --- | --- | --- |
| Conciliar o adaptador no contrato existente e homologar em etapas | Reaproveita PRs e gates; permite avançar localmente sem merge | Adotar |
| Criar pipeline separada só para packages | Duplica policy, segurança e recuperação | Não adotar |
| Migrar Vue para versão única para reutilizar o perfil escalar | Muda o produto e histórico sem necessidade técnica | Não adotar |

### Agent's Discretion

O usuário autorizou a ampliação de escopo para Release Please e organização modular. Isso não delega a escolha de outro piloto ou ampliação de package managers, release-types e privilégios. O design poderá escolher componentes/testes dentro dos defaults explicitamente revisados.

### Declined / Undiscussed Gray Areas -> Assumptions

Os defaults anteriores e do aditivo foram aprovados em 2026-10-19. Isso inclui milestone de lote, ordem A/B/C, recuperação conservadora, primeiro perfil Release Please Node único, preparo nativo somente leitura, composição incremental e ausência de novo piloto. O design fixa versão, conjunto de opções e componentes técnicos sem reabrir essas decisões de escopo.

## Specific References

- PR #12 c7e610117edfbe8a6338ec0d3b6703156026ef70; PR #13 b1b2ec51906306c7afa5129f6557b30b9528f6b5.
- PackagesVue possui tags próprias por package; PackagesJava tem tag 0.0.1 sem prefixo v. Preservar ambas as histórias e verificar as bases antes da adoção.
- Guias nativos e changelogs devem ser reaproveitados na homologação, não substituídos por um algoritmo central.
- O upstream de standard-version declara depreciação; a sua manutenção futura não é assumida como garantia. Manter o perfil testado é uma decisão de compatibilidade do projeto, sem instalar fork automaticamente.
- O Release Please trabalha com PRs de release e não distribui packages em registries. Consumir seu cálculo/preparo nativos sem permitir uma segunda autoridade de escrita exige teste específico no design/implementação.

## Deferred Ideas

- Versionamento independente dos módulos Java, pnpm/Yarn, Gradle, prereleases e aprovação de environments por LLM.
- Campos/mapas de versão para milestones de monorepo. O recorte atual não define um novo formato de planejamento por package.
- Release-types e monorepos Release Please além do primeiro perfil validado; substituição automática de standard-version por ferramentas/forks alternativos.
