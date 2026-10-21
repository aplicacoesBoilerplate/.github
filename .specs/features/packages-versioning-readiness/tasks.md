# Versionamento central TypeScript: tarefas

## Execution Protocol (MANDATORY -- do not skip)

Usar a skill `tlc-spec-driven` e seguir seu fluxo Execute e Critical Rules. Se a skill não puder ser carregada, parar e informar o usuário. Testes derivam da spec; cada tarefa futura inclui seus testes, gate, status e commit atômico. Nunca enfraquecer testes para acomodar a implementação. O verificador final é distinto do autor.

**Design:** [design.md](design.md). **Spec:** [spec.md](spec.md).
**Status:** Execução em andamento; 5/40 tarefas concluídas. Evidências em [implementation-log.md](implementation-log.md).
**Escopo da execução:** implementar neste chat, uma tarefa por vez, conforme preferência já registrada. A revisão independente documental anterior não substitui o Verifier de implementação.

T1–T33 são preparação e verificação locais da entrega A. T34–T35 completam sua disponibilidade remota. T36–T37 produzem B; T38–T39 produzem C. T40 consolida o aceite completo. Etapas remotas ficam pendentes sem execução autorizada. Autorizações anteriores devem ser conferidas pelo alvo/ação antes de pedir nova permissão; esta rodada não as exerce.

## Test Coverage Matrix

> Gerada da codebase, guidelines e spec. Fontes: AGENTS.md, scripts/versioning/README.md (testes/segurança), .github/workflows/README.md, .github/workflows/ci.yml e tests/versioning/run.mjs. Não há threshold global ou comando lint/format próprio deste componente observado. Usar todos os ACs/edge cases como alvo; contagem é piso, não substituto de cobertura.

