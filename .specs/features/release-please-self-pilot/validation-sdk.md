# Archived validation: release-please-self-pilot - PASS para T1-T3 e prontidão do teste hospedado

**Result**: PASS no recorte implementado. Seguro publicar somente a branch de teste para executar o caller de leitura. A execução hospedada ainda está PENDENTE. A Action de produção, o ciclo real de PR/tag/Release e a conclusão da feature/issue continuam PENDENTES.

**Data**: 2026-10-23.  
**Verifier**: subagente independente; não escreveu a implementação nem os testes.  
**Spec**: `.specs/features/release-please-self-pilot/spec.md`.  
**Diff imutável revisado**: `e05a76af07096e2cc4350af02896a68b11386bd5..a04385dd2666b3dc87235d497a0a06266fb2fa9b`.  
**HEAD observado**: `a04385dd2666b3dc87235d497a0a06266fb2fa9b`.  
**Ambiente local**: Windows, Node `v24.19.0`, npm `11.17.0`. O caller hospedado está configurado para Ubuntu/Node 22; esse ambiente precisa do run remoto.

## Escopo e veredito

Nenhum achado que exija correção em T1-T3. O teste existente foi ampliado, os sete casos superiores e suas asserções originais foram preservados. O fluxo usa o comando do YAML real, resolve os bindings reais dos inputs da Action e entrega a versão à estratégia `Simple` real, presa em `release-please@17.3.0`. Ele aplica os updaters reais e verifica os dados de release sem executar publicação.

O caller de teste contém somente um job que reutiliza a CI local no mesmo commit, com `contents: read` e sem secrets herdados. Não invoca o workflow de publicação. Essa é uma aprovação para push/teste dessa branch, não uma aprovação de merge nem uma comprovação da publicação em produção.

| Tarefa | Resultado revisado | Evidência |
| --- | --- | --- |
| T1 | PASS local | `ci-scripts/tests/release-please.test.ts:79`, `:124`, `:143`, `:157`, `:167`, `:178`; commit `f22644927a632125acb2fedbe5b1be5eb579dca9` |
| T2 | PASS na prontidão; run hospedado PENDENTE | `.github/workflows/version-release-please-test-caller.yml:4`, `:11`, `:16`; `.github/workflows/ci.yml:4`, `:42`, `:46`; commit `1c81c88e1f301d7d933559c1c384a76b9dc3206f` |
| T3 | PASS documental | `docs/pipelines/versionamento-release-please.md:34`, `:50`, `:65`, `:71`, `:82`, `:84`; commit `a04385dd2666b3dc87235d497a0a06266fb2fa9b` |

## Critérios de aceitação rederivados

Os sufixos AC1, AC2 etc. seguem a ordem de cada história na spec. PASS local comprova apenas o resultado executado ou o contrato inspecionado. Não promove requisitos de produção para Verified. PENDENTE indica comportamento externo não exercitado; ADIADO identifica escopo futuro explicitamente excluído pelo usuário.

