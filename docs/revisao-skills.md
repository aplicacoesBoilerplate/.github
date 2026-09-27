# Revisão das skills para as entregas da v1.0.0

**Data**: 2026-09-23

**Fontes**: [épica #1](https://github.com/ModulosTestesAutomatizados/.github/issues/1),
[versionamento #2](https://github.com/ModulosTestesAutomatizados/.github/issues/2),
[SonarQube #3](https://github.com/ModulosTestesAutomatizados/.github/issues/3),
[templates #4](https://github.com/ModulosTestesAutomatizados/.github/issues/4),
[Project GitHub Features](https://github.com/orgs/ModulosTestesAutomatizados/projects/6),
[status das specs](../specs/README.md) e [constituição](../.specify/memory/constitution.md).

**Escopo**: 21 skills globais em `~/.agents/skills/` e 6 skills OpenSpec geradas em
`.opencode/skills/`. Esta é uma avaliação de conteúdo; não altera as skills. As três
features em `specs/` são artefatos **SpecKit**. O planejamento da issue #2 e a
mudança OpenSpec `versionamento-por-sprint` ficam na branch `feature/issue-2`:
têm formatos e ciclos de vida diferentes e precisam permanecer coerentes; não
tratar um `tasks.md` SpecKit como tarefas OpenSpec.

## Regras confirmadas pelo Project e pelas issues

- A ordem e a grafia oficial do campo `Status` são as de `specs/README.md`. As três
  sub-issues estão em `Backlog`; a épica está em `In progress`. `Ready` é descrito no
  Project como **pronto para ser iniciado**, portanto não se pode presumir que `APPROVED`
  mova automaticamente o item para `Ready` sem verificar o workflow real.
- `Estimate` mede **valor agregado**, não esforço: 0 homologação; 1–5 features conforme
  Size XS–XL; 6 hotfix com Size variável; 7 PATCH, 8 MINOR, 9 MAJOR; 10 apenas épica.
  `Effort`, `Release` e os campos de Project/Issue Fields exigem descoberta por organização.
- O fluxo de sprint envolve milestone/épica, `release/<versão>` originada de `develop`,
  branch e PR por sub-issue, homologação antes de `release → develop` e nova homologação
  antes de `develop → master`. A ferramenta de versão varia por consumidor.
- A análise SonarQube deve ser acionada por PR. Um quality gate reprovado/inconclusivo
  não aprova o check; ruleset/check obrigatório bloqueia merge. `Request changes` do
  Project não substitui review humana; scanner temporário não implica servidor efêmero.
- Issue forms podem orientar título e exigir campos do corpo, mas não se deve pressupor
  que definem parent, milestone, Issue Fields ou Project Fields automaticamente. PR template
  reutiliza as quatro seções do relatório; migração dos pilotos preserva o bug da CLI.

## Skills globais — prioridades de revisão

| Skill | Decisão | Mudança recomendada |
| --- | --- | --- |
| `github-planning` | **Reestruturar — P0** | Substituir tabela Estimate/Size atual (1–10) pela escala da #4, parametrizar `v0.0.1`/owner e conferir os nove status e transições reais; separar Issue Fields de Project Fields e release PR de sub-issue PR. Preservar triagem, épica, vínculo e análise de bloqueios. |
| `entregas` | **Reestruturar — P0** | Remover exigência indiscriminada de Kafka/Playwright/build para qualquer entrega; usar validações por stack. Corrigir status `In Progress`/`In Review`, `Ready` e remoto fixo, e exigir gate SonarQube por PR apenas quando configurado, sem confundir Project com branch protection. Preservar isolamento, testes pertinentes e review humano. |
| `gitlens-mcp` | **Reestruturar — P0** | Trocar exemplos `release/v0.0.1` por milestone real e corrigir status/ciclo de revisão. Não afirmar indisponibilidade universal dos campos no MCP; verificar capacidades atuais antes de escolher GraphQL. Preservar rastreabilidade e separação transporte/metadados. |
| `git-worktree` | **Ajustar — P0** | Parametrizar branch de release da milestone da issue e usar exatamente `In progress`. Preservar um worktree por entrega e verificações de worktree existente. |
| `github-permissions` | **Reestruturar — P0** | Distinguir GitHub App/GITHUB_TOKEN/PAT e permissões de Projects/Issues/PRs por operação; remover exclusividade obsoleta atribuída ao GraphQL quando o MCP cobrir fields. Não sugerir imprimir `~/.npmrc` ou `settings.xml`, que podem conter tokens. Preservar mínimo privilégio e interação humana para concessão de credenciais. |
| `github-cli-graphql` | **Reestruturar — P0** | Separar exemplos de **Issue Fields** dos de **Project V2 Fields**; consultar schema/IDs/opções reais, validar exemplos de `gh project item-edit` antes de orientar uso e não fixar org/projeto. Preservar consulta dinâmica em vez de IDs hardcoded. |
| `sonarqube` | **Ampliar — P0** | Acrescentar política de quality gate para código novo, check obrigatório por PR e `Request changes` somente com vínculo/permissão; distinguir servidor persistente e scanner efêmero. Manter orientação de corrigir bugs/vulnerabilidades e cobrir regras novas. |
| `cicd` | **Ampliar — P1** | Descrever workflows reutilizáveis via contrato e callers curtos, eventos de PR versus publicação pós-merge, permissões/secrets mínimos, tags imutáveis e adapters de versionamento por consumidor. Preservar lint/test/build e práticas de Docker onde aplicáveis. |
| `packages` | **Reestruturar — P1** | Retirar exemplo que escreve PAT literal em `.npmrc`; corrigir afirmação absoluta de que `standard-version` sempre eleva MINOR e lê só o último commit; distinguir Changesets/Turbo, Maven/jgitver e tags no momento da publicação. Preservar exemplos de empacotamento contextualizados. |
| `generate-report` | **Ajustar — P1** | Padronizar exatamente `Realização`, `Fontes modificados`, `p/ teste`, `O que há de novo` no PR template e adaptar instruções de teste para workflows/templates, não apenas interface gráfica. Preservar formato de quatro partes. |
| `backend` | **Ajustar — P2** | Manter arquitetura Java, testes e `verify`; tornar Release Please uma opção do consumidor, não concorrente implícita ao fluxo de release por sprint/jgitver. |
| `vue` | **Ajustar — P2** | Mover contratos específicos de BaseForm/GenericView do boilerplate para `boilerplate-vue`; conservar diretrizes gerais de Vue/Pinia e não impor estrutura de aplicação a workflows compartilhados. |
| `toolkit` | **Ajustar — P2** | Detectar se a sessão roda em container antes de afirmar que `localhost` sempre aponta para ele; preservar isolamento e limpeza seletiva. |
| `graphify` | **Ajustar — P2** | Restringir ativação a análise de grafo solicitada/necessária e evitar imposição de subagentes/instalação em simples revisão de documentação; manter procedimento para uso explícito de graphify. |
| `context7` | **Manter** | Consulta a fontes atuais continua adequada ao validar suporte de GitHub/SonarQube e ferramentas de versão; evitar transmitir dados privados em queries. |
| `boilerplate-vue` | **Manter** | Contratos específicos do projeto permanecem nele; pode receber padrões extraídos da `vue` genérica se estiverem atuais. |
| `type-orm` | **Manter** | Orientação de ORM não conflita com as três entregas. |
| `sc` | **Manter** | Contratos da SoftwareCenter são de domínio distinto; sem alteração decorrente destas issues. |
| `kafka` | **Manter** | Padrões de mensageria continuam específicos; não o tornar validação obrigatória de todo backend. |
| `pencil` | **Manter** | Sem impacto direto em pipelines, Project ou templates GitHub. |
| `playwright` | **Manter** | Útil para UI/E2E pertinente, não obrigatório para todas as entregas. |

## Skills locais OpenSpec

| Skill | Decisão | Motivo |
| --- | --- | --- |
| `openspec-propose` | **Manter** | Gera proposta e artefatos na raiz OpenSpec; a mudança existente `versionamento-por-sprint` referencia, mas não substitui, a spec SpecKit #2. |
| `openspec-apply-change` | **Manter** | Só executa tarefas de uma mudança OpenSpec existente; `specs/001-*/tasks.md` do SpecKit não se torna elegível por existir ao lado dela. |
| `openspec-explore` | **Manter** | Investigação sem implementar respeita a separação planejamento/entrega. |
| `openspec-update-change` | **Manter** | Atualiza apenas artefatos OpenSpec; revisar divergências com a spec SpecKit #2 ao atualizar a mudança `versionamento-por-sprint`, sem sincronização automática. |
| `openspec-sync-specs` | **Manter** | Delta specs OpenSpec e specs SpecKit têm caminhos e formatos diferentes; não sincronizar um no outro automaticamente. |
| `openspec-archive-change` | **Manter** | Arquivamento OpenSpec só depois de verificar os artefatos da mudança correspondente. |

As seis skills locais são geradas pelo OpenSpec. Se precisarem de orientação específica do
projeto, prefira acrescentar contexto em `openspec/config.yaml` ou documentação própria,
sem reescrever instruções geradas nem misturar a governança do SpecKit com a do OpenSpec.

## Ordem proposta para a reestruturação

1. **P0 — fluxo e fonte de verdade**: alinhar `github-planning`, `entregas`, `gitlens-mcp`,
   `git-worktree`, `github-permissions` e `github-cli-graphql` com Project #6, escala #4,
   status reais e permissões verificadas. Evita automatizar metadados errados.
2. **P0 — bloqueio de qualidade**: detalhar `sonarqube` com a #3, separando check requerido,
   status visual e análise efêmera.
3. **P1 — reuso e publicação**: atualizar `cicd`, `packages` e `generate-report` com #2/#4,
   antes de codificar callers/templates.
4. **P2 — limpeza de escopo**: revisão pontual de `backend`, `vue`, `toolkit` e `graphify`.
   Skills marcadas **Manter** seguem independentes desta sprint.

Esta auditoria não comprova que os workflows de Project já façam todas as transições
descritas nas skills antigas. Confirmar automações efetivas e permissões antes de reescrever
qualquer regra como fato operacional.