Amostras lidas: adapter-registry, release-policy, version-bundle, native-workflows, process-runner, git-inputs, real-standard-version e real-jgitver. São fixtures Node com `node:assert/strict`, Git temporário e dependências injetadas; contratos YAML usam PyYAML. A união observada contém 29 fixtures determinísticas: 27 no #12 + changesets-flow e changesets-publish no #13. T1 registra assertions/cenários reais antes de alterar; os números mínimos de casos abaixo são metas futuras, não resultados de testes já rodados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Contratos, policy e guias | unit + type quando aplicável | Cada AC e branch de decisão; negativos de capacidade, milestone e override | tests/versioning/*.mjs e fixtures de tipos | Quick; Build para tipos |
| Processos, Git, API e filesystem | integration | Sucesso, erro, limites, permissão/SHA e ausência de efeitos no import | tests/versioning/*port*.mjs, *bundle*.mjs, git-inputs.mjs | Quick |
| Adaptadores | integration + native | Cálculo e arquivos reais, bootstrap/erro e formatos suportados; mocks não certificam a ferramenta | tests/versioning/real-*.mjs e testes de contrato | Native por perfil |
| PR técnico/publicador | integration | Estado e payload exatos, origem, autorização, retry, conflito, concorrência e parcial | tests/versioning/*publication*.mjs, *technical*.mjs, *publish*.mjs | Quick e Full ao fechar fase |
| Distribuição compilada | type + integration | Erro bloqueia emissão; lista/bytes de dist íntegros; compilado funciona sem loader | tests/versioning/typescript-build.mjs, dist-integrity.mjs | Build |
| YAML/callers | semantic integration | Eventos, permissões, needs, environment, SHA central/consumidor e outputs | tests/versioning/*workflow*.mjs, caller-contracts.mjs | Build |
| POMs/tarballs | integration + native packaging | Nome/versão/referências/digest/SHA e rejeição antes do envio | tests/versioning/*artifacts.mjs | Native-Maven ou Build |
| READMEs/relatórios | documentary (sem teste funcional de prosa) | Links, comandos existentes, limites e evidências verdadeiros | READMEs e .specs | Docs |
| Pilotos/registry | remote integration/e2e | Todos os cenários da matriz de aceite e consumo externo sem cache | docs/integration-baselines/ | Hosted, Pilot, Registry |

## Gate Check Commands

> Comandos existentes extraídos da CI/runner. Comandos marcados NOVO são entregáveis de suas tarefas: não existem nem foram executados nesta rodada. Executar a partir da raiz do worktree pertinente; fixtures novas entram no runner na mesma tarefa que cria o comportamento. Não usar --if-present para silenciar gate ausente.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Docs | Artefatos de planejamento e prosa | `git diff --check`; `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_spec.py .specs/features/packages-versioning-readiness/spec.md --strict`; `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_tasks.py .specs/features/packages-versioning-readiness/tasks.md --strict`; revisar links locais |
| Baseline | T1, antes de migrar | `node tests/versioning/run.mjs --local`, conferindo união de 29 fixtures; comparar históricos/SHAs e inventário, sem inferir compatibilidade pela quantidade |
| Toolchain | T2, antes de existir check-dist | `npm --prefix scripts/versioning run typecheck` + `npm --prefix scripts/versioning run build` + `node tests/versioning/typescript-build.mjs` + suíte local; todos os comandos novos são criados na própria T2 |
| Quick | Cada tarefa com código | `node tests/versioning/run.mjs --local` + `npm --prefix scripts/versioning run typecheck` (NOVO T2); rodar diretamente a fixture afetada quando ainda na preparação RED |
| Build | Configuração, workflow, tipos e fim de fase, a partir de T3 | Quick + `npm --prefix scripts/versioning run check-dist` (NOVO T3) + `git diff --check`; check-dist compila isoladamente sem alterar dist. Ao editar fontes, gerar dist com `npm --prefix scripts/versioning run build` antes de preparar o commit. Na CI, conferir o dist recebido ANTES de qualquer build que o sobrescreva |
| Native-Go | T11 e regressão final | Quick + `node tests/versioning/run.mjs --real-go` |
| Native-Maven | T12/T28 e regressão final | Quick + `node tests/versioning/maven-setup.mjs`, `node tests/versioning/real-jgitver.mjs`, `node tests/versioning/real-maven-reactor.mjs`, `node tests/versioning/real-jgitver-prefix.mjs`; T28 acrescenta `node tests/versioning/maven-artifacts.mjs` (NOVO) |
| Native-Standard | T13 e regressão final | Quick + `node tests/versioning/real-standard-version.mjs` + `node tests/versioning/real-standard-bootstrap.mjs` |
| Native-Changesets | T14 e regressão final | Quick + `node tests/versioning/real-changesets.mjs`; ampliar o mesmo comando para testar os dois lockfiles fixados 2.29.5/3.0.3 |
| Native-ReleasePlease | T16 e regressão final | Quick + `node tests/versioning/real-release-please.mjs` (NOVO T16), SDK real 17.11.2 com transporte controlado |
| Full | Fim da integração e verificação central | Build + todos os cinco gates Native acima; incluir todas as fixtures novas no runner e registrar ambiente/pins |
| Verify-Central | T33, autor distinto do verificador | Full + mutações comportamentais em scratch; relatório central com file:line, testes, SHA/diff e falhas; não rodar validate_state como se toda a feature estivesse entregue |
| Hosted | T34 | Run real da CI do PR no SHA enviado, inspecionado por `gh run view RUN_ID --repo aplicacoesBoilerplate/.github --json headSha,status,conclusion,url`; RUN_ID é o ID observado, nunca literal |
| Pilot | T36/T37 | Executar a matriz remota autorizada abaixo; obter `gh run view RUN_ID --repo OWNER/REPO --json headSha,status,conclusion,url` com valores observados; comparar outputs/artifacts e refs |
| Registry | T38/T39 | Roteiros concretos dos callers T30/T35: build no published_sha, envio autorizado e instalação externa; guardar comandos/coordenadas/digests usados, sem tokens |
| Closure | T40 | Revisão independente das evidências + `python C:/Users/gerso/.codex/skills/tlc-spec-driven/scripts/validate_state.py packages-versioning-readiness`; só permite PASS após A/B/C aplicáveis comprovados |

Gates Native exigem ferramentas fixadas/configuradas, não fallback silencioso. No Windows, as fixtures antigas usam Git Bash explícito durante a migração. Ao final, chamadas próprias a Bash saem; launchers nativos de ferramentas podem continuar existindo. Linux hospedado é necessário para confirmar o contrato final de runner. Instalações usam manifest/lock e cwd/prefixo absoluto, sem procurar manifest em diretório ancestral.

Typecheck não é lint de estilo. Não há lint preexistente omitido; se uma ferramenta for introduzida depois, incluí-la explicitamente no Build. Testes estruturais que conferem `.sh` devem conferir o equivalente Node na mesma tarefa, mantendo as proteções que motivaram a assertion.

## Execution Plan

As fases e tarefas são sequenciais. Dependência no predecessor incorpora todas as fases anteriores; dependências de dados relevantes são descritas em Reuses. A cadeia completa, inclusive nas fronteiras, é:

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> T17 -> T18 -> T19 -> T20 -> T21 -> T22 -> T23 -> T24 -> T25 -> T26 -> T27 -> T28 -> T29 -> T30 -> T31 -> T32 -> T33 -> T34 -> T35 -> T36 -> T37 -> T38 -> T39 -> T40
```

- Phase 1: Base e distribuição compilada, T1–T7.
- Phase 2: Governança e evidência, T8–T10.
- Phase 3: Adaptadores nativos, T11–T16.
- Phase 4: Preparação técnica e publicação, T17–T23.
- Phase 5: Workflows e retirada do legado, T24–T27.
- Phase 6: Callers, distribuição e documentação, T28–T33.
- Phase 7: Entrega central remota, T34–T35.
- Phase 8: Homologação dos pilotos, T36–T37.
- Phase 9: Distribuição e aceite completo, T38–T40.

## Task Breakdown

Todos os campos Done when estão abertos. Números de casos são mínimos planejados; cobrir integralmente os ACs referenciados mesmo que isso exija mais casos. Tests pertencem à mesma tarefa do código, nunca a uma fase posterior.

Ferramentas previstas por tarefa: TLC como protocolo; Git/filesystem para trabalho local; CI/CD para contratos de workflow; Context7 para APIs quando disponível, com documentação oficial como fallback registrado. GitHub CLI/connector somente para ações pertinentes autorizadas. T33/T40 usam verificador independente; T34–T39 precisam das autorizações/ambientes indicados. Essa escolha preserva a execução inline já solicitada.

### Phase 1: Base e distribuição compilada

#### T1: Reconciliar a base de versionamento

**What**: Integração local do delta pertinente de master, PRs #12/#13 e planejamento, com inventário antes da mudança.
**Where**: `branch de integração de versionamento`
**Depends on**: None
**Reuses**: Histórico e fixtures de #12/#13.
**Requirement**: PKG-01.1–4.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [x] 29 fixtures determinísticas da união (27 do #12 e duas exclusivas do #13), sem perder cenários; registrar SHAs, alterações selecionadas e caminhos fora de escopo preservados.
- [x] Gate Baseline passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: suíte existente, caracterização dos conflitos e baseline por fixture; não enfraquecer assertions.
**Gate**: Baseline (Gate Check Commands).
**Commit**: `chore(versioning): reconcile versioning baselines`

#### T2: Definir toolchain TypeScript

**What**: Um pacote privado de desenvolvimento central com compilação estrita, sem bin/publicação de CLI.
**Where**: `scripts/versioning/`
**Depends on**: T1
**Reuses**: Node 24 central e isolamento npm já previsto.
**Requirement**: PKG-11.1–2,4–5,8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [x] 5 casos mínimos: fonte válida, erro de tipo, noEmitOnError, import ESM e compilado executável sem loader; fixar compilador/tipos/lock, sem instalar no consumidor.
- [x] Gate Toolchain passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit + integration: nova tests/versioning/typescript-build.mjs; pacote/config/testes são um único componente de build.
**Gate**: Toolchain (Gate Check Commands).
**Commit**: `build(versioning): add strict TypeScript toolchain`

#### T3: Verificar correspondência do compilado

**What**: Verificador de distribuição que recompila isoladamente e compara conjunto completo de arquivos e bytes.
**Where**: `scripts/versioning/src/build/check-dist.ts`
**Depends on**: T2
**Reuses**: Toolchain T2.
**Requirement**: PKG-11.3,8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [x] 6 casos mínimos: distribuição correta, byte alterado, arquivo faltante, extra, symlink e reconstrução repetível; nenhuma verificação baseada apenas em git diff.
- [x] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova tests/versioning/dist-integrity.mjs, incluindo erros deliberados em cópias temporárias.
**Gate**: Build (Gate Check Commands).
**Commit**: `build(versioning): verify compiled distribution integrity`

#### T4: Migrar a porta de processos e paths

**What**: Executor tipado que preserva confinamento, argv, ambiente sanitizado e limites.
**Where**: `scripts/versioning/src/ports/process.ts`
**Depends on**: T3
**Reuses**: process-runner.mjs e paths.sh.
**Requirement**: PKG-10.3,6,8–9; PKG-11.1,6–7.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [x] 8 casos mínimos: sucesso, path fora, symlink, segredo removido, timeout 120s configurável no teste, saída >1MiB, exit não zero e argumento Windows inválido; import sem I/O.
- [x] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit + integration: ampliar process-runner.mjs na própria tarefa e executar contra dist.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): type process and path boundaries`

#### T5: Migrar a porta Git e o snapshot

**What**: Leitura de origem/refs/blobs por SHA com revalidação para retries.
**Where**: `scripts/versioning/src/ports/git.ts`
**Depends on**: T4
**Reuses**: git-inputs.mjs e collect-origin-report.sh.
**Requirement**: PKG-03.4,7; PKG-05.3–4,8; PKG-10.3; PKG-11.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [x] 7 casos mínimos: SHA correto/incorreto, tag anotada com peeling, ref nova, troca de tag, retry da própria tag idêntica e origem avançada; Git real temporário.
- [x] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: git-inputs.mjs e nova git-port.mjs; import sem I/O.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): centralize typed Git snapshots`

#### T6: Definir transporte GitHub de leitura e escrita

**What**: Portas separadas, paginação completa e erros HTTP explícitos.
**Where**: `scripts/versioning/src/ports/github.ts`
**Depends on**: T5
**Reuses**: Consultas GitHub já usadas pelos coletores.
**Requirement**: PKG-03.2–3,8; PKG-08.5; PKG-10.3,6,8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos mínimos: página final, múltiplas páginas, 404, 401, 403, 429, 5xx e mutação recusada em ReadApi; nenhuma credencial em modelo/log.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit + integration: nova github-port.mjs com transporte controlado e payloads esperados.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): separate typed GitHub ports`

#### T7: Normalizar contrato e registro dos cinco perfis

**What**: Envelope single/batch e capacidades validadas pelo registro confiável.
**Where**: `scripts/versioning/src/adapter-contract.ts`
**Depends on**: T6
**Reuses**: adapter-registry.mjs e version-report.mjs; registro auxiliar no mesmo componente.
**Requirement**: PKG-01.2; PKG-02.5–6; PKG-10.1–2,6,8,10; PKG-11.7–8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 10 casos mínimos: cinco IDs, unknown/__proto__, capacidade inválida, JSON inválido, lote vazio/unitário/múltiplo e substituto confiável; tipos negativos rejeitam contexto/capacidade incompatível.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit + type: adapter-registry.mjs, version-report.mjs e novos adapter-contract.mjs/type-contracts; nomes finais registrados no gate.
**Gate**: Build (Gate Check Commands).
**Commit**: `refactor(versioning): define typed adapter contracts`

### Phase 2: Governança e evidência

#### T8: Migrar a policy comum

**What**: Policy pura de rotas, milestone e override para single/batch.
**Where**: `scripts/versioning/src/services/release-policy.ts`
**Depends on**: T7
**Reuses**: release-policy.mjs.
**Requirement**: PKG-04.1–6,9; PKG-09.8; PKG-10.4.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 12 casos mínimos: rotas normal/hotfix equivalentes; sem milestone; exata; versão divergente; bump divergente; título inválido com override; duas pessoas válidas; mesmo ator; papel insuficiente; review anterior; lote múltiplo com/sem milestone.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit: release-policy.mjs ampliado; regra do PR funcional preservada quando PR técnico não tem milestone.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): unify typed release policy`

#### T9: Coletar evidência de PR e CI

**What**: Serviço que reduz timeline/reviews e vincula autorização, metadados e CI aos SHAs corretos.
**Where**: `scripts/versioning/src/services/pr-evidence.ts`
**Depends on**: T8
**Reuses**: collect-pr-policy.sh, release-gates.sh e redutor de reviews atual.
**Requirement**: PKG-03.6–8; PKG-04.1,5,9; PKG-05.8; PKG-09.6,11.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 10 casos mínimos: aprovação atual, dismissed, changes-requested, bot, autor do PR, head antigo, CI em SHA diferente, milestone removida/trocada e label sem autorização; roles consultados e auditados.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: pr-policy.mjs, pr-check.mjs e nova pr-evidence.mjs, com respostas API e saída auditável.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): bind PR evidence to reviewed commits`

#### T10: Migrar o guia de homologação

**What**: Gerador Markdown/JSON a partir de relatório nativo, PR e checklist.
**Where**: `scripts/versioning/src/services/homologation-guide.ts`
**Depends on**: T9
**Reuses**: homologation-guide.mjs/.sh.
**Requirement**: PKG-04.7; PKG-10.5–6; PKG-11.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 5 casos mínimos: release única, lote com dependente, no-release, texto com caracteres especiais e checklist pendente; não escrever commits nem afirmar aprovação humana.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit: homologation-guide.mjs contra dist com payloads completos, não apenas existência do arquivo.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): generate typed homologation guides`

### Phase 3: Adaptadores nativos

#### T11: Migrar o adaptador Go

**What**: Coletor nativo tipado, independente da aplicação piloto.
**Where**: `scripts/versioning/src/adapters/go-gitsemver.ts`
**Depends on**: T10
**Reuses**: adapters/go-gitsemver.mjs e fixtures Go.
**Requirement**: PKG-01.3; PKG-06.4; PKG-10.1; PKG-11.1,6.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos mínimos: bootstrap 0.0.1, base estável, JSON/SHA inválido, retry de commit tagueado com Sha nativo vazio e prefixo fora de escopo; nenhum algoritmo alternativo.
- [ ] Gate Native-Go passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: go-adapter.mjs, go-version.mjs e --real-go; substituir invocação .sh no mesmo teste mantendo os resultados esperados.
**Gate**: Native-Go (Gate Check Commands).
**Commit**: `refactor(versioning): migrate go-gitsemver adapter to TypeScript`

#### T12: Migrar o adaptador Maven

**What**: Perfil jgitver tipado com parser de propriedades e instalação confiável de Maven.
**Where**: `scripts/versioning/src/adapters/jgitver.ts`
**Depends on**: T11
**Reuses**: jgitver.mjs, java-properties.mjs, install-maven.sh.
**Requirement**: PKG-01.3; PKG-06.2,4; PKG-10.1; PKG-11.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 famílias mínimas: versão/propriedades/SHA, checksum inválido, prefixo, bootstrap, reactor quatro módulos e tag anotada; manter as 118 assertions existentes do reactor como piso, conferido em T1.
- [ ] Gate Native-Maven passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: jgitver-adapter, java-properties, maven-setup e fixtures Maven reais; auxiliares/parser/installer pertencem a este perfil.
**Gate**: Native-Maven (Gate Check Commands).
**Commit**: `refactor(versioning): migrate jgitver adapter to TypeScript`

#### T13: Migrar o adaptador standard-version

**What**: Perfil legado tipado e preparo npm/lock reutilizável, somente no leitor.
**Where**: `scripts/versioning/src/adapters/standard-version.ts`
**Depends on**: T12
**Reuses**: standard-version.mjs, install-node.sh e sync-npm-lock.mjs.
**Requirement**: PKG-01.3; PKG-03.2; PKG-09.12; PKG-10.1; PKG-11.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos mínimos: 1.0.0 + fix =>1.0.1, feat =>1.1.0, breaking =>2.0.0, bootstrap 0.0.1, configuração rejeitada e lock coerente; preservar schema1 e nenhuma migração para fork.
- [ ] Gate Native-Standard passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: standard-adapter.mjs, standard-flow.mjs, standard-precomputed.mjs e fixtures standard reais.
**Gate**: Native-Standard (Gate Check Commands).
**Commit**: `refactor(versioning): preserve standard-version in TypeScript`

#### T14: Integrar Changesets ao contrato tipado

**What**: Coletor/preparador de lote nativo completo com dependentes e consumo de changesets.
**Where**: `scripts/versioning/src/adapters/changesets.ts`
**Depends on**: T13
**Reuses**: Mudanças pertinentes do PR #13 e preparo npm T13.
**Requirement**: PKG-01.2–3; PKG-02.1–7; PKG-06.4; PKG-10.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 7 casos mínimos por matriz CLI: core 2.0.0 major =>3.0.0 e cli dependente 1.0.0 =>1.0.1, vazio, privado/ignorado, erro, prerelease, lock divergente e namespace; pins 2.29.5/3.0.3.
- [ ] Gate Native-Changesets passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: changesets-flow.mjs e real-changesets.mjs ampliados; dependentes/lock/arquivos verificados, sem executar gerador no escritor.
**Gate**: Native-Changesets (Gate Check Commands).
**Commit**: `feat(versioning): integrate typed Changesets plans`

#### T15: Confinar Release Please ao snapshot de leitura

**What**: Configuração permitida e implementação do SCM nativo fixada à origem funcional.
**Where**: `scripts/versioning/src/adapters/release-please/snapshot-scm.ts`
**Depends on**: T14
**Reuses**: Portas Git/GitHub e API SCM upstream fixada.
**Requirement**: PKG-09.3,10,13; PKG-10.3,6.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos mínimos: leitura em SHA congelado, paginação, ref avançada, manifesto divergente, mutação REST, mutação GraphQL, opção extra e workspace não suportado; nenhum create remoto.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: unit + integration: nova release-please-snapshot.mjs; módulo de configuração auxiliar incluído, transporte nega rede não prevista.
**Gate**: Quick (Gate Check Commands).
**Commit**: `feat(versioning): constrain Release Please snapshot reads`

#### T16: Integrar cálculo e arquivos nativos Release Please

**What**: Adaptador único Node/npm usando SDK 17.11.2 e bundle de dados, sem escrita nativa.
**Where**: `scripts/versioning/src/adapters/release-please.ts`
**Depends on**: T15
**Reuses**: Manifest.buildPullRequests/buildReleases e snapshot T15.
**Requirement**: PKG-09.1–4,7–10,13–14; PKG-10.1; PKG-11.1.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos mínimos com SDK real: patch 1.0.1, minor 1.1.0, major 2.0.0 desde 1.0.0, bootstrap nativo 0.0.1, vazio, default inicial incompatível, arquivo extra e histórico divergente; lock próprio isolado.
- [ ] Gate Native-ReleasePlease passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: nova real-release-please.mjs, sem rede mutante; expectativas fixas independentes do resultado observado.
**Gate**: Native-ReleasePlease (Gate Check Commands).
**Commit**: `feat(versioning): add native Release Please adapter`

### Phase 4: Preparação técnica e publicação

#### T17: Compartilhar transporte validado de arquivos

**What**: Bundle schema2 com políticas puras por perfil e ponte compatível schema1.
**Where**: `scripts/versioning/src/services/version-files.ts`
**Depends on**: T16
**Reuses**: version-bundle.mjs, verify-version-files.mjs e verificações do #13.
**Requirement**: PKG-03.3–5,8; PKG-02.2; PKG-10.5; PKG-11.7.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 12 casos mínimos: schemas válidos, hash/semântica/base alterados, paths absolutos/traversal, symlink ancestral, duplicata, delete não autorizado, limites 10MiB/16MiB/100 releases/1000 operações e igualdade nas fronteiras; zero escrita nos negativos.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: version-bundle.mjs e nova multi-version-bundle.mjs, com bytes/árvore verificados antes e depois.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): share validated version file bundles`

#### T18: Criar e atualizar PR técnico

**What**: Serviço de identidade/proveniência e aplicação de bundle, sem ferramentas nativas.
**Where**: `scripts/versioning/src/services/technical-release.ts`
**Depends on**: T17
**Reuses**: prepare-version-pr.sh, version-pr.mjs e Git Data API via portas.
**Requirement**: PKG-03.1–5; PKG-09.5–6,11; PKG-10.5.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 7 casos mínimos: criar, retry sem duplicação, atualizar RP por repo/branch/componente, pais antigos/novos coerentes, head manual, artifact de outra origem e corrida; sem force-push.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova technical-release.mjs; sentinelas impedem npm/Maven/SDK no escritor, conferir trees/commits/refs/corpo PR.
**Gate**: Quick (Gate Check Commands).
**Commit**: `feat(versioning): share technical release PR preparation`

#### T19: Validar integração do PR técnico

**What**: Validação do bundle revisado, reviews efetivos, origem e commit integrado.
**Where**: `scripts/versioning/src/services/technical-merge.ts`
**Depends on**: T18
**Reuses**: version-pr.mjs, validate-version-pr.sh e T9.
**Requirement**: PKG-03.6–7; PKG-04.9; PKG-09.6–7,11.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos mínimos: merge, squash e rebase de um commit; head antigo, dismissed, origem avançada, metadado funcional alterado e rebase multi-commit não comprovado; CI no SHA publicado.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: version-pr.mjs, post-merge.mjs e nova technical-merge.mjs; distinguir os três SHAs explicitamente.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): verify technical merge provenance`

#### T20: Unificar publicação e recuperação

**What**: Publicador single/batch com preflight completo, imutabilidade e relatório parcial.
**Where**: `scripts/versioning/src/services/publication.ts`
**Depends on**: T19
**Reuses**: publish.sh, publish-changesets.mjs e annotated-publish.mjs.
**Requirement**: PKG-05.1–8; PKG-09.7; PKG-10.5.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 10 casos mínimos: tags leves/anotadas, lote no mesmo SHA, conflito na segunda entrada antes de escrever, retry completo, falha após tag, falha após Release, retomada, corrida, API indisponível e refs alteradas após espera; published_sha vazio até completo.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: changesets-publish.mjs, annotated-publish.mjs e nova publication.mjs; verificar payloads e contagem de escritas.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): unify immutable release publication`

#### T21: Orquestrar a prévia interna Node

**What**: Entrypoint de prévia que encadeia coletor tipado, policy e guia por capacidades.
**Where**: `scripts/versioning/src/entrypoints/preview.ts`
**Depends on**: T20
**Reuses**: preview.sh, collect-version-report.mjs/.sh e serviços anteriores.
**Requirement**: PKG-04.7; PKG-10.1–2,6–8; PKG-11.4,6.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 7 casos mínimos: cinco perfis, ausência de release e erro; outputs/exit preservados, nenhuma tag/Release/PR criado, import sem I/O.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: collect-version-report.mjs e nova preview-entrypoint.mjs; serviço versioning auxiliar pertence a esta composição.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): run previews through Node entrypoint`

#### T22: Preparar evidência pós-merge em leitura

**What**: Entrypoint de coleta funcional/técnica que gera artifacts completos e identifica o produtor.
**Where**: `scripts/versioning/src/entrypoints/prepare-publication.ts`
**Depends on**: T21
**Reuses**: prepare-publication.sh e serviços anteriores.
**Requirement**: PKG-03.2,4,8; PKG-04.9; PKG-09.2; PKG-11.4–5.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos mínimos: funcional, técnico, no-release, origem inválida, artifact incompleto e CI de outro SHA; sem privilégio de escrita ou chave App.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova prepare-publication.mjs; conferir relatório/plano/bundle/snapshot e identidade run/job/central SHA.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): prepare publication evidence in Node`

#### T23: Executar escrita pelo entrypoint Node

**What**: Entrypoint que revalida artifacts/estado e chama PR técnico ou publicação conforme fase confiável.
**Where**: `scripts/versioning/src/entrypoints/publish.ts`
**Depends on**: T22
**Reuses**: publish.sh, T18–T20 e outputs atuais.
**Requirement**: PKG-03.3–8; PKG-05.5–8; PKG-10.7–8; PKG-11.4–5.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos mínimos: single, batch, preparar PR, retry, artifact expirado, produtor falso, metadado alterado e falha parcial; nenhum SDK/build/install ou nativo importado/executado.
- [ ] Gate Quick passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova publish-entrypoint.mjs; testar outputs reais, sentinelas e grafo de imports.
**Gate**: Quick (Gate Check Commands).
**Commit**: `refactor(versioning): enforce Node publication boundary`

### Phase 5: Workflows e retirada do legado

#### T24: Conectar workflow de prévia ao compilado

**What**: Workflow_call de leitura compatível com os cinco perfis e configuração existente.
**Where**: `.github/workflows/version-preview.yml`
**Depends on**: T23
**Reuses**: Workflow atual e entrypoint T21.
**Requirement**: PKG-03.2; PKG-04.7; PKG-10.7; PKG-11.4.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos de contrato mínimos: cinco seleções e opção inválida; central SHA correto, consumer checkout sem credencial persistente, permissões read, Node24 e nenhum .sh central.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: workflow-contract.mjs/native-workflows.mjs com parsing YAML semântico, atualizado sem retirar garantias.
**Gate**: Build (Gate Check Commands).
**Commit**: `refactor(versioning): wire compiled preview workflow`

#### T25: Conectar workflow de publicação ao compilado

**What**: Leitor/environment/escritor com capacidades e outputs single/batch.
**Where**: `.github/workflows/version-publish.yml`
**Depends on**: T24
**Reuses**: Workflow atual e T22/T23.
**Requirement**: PKG-02.5–6; PKG-03.2–3,8; PKG-04.8; PKG-05.7–8; PKG-11.4–5.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 8 casos de contrato mínimos: environment ausente/presente, fase funcional/técnica, single/batch/no-release/parcial; App só onde necessário, artifacts vinculados e dist do próprio SHA.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: native-workflows.mjs e nova workflow-five-adapters.mjs; nenhuma execução consumer/nativo com token de escrita.
**Gate**: Build (Gate Check Commands).
**Commit**: `refactor(versioning): wire compiled publication workflow`

#### T26: Ampliar a CI central

**What**: Pipeline de verificação com build/dist e fixtures reais dos cinco adaptadores.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T25
**Reuses**: CI atual, run.mjs e fixtures de cada tarefa.
**Requirement**: PKG-01.3; PKG-08.1; PKG-10.12; PKG-11.2–3,8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 29 fixtures herdadas presentes mais todas as novas; SDK RP, CLI Changesets2/3, Go e Maven reais; erro de tipo e dist divergente bloqueiam, sem if-present que silencie gate ausente.
- [ ] Gate Full passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: contratos YAML/runner; instalar somente em diretórios com manifest e prefixo explícitos; evidência hospedada apenas em T34.
**Gate**: Full (Gate Check Commands).
**Commit**: `ci(versioning): validate five typed adapter profiles`

#### T27: Encerrar dependências legadas centrais

**What**: Gate e retirada dos .sh centrais após migrar todos os usos ativos.
**Where**: `scripts/versioning/`
**Depends on**: T26
**Reuses**: Inventário T1 e equivalentes TS T4–T26.
**Requirement**: PKG-10.7,9; PKG-11.1,6,10.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 4 casos mínimos do gate: árvore conforme, .sh referenciado, regra de negócio JS manual e export/fachada incompatível; remover legado somente após equivalentes e testes verdes.
- [ ] Gate Full passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova migration-inventory.mjs; preservar testes de tagged SHA e caracterização, retirar calculador paralelo morto de version.mjs sem portá-lo.
**Gate**: Full (Gate Check Commands).
**Commit**: `refactor(versioning): retire central Shell implementation`

### Phase 6: Callers, distribuição e documentação

#### T28: Verificar artifacts Maven para distribuição

**What**: Validador de coordenadas, POMs destinados ao registry e dependências do reactor.
**Where**: `scripts/versioning/src/distribution/maven-artifacts.ts`
**Depends on**: T27
**Reuses**: Fixture reactor, published_sha e inventário Java.
**Requirement**: PKG-07.1–2,4–6,9.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos mínimos: BOM/parent/core/starter alinhados, revision residual, dependência antiga, SHA/tag divergente, coordenada já divergente e estado parcial; nenhuma publicação na fixture.
- [ ] Gate Native-Maven passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + native: nova maven-artifacts.mjs; verificar POM distribuível e digest, não só effective-pom do build.
**Gate**: Native-Maven (Gate Check Commands).
**Commit**: `feat(versioning): validate Maven distribution artifacts`

#### T29: Verificar artifacts npm para distribuição

**What**: Validador de tarballs por releases_json e elegibilidade nativa.
**Where**: `scripts/versioning/src/distribution/npm-artifacts.ts`
**Depends on**: T28
**Reuses**: Plano Changesets, published_sha e portas.
**Requirement**: PKG-02.7; PKG-07.1,3–6,9.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 6 casos mínimos: lote coerente, nome/versão errados, referência interna antiga, root privado, SHA/digest divergente e publicação parcial; sem credencial publisher no build.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova npm-artifacts.mjs com npm pack real em fixture isolada, sem npm publish remoto.
**Gate**: Build (Gate Check Commands).
**Commit**: `feat(versioning): validate npm distribution artifacts`

#### T30: Preparar catálogo de callers e roteiros

**What**: Um template de workflow por perfil, incluindo preparo/build/distribuição opcionais e instruções de eventos.
**Where**: `examples/callers/`
**Depends on**: T29
**Reuses**: Callers atuais, inventários Java/Vue e workflows centrais.
**Requirement**: PKG-06.1–6; PKG-07.1,4–5; PKG-09.14.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] 5 templates de perfil com matriz de configuração: paths/prefixo permitidos, environment omitido/presente, eventos de review/metadados, needs/CI e published_sha; preservar Go genérico.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration: nova caller-contracts.mjs; templates não publicados ficam explicitamente não executáveis, não usar SHA fictício ou pin antigo para perfil novo.
**Gate**: Build (Gate Check Commands).
**Commit**: `docs(versioning): prepare five adapter caller templates`

#### T31: Documentar o contrato dos workflows

**What**: README curto que conecta responsabilidades e uso dos calleds.
**Where**: `.github/workflows/README.md`
**Depends on**: T30
**Reuses**: Documentação existente e contratos finais.
**Requirement**: PKG-10.11; PKG-11.9.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] Documentar workflow_call, run Node, inputs/outputs/secrets, jobs e relação com scripts; links válidos e exemplos coerentes com T24/T25.
- [ ] Gate Docs passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: documentary: revisão dos contratos/links e diff-check; nenhum teste funcional artificial para prosa.
**Gate**: Docs (Gate Check Commands).
**Commit**: `docs(versioning): explain compiled workflow contracts`

#### T32: Documentar manutenção e expansão dos scripts

**What**: Guia completo de arquitetura TS, fontes/gerados, adaptação e diagnóstico.
**Where**: `scripts/versioning/README.md`
**Depends on**: T31
**Reuses**: Design, inventário e gates das tarefas.
**Requirement**: PKG-09.14; PKG-10.11; PKG-11.9–10.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] Documentar cinco perfis, ferramentas/pins, adicionar adaptador por composição, build/typecheck/check-dist/test, fronteira read/write, recuperação e referência ao README de workflows.
- [ ] Gate Docs passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: documentary: revisão de links, comandos realmente existentes e limites de suporte; atualizar referências auxiliares necessárias sem refatorar outros assuntos.
**Gate**: Docs (Gate Check Commands).
**Commit**: `docs(versioning): document typed adapters and maintenance`

#### T33: Verificar a implementação central independentemente

**What**: Parecer central com evidência por AC e mutações comportamentais em scratch.
**Where**: `.specs/features/packages-versioning-readiness/central-verification.md`
**Depends on**: T32
**Reuses**: Todas as evidências por tarefa, sem depender do relato do autor.
**Requirement**: PKG-08.1,3,5; PKG-10.12; PKG-11.8.
**Tools**: ferramentas previstas acima; execução local, sem publicação remota.
**Done when**:

- [ ] Revisor distinto; pelo menos 6 mutantes: SHA publicado trocado, override indevido, milestone funcional perdida, bundle de outro run, SDK no escritor e sucesso parcial indevido; todos detectados, estado real preservado.
- [ ] Gate Verify-Central passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: independent integration: Full e mutantes em scratch; até três ciclos de correção rastreáveis. Não criar PASS global se B/C pendentes.
**Gate**: Verify-Central (Gate Check Commands).
**Commit**: `docs(versioning): record independent central verification`

### Phase 7: Entrega central remota

#### T34: Publicar revisão central e comprovar CI hospedada

**What**: Entrega da branch do PR existente em fast-forward, após autorização aplicável e nova comparação remota.
**Where**: `branch do PR #13`
**Depends on**: T33
**Reuses**: Intervalo verificado em T33 e PRs existentes.
**Requirement**: PKG-01.4; PKG-08.1–3,5.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] 0 reescritas de histórico; registrar HEAD remoto antes/depois, PR/base e URL de CI verde no SHA enviado; avanço do remoto exige reconciliação e gate novo.
- [ ] Gate Hosted passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: remote integration: CI real; não marcar completo com log local e não efetuar merge automático.
**Gate**: Hosted (Gate Check Commands).
**Commit**: `docs(versioning): record reviewed remote delivery`

#### T35: Fixar callers na revisão disponível

**What**: Renderização dos cinco templates com um SHA real completo que contenha todos os contratos e tenha CI aprovada.
**Where**: `examples/callers/`
**Depends on**: T34
**Reuses**: Templates T30 e SHA central publicado T34.
**Requirement**: PKG-06.1,6; PKG-09.14.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] 5 callers sem placeholder; todos os calleds do mesmo caller no mesmo SHA; confirmar arquivo/contrato no commit remoto, mantendo esse SHA estável mesmo no commit documental seguinte.
- [ ] Gate Build passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: integration + remote read: caller-contracts.mjs e inspeção do commit publicado; envio do commit documental somente se autorizado.
**Gate**: Build (Gate Check Commands).
**Commit**: `docs(versioning): pin callers to verified central revision`

### Phase 8: Homologação dos pilotos

#### T36: Homologar integração Maven no piloto

**What**: Adoção revisável do caller em PackagesJava, com inventário de tag/prefixo/revision e gates reais.
**Where**: `PackagesJava/.github/workflows/`
**Depends on**: T35
**Reuses**: Caller jgitver e matriz remota deste plano.
**Requirement**: PKG-06.2,4,6; PKG-08.2–5.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] Execução autorizada usa called remoto; registrar origem, reviewed head quando aplicável, SHA publicado, versão e run; normal/hotfix, milestone/override, environment e retry por cobertura compartilhada.
- [ ] Gate Pilot passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: remote integration: matriz de aceite, sem alterar funcionalidades/issues do produto, sem mover tag 0.0.1 e sem publicar registry nesta tarefa.
**Gate**: Pilot (Gate Check Commands).
**Commit**: `docs(versioning): record Maven pilot integration evidence`

#### T37: Homologar integração Vue no piloto

**What**: Adoção do caller Changesets com uma única autoridade de PR técnico/tag/Release.
**Where**: `PackagesVue/.github/workflows/`
**Depends on**: T36
**Reuses**: Caller Changesets e release.yml inventariado.
**Requirement**: PKG-02.1–7; PKG-06.3–6; PKG-08.2–5.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] Execução autorizada preserva versões existentes, elimina produtor concorrente, valida lote/dependentes/no-release, PR técnico e published_sha; registrar todos os runs.
- [ ] Gate Pilot passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: remote integration: matriz do monorepo mais policy compartilhada; nenhuma mudança de funcionalidade de packages nesta tarefa.
**Gate**: Pilot (Gate Check Commands).
**Commit**: `docs(versioning): record Vue pilot integration evidence`

### Phase 9: Distribuição e aceite completo

#### T38: Comprovar distribuição e consumo Java

**What**: Ensaio autorizado no GitHub Packages a partir dos artifacts aprovados e instalação externa sem cache.
**Where**: `docs/integration-baselines/`
**Depends on**: T37
**Reuses**: Verificador Maven T28 e integração T36.
**Requirement**: PKG-07.1–2,4–7,9; PKG-08.2–5.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] Coordenadas/digests conferidos, build sem token de publicação, publicador sem recalcular versão; consumidor vazio resolve BOM/starter e compila; falha parcial explicitamente reconciliada.
- [ ] Gate Registry passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: remote e2e: ensaio real Maven; 1 consumidor externo mínimo e negativos de divergência/auth, sem sobrescrever coordenadas.
**Gate**: Registry (Gate Check Commands).
**Commit**: `docs(versioning): record Maven package consumption`

#### T39: Comprovar distribuição e consumo Vue

**What**: Ensaio autorizado npm com tarballs aprovados e instalação externa exata.
**Where**: `docs/integration-baselines/`
**Depends on**: T38
**Reuses**: Verificador npm T29 e integração T37.
**Requirement**: PKG-07.1,3–6,8–9; PKG-08.2–5.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] Publicar só elegíveis, conferir digests/coordenadas e registrar parcial; consumidor com cache isolado instala versões exatas, imports/tipos/build passam.
- [ ] Gate Registry passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: remote e2e: ensaio real npm; 1 consumidor externo mínimo e negativos de divergência/auth, sem publicar root privado.
**Gate**: Registry (Gate Check Commands).
**Commit**: `docs(versioning): record npm package consumption`

#### T40: Consolidar aceite da issue

**What**: Relatório final independente que separa A central, B integração e C distribuição, com pendências visíveis.
**Where**: `.specs/features/packages-versioning-readiness/validation.md`
**Depends on**: T39
**Reuses**: Parecer central e evidências remotas T34–T39.
**Requirement**: PKG-08.1–6.
**Tools**: ferramentas previstas acima; GitHub/ambiente remoto somente após autoridade aplicável.
**Done when**:

- [ ] 93 ACs e 7 edge cases rederivados; PASS somente com evidência aplicável, falha/pendência não vira sucesso; recomendar fechamento humano, não fechar issue automaticamente.
- [ ] Gate Closure passa, com comandos/resultados e contagens registrados; status e rastreabilidade acompanham o commit.

**Tests**: independent documentary + integration: validar evidências, estado e escopo final; qualquer implementação posterior a T33 requer nova revisão pertinente.
**Gate**: Closure (Gate Check Commands).
**Commit**: `docs(versioning): consolidate issue acceptance evidence`

## Task Granularity Check

Cada tarefa entrega um componente ou um resultado verificável. Arquivos auxiliares inseparáveis, fachadas, gerados e testes acompanham o componente; não são tarefas sem teste. As exceções de integração/entrega abaixo são deliberadas e não agrupam implementação de adaptadores diferentes.

| Tarefas | Unidade de entrega | Avaliação |
| --- | --- | --- |
| T1 | Reconciliação de uma base com inventário e caracterização | Atômica por integração; não implementa os novos serviços |
| T2–T3 | Toolchain; verificador do compilado | Dois componentes separados |
| T4–T7 | Porta de processo; Git; API; contrato/registro | Um componente por tarefa |
| T8–T10 | Policy; evidência; guia | Um serviço por tarefa |
| T11–T16 | Um perfil nativo por tarefa; RP separa SCM e adaptador | Auxiliares necessários testados junto com o perfil |
| T17–T20 | Bundle; PR técnico; merge técnico; publicação | Um serviço por tarefa |
| T21–T23 | Um entrypoint por tarefa | Cada caminho testado sem depender de wiring posterior |
| T24–T26 | Um workflow por tarefa | Contratos YAML no mesmo commit |
| T27 | Retirada do mecanismo legado já substituído | Não reimplementa funcionalidades; gate cobre inventário inteiro |
| T28–T29 | Um verificador de artifacts por ecossistema | Build e negativos no mesmo componente |
| T30 | Catálogo de callers | Um contrato de templates aplicado a cinco perfis, sem lógica duplicada |
| T31–T32 | Um README principal por tarefa | Documentação e links, sem testes funcionais artificiais |
| T33 | Parecer independente central | Não adia testes das tarefas de código |
| T34–T35 | Disponibilizar revisão; fixar referências reais | Separa publicação de código e commit posterior de pins |
| T36–T39 | Uma integração ou consumo por piloto | Escopo remoto individual e evidência própria |
| T40 | Aceite final | Não encerra a issue automaticamente |

## Diagram-Definition Cross-Check

A sequência incorpora pré-requisitos transitivamente. A tabela explicita todas as arestas, inclusive entre fases; nenhum passo depende de uma fase futura.

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Início | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |
| T4 | T3 | T3 → T4 | Match |
| T5 | T4 | T4 → T5 | Match |
| T6 | T5 | T5 → T6 | Match |
| T7 | T6 | T6 → T7 | Match |
| T8 | T7 | T7 → T8 | Match |
| T9 | T8 | T8 → T9 | Match |
| T10 | T9 | T9 → T10 | Match |
| T11 | T10 | T10 → T11 | Match |
| T12 | T11 | T11 → T12 | Match |
| T13 | T12 | T12 → T13 | Match |
| T14 | T13 | T13 → T14 | Match |
| T15 | T14 | T14 → T15 | Match |
| T16 | T15 | T15 → T16 | Match |
| T17 | T16 | T16 → T17 | Match |
| T18 | T17 | T17 → T18 | Match |
| T19 | T18 | T18 → T19 | Match |
| T20 | T19 | T19 → T20 | Match |
| T21 | T20 | T20 → T21 | Match |
| T22 | T21 | T21 → T22 | Match |
| T23 | T22 | T22 → T23 | Match |
| T24 | T23 | T23 → T24 | Match |
| T25 | T24 | T24 → T25 | Match |
| T26 | T25 | T25 → T26 | Match |
| T27 | T26 | T26 → T27 | Match |
| T28 | T27 | T27 → T28 | Match |
| T29 | T28 | T28 → T29 | Match |
| T30 | T29 | T29 → T30 | Match |
| T31 | T30 | T30 → T31 | Match |
| T32 | T31 | T31 → T32 | Match |
| T33 | T32 | T32 → T33 | Match |
| T34 | T33 | T33 → T34 | Match |
| T35 | T34 | T34 → T35 | Match |
| T36 | T35 | T35 → T36 | Match |
| T37 | T36 | T36 → T37 | Match |
| T38 | T37 | T37 → T38 | Match |
| T39 | T38 | T38 → T39 | Match |
| T40 | T39 | T39 → T40 | Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Base integrada | integration | integration | OK |
| T2–T3 | Compilação/distribuição | type + integration | unit/type + integration | OK |
| T4–T6 | Portas | integration | unit + integration | OK |
| T7 | Contrato/registro | unit + type | unit + type | OK |
| T8 | Policy | unit | unit | OK |
| T9 | API/reviews | integration | integration | OK |
| T10 | Guia | unit | unit | OK |
| T11–T14 | Adaptadores existentes/Changesets | integration + native | integration + native | OK |
| T15 | SCM/API | integration | unit + integration | OK |
| T16 | Novo adaptador | integration + native | integration + native | OK |
| T17–T23 | Bundle/PR/publicação/entrypoints | integration | integration | OK |
| T24–T26 | Workflows/runner | semantic integration | integration | OK |
| T27 | Retirada do legado | integration | integration | OK |
| T28–T29 | POM/tarballs | integration + native packaging | integration + empacotamento real | OK |
| T30 | Callers | semantic integration | integration | OK |
| T31–T32 | Documentação | documentary | documentary | OK |
| T33 | Verificação central | independent integration | independent integration | OK |
| T34 | CI hospedada | remote integration | remote integration | OK |
| T35 | Callers fixados | semantic integration + remote read | integration + remote read | OK |
| T36–T37 | Pilotos | remote integration | remote integration | OK |
| T38–T39 | Registry/consumo | remote e2e | remote e2e | OK |
| T40 | Aceite final | independent review | independent documentary + integration | OK |

## Requirement-to-task Coverage

A notação “1–3” cobre individualmente AC1, AC2 e AC3 daquele requisito. Cada grupo deve ter assertions/evidências próprias; executar o gate sem conferir seu resultado esperado não satisfaz o AC. Total: **11 requisitos, 93 critérios de aceite, todos mapeados; 0 verificados nesta feature**.

| Requirement | Critérios → tarefas | Resultado esperado / evidência |
| --- | --- | --- |
| PKG-01 | 1:T1; 2:T7,T14; 3:T1,T11–T14,T26; 4:T34 | Baseline/registro e regressão nativa; remoto avançado bloqueia envio. |
| PKG-02 | 1–4:T14,T22; 5–6:T7,T25; 7:T14,T29 | CLI2/3, dependentes, no-release, erro e outputs single/batch. |
| PKG-03 | 1:T18; 2:T6,T22,T24; 3:T17,T18,T23; 4–5:T17,T23; 6:T19; 7:T5,T19; 8:T6,T22,T23 | Bundle, proveniência de artifact, PR técnico, revisão atual e ausência de execução privilegiada. |
| PKG-04 | 1:T8,T9; 2–6:T8; 7:T10,T21; 8:T23,T25; 9:T9,T19 | Rotas normal/hotfix, milestone/override, guia e environment; origem funcional preservada. |
| PKG-05 | 1–6:T20; 7:T20,T23,T25; 8:T5,T9,T20,T23 | Preflight/retry/concorrência e publicação parcial; SHA vazio impede distribuição. |
| PKG-06 | 1:T30,T35; 2:T12,T30,T36; 3:T30,T37; 4:T11–T16; 5:T37; 6:T30,T35–T39 | Callers fixados somente após publicação central; adoção sem reinício de histórico. |
| PKG-07 | 1:T28–T30,T38–T39; 2:T28,T38; 3:T29,T39; 4–6:T28–T30,T38–T39; 7:T38; 8:T39; 9:T28–T29,T38–T39 | POM/tarball local não equivale a registry; aceite externo exige caches vazios. |
| PKG-08 | 1:T26,T33,T34; 2:T34–T39; 3:T33,T40; 4:T36–T37; 5:T6,T34–T40; 6:T40 | Relatórios honestos por etapa e Verifier distinto do autor. |
| PKG-09 | 1:T7,T16; 2:T16,T22; 3–4:T15–T16; 5:T18; 6:T9,T18–T19; 7:T16,T19–T20; 8:T8,T16; 9:T16; 10:T15–T16; 11:T9,T18–T19; 12:T13; 13:T15–T16; 14:T16,T30,T32,T35 | SDK real, configuração permitida, nenhum writer nativo; standard preservado. |
| PKG-10 | 1–2:T7,T11–T16,T21; 3:T4–T6; 4:T8–T9; 5:T10,T17–T20; 6:T4–T7,T10,T15,T21; 7:T21,T23–T27; 8:T4,T6–T7,T23; 9:T1,T4,T27; 10:T7; 11:T31–T32; 12:T26,T33 | Contratos substituíveis, sem I/O no import; migração com caracterização. |
| PKG-11 | 1:T2,T4–T27; 2:T2,T26; 3:T3,T26; 4:T2,T21–T25; 5:T6,T23,T25; 6:T4,T11,T21,T27; 7:T7,T17; 8:T2–T3,T7,T26,T33; 9:T31–T32; 10:T27,T32 | Todo código central em escopo com fonte TS; dist fiel e nenhuma lógica Shell ativa. |

| Edge case da spec | Tarefas | Expectativa |
| --- | --- | --- |
| Tag de outro namespace | T5,T11–T16 | Ignorar para cálculo, diagnosticar bootstrap; nenhuma tag artificial |
| CLI/lock alterado entre fases | T14,T16–T17,T22–T23 | Invalidar plano e bloquear escrita |
| Artifact expirado | T22–T23 | Recoleta validada; não presumir evidência antiga |
| Autenticação do registry rejeitada | T38–T39 | Falha sem tokens nos logs; não desfazer Release GitHub |
| Erro nativo por changeset ausente | T14,T22 | Erro preservado, nenhum PATCH central |
| Bot Release Please concorrente | T30,T35 | Adoção rejeitada até uma autoridade; nenhuma aplicação RP nova escolhida |
| Histórico RP diferente da origem | T15–T16,T19 | Invalidar plano antes de aplicar/publicar |

## Matriz de aceite remoto planejada

Todos os cenários abaixo estão **PENDENTES**, pois esta rodada é exclusivamente documental. Casos comuns de policy podem compartilhar uma evidência representativa, com contrato local nos demais perfis; não é necessário repetir cada combinação em todos os repositórios.

| Cenário | Alvo/tarefa | Esperado |
| --- | --- | --- |
| Entrega normal develop → master | Java T36; Vue T37 | Cálculo nativo, CI correta, publicação só no SHA integrado elegível |
| Hotfix criado de master sem milestone | Java ou Vue, T36/T37 | Mesmos gates, versão nativa; nenhum desvio por hotfix |
| Milestone exata/divergente/inválida | Perfil de release única, T36 | Igual passa; divergente exige override válido; inválida sempre bloqueia |
| Override autorizado/insuficiente/obsoleto | T36 ou T37 | Duas pessoas distintas, permissão e revisão após label; estado atual reavaliado |
| PR técnico com metadados funcionais alterados | Vue T37; RP fixture T18/T19 | Origem funcional revalidada; revisão antiga não reaproveitada |
| Lote Vue múltiplo com milestone | T37 | Bloqueio de contrato, sem selecionar um package ou contornar por override |
| Lote com dependentes, unitário e no-release | T37 | Plano nativo completo; outputs coerentes; vazio sem PR/tag/distribuição |
| Environment omitido/configurado | T36 ou T37 | Sem gate extra quando omitido; espera e revalidação quando presente |
| Retry, falha parcial e conflito | T36/T37 | Reconciliar somente ausentes consistentes; não mover tag; parcial impede distribuição |
| SHA de CI, tag ou bundle divergente | T36/T37 | Escrita bloqueada, diagnóstico com identidades observadas |
| Distribuição Maven e consumo externo | T38 | Quatro módulos coerentes; BOM/starter resolvidos em repo local vazio |
| Distribuição npm e consumo externo | T39 | Elegíveis/versões exatas; imports/tipos/build em cache isolado |
| Registry parcial/auth/divergência | T38/T39 | Relatório por coordenada, intervenção quando identidade não é comprovada, sem overwrite |

Usar branches/versões autorizadas e fixtures isoladas para falhas destrutivas; não mover uma tag publicada para “simular” conflito. Não há piloto Release Please escolhido; ferramenta real controlada cobre o escopo central e sua homologação remota futura não é presumida.

Cada evidência deve registrar: repositório, PR, SHA central, SHA funcional, head revisado quando houver, SHA integrado, configuração/pins, URL/run, outputs esperados/obtidos, resultado e causa da falha. Retenção de artifacts segue configuração/default; o relatório durável guarda identidades e links, sem inventar disponibilidade permanente.

## Limites do planejamento e parada

- Nenhum checkbox de implementação está concluído. Validação dos documentos não é build, teste nativo, publicação ou homologação.
- Não criar validation.md com PASS agora. T33 cria parecer central restrito; T40 só conclui o relatório global quando houver evidência aplicável de A/B/C.
- O ponto de retomada será T1 após nova instrução para implementar, reconciliando novamente o remoto e preservando mudanças locais.
- Não executar sequer T1 nesta rodada: a entrega solicitada termina nos artefatos TLC e na validação documental.

## Validação documental — 2026-10-20

- validate_spec.py --strict: 0 erros, 0 avisos.
- validate_tasks.py --strict: 0 erros, 0 avisos.
- Auditoria de rastreabilidade: 11 requisitos, 93 ACs, 40 tarefas sequenciais, nenhum AC sem mapeamento; os 7 edge cases possuem linha própria.
- Revisão documental independente: sem lacunas materiais restantes. A dependência de T2 para o check-dist futuro foi corrigida com gate Toolchain próprio; CI deve conferir dist antes de qualquer sobrescrita.
- git diff --check aprovado; somente arquivos .specs alterados. Nenhum teste funcional, build ou ferramenta nativa foi executado nesta rodada.
- Planejamento concluído. Implementação e aceite da feature continuam pendentes; não há validation.md nem alegação de PASS funcional.

