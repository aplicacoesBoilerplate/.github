# Validação independente da conciliação

## Validation: FAIL

Os gates existentes e o sensor passaram. A prontidão técnica permanece bloqueada por uma lacuna de precisão do bootstrap Node: o guia não distingue a candidata nativa 0.0.1 de um bootstrap que realmente altera package.json. A reprodução adicional mostrou comportamento dependente da formatação dos manifests já em 0.0.1. O guard deve ser preservado; documentar o caminho suportado e fixá-lo em teste real resolve a lacuna sem aceitar flags arbitrárias.

- Data: 2026-10-15, America/Sao_Paulo.
- Verifier: subagente independente, autor diferente do implementador.
- Range integral revisado: `fcf31e08165156a5938eec7577bbf1be945f365f..bcb145a06dff6bfca0ca460ed094c83bc6a67e44`, 67 arquivos.
- Branch congelada: `codex/reconcile-native-profiles`.
- Apenas este relatório e lessons geradas pelo script podem mudar na árvore real durante esta verificação. Nenhum código/teste real foi alterado pelo Verifier.
- REC-06 é entrega operacional subsequente. O veredicto não afirma push, nova CI hospedada, merge, deploy ou homologação dos pilotos.

## Gates executados

Ambiente: Node 24.19.0; Git Bash primeiro no PATH; Go instalado; JAVA_HOME `C:/Users/gerso/.jdks/corretto-21.0.3`; Java21/Maven3.9.9; Python/PyYAML; actionlint1.7.12.

| Comando | Evidência observada |
| --- | --- |
| `node tests/versioning/run.mjs --local` | exit0; 27 fixtures; VersionReport30, policy54, workflow64; nenhum skip |
| `node tests/versioning/run.mjs --real-go` | exit0; bootstrap, tagged retry, fix, feat, breaking e sprint; configuração inválida rejeitada |
| `node tests/versioning/real-standard-version.mjs` | exit0; 1.1.0, três arquivos nativos, replay byte a byte e recálculo da origem após tag descendente |
| `node tests/versioning/real-jgitver.mjs` | exit0; project.version0.1.0, SHA/base e Properties nativas |
| `node tests/versioning/real-maven-reactor.mjs` | exit0; 118 assertions; quatro módulos e referências internas; dirty preservado, core-only, checkpoints e rebuild |
| `node tests/versioning/real-jgitver-prefix.mjs` | exit0; infra/v isolado de v9.0.0; PATCH, rebuild e MINOR |
| `node tests/versioning/maven-setup.mjs` | exit0; Maven3.9.9 real e checksum incorreto rejeitado |
| `actionlint` central | exit0, ignorando somente `property "(workflow_repository|workflow_sha)" is not defined` |
| `actionlint` callers Go/Maven/Node | exit0 nos três minirrepositórios temporários, workflows em `.github/workflows`; sem ignorar workflow-call |
| Python/PyYAML | 12 arquivos YAML centrais/callers parseados |
| `git diff --check fcf31e0..HEAD` | exit0 |
| TLC validate_spec / validate_tasks | zero erros; spec zero avisos; tasks quatro avisos: docs sem testes, T11 multifile e parser de diagrama; dependências T1->T12 conferidas |

Integridade dos testes: `git show fcf31e0:tests/versioning/run.mjs` contém 13 fixtures; a lista atual conserva as 13 e acrescenta14. Não houve exclusão/skip. A migração Maven trocou fixtures stdout1.8 por Properties1.9 completas, mantendo versão/base/SHA e negativos. O fluxo Node ganhou tag-base1.0.0 coerente com a regra de bootstrap; a assertion continua proibindo qualquer tag nova. Mudanças estruturais de workflows preservam os64 checks e acrescentam o contrato semântico read/write. Os testes reais antigos foram ampliados, não substituídos por mocks. Saídas esperadas de processos inválidos e a depreciação fs.F_OK do upstream são observações esperadas, não falhas dos gates.

