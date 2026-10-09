# Workflows centralizados

Esta pasta contém os pontos de entrada do GitHub Actions deste repositório.
Os arquivos YAML coordenam **quando executar, em qual runner, com quais
permissões e em qual ordem**. As regras de versionamento ficam em scripts
testáveis, compartilhados por todos os consumidores.

Para entender a implementação, leia o
[README dos scripts de versionamento](../../scripts/versioning/README.md).
Para configurar uma aplicação, consulte o
[guia de adoção](../../docs/versioning.md) e o
[callers de exemplo](../../examples/callers/).

## Catálogo atual

| Workflow | Acionamento | Responsabilidade |
| --- | --- | --- |
| [ci.yml](ci.yml) | PR e push nas branches declaradas | Validar este repositório, executar fixtures de versionamento e testes reais de Go, standard-version e jgitver. Também verifica Maven/npm quando há projetos correspondentes. |
| [pull-request-hygiene.yml](pull-request-hygiene.yml) | Eventos de PR | Exigir título no formato Conventional Commits. |
| [version-preview.yml](version-preview.yml) | `workflow_call` | Calcular prévia, gerar guia de homologação em develop e validar a policy dos PRs finais. |
| [version-publish.yml](version-publish.yml) | `workflow_call` | Executar environment opcional e publicar tag/Release após integração e gates. |

Os dois últimos são **calleds reutilizáveis**: não são acionados sozinhos por
qualquer PR deste repositório. O **caller** do consumidor define os eventos e
chama esses workflows com `jobs.<job>.uses` e configurações em `with`.
Novos calleds poderão entrar neste catálogo sem duplicar lógica nos consumidores.

## Como um workflow executa um script

Uma etapa `run` executa comandos no runner. Ela pode chamar um arquivo do
checkout, em vez de conter toda a lógica no YAML. Este trecho existe na prévia:

```yaml
- name: Calculate and validate preview
  id: preview
  env:
    GH_TOKEN: ${{ github.token }}
    ADAPTER: ${{ inputs.adapter }}
    TARGET_BRANCH: ${{ inputs.target_branch }}
    PROJECT_PATH: ${{ inputs.project_path }}
    VERSIONING_OUTPUT_DIR: ${{ runner.temp }}/versioning
  run: bash .shared-versioning/scripts/versioning/preview.sh
```

`env` fornece os parâmetros ao processo; `bash` interpreta o arquivo; um
retorno diferente de zero faz a etapa falhar. `run` não baixa arquivos nem
transforma o script em outro workflow: os arquivos precisam estar disponíveis
no runner. Essa abordagem também permite testar os scripts fora do Actions.

O called faz dois checkouts: a aplicação consumidora e a automação central em
`.shared-versioning`. A automação é obtida de `job.workflow_repository`, na
revisão `job.workflow_sha`, preservando a mesma versão do called selecionada
pelo caller. Portanto, o consumidor **não precisa copiar os scripts**.

## Limites e segurança

- Prévia: leitura apenas; não cria commits, tags ou Releases.
- Publicação: somente `push` na branch alvo, associado a PR funcional integrado
  `develop -> master` ou `hotfix/<nome> -> master`. Em standard-version, o
  primeiro push abre PR técnico; somente o merge revisado desse PR publica.
- CI da aplicação: o caller encadeia a publicação com `needs` da CI própria;
  o called não substitui os testes do consumidor.
- Environment: opcional; quando informado, as regras vivem no consumidor.
- Permissões: o caller deve conceder as permissões exigidas pelo called;
  o called não pode elevar o token recebido. Escrita fica na publicação.
- Referências: usar SHA revisado nos calleds, não uma branch mutável.
- Proteção contra merge/push indevido: configurar rulesets e required checks
  no consumidor. Os scripts não configuram essas proteções automaticamente.

O exemplo Go mantém a CI em um arquivo reutilizável separado. Sua consolidação
fica para a adoção no piloto; este README não altera o `boilerplate-cli`.

## Documentação oficial

- [Sintaxe de etapas run](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun).
- [Reutilização de workflows e permissões](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
- [Detalhamento dos scripts, dados, testes e diagnóstico](../../scripts/versioning/README.md).