| Critério | Resultado esperado da spec | Evidência e asserção/inspeção | Resultado |
| --- | --- | --- | --- |
| RPSP-01.AC1 | `project-type: simple` seleciona a estratégia nativa simple | `ci-scripts/tests/release-please.test.ts:143`: `deepEqual(preparation.engineInputs, {'release-type':'simple','release-as':'0.0.1'})`; `:150`: construção de `Simple`; factory em `ci-scripts/scripts/release-orchestrator.ts:69` | PASS local |
| RPSP-01.AC2 | A proposta contém a versão candidata em `version.txt` | `ci-scripts/tests/release-please.test.ts:160`: paths exatos `CHANGELOG.md` e `version.txt`; `:167`: conteúdo exato `0.0.1` após aplicar os updaters | PASS SDK local; arquivo no PR remoto PENDENTE |
| RPSP-01.AC3 | A proposta contém as notas em `CHANGELOG.md` | `ci-scripts/tests/release-please.test.ts:165`: updater nativo; `:168`: conteúdo contém a mudança `valida o caller centralizado` | PASS SDK local; arquivo no PR remoto PENDENTE |
| RPSP-01.AC4 | Simple executa zero publicadores de registry/GoReleaser | `ci-scripts/tests/release-please.test.ts:101`: exatamente 3 adaptadores; `:103`: condições exatas por tipo; `:104`: simple difere de todos; `.github/workflows/version-release-please-called.yml:74`, `:82`, `:88` | PASS no contrato; produção não executada |
| RPSP-02.AC1 | Executar o caminho declarado no layout `.ci-scripts` | `ci-scripts/tests/release-please.test.ts:87`: layout; `:95`: argumentos retirados de `orchestrator.run`; `:124`: subprocesso real; `:141`: exit 0; `.github/workflows/version-release-please-called.yml:51`; sensor M1 | PASS local |
| RPSP-02.AC2 | Referência de caller inexistente causa falha | `ci-scripts/tests/release-please.test.ts:82`: caminho derivado de `uses`; `:83`: `assert.ok(fs.existsSync(...))`, antes de carregar o called | PASS no contrato; não foi injetado um quarto mutante |
| RPSP-02.AC3 | Milestone `v0.0.1` alcança o input `release-as: 0.0.1` | `ci-scripts/tests/release-please.test.ts:140`, `:143`: valor exato após resolver o binding da Action; `:152`: esse valor é entregue ao SDK; sensor M2 | PASS local; Action em produção PENDENTE |
| RPSP-02.AC4 | O contrato efetivo seleciona `release-type: simple` | `ci-scripts/tests/release-please.test.ts:143`: valor exato; `.github/workflows/version-release-please-called.yml:67`: binding oficial | PASS local; invocação real da Action PENDENTE |
| RPSP-02.AC5 | Reutilizar o mesmo called central, sem cópia especial | `ci-scripts/tests/release-please.test.ts:79`, `:82`, `:84`: exemplo real e arquivo central real; `.github/workflows/examples/version-release-please-caller.yml:13`; nenhum segundo called no diff | PASS no recorte |
| RPSP-02.AC6 | Scripts centrais e caller/called usam o mesmo SHA revisado | `ci-scripts/tests/release-please.test.ts:99`: apenas binding `${{ inputs.central-ref }}`; `.github/workflows/version-release-please-called.yml:14`: default ainda `master`; `docs/pipelines/versionamento-release-please.md:73`: fixação futura explícita | PENDENTE para produção. Caller de teste/CI usam referência local no mesmo commit, comprovada em `ci-scripts/tests/release-please.test.ts:67`; isso não prova checkout remoto dos scripts |
| RPSP-03.AC1 | PR funcional fix/feat com milestone usa a versão planejada | `ci-scripts/tests/release-please.test.ts:140`, `:143`: milestone `v0.0.1` -> input `0.0.1`; `:155`: commit `fix:`; `:159`: versão do candidato `0.0.1` | PASS com entradas simuladas; evento/merge real PENDENTE |
| RPSP-03.AC2 | Milestone ausente/inválida falha antes de parâmetros de publicação | `ci-scripts/tests/release-please.test.ts:191`, `:192`, `:196`: exit 1; `:197`: erro correspondente; `:198`: outputs `{}` | PASS local; chamada com escrita não executada |
| RPSP-03.AC3 | Fechamento sem merge cria zero PRs/tags/Releases | `.github/workflows/version-release-please-called.yml:18`: guarda `merged == true`; `ci-scripts/tests/release-please.test.ts:98`: compara essa guarda. Não simula a decisão do runner nem conta escritas externas | PENDENTE em produção; somente guarda estática conferida |
| RPSP-03.AC4 | Nenhuma tag/Release antes do merge humano do PR técnico | `docs/pipelines/versionamento-release-please.md:79`: resultado exigido no roteiro; SDK local só gera propostas, com fetch proibido em `ci-scripts/tests/release-please.test.ts:148` | PENDENTE em produção; ausência local de rede não comprova a ordem de eventos do Actions |
| RPSP-03.AC5 | PR técnico conclui sem revalidar milestone | `ci-scripts/tests/release-please.test.ts:170`: branch gerada pelo motor e milestone vazia; `:171`: exit 0; `:173`: inputs sem release-as | PASS local; reconhecimento robusto de identidade e merge remoto PENDENTES |
| RPSP-03.AC6 | Segundo momento preserva a versão preparada, sem nova extração | `ci-scripts/tests/release-please.test.ts:172`, `:173`: release_as vazio; `:184`: tag proposta `v0.0.1`; `:185`: SHA exato da fixture; sensor M3 | PASS SDK local; tag persistida PENDENTE |
| RPSP-04.AC1 | Relatório separa domínio, contrato e estado remoto | Seção de camadas abaixo; asserções de domínio em `ci-scripts/tests/release-please.test.ts:44`, `:56`, `:225`; contrato em `:62`, `:143`; diagnóstico em `:187`; distinção documental em `docs/pipelines/versionamento-release-please.md:34` | PASS no relatório e documentação |
| RPSP-04.AC2 | Sem Action remota, E2E fica PENDENTE | `docs/pipelines/versionamento-release-please.md:34`, `:82`; este relatório mantém o mesmo limite | PASS documental; E2E PENDENTE |
| RPSP-04.AC3 | Falhas essenciais de caminho, milestone e configuração são observáveis | `ci-scripts/tests/release-please.test.ts:196`, `:197`, `:198`: negativos de milestone/tipo; `:141` e `:143`: falhas de caminho/binding comprovadas pelos sensores M1/M2 | PASS local |
| RPSP-04.AC4 | Preservar os 7 testes e asserções originais | Diff da base preserva asserções em `ci-scripts/tests/release-please.test.ts:44`, `:45`, `:56`, `:57`, `:225`, `:240`; `conventional-commit.test.ts` não foi alterado; gate 7/7, zero skip | PASS |
| RPSP-04.AC5 | Cenários simulados sem credenciais capazes de publicar | `ci-scripts/tests/release-please.test.ts:17`: allowlist sem tokens; `:23`, `:126`: ambiente filtrado; `:148`: fetch do SDK sempre lança erro; caller em `.github/workflows/version-release-please-test-caller.yml:11` tem leitura | PASS nos subprocessos e cliente SDK em escopo; não é auditoria geral de credenciais da máquina |
| RPSP-04.AC6 | Cobertura nova concentrada no teste funcional existente | `ci-scripts/tests/release-please.test.ts:31`: único fluxo ampliado; diff não cria arquivos de teste | PASS |
| RPSP-04.AC7 | Motor real produz versão, changelog e dados de release, sem rede | `ci-scripts/tests/release-please.test.ts:10`: `Simple`; `:148`: fetch proibido; `:157`: `buildReleasePullRequest`; `:165`: updater real; `:178`: `buildReleases`; `:184`, `:185`, `:186`: tag, SHA e notas exatos | PASS SDK local |
| RPSP-05.AC1 | Operações externas obedecem à autorização explícita | Limites registrados em `.specs/features/release-please-self-pilot/implementation-log.md:30` e `:31`; o Verifier não executou push, PR, merge, tag, Release nem alterações de secrets/proteções | PASS processual nesta revisão; o próximo push/teste permanece limitado à autorização já dada pelo usuário |
| RPSP-05.AC2 | Entrega real produz PR de release inspecionável | `docs/pipelines/versionamento-release-please.md:77`, `:79`: roteiro futuro; nenhum PR real foi produzido | PENDENTE |
| RPSP-05.AC3 | Tag real aponta para SHA integrado do PR técnico | `ci-scripts/tests/release-please.test.ts:185` confere apenas `'b'.repeat(40)` da fixture; `docs/pipelines/versionamento-release-please.md:81` exige prova futura | PENDENTE |
| RPSP-05.AC4 | Registrar links de PR/run/Release, versão e SHA reais | `docs/pipelines/versionamento-release-please.md:82`: evidência futura exigida; nenhum conjunto de links reais disponível nesta revisão | PENDENTE |
| RPSP-05.AC5 | Orientar aprovação humana da CI automatizada sem dispensá-la | `docs/pipelines/versionamento-release-please.md:80`: instrução explícita | PASS documental; necessidade efetiva no GitHub PENDENTE |
| RPSP-06.AC1 | Reprocessamento mantém no máximo um PR aberto | `.specs/features/release-please-self-pilot/spec.md:34` exclui governança de milestones/conflitos; história P2 em `:144` é futura; sem ensaio de escrita | ADIADO, não julgado |
| RPSP-06.AC2 | Reprocessamento preserva tag/Release existentes | `docs/pipelines/versionamento-release-please.md:84`; sem publicação/reexecução real | ADIADO, não julgado |
| RPSP-06.AC3 | Conflito de SHA falha sem mover/excluir tag | `docs/pipelines/versionamento-release-please.md:84`; nenhuma tag manipulada | ADIADO, não julgado |
| RPSP-06.AC4 | Erro externo é reportado sem falso sucesso | Não houve chamada externa do motor; fetch é proibido em `ci-scripts/tests/release-please.test.ts:148`; falha real de permissão não foi ensaiada | ADIADO para a governança/produção; não inferido do SDK local |
| RPSP-06.AC5 | Execuções concorrentes serializam escritas | `docs/pipelines/versionamento-release-please.md:84`; nenhuma guarda nova ou ensaio concorrente em escopo | ADIADO, não julgado |
| RPSP-06.AC6 | Versão conflitante preserva PR para decisão humana | `docs/pipelines/versionamento-release-please.md:84`; nenhum PR externo alterado | ADIADO, não julgado |
| RPSP-06.AC7 | Versão regressiva falha preservando publicação anterior | `docs/pipelines/versionamento-release-please.md:84`; nenhuma política adicional implementada neste recorte | ADIADO, não julgado |

