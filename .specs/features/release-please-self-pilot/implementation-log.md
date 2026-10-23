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
| Referência caller | `ci-scripts/tests/release-please.test.ts`, `assert.ok(fs.existsSync(...))` | Arquivo central existe |
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

## T3: Roteiro e limites

- Documentação atualizada no guia existente: outputs efetivos da Action, dois momentos, caller hospedado, dependências de teste, reprodução, central-ref e evolução de governança.
- Distinção explícita: o runner executará o SDK real e o contrato TS, não a Action de publicação. Nenhum resultado de PR/tag/Release persistidos é presumido.
- As sete asserções/casos superiores permanecem; sem arquivos novos de teste. RPSP-05 e RPSP-06 não são declarados entregues.
- A próxima evidência exigida é o Verifier independente, seguido do run hospedado no SHA publicado.

## Gate independente antes do push

- Verifier: PASS no range e05a76a..a04385d, para T1-T3 e prontidão do teste hospedado; relatório em validation.md.
- Execução independente: 7/7 testes, zero skips; typecheck, validadores TLC e diff aprovados.
- Sensor: 3/3 mutações detectadas, com baseline da cópia restaurada aprovada e checkout real preservado.
- Auditoria adicional: npm audit --prefix ci-scripts --omit=dev --audit-level=high retornou 0 vulnerabilidades.
- Autorização conferida: conta agentegersonfribeiro-AI com WRITE; somente push da branch de teste e seu run. Antes do push, master continua e05a76a, e a API não retornou tags nem Releases.

## Execução hospedada: PASS

- [Release Please Functional Pilot: run 40033980369](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40033980369).
- SHA executado: b6493740679134fc540c27344e4d8ec28cc23004; evento push, branch codex/release-please-self-pilot.
- Job: Caller to real release engine (no publication) / Validate repository; conclusão success. Setup Node confirmou v22.23.3; permissões confirmaram Contents: read.
- Run TypeScript tests: 7 testes, 7 aprovados, 0 falhas, 0 skips. Diagnóstico do SDK: versão 0.0.1, tag proposta v0.0.1, SHA simulado b repetido 40 vezes, nenhuma publicação executada.
- Check TypeScript types: tsc --noEmit aprovado.
- Limites preservados: master e05a76a; nenhuma tag ou Release retornada pela API após o run; nenhum PR criado, nenhum pacote publicado, nenhuma aplicação externa alterada.
- O primeiro push usou também o transporte SSH configurado no origin, e o actor desse run foi gersonfribeiro. A credencial ativa da CLI continua agentegersonfribeiro-AI; o push deste registro usa URL HTTPS direta e o helper da CLI, sem alterar configuração global.
- O resultado hospedado confirma T1-T3 no runner real. Não confirma RPSP-05 nem os critérios de produção marcados PENDENTES no relatório independente.

## T4: Preparação do caller real

- Autorização: preparar e abrir o PR de entrega no próprio aplicacoesBoilerplate/.github; usuário confirmou milestone v0.0.1 separada, mantendo v1.0.0 para as outras pipelines. Os merges ficam com o usuário; a Action publicará tag/GitHub Release após o segundo merge.
- RED: mesmo teste funcional falhou com ENOENT para version-release-please-self-caller.yml antes da implementação.
- GREEN: caller real recebe apenas PR closed para master, ambos os jobs exigem merged=true, release depende de validate e usa called local/simple/central-ref github.sha. validate tem leitura; release tem somente contents/pull-requests/issues:write e não herda secrets de pacotes.
- version.txt inicia em 0.0.0 como base não publicada. O contrato permite que esse arquivo evolua no PR técnico; a fixture do teste continua isolada e previsível.
- O fluxo funcional usa agora os inputs do caller de produção. As sete asserções/casos superiores permanecem, com 7/7 aprovados, zero skips e typecheck aprovado.
- A revisão anterior permanece em validation-sdk.md com seu range imutável. Novo gate independente é exigido antes do push/PR desta extensão. Nenhuma publicação real foi presumida.

### Gate independente de T4: PASS

- Range fbc7c31..133f896, relatório canônico validation.md: 9/9 critérios com evidência; suíte 7/7, zero skips, typecheck e validadores aprovados.
- Duas mutações de wiring detectadas (dependência da CI removida e central-ref mutável). Controle positivo com version.txt 0.0.1 e baseline restaurada aprovados.
- Milestone v0.0.1 criada em https://github.com/aplicacoesBoilerplate/.github/milestone/2. A v1.0.0 e a issue #4 permanecem inalteradas. A API confirmou gersonfribeiro como administrador para a revisão humana; a conta ativa do agente é agentegersonfribeiro-AI.
- Autorizado publicar a mesma branch e abrir PR de entrega, com solicitação de revisão ao mantenedor. Sem merge, tag ou Release pelo agente.
