# Design

## Context

Ver proposta e delta spec. A issue #9 centraliza sessão, diretrizes globais versionadas, roteamento de modelo/prompt e inferência; a issue #7 estabelece o padrão de caller e PR revisável. O texto original da issue #8 previa SonarQube antes do merge e `Request changes` em caso de falha. A diretriz global aprovada é posterior: Sonar analisa o SHA de `develop` após integração da release/hotfix e bloqueia promoção para `master`, sem reabrir épica nem atribuir `Request changes`.

## Goals / Non-Goals

**Goals:** workflow de code review reutilizável, caller enxuto de PR confiável, achados auditáveis ligados ao SHA e correção segura via PR complementar para feature elegível.

**Non-Goals:** substituir aprovação humana, fazer merge, modificar branch de integração, acionar Sonar em PR, processar código de fork com secrets ou alterar Project V2 com base apenas no resultado da LLM.

## Decisions

### 1. Disparo por PR, sem filtro de branch de negócio

O caller do repositório privado responde a `pull_request` aberto, sincronizado ou reaberto para qualquer par de branches e chama o workflow reutilizável de review, que por sua vez chama o central da issue #9. O review classifica o PR como feature ou integração. PR de fork não recebe secrets e é registrado como não elegível no MVP. PR gerado pelo próprio bot é ignorado para evitar recursão. Alternativa de filtrar somente feature→release foi rejeitada porque a issue pede revisão independente das branches envolvidas.

### 2. Contexto confiável e instruções versionadas

O central recebe o diff e metadados do head SHA como dados, mas a política global vem da cópia integral versionada do `AGENTS.md` da issue #9 e as instruções do consumidor vêm do checkout da revisão-base confiável. `AGENTS.md` modificado no head é analisado como diff, não promovido a instrução confiável. O tamanho do diff é limitado e extrapolação gera estado inconclusivo; não se publica uma revisão aparentemente completa após truncamento silencioso. Alternativa de executar o CLI dentro do checkout do head foi rejeitada por risco de instruções e scripts não confiáveis.

### 3. Resultado vinculado ao SHA e revisão humana

O caller valida o envelope estruturado do central, arquivo/linha dos achados contra o diff e publica comentário/resumo marcado como automático. Reexecução do mesmo SHA atualiza esse registro. Achado crítico pede revisão humana, mas não cria aprovação/reprovação nativa em nome do humano nem move o item do Project para `Request changes` automaticamente. Alternativa de usar a LLM como gate final foi rejeitada porque a revisão pode conter erro e não substitui o responsável.

### 4. Correção por PR complementar

Quando o central propõe patch para PR de feature do mesmo repositório, o caller valida caminhos, extensão, base SHA e escopo, aplica em job sem sessão Codex/PAT, roda verificações do consumidor e cria branch de correção a partir do head SHA analisado. Abre PR complementar com base na branch head do PR original, vinculando os dois; após revisão e merge humano, o PR original recebe novo commit e é reavaliado. Em PR de release→develop ou develop→master, limita-se a achados, sem modificar essas branches. Alternativa de push direto no head original foi rejeitada por apagar a separação entre proposta da IA e aceitação humana.

### 5. SonarQube é controle distinto

Nenhum job deste caller dispara a análise da issue #5. Após merge de release/hotfix em `develop`, aquela automação roda e, se reprovar, cria Hotfix `On hold` na mesma milestone da épica, mantendo a épica `Done` e bloqueando `develop→master`. O code review não antecipa nem reproduz esse Quality Gate.

## Risks / Trade-offs

- [LLM pode inventar achado ou patch incorreto] → validar referência ao diff, executar testes sem secrets e exigir revisão humana.
- [PR grande excede contexto] → limite explícito e resultado inconclusivo com pedido de revisão humana, nunca sucesso parcial silencioso.
- [Patch pode introduzir execução maliciosa] → allowlist e aplicação em job isolado sem PAT/sessão; não executar scripts do patch como parte da preparação.
- [PR complementar pode ficar obsoleto após novo commit] → vínculo ao head SHA e nova análise no evento `synchronize`.
- [Revisão de integração pode tocar código sensível] → comentário apenas, sem alteração automática em release/develop/master.

## Migration Plan

1. Validar contrato do central com fixtures de diffs/achados, sem credenciais reais.
2. Publicar caller e documentação em modo opt-in para repositório privado piloto.
3. Exercitar PR sem achados, com achado crítico, patch de feature, PR de integração e novo SHA; verificar ausência de duplicação e de escrita pelo central.
4. Desabilitar o caller se necessário; comentários/PRs complementares permanecem para decisão humana, sem afetar o SonarQube posterior.