## Acceptance criteria, evidence-or-zero

| AC | Outcome derivado do spec | Evidência exata e assertion | Avaliação |
| --- | --- | --- | --- |
| REC-01.1 | Três IDs permitidos, injeção explícita, desconhecido recusado | `tests/versioning/adapter-registry.mjs:16` candidateVersion===0.0.1; :18 calculate injetado; :19-20 assert.throws unknown/__proto__; `tests/versioning/standard-adapter.mjs:15` argv exato | Coberto |
| REC-01.2 | schema1 e identidade Go/outputs preservados | `tests/versioning/version-report.mjs:47` schemaVersion===1; :48-53 adapter/base/candidate/tag/bump/explanation exatos; `tests/versioning/go-adapter.mjs:20` envelope exato; `tests/versioning/native-workflows.mjs:50` seis outputs iguais ao contrato | Coberto |
| REC-01.3 | Somente estáveis alcançáveis no prefixo literal | `tests/versioning/version-report.mjs:33` base0.2.0; :39 infra/v base0.1.0; `tests/versioning/reconciled-report.mjs:23` [1.0.0,infra/v1.1.0,minor]; `tests/versioning/real-jgitver-prefix.mjs:24` PATCH1.0.1 | Coberto |
| REC-02.1 | used/calculated/SHA/plugin1.9 coincidentes | `tests/versioning/real-maven-reactor.mjs:38` used_version===expectedVersion; :39-41 calculated/SHA/plugin exatos; `tests/versioning/jgitver-report.mjs:24` envelope schema nativo/tag anotada; :26 Properties iguais | Coberto |
| REC-02.2 | Versão divergente, SHA incorreto e qualificador bloqueados | `tests/versioning/jgitver-adapter.mjs:31` assert.throws divergência com Properties completas; `tests/versioning/reconciled-report.mjs:26` quatro propriedades adulteradas rejeitadas; :28 SHA incorreto; :29 SNAPSHOT rejeitado | Coberto |
| REC-02.3 | Tag anotada no merge, retry sem mover ref | `tests/versioning/annotated-publish.mjs:57` tag===sha e objeto===d*40; :58 Release target===sha; :60 writes idênticos no retry; :63 conflito sem writes | Coberto |
| REC-02.4 | Quatro módulos versão única, dirty/core-only/rebuild | `tests/versioning/real-maven-reactor.mjs:56` lista dos quatro artifacts; :60 project.version===expectedVersion; :62 referências internas iguais; :65 porcelain; :115 dirty bytes iguais; :150 diff somente Core.java | Coberto |
| REC-03.1 | Um PR técnico, manifests/lock/changelog nativos, sem Release funcional | `tests/versioning/standard-flow.mjs:142` pending-version-pr; :143 versão1.0.1; :144 tags somentev1.0.0; :149 mesmo PR aberto; `tests/versioning/real-standard-version.mjs:53` três paths exatos, :58-60 replay igual | Coberto no caminho versionado; precisão insuficiente no bootstrap já0.0.1, G1 |
| REC-03.2 | Humano no head atual, cálculo no SHA funcional e tag no merge técnico | `tests/versioning/version-pr.mjs:46` revisor humano aprovado; :56 SHA antigo rejeitado; `tests/versioning/standard-flow.mjs:188-189` published_sha/tagSha===versionMergeSha; `tests/versioning/real-standard-version.mjs:66` origem recalculada1.1.0 | Coberto |
| REC-03.3 | Bot/dismissed/obsoleto/PR inválido bloqueiam sem escrita | `tests/versioning/version-pr.mjs:47` changes-requested revoga aprovação; :49 dismissed; :51-56 bots/head antigo; :38 metadado/origem; :65 arquivo extra; `tests/versioning/standard-flow.mjs:160-182` negativos e tagSha undefined | Coberto |
| REC-03.4 | Retry técnico/Release não duplica nem sobrescreve | `tests/versioning/standard-flow.mjs:149` já aberto; :193 already-published; :194 SHA inalterado; :201-209 retry antigo completo permitido, incompleto bloqueado | Coberto |
| REC-04.1 | Native reader somente leitura sem App secrets | `tests/versioning/native-workflows.mjs:11` permissões read exatas; :31 nenhuma App action; :32 sem secrets/VERSIONING_TOKEN; `tests/versioning/process-runner.mjs:13` tokens null, variável visível preservada | Coberto |
| REC-04.2 | Writer materializado sem runtime nativo | `tests/versioning/native-workflows.mjs:35` ausência setup Java/Go/instaladores/nativos; :43 require-precomputed1; `tests/versioning/annotated-publish.mjs:72` sucesso com Maven exit99; `tests/versioning/standard-flow.mjs:132` adapter exit99 antes da execução do writer com artifacts, executado por standard-precomputed | Coberto |
| REC-04.3 | Identidade/SHA/prefixo/path/hash/ref divergentes sem writes | `tests/versioning/version-bundle.mjs:31-40` assert.throws SHA/identidade/prefixo/traversal/hash/versão; :44 bytes antigos intactos; :47 symlink; `tests/versioning/git-inputs.mjs:15` ref nova rejeitada; :21 substituição rejeitada; `tests/versioning/annotated-publish.mjs:75-81` nenhum write após ref/policy/SHA adulterados | Coberto |
| REC-04.4 | Path fora e timeout falham sem fallback | `tests/versioning/process-runner.mjs:14` throws fora do workspace; :15 throws timeout; `tests/versioning/collect-version-report.mjs:14` status1/path e :15 relatório inexistente | Coberto |
| REC-05.1 | Sem milestone cálculo nativo autoritativo | `tests/versioning/jgitver-report.mjs:49` outcome adapter-authoritative; :44-45 mesmos outcomes/decisão para Maven e Go | Coberto |
| REC-05.2 | Exatidão versão/incremento; inválida sem override | `tests/versioning/release-policy.mjs:32-57` versão/bump e mismatch específicos; `tests/versioning/jgitver-report.mjs:35` invalid+override -> blocked, :44 outcome exato | Coberto |
| REC-05.3 | Duas pessoas autorizadas, depois do label, head atual, versão preservada | `tests/versioning/release-policy.mjs:61-68` calculatedVersion2.0.0/audit iguais; :70-86 label/role/same-user/tempo/SHA rejeitados; `tests/versioning/jgitver-report.mjs:36-44` overridden e negativos exatos | Coberto |
| REC-05.4 | Properties diferentes de explicação derivada no guia | `tests/versioning/jgitver-report.mjs:53` deepEqual nativeEvidence format/properties/explanation.kind=derived; :56-60 seções e campos exatos | Coberto |
| REC-06.1 | Entrega somente PR12 via fast-forward após aprovação | Pré-condição: `git merge-base --is-ancestor fcf31e0 HEAD` exit0; ls-remote atual fcf31e0 em refs/heads/codex/versioning-profiles. Entrega não executada pelo Verifier | Pendente operacional, não alegado concluído |
| REC-06.2 | Remoto novo não integrado interrompe sem force | Protocolo em `design.md:38` e escopo explícito em spec. Necessária releitura imediatamente antes do envio; este relatório não implementa/aprova force-push | Pendente operacional |
| REC-06.3 | Distinguir provas locais/CI/piloto/registry | Este relatório; `delivery.md:7` revisão/push/CI pendentes; `docs/versioning-jgitver.md:17` piloto não certificado; docs Node/Maven registram limites | Coberto documentalmente |

