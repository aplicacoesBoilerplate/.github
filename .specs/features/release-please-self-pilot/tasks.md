# Piloto funcional do Release Please Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Follow tlc-spec-driven for gates, atomic commits and the independent final Verifier.

**Goal:** Exercitar um caller simulado, o orquestrador e o motor real no mesmo fluxo funcional TypeScript, localmente e no runner do GitHub Actions, sem publicar PR/tag/Release.
**Architecture:** Reaproveitar o teste de fluxo existente, executar o entrypoint definido no called num checkout temporário e passar suas saídas à estratégia real Simple. Um caller de teste na branch de trabalho reutiliza a CI no mesmo commit, sem invocar a Action com escrita.
**Tech Stack:** TypeScript, node:test, tsx, YAML e release-please 17.3.0 somente nos testes do motor.
**Spec:** `.specs/features/release-please-self-pilot/spec.md` e `design.md`.
**Status:** Approved: execução local, push da branch de teste e execução no GitHub Actions autorizados pelo usuário.

## Global Constraints

- Push somente da branch de teste; nenhum PR de release, merge, secret, tag ou Release no GitHub.
- Um único teste funcional ampliado no arquivo existente; preservar as sete asserções/casos existentes, sem skip.
- Entradas dos callers e evento de merge simulados; cálculo, updaters e dados da Release produzidos pelo motor real.
- Milestone obrigatória no PR funcional; não revalidada no segundo momento do PR técnico.
- Nenhum registry no modo simple. Governança avançada e milestone 100% ficam para depois.
- Implementação neste chat e uma revisão independente ao final. Um commit local por tarefa.

## Review Focus

- O caminho executado precisa vir do YAML real, não de um atalho correto presente só no teste.
- O valor da milestone precisa alcançar o motor através dos inputs da Action, não apenas de um JSON local.
- O segundo momento não pode carregar release-as residual da primeira execução.
- A estratégia simple não pode acionar npm, Maven ou GoReleaser.
- Qualquer acesso à rede pelo cliente do motor local deve falhar; não confundir geração de dados com publicação real.

## Test Coverage Matrix