Não há lacuna de precisão que impeça avaliar T1-T3. Os resultados PENDENTES e ADIADOS acima são limites deliberados do recorte, não critérios silenciosamente aprovados.

## Camadas e integridade dos testes

| Camada | Evidência executada | Limite |
| --- | --- | --- |
| Domínio/orquestrador | Fases originais feature/release e quatro tipos existentes preservados; milestone ausente/inválida e tipo não suportado rejeitados | Entradas simuladas; não prova identidade do robô |
| Contrato YAML/processo | Caller de exemplo e called reais; checkout temporário; comando real e binding de outputs; caller de teste e CI reais | Não emula integralmente o runner nem executa a instalação de produção |
| Integração SDK real | `Simple` 17.3.0, Conventional Commits, updaters nativos, versão/notas/tag/SHA | Fetch proibido; dados de PR/Release em memória, sem persistência externa |
| Hospedagem do teste | Trigger da branch, workflow local no mesmo commit, CI de leitura, testes e typecheck conferidos | Run Ubuntu/Node 22 PENDENTE do push |
| Produção | Roteiro e limites documentados | Action/PR/merge/tag/Release PENDENTES |

O lockfile confirma `release-please 17.3.0` e `yaml 2.9.1` com `dev: true`. `tsx 4.23.15` é dependência de runtime, conforme `ci-scripts/package.json:20`. Os imports internos da estratégia estão explicitamente presos à versão exata. Nenhum algoritmo paralelo de versionamento foi acrescentado.

