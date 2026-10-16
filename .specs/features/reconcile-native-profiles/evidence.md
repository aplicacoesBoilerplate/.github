# Evidências da conciliação

## T1

Baseline de entrada fcf31e0 PR12, local b4c783a preservado. API PR12 e13 lidos; baseline suite13 iniciada. validate_spec zero erros/avisos; validate_tasks zero erros e3 avisos documentais/diagramparsing, crosscheck manual sequencial Match. REC-01/06 autorizados em 2026-10-15, push fast-forward PR12 e execução neste chat. Nenhum piloto/merge/deploy autorizado. Context7 ausente, fontes oficiais consultadas. Testes não aplicáveis a planejamento; tools e gates definidos antes do código.

## T2

Red: module missing. Quick PASS process-runner.mjs. REC-04: tests/process-runner.mjs:13 assert.deepEqual credentials null/visible retained, :15 assert.throws outsideworkspace, :16 timeout, :17 exit7, :19 missingcommand; argv/stdout assertions exact. Porta reutilizada b4c783a sem mudança, diretório confinado e env explícito; sintaxe/diff PASS. Toda assertion corresponde fronteira de execução; sem excluir testes baseline.

## T3

Red module missing; Quick Properties PASS. java-properties.mjs:3 assert.deepEqual nativas/escapes/unicode/continuação e :7-10 assert.throws malformed/duplicação/truncado/tipo. REC-02 parsing exato e falha fechada, sem fallbackstdout; fonte b4c783a preservada. Diff PASS, nenhum teste existente alterado.

## T4

Red novo relatório: API stdout não aceita Properties. Quick PASS novo contrato, version-report30 e policy54; diff PASS. reconciled-report.mjs:17 deepEqual bootstrap/base/tagKind/formato, :19-20 negativos bootstrap Maven/Node, :23 base/tag/bump prefix isolado, :26 propriedades divergentes rejeitadas, :28-29 SHA/SNAPSHOT. Teste antigo version-report mantém30 assertions e expectativas, apenas input Maven migrou para Properties completas1.9. REC-01/02. Coletor Bash antigo será conectado no T7, integração Maven não alegada neste gate unitário.

## T5

Red módulo ausente; Quick coletor PASS. jgitver-adapter.mjs:20 versão/SHAexatos, :21 filtro dado pessoal, :22-24 branch/-N/temp cleanup, :31 divergência com todas Properties completas throws mensagem específica; skip/use-version bloqueados. REC02/04. Ruling: prova reactorCLI118 foi movida inteira para T7 onde a CLI existe (tentativa anterior falhou módulo ausente, não alegada como gate); nenhuma assertion removida/condicionada. Primeira baseline --local inválida: HEAD alterado pelo autor durante testepr-check; repetir em checkout congelado. Sintaxe/diff/tasks PASS.

## T6

Quick PASS go-adapter e version-report30. Red módulo ausente antes do código; go-adapter:18 argv exato branch/commit/json/explain, :20 envelope/identidade e :24-26 negativos JSON/SHA/runtime. Reuso b4c783a, sem alteração na normalizaçãoGo do PR12. REC01. Teste Go real permanece gateBuild; nenhuma assertion removida.

## T7

Full PASS: standard-adapter/registry/entrypoint, adapter-report original; reactorMaven118, antigo fixtureMaven agoraProperties1.9 mantendo assertions, novo Mavenprefix real PATCH/rebuild/checkpointMINOR com infra/v e v9.0.0 estrangeira ignorada; standard-version9.5 real calcula1.1.0 e arquivossemcommit/tag; standard-flow funcional/técnico/negativos/retry PASS. UnitNodeargs exatos e envelope/SHA/tag; registryunknown beforetools. SetupfixturesMaven exportaProperties em vezstdout, outcomesoriginais preservados. BootstrapNodeagora0.0.1: standard-flow representa entrega já1.0.0 com tag preexistente e novo commitfuncional; assertion zero-tags foi migrada para exigir exclusivamentev1.0.0 apósgeração (mesmo critério sem nova tag, não relaxado). Não se certifica publicação/remoto ainda.

## T8

Full PASS bundle contract, version-pr existente, standard-version9.5 real+captura/aplicação byte-idêntica de package/lock/changelog. Red inicial módulo ausente; cenário danglingjunction reproduziu ENOENT antes da correção de lstat, agora rejeita explicitamente symlink. version-bundle.mjs:22-28 topidentity/arquivo/base/SHA256/base64; demais assert.throws cobrem SHA/versão/prefixo/path/hash/versão interna10MiB/dirty/symlink e zeroescrita parcial; :final exige3arquivos exatos, HEAD/tag intactos. REC03/04 somente arquivospermitidos e semexecnativa no apply. Baseline congeladaPR12 terminou13fixtures PASS, versionreport30/workflow64, sem editarHEADduranteessegate. Deprecação fs.F_OK em dependencyNode9.5 observada e documentar semclaimmanutenção upstream.

## T9

