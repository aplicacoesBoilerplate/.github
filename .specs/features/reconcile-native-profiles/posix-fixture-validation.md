# Validação independente do fixture POSIX

## Validation: PASS

PASS de adequação técnica do patch T14. A confirmação POSIX continua pendente da CI Linux no SHA enviado após esta revisão. Este parecer não certifica CI hospedada verde nem conclusão operacional de REC-06.

- Data: 2026-10-15, America/Sao_Paulo.
- Verifier: subagente independente, autor diferente do implementador.
- HEAD conferido: `cf2a7f922c607b8eef040495ec348a9167d589ef`.
- Delta: `73c0198a4ff38f671417fcb6429ce5e1106e129d..cf2a7f922c607b8eef040495ec348a9167d589ef`.
- Escopo: `tests/versioning/adapter-report.mjs`, mais registros de planejamento/progresso. Nenhum módulo produtivo mudou.
- `validation.md` anterior preservado integralmente. Nenhuma implementação, commit, push ou instalação foi feita nesta revisão.

## Causa e integridade

O Verifier consultou diretamente `gh run view 38836186739 --repo aplicacoesBoilerplate/.github --log-failed`. A execução Linux falhou no passo `node tests/versioning/run.mjs --local`, em `adapter-report.mjs:35`, com `spawnSync /tmp/adapter-report-26Srdp/mvnw EACCES`. O log confirma que `adapter-registry.mjs` passou antes da falha. Fonte: [CI38836186739](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38836186739).

O fixture base escrevia `mvnw` com shebang Bash, mas sem chmod. `scripts/versioning/process-runner.mjs:17` mantém o comando original; as adaptações de launcher em :18 e :28 são exclusivas do Windows; :33 executa `spawnSync(binary, argv, ...)`. Portanto a ausência do bit executável no script temporário explica a diferença entre Windows e Linux. A correção prepara o arquivo antes de seu consumo e segue o padrão do executável standard-version em `tests/versioning/adapter-report.mjs:20`.

| Critério | Evidência e resultado |
| --- | --- |
| T14, preparar executável Maven | `tests/versioning/adapter-report.mjs:25`, `chmodSync(maven, 0o755)`, antes do commit e execução. PASS de adequação. |
| T14, conferir bits POSIX | `tests/versioning/adapter-report.mjs:26`, `assert.equal(statSync(maven).mode & 0o111, 0o111)`. Exige os três bits executáveis em plataforma POSIX; ramo não executado no Windows. Confirmação hospedada pendente. |
| REC-02, manter resultado nativo exato | `tests/versioning/adapter-report.mjs:38`, status zero; :40 candidata igual a `expected` (Maven `1.0.1`); :41 tag igual ao prefixo mais candidata; :42 SHA igual ao HEAD do fixture. PASS local. |
| Integridade dos testes | Diff integral do fixture contém somente import de `statSync`, chmod e assertion POSIX. Todas as assertions anteriores permanecem idênticas; nenhum cenário removido ou desabilitado. PASS. |
| REC-06.3, separar evidências | Três fixtures locais passaram no Windows. CI anterior é RED comprovado; nova CI Linux ainda não foi observada. PASS documental, entrega condicionada. |

O patch é mínimo, não cria abstrações e não altera guards ou execução produtiva. Segue AGENTS.md, T14 em `tasks.md:195` e os princípios TLC de alterações cirúrgicas e integridade dos testes. Não há gap técnico identificado que exija correção adicional neste delta.

## Gates executados pelo Verifier

Ambiente: Windows, Node `v24.19.0`; `C:/Program Files/Git/bin` primeiro no PATH em cada fixture.

| Comando | Resultado |
| --- | --- |
| `node tests/versioning/adapter-report.mjs` | exit0, standard-version e jgitver normalizados; ambas as iterações e assertions exatas executadas. |
| `node tests/versioning/adapter-registry.mjs` | exit0, contrato do registro aprovado. |
| `node tests/versioning/collect-version-report.mjs` | exit0, fronteiras do entrypoint aprovadas. |
| `node --check tests/versioning/adapter-report.mjs` | exit0. |
| `git diff --check 73c0198a4ff38f671417fcb6429ce5e1106e129d..HEAD` | exit0. |

Nenhum gate executado falhou. Os avisos LF/CRLF emitidos pelo Git no repositório temporário do fixture não alteraram o resultado. Não houve execução dos gates nativos completos nesta revisão restrita; permanecem evidências históricas, não reexecuções alegadas.

## Sensor e limite de plataforma

`git diff --name-only b7d2c6b31bedd884a4b4cbbbc1a13eb48cdce90b..HEAD -- scripts/versioning tests/versioning` retornou somente `tests/versioning/adapter-report.mjs`. Os módulos produtivos e os testes usados para matar M1–M7 permanecem imutáveis. Assim, o sensor anterior de 7/7 mortos continua aplicável àqueles comportamentos, com proveniência em `validation.md:65` e `validation.md:130`. Nenhum desses mutantes foi alegado como reexecutado nesta rodada.

O novo comportamento limita-se à preparação de executabilidade do fixture. Não foi criado mutante POSIX no Windows nem substituto estático para comprovar permissões reais. O sensor histórico não prova esta propriedade nova; o ramo de assertion POSIX e a execução direta bem-sucedida precisam ocorrer na CI Linux. Esta é uma limitação explícita do parecer local, não um PASS POSIX.

Antes da revisão e depois dos gates, `git status --porcelain` estava vazio. O único arquivo criado pelo Verifier é este relatório; nenhum scratch adicional foi criado.

## Gate obrigatório após push

Após envio fast-forward da mesma branch do PR12, conferir que a execução hospedada corresponde ao SHA enviado e que `adapter-report.mjs` passa em Linux, incluindo a assertion POSIX e a execução real de `mvnw`. Acompanhar também todos os demais gates/checks hospedados até conclusão. Qualquer falha exige diagnóstico antes de declarar prontidão da CI. O autor mantém a responsabilidade pelo acompanhamento pós-push; este parecer aprova a adequação do patch para essa próxima etapa, sem certificar seu resultado futuro.
