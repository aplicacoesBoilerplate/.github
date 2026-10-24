# Versões, conflitos e tags duplicadas

## Versão explícita

No modo de projeto único, declare uma milestone como `v1.2.0` ou um footer fora de blocos de código:

```text
feat: adiciona exportação

Release-As: 1.2.0
```

A política central lê a milestone, o corpo do PR, **todos os commits do PR** e, depois do merge, a mensagem do commit de merge. `v1.2.0` e `1.2.0` representam a mesma versão. Todas as declarações encontradas precisam concordar. Um footer inválido não é ignorado porque existe uma milestone válida; exemplos dentro de blocos cercados por crases ou tils são ignorados.

São aceitas versões `X.Y.Z` e prereleases como `1.2.0-rc.1`. Zeros à esquerda e metadados `+build` não são aceitos pela política atual. Uma milestone com título descritivo, como `Sprint 12`, não serve como declaração de versão.

O footer no corpo do PR é uma funcionalidade da **política central**. O Release Please nativo lê footers de commits, não um corpo comum de PR como substituto automático. Ao depender do comportamento nativo, preserve `Release-As` na mensagem que chega à branch base, inclusive no squash merge. A validação central transmite a versão explícita validada ao motor no ciclo funcional.

## Regras em manifest

Sem milestone, footer ou `release-as` explícito, o SDK calcula a próxima versão de cada pacote a partir de seus Conventional Commits e histórico. Não é necessário inventar uma milestone global para um monorepo.

Uma milestone ou um `Release-As` escalar só pode selecionar **um** alvo:

| Situação | Resultado |
| --- | --- |
| Configuração tem um único pacote | A declaração vale para esse pacote. |
| `project-path` seleciona um pacote configurado | A declaração vale somente para ele. |
| Todos os pacotes selecionados, PR afeta um único pacote | A declaração vale para o pacote afetado. |
| PR afeta vários pacotes, ou não identifica um único alvo | Rejeitado como ambíguo; a versão nunca é distribuída a todos. |

Em configurações com vários pacotes, evite `release-as` no nível global: ele é rejeitado quando não há um único pacote selecionado. Para definir versões diferentes na mesma entrega, use `release-as` dentro de cada entrada de `packages`:

```json
{
  "include-component-in-tag": true,
  "packages": {
    "packages/utils": {
      "release-type": "node",
      "component": "utils",
      "release-as": "0.1.0"
    },
    "packages/ui/vuetify": {
      "release-type": "node",
      "component": "ui-vuetify",
      "release-as": "1.2.0"
    }
  }
}
```

Isso é uma configuração parcial ilustrativa: preserve os demais pacotes do seu arquivo real. Remova ou atualize esses overrides depois da release; um `release-as` persistido continua solicitando a mesma versão. Uma declaração do PR que divergir do override do pacote também falha.

## Proteção contra duplicidade

Para cada versão explícita, o validador consulta a **tag e a GitHub Release**, independentemente de a versão ter vindo de milestone, footer ou configuração. Uma tag existente já bloqueia a candidata, mesmo sem Release; uma Release existente também bloqueia. A consulta usa o namespace correto: `v1.2.0` na raiz ou, por exemplo, `ui-vuetify-v1.2.0` no componente.

Falhas de API, permissões insuficientes e respostas incompletas interrompem a validação. PRs com mais de 250 commits são rejeitados para evitar inspeção parcial. A detecção de arquivos de múltiplos pacotes também falha quando ultrapassa o limite consultável de arquivos.

O check antes do merge precisa ser obrigatório na proteção da branch. A revalidação após o merge e a execução serializada complementam esse check; não constituem uma reserva permanente de versão entre PRs abertos. No modo manifest, as candidatas calculadas pelo SDK também são verificadas contra as tags antes da criação do PR técnico. Antes de cada escrita real de release, a tag é verificada novamente.

## PR técnico e reexecução

A dispensa da declaração explícita exige, em conjunto: autor `github-actions[bot]` ou `release-please[bot]`, branch de release reconhecida, origem no mesmo repositório e label `autorelease: pending` ou `autorelease: tagged`. Apenas nomear uma branch `release-please` não basta.

O PR técnico segue o ciclo idempotente do motor. Uma tag existente só é aceita na reexecução técnica se apontar exatamente para o SHA do merge que está sendo publicado. Tags anotadas são resolvidas até o commit antes da comparação. Se a tag apontar para outro SHA, a publicação falha. O fluxo não apaga, sobrescreve nem move tags existentes para liberar uma versão: corrija a candidata ou investigue o estado da publicação.

Os nomes de bot e as labels acima são os padrões suportados. Personalizar labels de identificação do Release Please exige adaptar a política de reconhecimento antes de ativar esse fluxo.
