# Registro da etapa 1

## Baselines preservadas

- Central: origin/master 564f1bba751ed605931beffa5e9fed00e42fec4c, novo worktree nativo release-please-pilots-stage1, branch codex/release-please-pilots-stage1. Piloto interno v0.0.1 já publicado; issue #4 permanece fechada.
- Java: novo worktree PackagesJava.worktrees/release-please-stage1, base origin/release/v0.0.1 2992a00995071d4e836e907e5148222fea1e3fdc. Clone original sujo preservado.
- Vue: novo worktree PackagesVue.worktrees/release-please-stage1, base origin/release/v0.0.1 a846332f1f922f09333bfca81de45b3b47bf2f5b. Grafo atual tem cinco bibliotecas, docs e dois tools privados; não usar o inventário antigo da master. Clone original sujo preservado.
- Go: novo worktree boilerplate-cli.worktrees/release-please-stage1, base origin/release/v0.0.1 939987851b49436476a82a859694688772fda7bb. Não tocar issue-8/13/14 nem promover os commits funcionais para master.
- Gates de base: central 7/7 e typecheck; Java mvn verify com os quatro módulos SUCCESS; Go test/vet/build aprovados. Vue verify passou (17 tarefas, cache da baseline), usando npm10.9.4 invocado fora do repo com --prefix. Nenhuma regra de versão foi removida para contornar a falha. A instalação Vue reporta 16 vulnerabilidades preexistentes; upgrade amplo não integra este escopo.

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

## T2: Contrato configurado e motores nativos

- RED: o teste exigindo engine=action falhou quando o output era ausente; contratos configurados foram adicionados antes da implementação correspondente.
- Implementação: três inputs configurados; validação de caminho/política/seed; preservação dos arquivos do consumidor. Single continua na Action; manifest independente usa config-file/manifest-file oficiais; raiz configurada usa API pública Manifest.fromManifest do SDK 17.3.0 com override transitório da milestone. Nenhum cálculo próprio de incremento.
- ci-scripts/tests/release-please.test.ts:227-266 comprova preservação, override raiz, ausência de override no workspace e negativos (política, múltiplos componentes com override, path traversal e manifest ausente).
- Mesmo teste:288-321 aplica updaters Maven reais em quatro POMs, revision e pais, e confere versão 0.0.2, sem snapshot, tag v0.0.2 e SHA integrado.
- Mesmo teste:324-345 verifica ordem nativa releases/reload/PRs e resultados, isolando transporte de escrita. Não constitui prova de escrita real no GitHub.
- Mesmo teste:347-408 calcula incremento independente 1.1.1 -> 1.1.2, sem downgrade dos demais, atualiza range de docs privado e lockfile pelo plugin node-workspace, preserva root privado e impede GitHub Release para docs.
- Gate integral: 7/7, zero skips/falhas; typecheck e diff aprovados; npm audit --omit=dev: 0 vulnerabilidades. Contrato inclui o entrypoint SDK do YAML.
- Revisão independente central_contract_review: sem bloqueios da etapa 1. Limitação da etapa 2 registrada: os publishers legados não consomem resultados SDK nem múltiplos componentes; publish-artifacts=true não é suportado nesses modos. Os três pilotos usam false.
- Erro de import Version na implementação foi detectado pelo typecheck e corrigido com semver público para validação, antes do commit.

Veredito local T2: PASS. Transporte de GitHub isolado, cálculo/updates nativos. Publicação hospedada dos consumidores permanece pendente dos merges humanos.

## T3: Contrato consumível

- T2 publicada e SHA remoto conferido: 1bfe472a24b6111aaee4721a8416ef00900c02ea. A revisão de documentação seguinte contém o mesmo runtime e será fixada igualmente nos três callers.
- Guia central atualizado para os três modos, etapa 1/2, dois momentos, permissões, limites e evidência real do self-pilot já concluído. Removidas instruções antigas que prometiam publish automático ou duplicavam callers por linguagem.
- Mantido um exemplo genérico, com CI antecedente, merge verdadeiro, permissões mínimas, SHA igual e publish-artifacts=false. README dos workflows e scripts explicam run, Node/tsx e os dois níveis de diretório .ci-scripts/ci-scripts.
- Gate local: sete casos, zero skips/falhas, typecheck e diff aprovados. CI hospedada e PR/SHAs efetivos serão reconciliados em T7.

### Correção do build documental T3

O primeiro CI do PR19 aprovou os sete testes/tipos, mas o build VitePress reprovou dois links novos para READMEs fora da raiz docs/. Revisão independente confirmou a causa no run40071161215. Os links externos ao site passaram a URLs GitHub fixadas no SHA publicado 1d874d9, sem desabilitar checagem de links ou alterar Pages. Novo build obrigatório antes do push desta correção.

