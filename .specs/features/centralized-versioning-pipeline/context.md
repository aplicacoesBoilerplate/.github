# Pipeline Centralizada de Versionamento Context

**Gathered:** 2026-10-01
**Spec:** `.specs/features/centralized-versioning-pipeline/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Esta feature ajusta somente o repositório central `.github`. Ela entrega workflows reutilizáveis de validação e publicação, um caller Go copiável, guia de homologação e testes da automação. O repositório piloto `boilerplate-cli` não será alterado nesta iteração.

---

## Implementation Decisions

### Cálculo e contrato do adaptador

- O caller informa o adaptador e as configurações do projeto.
- O adaptador é a única fonte do cálculo da versão.
- O perfil Go usa `go-gitsemver` e preserva o JSON e a explicação nativos.
- A pipeline normaliza os resultados para consumo dos gates, do guia e da publicação, sem criar um cálculo SemVer concorrente.
- Sem tag estável anterior, a primeira versão publicável é `v0.0.1`; `v0.0.0` existe somente como base matemática.

### Milestone como contrato opcional

- O pull request final para `master` fornece a milestone diretamente em seus metadados.
- Sem milestone, o cálculo do adaptador é aceito sem check ou revisão adicional de planejamento.
- Com milestone, o título deve ser SemVer estável estrito e valida tanto a versão final exata quanto o tipo de incremento.
- A milestone não ganha campos customizados; título, data e descrição permanecem os metadados nativos.

### Override definitivo

- Divergência bloqueia por padrão.
- O label `versioning:override` inicia o fluxo de exceção, mas não constitui autorização isoladamente.
- A timeline identifica quem aplicou o label.
- Essa pessoa precisa possuir papel efetivo `Maintain` ou `Admin`.
- Outra pessoa com `Maintain` ou `Admin` precisa aprovar o pull request depois da aplicação do label.
- Novo commit ou alteração relevante em milestone, label ou review invalida e reavalia a exceção.
- O check registra valores planejados e calculados, autores e horários.

### Homologação

- `develop` é a branch de homologação.
- O guia reaproveita o relatório que a ferramenta de versionamento já fornece.
- A pipeline complementa esse relatório somente com metadados do pull request, estado conhecido da CI e checklist sugerido.
- O resultado é publicado como `homologation.md`, `homologation.json` e resumo do check.
- O guia não é commitado e não prova aprovação humana; ele orienta a homologação.
- O JSON separa fatos coletados de sugestões para servir como entrada segura de uma futura LLM de revisão.

### Publicação

- A GitHub Release só é criada depois do merge de `develop` em `master` e do sucesso da CI do consumidor.
- O merge aciona o fluxo por `push`; a pipeline associa o SHA ao pull request integrado e revalida seus gates.
- O environment de publicação é opcional no caller.
- Quando informado, suas regras são respeitadas; quando omitido, a publicação segue automaticamente após CI e checks.
- Tag e release são idempotentes e nunca sofrem force-push ou sobrescrita divergente.

### Agent's Discretion

- Estrutura interna do envelope normalizado do adaptador.
- Organização dos scripts, desde que cada responsabilidade permaneça testável isoladamente.
- Formato visual do Markdown do guia e das notas da release.
- Forma de simular a API do GitHub nas fixtures locais.
- Retenção dos artifacts segue a configuração do GitHub Actions do consumidor.

### Declined / Undiscussed Gray Areas → Assumptions

- Falha de API, limite de chamadas ou saída incompleta falha fechado porque autorização e publicação não admitem resultado presumido.
- Publicações concorrentes são serializadas por repositório e branch sem cancelamento porque uma execução pode já ter criado parte do estado externo.
- A adoção das proteções remotas nos consumidores será documentada, não automatizada nesta feature.

---

## Specific References

- O campo de Project `Release` com `MAJOR`, `MINOR` e `PATCH` permanece disponível para planejamento de issues, mas não é consultado por este fluxo porque o pull request final já possui milestone.
- O fluxo de branches esperado é `feature → release → develop → master`.
- O projeto futuro `boilerplate-cli` será o primeiro consumidor real do caller Go.

---

## Deferred Ideas

- Deployment protection rule implementada por GitHub App e LLM para aprovação autônoma de environments.
- Uso do guia JSON como arquivo de tarefas para revisão de código por LLM.
- Ativação completa dos adaptadores npm, Changesets e Java.
- Automação organizacional da instalação de rulesets e checks obrigatórios nos consumidores.