PASS: standard-flow + standard-precomputed (mesmos cenários completos; escritor com nativo exit99), annotated-publish e post-merge; report/pr/snapshot units; standard-version9.5.0 real inclusive recálculo da origem após tag descendente; bash -n e diff. RED->GREEN: review APPROVED antiga após CHANGES_REQUESTED/DISMISSED e merge técnico com entrega funcional interveniente. Evidência REC03: standard-flow.mjs:187 `assert.match(...,/outcome=published/)`, :189 tagSha==versionMergeSha, :193 already-published e :218 status!=0/219 tag ausente para origem obsoleta. REC02/04: annotated-publish.mjs verifica tag anotada, retry/conflito e artefato pré-computado com adaptador inutilizado; git-inputs.mjs verifica snapshot/SHA e própria tag; version-pr.mjs verifica estados efetivos de review. Todas assertions mapeiam REC02/03/04 e edges, sem redução de outcomes; AGENTS seguido. O PR técnico integrado deve ter originSha como pai imediato (merge/squash ou rebase de commit único); caso outra entrega entre, regenerar o PR antes de publicar.

## T10

Build PASS: --local 26 fixtures (13 anteriores +13 novas), Go real, standard-version9.5.0 real, jgitver real e reactor118/prefixo nativo, instalador Maven3.9.9/checksum inválido, actionlint1.7.12 e diff. REC04/06: native-workflows.mjs:11 `assert.deepEqual(read.permissions,{contents:'read',...})`, :12 needs read+environment, :18 checkout próprio workflowSHA e :19 Node24, :24 Java21, :32 ausência secrets no reader, :35 writer sem toolchain/instalação, :37 App só fase funcional, :43 requisito precomputed, :50 todos outputs preservados. Mapeamento reverso: assertions10-50 -> REC01/03/04/06; contrato existente mantém64 assertions, migrando somente estrutura necessária (Node universal, job reader e environment dependente) e fortalecendo isolamento. CI mantém npm/Maven anteriores e acrescenta todas fixtures. RED->GREEN native-workflows sem reader antes da implementação. AGENTS seguido; nenhum teste ignorado.

## T11

Quick PASS: jgitver-report, homologation-guide, reconciled-report, version-report30, syntax/diff. REC05: jgitver-report.mjs:42 `assert.deepEqual(mavenDecision,evaluateReleasePolicy({report:goReport,snapshot}))` em8 casos (sem milestone, matched, inválida, divergente, override e negativos); :53 `assert.deepEqual(...nativeEvidence,{format:'java-properties',properties:{...},explanation:{kind:'derived',...}})` cobre todos campos de evidência; Markdown exige propriedades/SHA e label derived; guide Go/Node mantém testes anteriores. REC01/02: :23 `assert.deepEqual(cli,report)` prova CLI com envelope Properties e normalizador compartilhado, corrigindo entrada antiga stdout restante no comando normalize-jgitver. RED->GREEN CLI/guia/diagnóstico de tag anotada; mapeamento reverso de todas assertions -> REC01/02/05; sem remoção/skip. AGENTS seguido.

## T12

Build final PASS:27 fixtures locais, native standard-version9.5.0, jgitver, reactor118/prefixo e Go; YAML/actionlint central com filtro somente workflow_identity,3 callers lintados em minirrepositórios isolados (sem ignorar workflow-call ausente),76 links relativos/diff, validadores spec/tasks0erros. REC01/06: três callers fixados no mesmo código11fa3c699b3ade5396e4d59ceb3845de80980a35; deployment/Maven/npm e pilotos explicitamente pendentes. Docs explicam read/write, bundle, bootstrap, Properties, toolchains, depreciação Node e limitação de merge técnico imediato; README scripts estendido e workflows resumido com run real. PR13 comparado com merge-tree sem aplicar merge:5 conflitos de código e roteiro de conciliação registrado, sem alterar sua branch. generate-report usado em delivery.md. T12 é documental (matrix:none); contratos/assertions64/semântico preservados. Revisão independente e push NÃO alegados como feitos; CI hospedada da nova revisão ainda pendente.

## T13

G1 corrigido sem alteração de código de produção nem afrouxar guards. Full PASS: real-standard-bootstrap.mjs6 casos, bundle/reconciled-report/workflow64/native-workflows, actionlint e spec/diff. REC03/04: fixture:18 npm prefix==scratch realpath, :23 binário confinado e versão9.5.0; :46 assert.throws diagnósticos firstRelease/candidata inválida; :53 envelope0.0.1/base0.0.0/tag/bump/SHA exatos; :59 same-version sem alteração real bloqueado; :62 paths3 exatos; :68 replay bytes exatos; :69-72 versões package/lock/changelog; :76-77 HEAD/tags intactos emtodoscasos. Reverso: prefix/confinamento -> REC04+incidente de harness; duas gerações -> REC03+edgebootstrap; quatro rejeições ->mesma precisão do perfil; sem novos recursos/calculador. Docs e CI incorporam recorte0.0.0->0.0.1, firstRelease incompatível e same-version não suportado. Revisão rodada1 preservada; aguarda revalidação independente, push/CI nova não executados.

## T14

RED hospedado CI38836186739: adapter-report:35 status1 em Linux por mvnw EACCES, antes dos gates nativos. Fonte do fixture escrevia mvnw sem chmod, ao contrário do fake standard-version e demais fixtures. Correção restrita ao setup: chmod755 e assertion POSIX adapter-report.mjs:26 `assert.equal(statSync(maven).mode &0o111,0o111)`. Assertions anteriores versão/tag/SHA permanecem exatas; o coletor volta a passar localmente (Windows), registry/entrypoint/syntax/diff PASS. REC02/06: preparar executável real do contrato sem afrouxar o executor ou chamar Bash como desvio no runtime. Não foi alegado teste POSIX no Windows; CI Linux e revisão independente do delta são gates seguintes. Conta AI agora tem workflow e o primeiro push73c0198 foi confirmado no GitHub.
