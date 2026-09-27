# Tasks

## 1. Contrato e testes de decisão

- [ ] 1.1 Definir inputs, secrets, outputs e nomes estáveis dos dois `workflow_call` em `docs/sonarqube.md`; verificar que cada campo possui origem, valor permitido e comportamento quando ausente.
- [ ] 1.2 Criar fixtures e testes Node para `PASS`, `FAIL`, `INCONCLUSIVE`, timeout, erro de scanner e SHA divergente; verificar com `node --test tests/sonarqube/*.test.mjs`.

## 2. Análise pós-merge

- [ ] 2.1 Implementar leitura de `report-task.txt`, polling limitado da tarefa Sonar e consulta do Quality Gate por análise; verificar fixtures de sucesso, reprovação, erro e timeout com `node --test tests/sonarqube/*.test.mjs`.
- [ ] 2.2 Vincular projeto, analysis ID e revisão ao SHA do evento, rejeitando ausência ou divergência de prova; verificar cenários de múltiplas análises e de `develop` avançado nos testes.
- [ ] 2.3 Criar workflow reutilizável de análise para `push` em `develop`, com checkout exato, scanner configurável pelo consumidor, permissões mínimas e commit status `sonarqube/develop-quality-gate`; verificar sintaxe do YAML e os testes de evento/ref/SHA inválidos.
- [ ] 2.4 Garantir que reexecuções e análises concorrentes não publiquem aprovação para outro SHA nem criem efeitos corretivos para um SHA obsoleto; verificar os casos de corrida nas fixtures.

## 3. Proveniência e Hotfix

- [ ] 3.1 Resolver o PR de merge `release/*` ou `hotfix/* → develop`, a referência explícita à épica e a milestone da própria épica; verificar testes de vínculo válido, ausente, ambíguo e divergente.
- [ ] 3.2 Fazer preflight de issue type `Hotfix`, milestone, item e campo Status do Project V2 antes da mutação; verificar com respostas simuladas que falta de permissão/campo produz falha explícita.
- [ ] 3.3 Criar/reconciliar Hotfix aberta por chave repositório+SHA, atribuir tipo, milestone, Project e `On hold`, com links para épica, PR e análise; verificar criação única, reexecução e recuperação de falha parcial em testes.
- [ ] 3.4 Verificar por testes que FAIL não reabre épica/milestone, não atribui `Request changes`, não fecha Hotfix e que erro/inconclusão não cria Hotfix.

## 4. Proteção da promoção

- [ ] 4.1 Implementar decisão de promoção por head SHA atual de `develop`, análise Sonar desse SHA, gate `PASS`, milestone verificada e ausência de Hotfix corretiva aberta; verificar matriz de bloqueios com `node --test tests/sonarqube/*.test.mjs`.
- [ ] 4.2 Criar workflow reutilizável do check `develop → master` com nome de job estável e sem segredos em PR de fork; verificar YAML e que refs/eventos fora do contrato falham fechados.
- [ ] 4.3 Adaptar os validadores de versionamento para PR revisado `hotfix/* → develop` sem permitir feature direta a `develop`; verificar testes existentes em `tests/versioning/` e novos casos de Hotfix.

## 5. Documentação e validação sem servidor

- [ ] 5.1 Adicionar callers de exemplo para `push develop` e PR `develop → master`, com pin da revisão do workflow central, permissões e secrets; verificar que exemplos referenciam os inputs reais e passam na validação estática de YAML.
- [ ] 5.2 Documentar edição Community Build versus Developer+, configuração do scanner por projeto, Quality Gate, Project V2, ciclo manual de fechamento da Hotfix e ativação do check obrigatório; verificar a checklist de setup contra os workflows e scripts criados.
- [ ] 5.3 Rodar testes de contrato integrados com APIs simuladas, `openspec validate sonarqube-develop-quality-gate --strict` e `git diff --check`; registrar os resultados e as limitações da simulação.

## 6. Ativação e prova ponta a ponta (dependência externa)

- [ ] 6.1 Quando houver SonarQube Server, projeto piloto, tokens e `develop` remoto, executar um merge de teste para cada `PASS`, `FAIL` e indisponibilidade; verificar SHA, link da análise, Hotfix única `On hold` e épica `Done`/milestone fechada no GitHub.
- [ ] 6.2 Configurar o check de promoção como obrigatório na proteção de `master` do piloto e provar que FAIL/inconclusão/Hotfix aberta impedem o merge, enquanto PASS do SHA atual com Hotfix encerrada permite seguir para os demais gates.
