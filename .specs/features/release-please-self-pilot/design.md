# Piloto interno do Release Please: desenho local

**Spec:** `spec.md`  
**Status:** Implementação aprovada; teste hospedado autorizado.  
**Limite:** push da branch de teste e execução no Actions permitidos; nenhum merge, PR de release, secret, tag ou Release nesta etapa.

## Architecture Overview

O próprio repositório terá um caller de teste reutilizando a CI. No runner hospedado, o teste lê o contrato do workflow central existente e executa o orquestrador e o SDK real, com entradas simuladas. O novo tipo `simple` seleciona a estratégia oficial do Release Please. O orquestrador TS continua produzindo configuração, mas o workflow passa a entregar seus valores à Action por entradas oficiais, em vez de presumir que ela lerá um arquivo apenas gerado no workspace.

Nesta entrega, `push` na branch de teste -> caller de teste -> CI reutilizável no mesmo commit -> teste TS -> contrato do called + SDK real sem rede. Não existe job de publicação no caller de teste. O ciclo abaixo é o roteiro posterior, não uma prova já executada. Um workflow novo com `workflow_dispatch` precisa existir na default branch; por isso a primeira execução usa `push` restrito à branch de teste, sem exigir merge em master.

O motor de cálculo, preparação do PR e publicação continua sendo o Release Please. O orquestrador mantém a validação de milestone do primeiro momento. Guardas avançadas de governança ficam para versão futura. Não será criada uma CLI distribuída nem um algoritmo concorrente de versionamento.

```text
PR integrado em master
  -> CI local/reutilizável no SHA integrado
  -> caller interno -> mesmo called central
  -> validar milestone do PR funcional e preparar parâmetros
  -> Action Release Please
  -> PR de release aguardando revisão humana
  -> merge humano -> CI -> reconhecer PR técnico sem revalidar milestone
  -> Action -> tag e GitHub Release da versão preparada
```

No modo `simple`, o fluxo termina na GitHub Release. Os blocos de publicação npm, Maven e Go continuam exclusivos dos seus tipos atuais.

A milestone é obrigatória na entrega funcional que alimenta a preparação do PR de release. No merge desse PR técnico, não se repete a validação nem a extração da milestone. A segunda etapa conclui a mesma entrega; ela não autoriza entregas funcionais sem milestone. Essa distinção foi confirmada pelo usuário e não permanece como default pendente.

## Approaches

| Abordagem | Trade-off | Resultado |
| --- | --- | --- |
| Estratégia simple e caller consumindo o called atual | Exige version.txt, mas dispensa registry e pacote artificial | Proposta selecionada para o piloto |
| Reclassificar o repositório como pacote Node | Requer metadados de pacote e separar publicação; mistura tooling com produto | Não selecionada |
| Criar outro workflow com lógica duplicada | Facilita um experimento isolado, mas não comprova o contrato central | Não selecionada |

## Code Reuse Analysis

| Componente | Reuso |
| --- | --- |
| `ci-scripts/scripts/release-orchestrator.ts` | Manter classes/factory existentes; acrescentar simple e saída explícita dos parâmetros. |
| `.github/workflows/version-release-please-called.yml` | Corrigir caminhos e binding, preservar os tipos existentes e acrescentar as guardas do piloto. |
| `.github/workflows/ci.yml` | Reutilizar os testes e acrescentar checagem de tipos; permitir workflow_call para o caller aguardar CI. |
| `ci-scripts/tests/release-please.test.ts` | Preservar as asserções dos sete testes atuais e ampliar os cenários do gerador. |
| `docs/pipelines/versionamento-release-please.md` | Acrescentar o piloto e distinguir configuração local de parâmetros efetivos da Action. |

## Components

| Componente | Responsabilidade e contrato |
| --- | --- |
| Orquestrador | Selecionar estratégia e versão; gerar JSON para inspeção e valores de saída para os inputs oficiais da Action. |
| Called central | Instalar dependências travadas no checkout correto, executar TS e fornecer release-type/release-as à Action. Aceitar um central-ref explícito para fixar o checkout dos scripts. |
| Caller de teste hospedado | Acionar push apenas na branch de teste e chamar a CI por referência local, no mesmo commit, com contents:read e sem secrets herdados. Não chamar o job de publicação. |
| Testes de contrato | Analisar YAML estruturado e reproduzir o checkout; não confundir presença textual com execução de uma etapa. |
| Roteiro | Descrever pré-requisitos e registrar a execução remota como pendente até haver autorização e evidência. |

## Error Handling Strategy

| Situação | Comportamento |
| --- | --- |
| Milestone inválida ou ausente no PR funcional | Falhar antes da Action que prepararia o PR de release. |
| PR técnico de release sem milestone no segundo momento | Concluir a versão já preparada sem revalidar milestone; manter CI, revisão e demais guardas. |
| Prefixo de branch imitando o robô | Não dispensar milestone sem identificação verificável do PR de release. |
| Disputa de versões, conclusão e fechamento de milestones | Guardas adicionais adiadas para evolução de governança; não criar writer próprio nem mover tags no MVP. |
| Permissão negada, rate limit ou falha externa | Expor causa e contexto sem sucesso artificial e sem retry ilimitado. |