Não há rotas HTTP novas ou UI a homologar. Cada fixture acrescida mapeia REC-01/02/03/04/05 ou os gates de toolchain de T10. Guia e callers seguem AGENTS/TLC, sem Changesets ou alterações dos pilotos. A composição dos três adaptadores reaproveita policy/API/guia, sem implementação paralela de versionamento.

## Sensor de discriminação

Scratch exclusivo: `C:/Users/gerso/AppData/Local/Temp/reconcile-verifier-06099b43a79d41af8578c232d1c14963`. Foram copiadas apenas scripts/tests para não precisar criar branch/checkout adicional. Nunca foi usado stash ou mutação da árvore real. Mutantes em módulos independentes não interferiram entre si; antes do sexto todos os cinco anteriores foram revertidos apenas nas cópias.

| Mutante comportamental | Alvo | Teste que o matou | Resultado |
| --- | --- | --- | --- |
| M1 remover TOKEN do filtro de env | `scripts/versioning/process-runner.mjs:15` | `tests/versioning/process-runner.mjs:13`, actual tokens never-export versus null | Morto, exit1 |
| M2 ignorar comparação de refs | `scripts/versioning/git-inputs.mjs:22` | `tests/versioning/git-inputs.mjs:15`, Missing expected exception | Morto, exit1 |
| M3 ignorar hash do conteúdo | `scripts/versioning/version-bundle.mjs:80` | `tests/versioning/version-bundle.mjs:36`, erro JSON não satisfaz contrato /hash/ | Morto, exit1 |
| M4 manter primeira review histórica por usuário | `scripts/versioning/version-pr.mjs:39` | `tests/versioning/version-pr.mjs:47`, CHANGES_REQUESTED posterior deixa de revogar | Morto, exit1 |
| M5 aceitar used_version diferente de calculated_version | `scripts/versioning/adapters/jgitver.mjs:41` | `tests/versioning/jgitver-adapter.mjs:31`, Missing expected exception | Morto, exit1 |
| M6 dispensar origem funcional como pai imediato | `scripts/versioning/validate-version-pr.sh:23` | `tests/versioning/standard-flow.mjs:218`, entrega interveniente aceita com status0 | Morto, exit1 |

