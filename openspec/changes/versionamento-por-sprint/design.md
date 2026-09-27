# Design

## Context

Ver [proposal.md](proposal.md) para motivação e [spec delta](specs/versionamento-por-sprint/spec.md) para o comportamento exigido. O repositório contém templates de issue e documentação de planejamento em `specs/001-versionamento-por-sprint/`, mas não tem `.github/workflows/` nem implementação de versionamento. O contrato de referência em `specs/001-versionamento-por-sprint/contracts/versioning.md` propõe dois workflows reutilizáveis. O controle de review, homologação, ambiente e branch protegida pertence ao consumidor.

## Goals / Non-Goals

**Goals:**

- Separar tecnicamente a superfície de leitura em PR da superfície de publicação pós-merge, inclusive em permissões e execução de código não confiável.
- Estabelecer contrato de adaptadores previsível entre quatro ferramentas sem impor um algoritmo único de versão.
- Manter versão dos arquivos do consumidor, tag e release coerentes com o commit integrado; tornar conflitos auditáveis e reexecuções seguras.

**Non-Goals:**

- Reconfigurar proteção de branches, ambientes, reviews ou ferramentas instaladas em cada consumidor.
- Atribuir automaticamente a versão do consumidor a partir do nome da milestone da sprint.
- Mover tags publicadas ou gerar um changelog genérico para todos os perfis.

## Decisions

### 1. Dois contratos `workflow_call` e gates no consumidor

Criar `.github/workflows/version-preview.yml` com permissões de leitura e `.github/workflows/version-publish.yml` com `contents: write` exclusivamente na publicação. Os callers documentados acionam a prévia em PRs e a publicação após o merge no destino protegido, sob regras obrigatórias de review/homologação do consumidor. A publicação também verifica contexto do evento, branch de destino e SHA integrado antes de escrever; rejeita execução em contexto de PR ou branch diferente. Os gates de aprovação/homologação devem ser exigidos pela configuração protegida do caller, não por um simples input booleano controlável pelo PR.

**Alternativa descartada:** Um workflow único, com permissão de escrita disponível em PR, ampliaria o risco de publicar a partir de código não confiável.

### 2. Adaptadores selecionados por enumeração fechada

O dispatcher em `scripts/versioning/` aceita apenas `standard-version`, `changesets`, `jgitver` e `go-gitsemver`, com `project_path` confinado ao checkout e entradas de sprint/branch validadas. Cada adaptador calcula uma prévia não destrutiva e lê/prepara a versão conforme a ferramenta e configuração presentes no consumidor; saídas são normalizadas para `bump`, `candidate_version` e `summary`. Não executar strings de comando originadas de PRs. PRs de release devem incluir previamente as alterações de arquivos de versão/changelog exigidas pelo perfil; a publicação lê os artefatos já integrados e falha se a versão declarada não corresponde ao commit alvo.

**Alternativas descartadas:** Impor `standard-version` a Maven e Go perde convenções próprias; gerar e commitar alteração de versão após o merge faria tag/release apontarem para um commit diferente do integrado.

### 3. Publicação conservadora e reconciliação

Serializar callers por repositório/branch de publicação com `cancel-in-progress: false`, mas não depender apenas disso: imediatamente antes de criar a tag, consultar Git remoto e GitHub Release e conferir a versão do projeto. Criar a tag sem force-push e comparar o resultado em caso de corrida; criar ou verificar a release para a mesma tag e SHA. Se tag e release já estão íntegros, retornar `already-published`; se existem referências divergentes, retornar `conflict` ou falhar com diagnóstico, preservando o estado. Expor `version`, `tag`, `release_url` e `outcome` na chamada de publicação quando há estado reconciliado. Se a tag foi criada e a release falhou, a reexecução deve completar somente a release após validar a mesma versão/commit; outros estados parciais requerem intervenção explícita.

**Alternativas descartadas:** Depender só de `concurrency` não protege chamadas simultâneas de outros callers; sobrescrever tags ou releases esconderia conflito de proveniência.

### 4. Consumo versionado e testes de contrato

Publicar exemplos de caller dos quatro perfis em `docs/versioning.md` com inputs, outputs, instalação/configuração da ferramenta, permissões e referência imutável (SHA ou tag estável revisada). Manter fixtures e checagens de sintaxe/contrato em `tests/versioning/`, seguidas de ensaio em repositórios de teste para PRs válidos/inválidos, merge aprovado/não aprovado, dez reexecuções, duas execuções concorrentes e falhas parciais. Sem credenciais reais em fixtures.

**Alternativa descartada:** Confiar apenas em lint YAML não verifica gates, integração entre ferramentas e ausência de escrita na prévia.

## Risks / Trade-offs

- [O runner ou o consumidor não instala a ferramenta do adaptador] → Detectar e interromper com instrução de configuração antes de qualquer escrita.
- [O consumidor omite proteção de branch/ambiente] → Documentar gates obrigatórios no caller e validar contexto pós-merge no workflow; review/homologação não podem ser substituídos por um input booleano.
- [Ferramenta de release tenta atualizar arquivos depois do merge] → Exigir arquivos de versão/changelog no commit integrado e conferir consistência antes da tag; documentar preparação anterior à integração por perfil.
- [Corrida entre projetos/callers ignora a serialização] → Revalidar remoto e usar criação sem sobrescrita, conciliando resultado em vez de confiar só no agendamento.
- [Falha entre tag e release deixa estado parcial] → Reconciliar somente tag do mesmo commit e mesma versão; demais divergências exigem diagnóstico e recuperação manual.

## Migration Plan

1. Adicionar workflows, scripts, exemplos e validações sem mudar callers existentes (não há workflows de versionamento neste repositório).
2. Habilitar um consumidor de ensaio por perfil com ferramentas e gates configurados; validar prévia sem escrita antes de testar publicação pós-merge.
3. Disponibilizar referência estável revisada para adoção gradual pelos consumidores; cada caller fixa a referência e declara suas próprias permissões e proteção.
4. Para rollback, remover/desabilitar os novos callers no consumidor ou voltar a referência anterior. Preservar tags/releases já publicadas e resolver inconsistências explicitamente, nunca movê-las.
