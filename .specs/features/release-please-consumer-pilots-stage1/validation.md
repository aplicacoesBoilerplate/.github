# Validação independente: três consumidores Release Please

**Date:** 2026-10-24.
**Spec:** `.specs/features/release-please-consumer-pilots-stage1/spec.md`.
**Verifier:** `/root/stage1_independent_verifier`, independente do implementador.
**Verdict:** PENDING — a implementação está aprovada para revisão/integração; a etapa integral depende dos três ciclos reais após os merges humanos.
**Result:** FAIL — o gate de conclusão integral permanece pendente dos merges/ciclos reais; não indica uma falha técnica remanescente da implementação.
**Implementation verdict:** PASS após a correção do SHA validado pela CI Go.

## Superfície auditada

| Repositório | Base -> revisão final auditada | PR / destino |
| --- | --- | --- |
| Central .github | 564f1bba751ed605931beffa5e9fed00e42fec4c -> b7acc0fe865b0cfc33d55a9bab9612179a3eb754 | [19](https://github.com/aplicacoesBoilerplate/.github/pull/19), master |
| PackagesJava | 2992a00995071d4e836e907e5148222fea1e3fdc -> 47a19912d55e4d94334e87ae3071ada0d948b49d | [36](https://github.com/aplicacoesBoilerplate/PackagesJava/pull/36), release/v0.0.1 |
| PackagesVue | a846332f1f922f09333bfca81de45b3b47bf2f5b -> d17697a47779608ee86caa9dd5cd810900837ce9 | [39](https://github.com/aplicacoesBoilerplate/PackagesVue/pull/39), release/v0.0.1 |
| boilerplate-cli | 939987851b49436476a82a859694688772fda7bb -> 282285ea372ab3bb9a5a47c5dff51d9b10b7c049 | [16](https://github.com/aplicacoesBoilerplate/boilerplate-cli/pull/16), release/v0.0.1 |

Os quatro heads foram conferidos no GitHub. Todos os callers reais fixam `1d874d946e5f5ad233a6b1f6bf278fef78f3b46d` em uses e central-ref. O commit central posterior b7acc0f altera somente links de documentação, não o runtime. O central é público, permitindo o checkout pelos tokens dos consumidores. A issue #4 continua CLOSED.

## Task completion

| Tarefa | Estado verificado |
| --- | --- |
| T1 | Implementada, testada e publicada; opt-out obrigatório nos publishers |
| T2 | Implementada, sete casos/tipos/audit aprovados; motor oficial nos três modos |
| T3 | Publicada, PR19 aberto e CI/build documental aprovados |
| T4 | Java implementado/publicado em PR36; reactor e ensaio de bump aprovados |
| T5 | Vue implementado/publicado em PR39; npm fixado antes de cache e ordem build/type-check corrigidos; gates finais aprovados |
| T6 | Go implementado/publicado em PR16; falha de SHA encontrada nesta revisão e corrigida em 282285e |
| T7 | Verificação técnica concluída neste relatório; persistência final do relatório/status cabe ao implementador. Merges/ciclos reais permanecem pendentes |

## Spec-anchored acceptance criteria

Os prefixos `Java/`, `Vue/` e `Go/` abaixo representam os worktrees consumidores identificados acima. Os caminhos sem prefixo são do central. Asserções são derivadas dos resultados da spec, sem usar sucesso de mock como prova de publicação.

| Critério | Resultado esperado | Evidência file:line e asserção/observação | Resultado |
| --- | --- | --- | --- |
| RPIL-01.AC1 | Publicação omitida = false | `ci-scripts/tests/release-please.test.ts:106`, deepEqual do input boolean/default:false; called:19 | PASS |
| RPIL-01.AC2 | Flag false bloqueia os três publishers mesmo com release_created | `ci-scripts/tests/release-please.test.ts:128`, igualdade exata de cada guard com AND inputs.publish-artifacts; called:112/120/126 | PASS de contrato; sem executar publishers |
| RPIL-01.AC3 | Flag false explícito nos três callers | `Java/.github/workflows/release.yml:27`, `Vue/.github/workflows/release.yml:27`, `Go/.github/workflows/release.yml:27`; `Go/tests/versioning/test_caller.py:31` | PASS |
| RPIL-01.AC4 | Writers antigos fora de gatilhos ativos | `Java/.github/workflows/deploy.yml:4` só workflow_dispatch e :12 if:false; `Vue/.github/workflows/release.yml:23` substitui Changesets; `Go/tests/versioning/test_caller.py:58` apenas go-ci e :61 rejeita legados | PASS |
| RPIL-02.AC1 | uses e scripts no mesmo SHA publicado | Os três `release.yml:23/26`; `Go/tests/versioning/test_caller.py:27-28`, igualdade do SHA; heads remotos conferidos | PASS |
| RPIL-02.AC2 | Milestone exigida antes da escrita funcional | `ci-scripts/tests/release-please.test.ts:215-223`, ausência/inválida => exit1 e outputs {}; called:82/95 só segue com engine produzido | PASS |
| RPIL-02.AC3 | PR técnico sem nova milestone/override residual | `ci-scripts/tests/release-please.test.ts:196-198`, outputs release_as vazio; :235-237 idem raiz configurada; :209-210 tag/SHA preparados | PASS do contrato nativo; ciclo real pendente |
| RPIL-02.AC4 | Config/política incompatível falha antes de fornecer escrita | `ci-scripts/tests/release-please.test.ts:256-264`, política desconhecida, override múltiplo, traversal e manifest ausente => exit1/outputs {}; configuração preservada em :234 | PASS |
| RPIL-02.AC5 | Motor oficial para candidatos e releases | `ci-scripts/scripts/configured-release.ts:29/41-42`, Manifest.fromManifest e writers públicos; teste:302/309/320/339/342/408 usa resultados nativos; called:84 Action oficial | PASS local; API de escrita isolada |
| RPIL-02.AC6 | Self-caller e sete casos preservados | `ci-scripts/tests/release-please.test.ts:83-98` verifica self-caller; suíte integral 7/7, zero skips. Um único arquivo funcional ampliado | PASS |
| RPIL-03.AC1 | Versão conjunta nos POMs e revision | `ci-scripts/tests/release-please.test.ts:309/312-315` exige 0.0.2; `Java/release-please-config.json:8-13` skip-snapshot/extra XML. Ensaio adicional aplicou updaters aos POMs reais e recompilou os quatro módulos em 0.0.2 | PASS |
| RPIL-03.AC2 | Referências internas coerentes | Teste:313 revision0.0.2; POM real usa revision nas dependências internas. Reactor efetivo atualizado em scratch passou mvn verify, sem resolução de versão interna antiga | PASS |
| RPIL-03.AC3 | Sem terceiro PR SNAPSHOT | `ci-scripts/tests/release-please.test.ts:303/310`, skipSnapshot===true e grupo diferente de snapshot; config Java:8 | PASS do comportamento nativo configurado |
| RPIL-03.AC4 | CI continua verify sem deploy | `Java/.github/workflows/ci.yml:25`, mvn -B verify; deploy:12 if:false. Gate real quatro módulos/quatro testes/zero skips | PASS |
| RPIL-04.AC1 | Incrementos independentes, sem escalar comum | `ci-scripts/tests/release-please.test.ts:247`, release_as vazio mesmo com milestone9.0.0; :387/393/394 exige UI1.1.2 e utils0.0.1; Vue caller:30 native | PASS |
| RPIL-04.AC2 | Ranges e lockfile acompanham dependência | `ci-scripts/tests/release-please.test.ts:397/399-400`, ^1.1.2 em docs/lock e UI1.1.2; ensaio adicional com lockfile real passou | PASS |
| RPIL-04.AC3 | Nomes, versões e privacidade preservados | `Vue/.release-please-manifest.json:2-7` seeds reais distintos; teste:374/396/401-402; ensaio real confere nomes/publishConfig restricted, raiz/tools/outros pacotes byte-idênticos | PASS |
| RPIL-04.AC4 | Raiz fora do manifest e privados sem tag/Release | `Vue/release-please-config.json:10-21`, lista explícita sem raiz; apps/docs skip-github-release; teste:409 exige releases=[] para docs, :401 raiz private | PASS |
| RPIL-04.AC5 | Changesets deixa de competir | `Vue/.github/workflows/release.yml:23` somente central; CI não contém mais gate changeset; scripts root de version/publish removidos. Arquivos/dependência histórica preservados | PASS |
| RPIL-05.AC1 | go-gitsemver deixa de escrever | `Go/tests/versioning/test_caller.py:57-61`, ausência de version-preview/version-publish e adapter legado nos workflows; CI apenas go-ci | PASS |
| RPIL-05.AC2 | Gates Go e aplicação preservados | `Go/tests/versioning/test_caller.py:75-84` confere checkout correto e todos comandos; tests/vet/build/lint executados. Diff base..HEAD contém somente YAML, docs e contrato; nenhum fonte Go/GoReleaser alterado | PASS após F-SHA |
| RPIL-05.AC3 | Promoção permanece humana | `Go/.github/workflows/release.yml:6/13/17` master+merged; PR16 OPEN contra release/v0.0.1, mergedAt:null confirmado | PASS de preservação |
| RPIL-05.AC4 | Tipo Go sem GoReleaser | `Go/tests/versioning/test_caller.py:31` exige project-type:go/publish-artifacts:false; :61 ausência de action GoReleaser. Ensaio nativo Go propõe só CHANGELOG.md, tagv0.0.1 e SHA integrado, mantendo go.mod | PASS local; ciclo real pendente |
| RPIL-06.AC1 | Gates, código/testes/status persistidos | Commits centrais T1/T2/T3 incluem status TLC; commits Java/Vue/Go incluem guias com progresso e contratos pertinentes. SHAs remotos da tabela confirmados. Status central agregado T4-T7 será persistido pelo implementador | PASS de entrega de código; consolidação final pendente |
| RPIL-06.AC2 | Verifier independente, gate e sensor | Este relatório; gates abaixo e quatro mutantes dirigidos mortos em scratch. Autor do código não é o Verifier | PASS |
| RPIL-06.AC3 | Separar local/CI/ciclo real | Tabelas de gate hospedado e pendências abaixo; `Java/docs/versioning.md:15`, `Vue/docs/versioning.md`, `Go/docs/versioning-pilot.md` registram limites | PASS |
| RPIL-06.AC4 | Não declarar meta concluída com merge pendente | Quatro PRs OPEN/mergedAt:null. Este relatório mantém verdict PENDING e distingue implementação aprovada de publicação dos três consumidores | PASS da obrigação de transparência; meta integral PENDING |

Os 27 critérios receberam evidência. Não foram encontradas novas lacunas de precisão que exijam inventar política. Aprovação técnica não equivale a comprovação dos três ciclos de publicação.

## Gate local executado pelo Verifier

| Gate | Resultado |
| --- | --- |
| npm test --prefix ci-scripts | 7/7, zero falhas/skips após rerun sequencial |
| npm run typecheck --prefix ci-scripts | PASS |
| npm audit --prefix ci-scripts --omit=dev | 0 vulnerabilidades |
| Maven mvn -B verify no consumidor | Quatro módulos SUCCESS; core1 + starter3 testes, zero falhas/skips |
| Ensaio SDK nos arquivos Java reais + verify em scratch | Quatro POMs/pais/revision em0.0.2; quatro módulos/quatro testes aprovados |
| Vue npm10.9.4 verify -- --force --concurrency=1 | 17/17 tarefas, zero cache; tipos/testes/build mantidos |
| Go contratos Python | 9/9; repetidos em282285e após correção do checkout |
| Go test/vet/build e golangci-lint | PASS; lint0issues |
| Ensaio SDK Go com go.mod real | Candidato0.0.1 só CHANGELOG; tagv0.0.1/SHA propostos corretos; go.mod inalterado |
| validate_spec/validate_tasks --strict | Zero erros/avisos |

A primeira tentativa de quatro gates simultâneos saturou memória do Windows: JVM registrou malloc insuficiente, filhos Node abortaram e um subprocesso negativo central retornou2147483651. Nada foi enfraquecido para passar: reruns sequenciais terminaram aprovados; Vue limitou concorrência, mantendo as mesmas tarefas e --force. Logs hs_err/replay ignorados gerados pela JVM foram preservados.

Contagem central antes/depois: sete casos superiores. Contagem de contrato Go antes/depois: nove. O antigo modo opcional --real-go era exclusivo do adaptador aposentado; o novo motor foi exercitado no SDK real, sem manter uma expectativa go-gitsemver incompatível com o escopo aprovado. Composables/utils não têm testes próprios e usam passWithNoTests preexistente; não são contabilizados como cobertura funcional. Os workspaces não declaram lint próprio: o nome Turbo lint não comprova análise adicional.

Ensaio adicional reexecutado pelo Verifier: `C:/Users/gerso/AppData/Local/Temp/rp-native-rehearsal-1792824309046/rehearse.mjs`, em particular asserts:29-39 e :48-60; `go-rehearse.mjs:20-30`. Os transportes SDK têm fetch proibido. Os scripts não criam PR/tag/Release no GitHub. São evidências locais auxiliares, não arquivos necessários ao caller.

## CI hospedada conferida

| Repositório / SHA final | Execução | Resultado |
| --- | --- | --- |
| Central b7acc0f | [40071353788](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40071353788) | Validate repository PASS |
| Central b7acc0f | [40071353809](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40071353809) | Build documental PASS; deploy corretamente não elegível em PR |
| Java47a1991 | [40071261874](https://github.com/aplicacoesBoilerplate/PackagesJava/actions/runs/40071261874) | verify PASS |
| Vue d17697a | [40071851841](https://github.com/aplicacoesBoilerplate/PackagesVue/actions/runs/40071851841) | validate PASS |
| Go282285e | [40072007834](https://github.com/aplicacoesBoilerplate/boilerplate-cli/actions/runs/40072007834) | go-ci PASS |

Prontidão administrativa: o central é público. A consulta de políticas Actions confirmou no Go can_approve_pull_request_reviews:true; o mesmo endpoint em central/Java/Vue retornou403 com a identidade do agente, portanto essas políticas não foram confirmadas nem inferidas como desabilitadas. O piloto interno já comprova o ciclo central, mas não substitui as permissões e os ciclos dos consumidores. Nenhuma política ou credencial foi alterada.

## Discrimination sensor

Profundidade: dirigida, ampliada com a regressão do SHA encontrada nesta revisão. Nenhum teste real foi alterado, desativado ou removido para o sensor.

| Mutante isolado | Local | Falha observada | Resultado |
| --- | --- | --- | --- |
| M1: default publish-artifacts=true | called:19 em scratch central | assert.deepEqual do input default em teste:106 | KILLED |
| M2: aplicar TARGET_VERSION também em native | release-orchestrator.ts:128 em scratch central | teste:247 recebeu release_as9.0.0 em vez de vazio | KILLED |
| M3: remover createReleases do bridge | configured-release.ts:41 em scratch central | teste:339 perdeu ordem releases/reload | KILLED |
| M4: checkout Go retorna ao head do PR integrado | Go ci.yml:19 em scratch Go final | teste Python:76 falhou, oito demais passaram | KILLED |

Resultado: 4/4 mortos, zero sobreviventes. Os três primeiros rodaram na cópia central; a verificação final M4 capturou e comparou porcelain dos quatro repositórios depois das correções legítimas Vue/Go. Os quatro ficaram exatamente iguais antes/depois do sensor. Central/Java/Vue limpos; Go manteve os mesmos16 flags stat-only de CRLF/LF já presentes, com git diff --exit-code HEAD -- '*.go' vazio e nenhum fonte Go no intervalo de commits.

Os mutantes foram revertidos nos scratches e ambos têm gitdiff/porcelain limpos. A limpeza do primeiro scratch (remoção dos dois junctions node_modules e git worktree remove) foi rejeitada automaticamente com a única razão `blocked by policy`. Não houve nova tentativa nem alternativa destrutiva. Foram preservados `C:/Users/gerso/AppData/Local/Temp/rp-stage1-independent-sensor` e `C:/Users/gerso/AppData/Local/Temp/rp-stage1-go-sha-sensor`; isso não altera o resultado nem os quatro worktrees reais.

## Finding corrigido: F-SHA

**Severidade:** P1. O caller Go reutilizava a CI após merge, mas seu checkout selecionava head.sha, enquanto o writer central selecionava merge_commit_sha. Assim, a CI não comprovava o commit efetivamente integrado. A implementação anterior e o teste não cercavam essa diferença de evento.

**Correção confirmada:** commit282285ea372ab3bb9a5a47c5dff51d9b10b7c049. `Go/.github/workflows/ci.yml:19` agora prioriza merge_commit_sha quando merged=true e preserva head.sha/github.sha nos demais contextos. `Go/tests/versioning/test_caller.py:76` foi fortalecido no mesmo caso existente. O Verifier repetiu os nove contratos e matou M4 com essa asserção. CI hospedada final aprovada. Não restam bloqueios técnicos conhecidos para revisar/integrar esta implementação.

## Qualidade e limites

- Sem novos callers por adaptador no central; apenas um exemplo genérico. As três aplicações mantêm seus próprios callers.
- Strategy, changelog, XML, plugin de workspace e tags vêm do Release Please oficial. O novo bridge usa GitHub/Manifest públicos; imports internos ficam nos testes/rehearsals da versão fixada.
- Publique pacotes/binários somente em outra etapa. Os publishers legados não suportam o bridge configurado nem múltiplos componentes; os três callers atuais usam false.
- Nomes, privacidade, configuração GoReleaser, fontes funcionais e branches de release preservados. O diff Go confirmado contém somente CI/caller, README/guia e contrato.
- A identificação do PR técnico por prefixo de branch não autentica o autor; é limite conhecido da governança, não foi alegado como autorização forte.
- Nenhuma alteração administrativa, merge, tag, Release ou registry publishing foi realizada pelo Verifier.

## Pendências humanas e conclusão

Implementação/configuração: **PASS para revisão e integração**. Os três PRs de aplicação têm destino release/v0.0.1 e continuam abertos, sem promover suas features a master. O PR central19 também está aberto, com milestonev0.0.2.

Etapa integral: **PENDING**. Falta levar cada integração pelo Git Flow com decisão humana e comprovar seus dois momentos reais: entrega funcional+milestone -> PR técnico e merge técnico -> tag/GitHub Release no SHA integrado. Java, Vue e Go ainda não têm esses três novos ciclos comprovados. Nenhum resultado local ou CI somente leitura substitui essa evidência. Manter a meta ativa e não declarar validate_state/feature completion aprovados como se a etapa integral estivesse concluída.

O primeiro validate_state retornou0 porque o título em português não era um dos marcadores reconhecidos pelo parser; ele passou a procurar PASS no texto inteiro e encontrou o resultado técnico restrito. Após adicionar o marcador canônico de resultado em inglês para o escopo integral, a reexecução final terminou com exit1, informando feature não concluída. O gate permanece reprovado enquanto faltarem os ciclos. A saída estrutural isolada nunca substitui a leitura do escopo e das evidências. A lição candidata L-001 registra o finding real F-SHA pela ferramenta TLC; a limitação do parser é observação de ferramenta, não uma nova regra de negócio.
