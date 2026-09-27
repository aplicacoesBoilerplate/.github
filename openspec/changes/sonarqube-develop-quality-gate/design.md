# Design

## Context

Ver [proposal.md](proposal.md) e a [spec delta](specs/sonarqube-develop-quality-gate/spec.md). Este repositório já publica workflows reutilizáveis em `.github/workflows/` e usa scripts Node/Bash e a GitHub CLI para conferir PRs, épicas e milestones. `scripts/versioning/validate-sprint.sh` exige milestone fechada com zero issues abertas; isso já bloqueia uma promoção enquanto a nova Hotfix estiver aberta, mas os validadores atuais não aceitam `hotfix/* → develop`. Não há workflow SonarQube, servidor configurado, branch remota `develop` ou proteção obrigatória de `master` disponíveis para uma validação real neste momento.

## Goals / Non-Goals

**Goals:**

- Publicar um contrato reutilizável de análise pós-merge e outro de promoção, com um identificador de Quality Gate estável e decisão vinculada ao SHA.
- Isolar interpretação das respostas Sonar/GitHub em scripts testáveis sem rede, preservando o padrão de Node e GitHub CLI do repositório.
- Reconciliar criação, milestone e Status da Hotfix sem duplicatas e sem mutar a épica.
- Entregar documentação e caller de exemplo que permitam ativação posterior sem redesenhar o contrato.

**Non-Goals:**

- Hospedar SonarQube em container efêmero por PR, analisar cada feature PR ou configurar um Quality Gate universal para todas as linguagens.
- Aprovar automaticamente review/homologação, fechar Hotfix automaticamente ou administrar as credenciais e regras de branch de cada consumidor.
- Tratar resultados simulados como validação ponta a ponta de um servidor SonarQube real.

## Decisions

### 1. Dois pontos de entrada, com eventos controlados pelo consumidor

Criar workflows `workflow_call` para (a) análise chamada por `push` em `develop` e (b) check chamado por `pull_request` com `base=master` e `head=develop` do próprio repositório. O caller de exemplo filtra esses eventos; o workflow chamado volta a validar evento, refs, repositório e SHA, pois um caller mal configurado não pode transformar outro evento em aprovação. O check de promoção terá nome estável para ser selecionado como obrigatório na regra de proteção de `master`; somente o administrador do repositório consumidor pode ativar essa regra.

Alternativa rejeitada: um único workflow de PR de feature. Ele contrariaria o fluxo corretivo aprovado e, em SonarQube Community Build, dependeria de análise de PR/branch indisponível.

### 2. Resultado do Sonar vinculado à análise, não ao estado “mais recente”

O job faz checkout do `github.sha`, confirma `HEAD` e usa o scanner com `sonar.scm.revision` igual a esse SHA. A configuração de fontes/linguagem fica no projeto consumidor (por exemplo, `sonar-project.properties`); o primeiro adapter utiliza SonarScanner CLI. O scanner produz `report-task.txt`; um script lê o `ceTaskId`, aguarda a tarefa de Compute Engine, obtém o identificador da análise e consulta o Quality Gate dessa análise. Quando a API da edição instalada oferecer a revisão da análise, o script a compara com o SHA enviado; discrepância é `INCONCLUSIVE`. O script normaliza apenas aprovação e reprovação confirmadas para `PASS` e `FAIL`; outros estados e falhas de scanner/API viram `INCONCLUSIVE`.

Um commit status em contexto fixo `sonarqube/develop-quality-gate` oferece visibilidade no GitHub para o SHA analisado, com URL Sonar e conclusão `success`, `failure` ou `error`. O check de promoção não confia apenas no status nem consulta cegamente o último gate do projeto: consulta novamente o Sonar para localizar a análise do projeto com revisão igual ao head SHA atual de `develop` e confirma o gate dessa análise. Se houver várias análises para o SHA, usa a mais recente válida e registra o identificador escolhido; se não for possível atribuir o resultado sem ambiguidade, bloqueia. Isso evita aprovar um PR após `develop` avançar ou após um status antigo ser reutilizado.