Guidelines: `AGENTS.md`; fontes e convenções observadas em `ci-scripts/tests/release-please.test.ts`, `conventional-commit.test.ts`, `package.json` e `.github/workflows/ci.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Caller, checkout, orquestrador e motor | Integração funcional local | Dois momentos completos e negativos essenciais no mesmo teste; resultados reais de versão, notas e SHA | `ci-scripts/tests/release-please.test.ts` | `npm test --prefix ci-scripts` |
| Contrato de CI e caller de teste | Contrato no mesmo fluxo funcional | Referência local no mesmo commit, gatilho restrito e permissões de leitura; testes e typecheck sem job de publicação | Mesmo arquivo | `npm test --prefix ci-scripts` |
| Documentação | Revisão e gate documental | Explicitar o que o teste executa e o que continua pendente no GitHub | `docs/pipelines/versionamento-release-please.md` | Verificação TLC e diff |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | RED/GREEN funcional | `npm run test:functional --prefix ci-scripts` |
| Full | Cada tarefa | `npm test --prefix ci-scripts` |
| Build | Tarefa/entrega concluída | `npm test --prefix ci-scripts`; `npm run typecheck --prefix ci-scripts`; `git diff --check` |

## Execution Plan

### Phase 1: MVP local

```text
T1 -> T2 -> T3
```

## Task Breakdown

### Task 1: Fluxo funcional do caller ao motor real

#### T1: Executar o contrato central de release

**Where**: `ci-scripts/tests/release-please.test.ts`
**Files**: teste existente, package/lockfile de ci-scripts, orquestrador, called e exemplo de caller.
**Depends on**: None
**Requirement**: RPSP-01, RPSP-02, RPSP-03, RPSP-04
**Interfaces**: subprocesso recebe PROJECT_TYPE/MILESTONE_TITLE/PR_HEAD_REF/GITHUB_OUTPUT; produz JSON e outputs release_type/release_as para os inputs oficiais da Action.
**Tools**: ferramentas locais, TLC, CI/CD, TDD e Entregas; documentação oficial quando Context7 não estiver disponível.

- [x] Escrever a extensão do teste existente: caller simple adaptado do exemplo, checkout temporário, execução do comando real do YAML, arquivos e dados de release do SDK real.
- [x] Observar RED: o caller aponta para um workflow inexistente, depois o entrypoint/binding/simple ainda precisam da implementação.
- [x] Acrescentar simple à factory e emitir outputs; corrigir caller, checkout/entrypoint e ligação release-type/release-as à Action.
- [x] Rodar os sete testes e a checagem de tipos; sem testes removidos, sem acesso à rede pelo cliente GitHub.
- [x] Atualizar rastreabilidade e registrar commit local `feat(versioning): exercise caller flow with real release engine`.

**Tests**: integração funcional no arquivo existente; exatamente 7 casos superiores preservados, com novas asserções no caso de fluxo.
**Gate**: Build.

### Task 2: Executar o teste por um caller hospedado

#### T2: Conectar o caller de teste à CI reutilizável

**Where**: `.github/workflows/version-release-please-test-caller.yml`
**Files**: novo caller de teste, CI e asserções adicionais no mesmo teste funcional.
**Depends on**: T1
**Requirement**: RPSP-01, RPSP-02, RPSP-04
**Interfaces**: push restrito à branch codex/release-please-self-pilot; caller usa CI via referência local no mesmo commit, contents:read e nenhum secrets:inherit. version.txt é gerado apenas na fixture temporária.
**Tools**: ferramentas locais, TLC, CI/CD, TDD e Entregas.

- [ ] Acrescentar ao mesmo fluxo o carregamento do caller de teste real e da CI; observar RED pela ausência desses contratos.
- [ ] Criar caller de teste para push na branch de trabalho, sem job de publicação; referência local da CI garante a mesma revisão.
- [ ] Permitir workflow_call na CI e executar typecheck junto dos testes.
- [ ] Rodar Build e confirmar 7 casos superiores preservados; execução hospedada somente após a revisão independente.
- [ ] Atualizar rastreabilidade e registrar commit local `ci(versioning): run functional pilot through reusable checks`.

**Tests**: contrato integrado no mesmo fluxo de T1.
**Gate**: Build.

### Task 3: Registrar limites e evidência verificável

#### T3: Documentar reprodução do piloto

**Where**: `docs/pipelines/versionamento-release-please.md`
**Files**: documentação atual e registros TLC desta feature.
**Depends on**: T2
**Requirement**: RPSP-04, roteiro de RPSP-05
**Interfaces**: instruções npm ci/test/typecheck, push na branch de teste e limites entre geração de propostas, execução hospedada e publicação.
**Tools**: ferramentas locais e TLC; revisor independente ao final.

- [ ] Documentar as duas etapas, o teste único, dependências somente de teste e modo simple sem registry.
- [ ] Registrar GitHub E2E como pendente e governança avançada como futura.
- [ ] Rodar Build e validação estrutural TLC; atualizar progresso antes do commit local `docs(versioning): document hosted pilot and publication boundary`.

**Tests**: revisão documental com suíte existente como gate de não regressão; nenhum teste artificial de prosa.
**Gate**: Build.

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma entrada | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Contrato executável e orquestrador | Integração | Mesmo teste funcional com motor real | Match |
| T2 | Caller e CI | Contrato integrado | Mesmo teste funcional | Match |
| T3 | Documentação | Revisão documental | Revisão e suíte de não regressão | Match |

## Completion Boundary

O Verifier independente revisará a entrega e executará mutações em cópias temporárias antes do push. Depois, a branch será publicada e o teste deverá passar no Actions, com SHA e execução registrados. Isso não autoriza marcar RPSP-05 como comprovado nem encerrar a issue: o teste hospedado não cria PR/tag/Release.
