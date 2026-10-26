# Validation: FAIL — piloto remoto

**Verdict: FAIL**

**Date:** 2026-10-26. **Spec:** `.specs/features/agentic-remote-pilot/spec.md`. **Diff range:** `b54f391..8e49227`. **Verifier:** agente independente `/root/remote_pilot_verifier`, autor diferente do verificador.

O código inspecionado preserva as fronteiras previstas, mas a suíte permite regressões relevantes na comparação do workspace e na proveniência. Não há defeito funcional demonstrado no caminho atual; há três mutantes sobreviventes que impedem aprovar a proteção contra regressões.

## Critérios ancorados na especificação

| AC | Resultado exigido | Evidência e asserção | Veredito |
| --- | --- | --- | --- |
| ARP-01 | Modelo/credencial/prompts do consumidor preservados | `ci-scripts/tests/agentic-remote-workflows.test.ts:81` — `assert.equal(REVIEW.jobs.pilot.with.model, 'provider/another-model')`; linha82 confere `secrets.REVIEW_KEY`; linhas56–57 conferem presença do contexto. `CGhAwPilot.ts:49` lê prompt e linha79 incorpora o texto integral. | PASS local |
| ARP-02 | Entrada manual, called reutilizável e nenhum write/detector Copilot | `ci-scripts/tests/agentic-remote-workflows.test.ts:13` confere `['workflow_call']`; linhas16–19 recusam jobs de publicação/detecção e permissões fora de read/none; linhas42–46 conferem caller workflow_dispatch e secrets explícitos. Locks inspecionados: activation/agent/conclusion/pre_activation; sem write. | PASS |
| ARP-03 | AWF, placeholder, negação de shell/escrita/acesso externo | `ci-scripts/tests/agentic-remote-engine.test.ts:35` confere endpoint AWF; linha36 `apiKey === 'awf-proxy'`; linhas37–44 conferem ausência das chaves e política efetiva; linhas50–52 recusam ausência de AWF. `agentic-remote-workflows.test.ts:22` e linhas26–28 conferem o comando/configuração compilados. | PASS do contrato simulado; runtime remoto pendente |
| ARP-04 | SHA e hashes correspondem aos inputs | `ci-scripts/tests/agentic-remote-guard.test.ts:41` confere SHA; linha46 só confere formato de configHash e não o valor; nenhuma asserção confere `END.files`. Mutantes configHash constante e files vazio sobrevivem. | GAP de payload |
| ARP-05 | Alteração versionada bloqueia evidência aprovada | `ci-scripts/tests/agentic-remote-guard.test.ts:69` exige falha após alterar AGENTS.md, mas esse arquivo já pertence ao manifesto. Remover `remote-pilot.ts:49` não falha a suíte: a comparação dos demais arquivos versionados não é exercitada. | GAP de discriminação |
| ARP-06 | CI reproduz; instruções e estado remoto pendente explícitos | `.github/workflows/ci.yml:48` executa `npm run compile:agentic -- --check` sem secret LLM; `ci-scripts/scripts/agentic/compile-pilot.ts:26` valida checksum antes de executar; linha34 recusa drift dos locks; `examples/agentic/self-pilot/README.md:47` em diante contém cadastro, integração, dispatch e avaliação. Revisão documental manual, sem testes de prosa. | PASS de preparação |

## Gates

- `npm test`: 86 passaram, zero falhas/skips, execução independente do verificador. Base anterior:78; adição:8 contratos remotos.
- `npm run typecheck`: exit0.
- Compilação strict/validate e reprodução dos dois locks pelo principal: exit0, zero avisos. Verificador inspecionou os locks e o helper; não executou LLM nem usou credencial real.
- Publicação, cadastro da secret e primeiro run remoto não realizados. Este relatório não homologa AWF/OpenRouter em Linux.

## Sensor de discriminação

Cópias isoladas produzidas por git archive do commit8e49227, dependências montadas por junction somente para execução dos testes; junction removida antes de descartar snapshot. Fontes reais nunca alteradas. Porcelain real idêntico antes/depois de cada rodada. Não foi usado stash.

| Mutação | Local | Resultado |
| --- | --- | --- |
| Remover exigência AWF | `.github/workflows/shared/agentic-opencode.md:102` | Morta: exit esperado1 virou0 |
| Passar chave real no lugar do placeholder | `.github/workflows/shared/agentic-opencode.md:144` | Morta: sentinela diferente de awf-proxy |
| Trocar deny padrão por allow | `.github/workflows/shared/agentic-opencode.md:152` | Morta: shell permitido |
| Remover exclusão de chaves do filho | `.github/workflows/shared/agentic-opencode.md:211` | Morta: sentinela presente |
| Ignorar modelo do caller | `ci-scripts/scripts/agentic/CGhAwPilot.ts:87` | Morta: ignored/model diferente do escolhido |
| Remover comparação PREVIOUS/RECORD | `ci-scripts/scripts/agentic/remote-pilot.ts:49` | Sobreviveu:3/3 guard tests passam |
| Substituir configHash por64 zeros | `ci-scripts/scripts/agentic/remote-pilot.ts:42` | Sobreviveu:3/3 guard tests passam |
| Substituir files por objeto vazio | `ci-scripts/scripts/agentic/remote-pilot.ts:42` | Sobreviveu:3/3 guard tests passam |

**Resultado:**8 mutações,5 mortas,3 sobreviventes. A cobertura de autenticação/isolamento detecta as falhas introduzidas. Os testes de integridade/proveniência precisam dos ajustes abaixo.

## Correções necessárias

1. **Major — ARP-05:** acrescentar arquivo versionado fora do manifesto à fixture antes do commit; alterá-lo após pre, ocultá-lo do status com assume-unchanged, exigir post falhar e evidência continuar pending. Deve matar a remoção da comparação de estado. Nenhuma alteração do comportamento correto é necessária.
2. **Major — ARP-04:** no caso de proveniência existente, comparar `configHash` com SHA256 real do config e `files` com hashes reais dos arquivos selecionados. Formato hexadecimal sozinho não prova correspondência. Deve matar ambos os mutantes de payload.

Tarefas T1–T3 implementadas; T4 necessita revalidação após esses reforços. Não ampliar o número de casos por meta: as duas correções podem aproveitar os três testes já existentes. Reexecutar gates e sensor das mutações sobreviventes. Limite de revisão: primeira rodada de até3.

## Limites e pendências externas

- Secret `API_KEY_OPENROUTER` ainda depende do cadastro pelo usuário.
- Workflows manuais precisam estar integrados na branch padrão antes do dispatch.
- Sem escrita pelo agente; detector desativado somente neste ensaio sem publicação. Fluxos futuros com escrita exigem outro contrato.
- SonarQube continua not-run.

## Lessons

Sinal fundamentado para o principal registrar pela ferramenta TLC: uma fixture que adultera apenas arquivos já cobertos pelo manifesto não exercita a proteção all-tracked; proveniência exige assertivas sobre o valor dos hashes, não só formato. O verificador preservou o escopo de escrita autorizado ao relatório.
