# Registro da etapa 1

## Baselines preservadas

- Central: origin/master 564f1bba751ed605931beffa5e9fed00e42fec4c, novo worktree nativo release-please-pilots-stage1, branch codex/release-please-pilots-stage1. Piloto interno v0.0.1 já publicado; issue #4 permanece fechada.
- Java: novo worktree PackagesJava.worktrees/release-please-stage1, base origin/release/v0.0.1 2992a00995071d4e836e907e5148222fea1e3fdc. Clone original sujo preservado.
- Vue: novo worktree PackagesVue.worktrees/release-please-stage1, base origin/release/v0.0.1 a846332f1f922f09333bfca81de45b3b47bf2f5b. Grafo atual tem cinco bibliotecas, docs e dois tools privados; não usar o inventário antigo da master. Clone original sujo preservado.
- Go: novo worktree boilerplate-cli.worktrees/release-please-stage1, base origin/release/v0.0.1 939987851b49436476a82a859694688772fda7bb. Não tocar issue-8/13/14 nem promover os commits funcionais para master.
- Gates de base: central 7/7 e typecheck; Java mvn verify com os quatro módulos SUCCESS; Go test/vet/build aprovados. Vue parou antes dos testes por npm devEngines; npm10.9.4 validado fora do repo e nova execução com --prefix em andamento. Nenhuma regra de versão foi removida para contornar a falha.

## T1: Opt-out de distribuição

- Hipótese: o called existente tem três publishers pós-tag sem controle de distribuição; a etapa 1 exige false mesmo quando release_created for true.
- Arquivos de implementação: .github/workflows/version-release-please-called.yml e ci-scripts/tests/release-please.test.ts. Planejamento/status são incluídos no mesmo commit.
- RED observado: assert.deepEqual do input publish-artifacts recebeu undefined em vez de boolean/default false.
- Implementação: booleano opcional com default false; os três guards preservam release_created e project-type e acrescentam AND inputs.publish-artifacts.
- Gate: suíte integral 7/7, zero skips/falhas; typecheck e diff aprovados. Nenhum caso ou asserção anterior removido; o guard exato foi fortalecido.

### Adequação do teste

| Critério | Evidência | Resultado |
| --- | --- | --- |
| RPIL-01.AC1, default fail-closed | ci-scripts/tests/release-please.test.ts:103, assert.deepEqual(workflow.on.workflow_call.inputs['publish-artifacts'], {...default:false}) | Tipo booleano e false por padrão |
| RPIL-01.AC2, false bloqueia três publishers | ci-scripts/tests/release-please.test.ts:125, assert.equal(distribution[index].if, expressão release_created AND tipo AND inputs.publish-artifacts) | Todos os publishers exigem o flag além das condições anteriores |

| Asserção | Requisito | Necessária |
| --- | --- | --- |
| input boolean/default false, linha 103 | RPIL-01.AC1 | Sim |
| três guards exatos, linha 125 | RPIL-01.AC2 | Sim |

Veredito local T1: PASS para o contrato; a etapa completa e a produção continuam pendentes. O teste verifica YAML/booleans tipados, não simula a execução do runner ou dos publicadores.