Alternativas rejeitadas: `sonar.qualitygate.wait=true` como único sinal (um exit code não distingue gate reprovado de falha operacional) e `api/qualitygates/project_status` sem análise identificada (pode devolver resultado de outro SHA). A documentação do Sonar confirma que `report-task.txt` contém `ceTaskId` e que a revisão pode ser registrada na análise: [parâmetros de análise](https://docs.sonarsource.com/sonarqube-server/2026.1/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui).

### 3. Proveniência verificável e reconciliação de Hotfix

Após `FAIL` confirmado, o job confere que `refs/heads/develop` ainda aponta para o SHA analisado. Usa os PRs associados ao commit para selecionar um único merge com `base=develop` e `head=release/*` ou `hotfix/*`. Reutiliza o padrão existente `Epic: #N`/`Épica: #N` do corpo do PR; para um PR de Hotfix, aceita a referência explícita à épica ou a rastreia pela Hotfix vinculada. Busca a issue épica e exige estado fechado, Status `Done` e milestone associada. Vínculos ausentes ou conflitantes geram erro operacional e não um palpite.

A chave de idempotência é repositório + SHA reprovado, registrada no corpo da Hotfix junto do PR, épica, milestone e URL/ID da análise. Antes de criar, o job procura uma Hotfix aberta com essa chave. Faz preflight de token e metadados do Project V2, cria a issue com tipo `Hotfix` e milestone da épica, adiciona-a ao Project e define `On hold`. Se a chamada ao Project falhar após a criação da issue, a execução falha, mantém a promoção bloqueada e a próxima execução reconcilia a issue existente em vez de criar outra. Não move a épica, não reabre a milestone e não atribui `Request changes`.

Alternativa rejeitada: usar apenas o PR de promoção, que pode nem existir quando a reprovação é detectada. A implementação deverá reutilizar os validadores de milestone/épica existentes, mas sem chamar `validate_epic(..., true)` depois de abrir a Hotfix: a milestone fechada pode temporariamente ter uma issue aberta por desenho.

### 4. Gate de promoção e ciclo da correção

No PR `develop → master`, o workflow verifica que o head do PR ainda é a ponta atual de `develop`, resolve a épica/milestone por metadados verificáveis, exige `PASS` do mesmo SHA no Sonar e consulta Hotfixes corretivas abertas dessa milestone. A ausência de qualquer prova falha o check. Os validadores de review, homologação e milestone permanecem independentes; o novo gate não os substitui. O fluxo de versionamento precisa reconhecer `hotfix/* → develop` como correção de homologação, mantendo a proibição de pular `release` para uma feature normal. A Hotfix passa a `In progress` quando o trabalho começar e só é encerrada explicitamente/`Done` após a nova análise de `develop` aprovar.

Alternativa rejeitada: fazer a automação fechar a Hotfix no merge da correção. O merge ocorre antes da análise e pode ainda reprovar.

### 5. Permissões e compatibilidade de edição

O caller fornece URL, chave do projeto e token Sonar; o token de GitHub com escrita em Issues/Project V2 fica apenas no job de reconciliação, separado do job de scanner e do check de promoção. O checkout não persiste credenciais. Logs e outputs não incluem tokens. O `GITHUB_TOKEN` recebe apenas permissões necessárias para checkout, leitura de PR/Issues e publicação do commit status; a escrita no Project V2 exige credencial apropriada do consumidor, documentada como pré-requisito. Nenhum job com segredos executa código de PR de fork.

Na Community Build, configurar `develop` como branch principal do projeto SonarQube para que a análise pós-merge seja possível sem branch analysis; Developer+ pode analisar `develop` como branch nomeada. O contrato expõe essa escolha de configuração, sem presumir a edição. A configuração da linguagem e geração de coverage/binaries permanecem responsabilidade do caller/projeto; ampliar adapters específicos para Maven ou outras stacks é evolução posterior, não mudança do gate.

## Risks / Trade-offs

- **Sem servidor Sonar e edição definida** → validar parser/decisões com fixtures e deixar uma checklist de ativação e teste real; não declarar o gate operacional antes dessa prova.
- **Project V2 ou issue type sem permissões** → preflight, falha explícita e reconciliação idempotente do estado parcial; nunca registrar aprovação por causa de falha de escrita.
- **Metadados do PR insuficientes ou vários PRs candidatos** → falhar fechado e pedir correção dos vínculos, sem escolher uma épica pela data ou pelo nome da branch.
- **Corrida entre merges e análises** → comparar a ponta de `develop` antes dos efeitos colaterais e vincular cada resultado ao SHA/analysis ID; o PR de promoção valida a ponta novamente.
- **Scanner genérico insuficiente para alguns consumidores** → exigir configuração própria do projeto e documentar pré-requisitos de compilação/cobertura; não prometer suporte automático a toda stack.
- **Ruleset ausente em `master`** → o check isolado é informativo; a ativação exige proteger `master` com esse check obrigatório e verificar o bloqueio em repositório de teste.

## Migration Plan

1. Adicionar workflows, scripts, fixtures/testes e documentação em `feature/issue-5-sonarqube`, sem habilitar callers reais ainda.
2. Quando houver servidor, cadastrar projeto/token e confirmar sua edição, branch principal e Quality Gate; criar `develop` remoto e configurar o caller em repositório piloto.
3. Exercitar PASS, FAIL, erro de infraestrutura e reexecução para o mesmo SHA; conferir Hotfix/Project/milestone e o PR `develop → master`.
4. Tornar o check de promoção obrigatório na proteção de `master` somente após o piloto; expandir aos consumidores gradualmente.
5. Para rollback de automação defeituosa, desabilitar o caller e corrigir o workflow; não remover silenciosamente a proteção nem tratar ausência de scan como PASS. Qualquer promoção excepcional exige decisão administrativa explícita e auditável.

## Open Questions

- URL, edição, versão, projeto piloto e tokens do SonarQube serão definidos no provisionamento do servidor; não alteram o contrato `PASS`/`FAIL`/`INCONCLUSIVE`.
- A identidade exata usada para escrita no Project V2 e o nome/ID do Project por consumidor serão escolhidos na ativação, respeitando as permissões e campos exigidos.