Profundidade aumentada por fronteira de credenciais/integridade: 6 injetados, 6 mortos, zero sobreviventes. Porcelain real era vazio antes do sensor e continuava vazio após todos os ensaios; HEAD permaneceu bcb145a. A remoção recursiva do scratch exclusivo via Remove-Item foi rejeitada pela revisão automática; o diretório descartável permanece no caminho acima. Nenhum pedido de permissão nem tentativa alternativa de apagar foi feito.

## G1: precisão do bootstrap Node e cobertura real

Prioridade: P2. Relacionado a REC-03.1 e edge bootstrap. `docs/versioning-standard-version.md:27` exige candidata nativa0.0.1; :32 apenas diz que first-release não incrementa automaticamente. Não explicita que firstRelease não é suportado pelo parser, nem que o PR técnico exige uma alteração efetiva de package.json. `scripts/versioning/version-report.mjs:122` depende de linhas de bump; `scripts/versioning/verify-version-files.mjs:26` rejeita package.json sem alteração; `scripts/versioning/version-bundle.mjs:86` exige esse arquivo no bundle.

Reprodução adicional real, standard-version9.5.0, sem tags, commit `fix: bootstrap`, package/lock npm e `.versionrc.json` no mesmo SHA:

| Manifests iniciais | Config nativa | Resultado observado |
| --- | --- | --- |
| 0.0.0 | default | dry-run0.0.1; bundle package/lock/changelog; replay0.0.1; HEAD intacto e zero tags |
| 0.0.0 | releaseAs0.0.1 | Mesmo resultado válido |
| 0.0.1 | default | Nativo0.0.2; normalizador bloqueia por bootstrap exclusivo0.0.1 |
| 0.0.1 compactos | releaseAs0.0.1 | Relatório0.0.1; bundle passa por reformatação incidental de package/lock |
| 0.0.1 formatados com JSON.stringify(data,null,2)+newline | releaseAs0.0.1 | Relatório0.0.1, geração nativa sem modificar package.json; captura falha `PR de versionamento não altera o package.json selecionado` |
| 0.0.0 ou0.0.1 | firstRelease:true | Nativo `skip version bump on first release`; parser bloqueia `standard-version não informou a versão calculada` |

