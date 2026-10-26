# Validation: PASS — piloto remoto

**Verdict: PASS**

**Date:** 2026-10-26. **Spec:** `.specs/features/agentic-remote-pilot/spec.md`. **Diff range:** `b54f391..ee91c5caad9a37fd0d3dda8a584ad5f04eae4626`. **Revision:**2. **Verifier:** agente independente `/root/remote_pilot_verifier`, autor diferente do verificador.

Preparação local aprovada para revisão e posterior primeiro run remoto. A rodada1 encontrou três mutantes sobreviventes nos testes; ee91c5c reforçou os mesmos casos sem alterar o comportamento da implementação, remover ou enfraquecer asserções. A rodada2 matou todos os mutantes antes sobreviventes. A execução real AWF/OpenRouter/Linux continua pendente.

## Critérios ancorados na especificação

| AC | Resultado exigido | Evidência e asserção | Veredito |
| --- | --- | --- | --- |
| ARP-01 | Modelo/credencial/prompts do consumidor preservados | `ci-scripts/tests/agentic-remote-workflows.test.ts:81` — `assert.equal(REVIEW.jobs.pilot.with.model, 'provider/another-model')`; linha82 confere `secrets.REVIEW_KEY`; linhas56–57 conferem presença do contexto. `CGhAwPilot.ts:49` lê prompt e linha79 incorpora o texto integral. | PASS local |
| ARP-02 | Entrada manual, called reutilizável e nenhum write/detector Copilot | `ci-scripts/tests/agentic-remote-workflows.test.ts:13` confere `['workflow_call']`; linhas16–19 recusam jobs de publicação/detecção e permissões fora de read/none; linhas42–46 conferem caller workflow_dispatch e secrets explícitos. Locks inspecionados: activation/agent/conclusion/pre_activation; sem write. | PASS |
| ARP-03 | AWF, placeholder, negação de shell/escrita/acesso externo | `ci-scripts/tests/agentic-remote-engine.test.ts:35` confere endpoint AWF; linha36 `apiKey === 'awf-proxy'`; linhas37–44 conferem ausência das chaves e política efetiva; linhas50–52 recusam ausência de AWF. `agentic-remote-workflows.test.ts:22` e linhas26–28 conferem o comando/configuração compilados. | PASS do contrato simulado; runtime remoto pendente |
| ARP-04 | SHA e hashes correspondem aos inputs | `ci-scripts/tests/agentic-remote-guard.test.ts:44` confere SHA; linha50 `assert.equal(END.configHash, F.hashes[PILOT_CONFIG])`; linha51 `assert.deepEqual(END.files, F.hashes)`. Os hashes esperados são calculados diretamente por crypto na fixture (linha25). | PASS |
| ARP-05 | Alteração versionada bloqueia evidência aprovada | `ci-scripts/tests/agentic-remote-guard.test.ts:69` percorre AGENTS.md e outside-context.txt; linha75 exige falha após adulteração com assume-unchanged; linha77 exige evidência não aprovada. O segundo arquivo é versionado fora do manifesto, exercitando a comparação geral. | PASS |
| ARP-06 | CI reproduz; instruções e estado remoto pendente explícitos | `.github/workflows/ci.yml:48` executa `npm run compile:agentic -- --check` sem secret LLM; `ci-scripts/scripts/agentic/compile-pilot.ts:26` valida checksum antes de executar; linha34 recusa drift dos locks; `examples/agentic/self-pilot/README.md:47` em diante contém cadastro, integração, dispatch e avaliação. Revisão documental manual, sem testes de prosa. | PASS de preparação |

## Gates

- `npm test`: 86 passaram, zero falhas/skips, execução independente do verificador. Base anterior:78; adição:8 contratos remotos.
- `npm run typecheck`: exit0.
- Compilação strict/validate e reprodução dos dois locks pelo principal: exit0, zero avisos. Verificador inspecionou os locks e o helper; não executou LLM nem usou credencial real.
- Publicação, cadastro da secret e primeiro run remoto não realizados. Este relatório não homologa AWF/OpenRouter em Linux.

## Sensor de discriminação

Cópias isoladas produzidas por git archive dos commits8e49227 (rodada1) e ee91c5c (rodada2), dependências montadas por junction somente para execução dos testes; junction removida antes de descartar snapshot. Fontes reais nunca alteradas. Porcelain real idêntico antes/depois de cada rodada. Não foi usado stash.

| Mutação | Local | Resultado |
| --- | --- | --- |
| Remover exigência AWF | `.github/workflows/shared/agentic-opencode.md:102` | Morta: exit esperado1 virou0 |
| Passar chave real no lugar do placeholder | `.github/workflows/shared/agentic-opencode.md:144` | Morta: sentinela diferente de awf-proxy |
| Trocar deny padrão por allow | `.github/workflows/shared/agentic-opencode.md:152` | Morta: shell permitido |
| Remover exclusão de chaves do filho | `.github/workflows/shared/agentic-opencode.md:211` | Morta: sentinela presente |
| Ignorar modelo do caller | `ci-scripts/scripts/agentic/CGhAwPilot.ts:87` | Morta: ignored/model diferente do escolhido |
| Remover comparação PREVIOUS/RECORD | `ci-scripts/scripts/agentic/remote-pilot.ts:49` | Sobreviveu na rodada1; morta na rodada2 |
| Substituir configHash por64 zeros | `ci-scripts/scripts/agentic/remote-pilot.ts:42` | Sobreviveu na rodada1; morta na rodada2 |
| Substituir files por objeto vazio | `ci-scripts/scripts/agentic/remote-pilot.ts:42` | Sobreviveu na rodada1; morta na rodada2 |

**Resultado final:**8/8 mutações discriminadas:5 mortas na primeira rodada, mantidas sobre implementação intacta;3 sobreviventes reproduzidas e mortas na segunda rodada. Baseline da rodada2:8/8 contratos aprovados. Nenhum mutante sobrevivente restante. As correções abaixo foram concluídas.

## Correções concluídas em ee91c5c

1. **Major — ARP-05:** acrescentar arquivo versionado fora do manifesto à fixture antes do commit; alterá-lo após pre, ocultá-lo do status com assume-unchanged, exigir post falhar e evidência continuar pending. Deve matar a remoção da comparação de estado. Nenhuma alteração do comportamento correto é necessária.
2. **Major — ARP-04:** no caso de proveniência existente, comparar `configHash` com SHA256 real do config e `files` com hashes reais dos arquivos selecionados. Formato hexadecimal sozinho não prova correspondência. Deve matar ambos os mutantes de payload.

Tarefas T1–T4 implementadas e revisadas para o recorte de preparação. Os três testes existentes foram preservados; as duas lacunas foram resolvidas dentro deles. Revisão2 de até3 aprovada. Autorização para publicação/merge e primeiro run remoto continuam fora da prova local.

## Limites e pendências externas

- Secret `API_KEY_OPENROUTER` ainda depende do cadastro pelo usuário.
- Workflows manuais precisam estar integrados na branch padrão antes do dispatch.
- Sem escrita pelo agente; detector desativado somente neste ensaio sem publicação. Fluxos futuros com escrita exigem outro contrato.
- SonarQube continua not-run.

## Lessons

Sinal fundamentado para o principal registrar pela ferramenta TLC: uma fixture que adultera apenas arquivos já cobertos pelo manifesto não exercita a proteção all-tracked; proveniência exige assertivas sobre o valor dos hashes, não só formato. O verificador registra ambas via lessons.py, sem editar manualmente o estado canônico.
