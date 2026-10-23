# Registro de execução

## T1: Caller, orquestrador e motor real

- Hipótese: o caller de exemplo fornece os inputs; o YAML do called fornece entrypoint e referências de outputs. Não é uma emulação integral do runner.
- Fontes: teste existente, manifest/lockfile ci-scripts, orquestrador, called e exemplo de caller.
- RED observado: `Caller referencia workflow inexistente: workflows/version-release-please-called.yml`.
- Correções: referência completa do called; layout real do checkout; runtime tsx travado no lockfile; simple; outputs oficiais; binding da Action.
- Motor: `release-please@17.3.0`, somente desenvolvimento. A instalação de produção omite o SDK e YAML.
- Critério de sucesso: sete casos superiores mantidos, fluxo funcional com arquivos e dados reais, sem rede pelo cliente GitHub, typecheck e diff limpos.

### Adequação: critérios para asserções

| Critério | Evidência no teste | Resultado exigido |
| --- | --- | --- |
| Referência caller | `ci-scripts/tests/release-please.test.ts:65` `assert.ok(fs.existsSync(...))` | Arquivo central existe |
| Dois momentos originais | Mesmo arquivo, `assert.equal(FEATURE_CONFIG...release-as, '1.4.0')` e `assert.equal(releasePrConfig...release-as, undefined)` | Asserções originais preservadas |
| Parâmetros efetivos | Mesmo arquivo, `assert.deepEqual(preparation.engineInputs, ...)` | simple e 0.0.1 |
| Arquivos reais | Mesmo arquivo, `assert.equal(...version.txt..., '0.0.1')` e `assert.match(...CHANGELOG...)` | Updaters reais aplicados |
| Segundo momento | Mesmo arquivo, `assert.deepEqual(publication.engineInputs, ...)` | release-as vazio |
| Release proposta | Mesmo arquivo, `assert.equal(releases[0].tag.toString(), 'v0.0.1')` e `assert.equal(releases[0].sha, 'b'.repeat(40))` | Tag e SHA da entrega preparada |
| Falhas essenciais | Mesmo arquivo, `assert.equal(invalid.result.status, 1)` e `assert.deepEqual(invalid.outputs, {})` | Falha sem parâmetros de publicação |

### Adequação: necessidade

Todas as asserções novas pertencem a RPSP-01 a RPSP-04. As asserções de caminho, inputs, arquivos e Release comprovam o mesmo encadeamento; não há novos arquivos de teste ou cenários especulativos. O SDK real calcula os resultados; somente dados de entrada são simulados.

## Limites de execução

- Autorização atual: publicar a branch de teste e executar o teste no GitHub Actions.
- Não autorizado: merge em master, publicação de tags ou Releases, alterações de secrets/proteções.
- A prova de PR/tag/Release persistidos no GitHub continua pendente de uma etapa posterior.

## T2: Caller hospedado e CI reutilizável

- RED observado: ENOENT ao ler version-release-please-test-caller.yml, antes de criar o workflow.
- Caller de teste: push restrito a codex/release-please-self-pilot, contents:read, um único job usando ./.github/workflows/ci.yml no mesmo commit, sem secrets herdados.
- CI existente: workflow_call aditivo e typecheck depois dos testes. Os gatilhos anteriores continuam preservados.
- O mesmo fluxo funcional verifica o caller e a CI reais, sem novo arquivo de teste. A fixture version.txt continua temporária.
- Gate local: 7 testes aprovados, 0 falhas/skip; typecheck e git diff --check aprovados. Execução hospedada ainda pendente do push após o Verifier.
