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