Script de reprodução preservado no scratch como `bootstrap-check.mjs`; caso formatado em `bootstrap3-one-releaseAs-formatted`. Módulos importados da árvore real são somente lidos. O teste real comprometido `tests/versioning/real-standard-version.mjs:19` começa1.0.0 com tag e não cobre esse caminho; o unitário `tests/versioning/reconciled-report.mjs:20` cobre apenas rejeição de candidata incorreta.

Fix proposto: declarar no guia o bootstrap suportado0.0.0->0.0.1, exigência de bump reportado e package.json efetivamente alterado; declarar firstRelease incompatível, sem prometer same-version bootstrap baseado em reformat. Acrescentar prova real positiva0.0.0 e negativas firstRelease e same-version sem diff, preservando os guards de paths/bundle e a exigência0.0.1. Não é necessário aceitar qualquer flag ou diminuir o guard de integridade.

## Incidente do harness de bootstrap

O comando adicional `npm install --no-save --ignore-scripts --no-audit standard-version@9.5.0`, via Bash com cwd `<scratch>/bootstrap-tools` ainda sem package.json, resolveu prefixo ancestral `C:/Users/gerso`. A evidência é `npm prefix` retornando esse caminho, binário ausente no scratch e `C:/Users/gerso/node_modules/standard-version/package.json` criado em2026-10-15 22:14:44. Instalação fora do scratch foi um erro do Verifier, não da implementação.

Efeito confirmado: instalação de standard-version9.5.0 e dependências em `C:/Users/gerso/node_modules`; sem inventário anterior não é possível atribuir cada arquivo/dependência à execução. `C:/Users/gerso/package.json` tinha timestamp2025-07-23 e `package-lock.json`2025-09-22, sem evidência de alteração dos dois por esse comando. Nenhuma .npmrc ou credencial foi lida/exposta. Nada desse prefixo foi removido, pois não existe baseline confiável.

O harness foi corrigido com package.json explícito em bootstrap-tools e prefixo local; o último ensaio usou `npm install --prefix "$1" --no-save --ignore-scripts --no-audit standard-version@9.5.0`, passando o caminho absoluto de bootstrap-tools em argv. Antes do último ensaio, npm prefix e localização de node_modules/standard-version/bin/cli.js foram confirmados dentro do scratch. Essa falha do harness não é contada como regressão do código nem como sobrevivente do sensor.

## Prontidão e próximos passos

T1-T12 estão marcadas concluídas, mas G1 impede fechar a revisão independente. Nenhum bug de cálculo/publicação nos caminhos documentados com versão incrementada foi reproduzido; o bloqueio é precisão/cobertura do bootstrap. Corrigir G1, repetir sua prova e revalidar o range final antes de declarar prontidão técnica.

Após aprovação técnica, o autor deve reler o head remoto e enviar apenas para `refs/heads/codex/versioning-profiles` se continuar ancestral, sem force ou merge. O remoto observado nesta revisão continua fcf31e0. Push e CI da nova revisão continuam sem evidência. Pilotos, Maven deploy/npm publish, registry e consumidor externo permanecem fora do escopo. A análise PR13 documenta os contratos e conflitos; não certifica Changesets/Turbo.

O fechamento determinístico `validate_state.py reconcile-native-profiles` retornou exit1 porque o veredicto é FAIL, como esperado. Duas lições candidatas foram registradas via script: L-008 para G1 e L-009 para confinamento das instalações npm do harness. O diff final do Verifier contém somente este relatório e os dois arquivos de lessons gerenciados pelo script. HEAD e código/testes reais permanecem congelados.