## Gates executados independentemente

| Gate | Resultado |
| --- | --- |
| `npm test --prefix ci-scripts` | Exit 0: 7 testes, 7 aprovados, 0 falhas, 0 cancelados, 0 skips |
| `npm run typecheck --prefix ci-scripts` | Exit 0 |
| `validate_spec.py .specs/features/release-please-self-pilot/spec.md` | Exit 0: 0 erros, 0 avisos |
| `validate_tasks.py .specs/features/release-please-self-pilot/tasks.md` | Exit 0: 0 erros, 0 avisos |
| `check_commit.py` nos três títulos do range | Todos aprovados |
| `git diff --check` | Exit 0 |
| `validate_state.py release-please-self-pilot` | Exit 0: 0 erros; o gate verifica apenas formato/evidência do relatório, não a produção |

Contagem anterior: 7 casos superiores, identificados na base e comparados pelo diff. Contagem atual: 7. A mudança adiciona asserções ao caso funcional; não remove, enfraquece ou desativa as anteriores. O gate integral não usou seleção por nome. A seleção `test:functional` foi usada somente no sensor.

## Sensor de discriminação

**Result**: PASS, 3 mutações injetadas, 3 detectadas, 0 sobreviventes.

Foi extraído um `git archive` do SHA revisado para uma cópia temporária, sem criar worktree, stash ou alterar o checkout real. O diretório copiado usou uma junction somente para as dependências já instaladas. A baseline da cópia passou antes das mutações: 1 teste funcional, 0 falhas/skip. Cada mutação foi revertida por patch antes da seguinte. A baseline restaurada passou novamente ao final.