## Risks & Concerns

| Concern | Location (file:line na base) | Impact | Mitigation |
| --- | --- | --- | --- |
| Caminho do script incompatível com checkout | `.github/workflows/version-release-please-called.yml:38` | O fluxo falha antes da Action | Teste executando o mesmo entrypoint no layout real. |
| Caller com referência incompleta | `.github/workflows/examples/version-release-please-caller.yml:13` | O workflow reutilizável não é encontrado | Resolver a referência contra os arquivos do repositório. |
| JSON local ignorado pelo manifest-mode remoto | `.github/workflows/version-release-please-called.yml:54` | A versão planejada não chega ao motor | Usar os inputs oficiais release-type/release-as e testar seu binding. |
| Dispensa por prefixo de branch | `ci-scripts/scripts/release-orchestrator.ts:75` | Prefixo sozinho não comprova autoria | Piloto controlado com PR técnico do motor real; hardening adicional fica explicitamente pendente. |
| Teste apenas textual | `ci-scripts/tests/release-please.test.ts:87` | Verde sem comprovar o contrato executável | Manter teste existente e acrescentar contrato estruturado e subprocesso real. |
| Segundo checkout resolvendo master novamente | `.github/workflows/version-release-please-called.yml:24` | Scripts executados podem divergir do workflow e da CI revisados | Fixar central-ref no SHA do piloto e testar a consistência entre workflow, checkout e CI. |
| Dois planos de versão simultâneos | Evolução de governança | Podem disputar a versão planejada | Fora do MVP por decisão do usuário; não declarar esse risco eliminado. |
| CI do PR automatizado pode aguardar aprovação | Configuração externa do GitHub | PR fica sem CI concluída | Roteiro humano; nenhuma dispensa automática. |

## Tech Decisions

- A integração nativa usa `googleapis/release-please-action@v4`; não instala um segundo motor em produção.
- `release-type` e `release-as` são entradas oficiais; o arquivo JSON gerado continua útil como evidência local, não como canal presumido de configuração remota.
- Uma biblioteca YAML, se necessária para os contratos, fica somente no tooling de testes e presa no lockfile. Não escrever um parser YAML próprio.
- Nenhum secret é necessário para a suíte local. As entradas dos callers e o evento de merge são simulados; os parâmetros e o motor real são exercitados localmente. A escrita real só acontece no fluxo remoto autorizado.
- O called aceita central-ref; o teste verifica seu binding no checkout central. O novo input é aditivo; callers existentes que não o informam mantêm o comportamento anterior, que não é declarado imutável por este piloto. No futuro piloto de publicação, a referência local e central-ref devem usar o mesmo SHA. Futuros consumidores externos devem usar o mesmo SHA revisado tanto em uses quanto em central-ref.
- Este piloto não valida a distribuição de pacotes nem compatibilidade entre repositórios. Esses resultados continuam pendentes para os próximos consumidores.

## Teste funcional identificado

Reaproveitar o teste de fluxo já existente em `ci-scripts/tests/release-please.test.ts`. Não criar um arquivo por helper ou adaptador. Preservar as asserções existentes e os sete testes da suíte atual.

O único fluxo funcional ampliado terá estas etapas:

1. Ler o caller e o called como YAML estruturado e reproduzir o checkout central dentro de um diretório consumidor temporário.
2. Simular as entradas do caller simple e do PR funcional com milestone; executar o entrypoint real do orquestrador e obter os parâmetros efetivos da Action.
3. Entregar os parâmetros à estratégia real Simple do Release Please; aplicar seus updaters no diretório temporário e conferir versão, conteúdo do changelog e proposta de PR.
4. Simular o merge do PR técnico, sem milestone; executar o segundo momento do orquestrador e usar buildReleases do motor real para conferir versão, notas e SHA alvo.
5. No mesmo fluxo, exercitar somente negativos essenciais: milestone ausente ou inválida na entrega funcional, tipo não suportado e caminho de execução inválido. Nenhum registry ou chamada de escrita ao GitHub pode ser executado.

O cliente GitHub usado pelo motor terá fetch proibido. As entradas são fixtures, não uma simulação do cálculo de versão. Essa execução comprova o encadeamento local e a geração dos artefatos; não comprova permissões, eventos do Actions ou publicação hospedada.

API identificada e disponível em release-please 17.3.0: GitHub.create, Simple.buildReleasePullRequest e Simple.buildReleases. Os imports da estratégia são internos ao pacote e exigem versão exata no teste. A dependência é somente de desenvolvimento. O caller de teste hospedado executa esse mesmo teste no Ubuntu/Node 22, sem liberar acesso à rede ao cliente do motor nem credenciais de publicação aos subprocessos.