## T4–T6: Callers publicados nas aplicações

Cada aplicação inclui seu próprio guia/status no mesmo commit da implementação. A consolidação abaixo referencia esses commits, sem alterar fontes funcionais ou promover branches.

| Tarefa | Entrega | Revisão remota final | Gate |
| --- | --- | --- | --- |
| T4 Java | [PR36](https://github.com/aplicacoesBoilerplate/PackagesJava/pull/36), para release/v0.0.1 | 47a19912d55e4d94334e87ae3071ada0d948b49d | Quatro módulos/quatro testes verify aprovados; SDK aplicou0.0.2 em POMs/pais/revision reais e reactor scratch recompilou |
| T5 Vue | [PR39](https://github.com/aplicacoesBoilerplate/PackagesVue/pull/39), para release/v0.0.1 | d17697a47779608ee86caa9dd5cd810900837ce9 | verify17/17 sem cache; pack:check cinco libs; grafo/ranges/privados/lock reais aprovados |
| T6 Go | [PR16](https://github.com/aplicacoesBoilerplate/boilerplate-cli/pull/16), para release/v0.0.1 | 282285ea372ab3bb9a5a47c5dff51d9b10b7c049 | Nove contratos, testes/vet/build/help, lint0issues; SDK Go propõe0.0.1/changelog/tag/SHA sem mudar go.mod |

Os três usam 1d874d946e5f5ad233a6b1f6bf278fef78f3b46d tanto no uses quanto em central-ref e publish-artifacts=false. Nenhum novo exemplo central por adaptador. O PR central19 recebeu milestonev0.0.2; revisão solicitada a gersonfribeiro nos quatro PRs. Aplicações ficam nas releases existentes; nenhuma issue funcional foi alterada.

### Impedimentos resolvidos

- Vue40071481961: setup-node chamou npm cache antes do pin; npm10.9.9 violava devEngines10.9.4. Desabilitado cache npm automático antes do pin, sem relaxar devEngines (39794c5).
- Vue40071638090: TS2307 em exemplo que importa a API pública do próprio ui-core antes de dist existir. Corrida preexistente resolvida com type-check.dependsOn=[build], sem excluir exemplos/testes (d17697a). Grafo Turbo real validou a dependência nos oito nós. Sem Context7 disponível; sintaxe confirmada no código instalado e na [documentação oficial](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#depending-on-tasks-in-the-same-package).
- Go F-SHA: Verifier detectou CI do closed/merged no head anterior. Mesmo teste fortalecido produziu RED1/9, depois GREEN9/9; checkout agora prioriza merge_commit_sha após merge (282285e). Fonte Go não alterada.
- Lint Go local: normalização do CRLF de checkout comprovadamente idêntico ao HEAD, sem diff de conteúdo e sem fonte Go incluído no commit. Nenhum clone original sujo foi limpo/alterado.

## T7: Evidência independente e pendências humanas

- Relatório canônico: validation.md; aprovação técnica para revisão/integração. Quatro mutantes mortos (default true, override escalar no native, perda do writer SDK, checkout Go incorreto); zero sobreviventes e isolamento dos quatro worktrees comprovado.
- O verificador executou gates sequencialmente após saturação de memória em uma tentativa paralela; mesmas tarefas/testes mantidos. Não foi necessário reduzir cobertura.
- CI hospedada verde nos heads finais: central40071353788 +docs40071353809; Java40071261874; Vue40071851841; Go40072007834. O commit final modifica apenas registros TLC/relatório/lição, sem mudar o runtime consumido.
- Central PUBLIC; checkout externo não requer PAT. Go permite criação/aprovação de PRs por Actions. A consulta administrativa em Java/Vue e central retornou403 para a identidade agentegersonfribeiro-AI: não foi alterada política, nem presumida desabilitada. Confirmar na revisão administrativa dos consumidores antes de ativar os ciclos.
- Preservação conferida por status: central original develop com alterações anteriores; Java release/v0.0.1 com .envrc/.opencode/OpenSpec; Vue feature/separacao-de-lib com snippet sujo; Go feature/issue-14 com README/fontes/OpenSpec. Nenhum desses arquivos foi modificado por esta entrega.
- Limpeza de scratch rejeitada pela revisão automática: blocked by policy, sem motivo adicional. Diretórios temporários preservados limpos e sem novas tentativas destrutivas; detalhes no relatório. Não afeta os repositórios reais.
- Meta permanece ATIVA. Ainda faltam os três ciclos hospedados completos após merges humanos (entrega funcional+milestone -> PR técnico -> merge -> tag/Release). A implementação e seus PRs estão entregues; não declarar conclusão integral com base no validador ou em transporte simulado. Nenhum merge, tag, Release ou pacote/binário criado pelo agente nesta etapa.