| ID | Falha injetada somente na cópia | Falha observada no teste | Resultado |
| --- | --- | --- | --- |
| M1 | `.github/workflows/version-release-please-called.yml:51`: entrypoint trocado por `release-orchestrator.missing.ts` | Exit 1; `ci-scripts/tests/release-please.test.ts:141` recebeu status 1 em vez de 0 e `ERR_MODULE_NOT_FOUND` para o entrypoint deliberadamente quebrado dentro do checkout temporário | Detectada. Runtime/SDK carregaram corretamente; não foi falta de dependências |
| M2 | `.github/workflows/version-release-please-called.yml:68`: input `release-as` ligado a `release_type` | Exit 1; `ci-scripts/tests/release-please.test.ts:143` recebeu `release-as: simple` em vez de `0.0.1` | Detectada pelo valor efetivo do binding |
| M3 | `ci-scripts/scripts/release-orchestrator.ts:126`: fallback vazio trocado por `0.0.1`, deixando versão residual no segundo momento | Exit 1; `ci-scripts/tests/release-please.test.ts:172` recebeu `release_as: 0.0.1` em vez de string vazia. Preparação e SDK real já haviam executado | Detectada na transição técnica correta |

**Isolamento**: porcelain real antes do sensor = vazio; depois das mutações e baseline restaurada = vazio; HEAD permaneceu o SHA revisado. Após gravar o relatório, o porcelain contém somente `?? .specs/features/release-please-self-pilot/validation.md`; excluindo esse caminho, continua vazio. Nenhum stash/reset/checkout, commit ou operação remota foi executado pelo Verifier.

**Limpeza**: a revisão automática de execução rejeitou antes de executar o comando de remoção da cópia temporária, com a razão `blocked by policy`. Não houve tentativa por mecanismo alternativo. A cópia restaurada permanece em `C:/Users/gerso/AppData/Local/Temp/rpsp-verifier-118bf8b2f417442f86437f42f2cf0a70`, com uma junction para `ci-scripts/node_modules` do checkout real. Nenhum arquivo material foi removido; o diretório real de dependências continua presente.

## Edge cases e qualidade

- Tipo não suportado: PASS local, `ci-scripts/tests/release-please.test.ts:193`, `:196`, `:198`.
- Milestone inválida: PASS local, `ci-scripts/tests/release-please.test.ts:192`, `:196`, `:198`.
- Falha externa no piloto: PENDENTE; não foi convertida em sucesso local nem simulada como publicação comprovada.
- Primeira tag proposta sem tag anterior: PASS SDK local, `ci-scripts/tests/release-please.test.ts:184` exige `v0.0.1`; nenhuma tag `v0.0.0` criada.

As alterações seguem o fluxo e os padrões existentes. Não há novo framework de adaptadores, novos arquivos de teste por função, publicação de pacote simple, mudanças em aplicações externas ou tentativa de resolver a governança adiada. Diretrizes usadas: `AGENTS.md`, spec/design/tasks desta feature e validação TLC. A documentação identifica tanto o prefixo de branch como limitação conhecida (`docs/pipelines/versionamento-release-please.md:17`) quanto a diferença entre SDK hospedado e Action (`:34`).

## Achados, lições e próxima evidência

**Achados ranqueados no recorte T1-T3**: nenhum. Não há tarefa de correção antes do push/teste da branch.

Declinei julgar como entregues: autenticação forte do PR técnico, conclusão/fechamento de milestones, versões regressivas/conflitantes, concorrência, idempotência remota e recuperação de falhas parciais. São explicitamente futuros. Também não julguei consumidores externos nem o projeto anterior de múltiplos adaptadores. A validação de RPSP-05 permanece pendente porque o caller de teste não executa a Action nem escreve PR/tag/Release.

Nenhuma lição foi registrada: não houve critério falho no recorte aprovado, mutante sobrevivente, desvio ou lacuna de precisão. Os critérios externos PENDENTES e futuros ADIADOS não são falhas de implementação deste recorte.

Próxima evidência necessária: executar o caller de teste na branch autorizada e registrar o link e o SHA real do run. Mesmo se esse run passar, o resultado será integração hospedada do SDK/contrato, mantendo o E2E de publicação, merge em master e encerramento da issue fora deste veredito.
