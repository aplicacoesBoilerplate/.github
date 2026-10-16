# Versionamento Maven com jgitver

O adaptador `jgitver` calcula uma versão comum para o reactor. O central usa
essa versão para homologação, milestone, tag anotada e GitHub Release. Ele não
publica os artefatos Maven: build e distribuição pertencem ao consumidor.

Leia também o [contrato comum](versioning.md), o
[mapa dos scripts](../scripts/versioning/README.md) e a
[especificação TLC](../.specs/features/reconcile-native-profiles/spec.md).

## Estado e limite desta entrega

A implementação foi conciliada no PR [#12](https://github.com/aplicacoesBoilerplate/.github/pull/12),
branch remota `codex/versioning-profiles`. O SHA de código usado nos exemplos é
`11fa3c699b3ade5396e4d59ceb3845de80980a35`. Consuma-o após confirmar sua presença no GitHub.
Validação local e CI central não substituem a homologação do consumidor.

PackagesJava não foi alterado. Seus parent, BOM, core e starter terão uma versão
única, conforme decisão do mantenedor. O fixture mínimo não certifica seus
POMs atuais, autenticação privada nem pacotes já existentes no registry.

## Pré-requisitos nativos do consumidor

No diretório indicado por `project_path`, mantenha `pom.xml` e
`.mvn/extensions.xml`:

```xml
<extensions>
  <extension>
    <groupId>fr.brouillard.oss</groupId>
    <artifactId>jgitver-maven-plugin</artifactId>
    <version>1.9.0</version>
  </extension>
</extensions>
```

Declare uma única extensão jgitver com essa versão literal. O central prepara
Node 24, Java 21 e Maven 3.9.9, baixado do Apache e verificado por SHA-512.
Go não é instalado quando `adapter: jgitver`; Java/Maven não são instalados
quando o adaptador é Go. Actions e revisão central são fixadas por SHA.

A extensão pertence ao projeto, pois deve funcionar também no Maven local.
O central executa Maven Help Plugin 3.5.1 em modo não recursivo para exportar
propriedades nativas. Não extrai a versão da última linha de stdout.
Ele fornece `jgitver.branch` para o checkout detached e compara versão usada,
versão calculada, SHA completo e versão da extensão.

Não use `jgitver.skip` nem `jgitver.use-version` para o cálculo governado.
Versões SNAPSHOT ou outros qualificadores são recusadas, não truncadas.
Credenciais de escrita e opções de injeção de runtime são retiradas do ambiente
do processo calculador. Isso não constitui sandbox para código Maven:
somente configurações revisadas devem chegar ao fluxo de publicação.

### Primeiro versionamento, sem tags de release

Antes de migrar, inventarie o registry. A ausência de tags não prova que a
coordenada `0.0.1` está disponível. Não sobrescreva pacotes existentes.

O perfil **temporário de bootstrap**, comprovado no fixture, fica em
`.mvn/jgitver.config.xml`:

```xml
<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">
  <strategy>PATTERN</strategy>
  <versionPattern>0.0.1</versionPattern>
  <tagVersionPattern>${v}</tagVersionPattern>
  <nonQualifierBranches>master</nonQualifierBranches>
</configuration>
```

O valor pertence à configuração nativa, não é fallback central. Sem release
anterior, o central aceita exclusivamente `0.0.1`; `0.0.0` é só base matemática.
Se esse perfil permanecer depois do bootstrap, novas mudanças continuarão
calculando `0.0.1`. Portanto, substitua-o na próxima entrega pelo perfil abaixo.
Não use `meta.NEXT_PATCH_VERSION` dentro de `versionPattern`: o experimento
mostrou que esse metadado ainda não existe nessa etapa de cálculo.

### Entregas seguintes

```xml
<configuration xmlns="http://jgitver.github.io/maven/configuration/1.1.0">
  <strategy>CONFIGURABLE</strategy>
  <autoIncrementPatch>true</autoIncrementPatch>
  <useCommitDistance>false</useCommitDistance>
  <useSnapshot>false</useSnapshot>
  <nonQualifierBranches>master</nonQualifierBranches>
</configuration>
```

Esse perfil produz `0.0.2` após uma mudança posterior à release anotada
`v0.0.1`. Reconstruir o SHA da tag retorna a mesma versão publicada.
Não traduz commits `feat` ou `fix` em bumps no central: o perfil acima tem
incremento PATCH nativo. Alterar estratégia exige repetir a prova
candidato/tag/rebuild antes de adotar a configuração.

Para preparar MINOR/MAJOR, o jgitver admite uma **tag leve de planejamento**,
como `1.0.0`, no checkpoint anterior às mudanças da próxima entrega. No fixture,
checkpoint `1.0.0` seguido de mudança produz `1.0.0`, e a release anotada
`v1.0.0` mantém essa versão na reconstrução. Criação de checkpoint é uma ação
deliberada do mantenedor, não ocorre automaticamente pela milestone.

O central separa essas referências pelo `tag_prefix` literal do caller (padrão `v`).
Somente tags estáveis alcançáveis nesse namespace formam a base de governança.
Um checkpoint leve sem o prefixo, como `1.0.0`, não altera essa base.
Assim, candidato `1.0.0` após release `v0.0.2` é MAJOR para a governança,
mesmo que a base nativa do jgitver indique o checkpoint `1.0.0`.
Não use `v1.0.0` para um checkpoint: o prefixo identifica release governada.
Tags existentes nunca são movidas nem convertidas silenciosamente.

## Caller: um workflow, responsabilidades distintas

Este exemplo integra CI, prévia e publicação no mesmo arquivo consumidor.
Os jobs continuam separados porque têm permissões e condições diferentes.
As opções do central não dependem de nomes de packages ou código da aplicação.
Adapte a CI aos testes reais e fixe também o runtime Maven do consumidor
(por exemplo, com Maven Wrapper revisado em 3.9.9).

```yaml
name: Versionamento Maven
on:
  pull_request:
    types: [opened, reopened, synchronize, edited, labeled, unlabeled, milestoned, demilestoned]
  pull_request_review:
    types: [submitted, dismissed]
  push:
    branches: [master]

jobs:
  maven-ci:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-java@c5195efecf7bdfc987ee8bae7a71cb8b11521c00
        with:
          distribution: temurin
          java-version: '21'
      - run: ./mvnw -B -ntp -Djgitver.branch=master -Djgitver.resolve-project-version=true verify

  validate-pr:
    if: github.event_name == 'pull_request' || github.event_name == 'pull_request_review'
    permissions:
      contents: read
      pull-requests: read
      issues: read
      checks: read
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-preview.yml@11fa3c699b3ade5396e4d59ceb3845de80980a35
    with:
      adapter: jgitver
      project_path: .
      target_branch: master

  publish:
    if: github.event_name == 'push' && github.ref_name == 'master'
    needs: maven-ci
    permissions:
      contents: write
      pull-requests: read
      issues: read
    uses: aplicacoesBoilerplate/.github/.github/workflows/version-publish.yml@11fa3c699b3ade5396e4d59ceb3845de80980a35
    with:
      adapter: jgitver
      project_path: .
      target_branch: master
      # publication_environment: production
```

O exemplo exige `mvnw` previamente configurado; não assume que PackagesJava já
o possui. Ajuste eventos/filtros às transições suportadas e registre os nomes
dos checks nas proteções de branch. Não use `pull_request_target` para executar
Maven de PR com token privilegiado. PRs externos e dependências privadas exigem
um desenho de permissões próprio, ainda não certificado por este fixture.

### O que acontece em cada etapa

1. PR para `develop`: calcular versão e gerar Markdown/JSON para homologação,
   a partir das propriedades nativas e de uma explicação explicitamente derivada.
2. PR `develop -> master` ou `hotfix/<nome> -> master`: mesma policy singular.
   Sem milestone, cálculo autoritativo; com milestone, validar versão e incremento.
3. Milestone inválida bloqueia sem override. Divergência válida exige label por
   Maintain/Admin e aprovação posterior, no SHA atual, de outra pessoa autorizada.
4. Merge gera `push` em master. CI consumidor aprovada precede o called.
5. Job de leitura calcula o relatório e captura referências Git. Environment,
   quando informado, funciona como aprovação adicional no consumidor.
6. Job de escrita recebe artifacts, confere SHA, referências e policy atual,
   sem executar Maven. Publica objeto de tag anotada, referência e uma Release.

Mudança de referências durante a espera exige repetir o cálculo. Só a adição
da própria tag no mesmo SHA é tolerada, para recuperar publicação parcial.
Go captura também heads/remotes, de forma conservadora; Maven e Node capturam tags.
Environment não substitui CI nem autorização do override.

## Build/deploy Maven depois da Release

Encadeie o job de distribuição com `needs: publish` no **mesmo workflow**.
Use `needs.publish.outputs.published_sha`, `version` e `tag`. Não dependa de
outro workflow `push: tags`: tags criadas com `GITHUB_TOKEN` não são um mecanismo
de encadeamento entre workflows.

O protocolo obrigatório antes de adicionar `deploy` ao piloto é:

1. Checkout `published_sha` com histórico completo, sem credenciais persistidas.
2. Fetch da tag retornada e conferir `git rev-parse refs/tags/<tag>^{commit}`
   igual ao SHA retornado. Não recalcular sobre master móvel.
3. Preparar Java21/Maven3.9.9. Executar a extensão nativa no mesmo SHA e branch,
   exportando propriedades para `runner.temp`. Conferir `used_version`,
   `calculated_version` e `git_sha1_full` contra os outputs centrais.
4. Produzir/inspecionar POMs de distribuição. Parent, BOM, core e starter,
   dependências internas e parents publicados devem apontar para a versão comum.
   Dependências externas, como Spring Boot, mantêm suas próprias versões.
5. Inventariar cada coordenada no destino e decidir a retomada antes de escrever.
   Somente então fornecer `packages: write` e autenticação ao deploy consumidor.
6. Rodar `./mvnw -B -ntp -Djgitver.branch=master
   -Djgitver.resolve-project-version=true deploy` no SHA conferido.
7. Testar importação do BOM e uso do starter em projeto externo com cache vazio,
   sem acesso ao reactor original. Guardar PR, SHA, versão, jobs e resultado.

O central não executa essa sequência de distribuição. Ela é o gate de integração
futuro, não um resultado comprovado no PackagesJava. A propriedade `revision`
literal atual deve ser revisada: atualizar `project.version` não prova que
dependencyManagement ou os POMs publicados foram corrigidos. O fixture usa
`${project.version}` nas referências internas e prova versões efetivas; os
POMs realmente distribuídos e consumidor externo ainda precisam de evidência.

GitHub Release e distribuição Maven têm estados distintos. Se o deploy falhar
depois de publicar parte do reactor, mantenha a Release/tag e registre quais
coordenadas existem. Não apague a release nem tente redeploy cego de versões
imutáveis. Retry da Release é idempotente; retry de quatro packages não é uma
transação atômica e depende do registry.

## Roteiro de homologação remota

| Cenário | Resultado esperado |
| --- | --- |
| Primeiro PR de entrega para develop | Guia com 0.0.1 comum; nenhuma tag/Release/package publicado. |
| PR final sem milestone | Cálculo nativo aceito; restantes gates obrigatórios. |
| Milestone com versão exata | `matched` com incremento correspondente. |
| Título inválido, mesmo com override | Check bloqueado. |
| Divergência válida sem duas autorizações | Check bloqueado. |
| Divergência com override auditável | `overridden`, preservando versão nativa. |
| Novo commit/review dismissed/metadado alterado | Reavaliar autorização atual. |
| CI vermelha | Sem publicação. |
| Environment ausente/presente | Publicação automática após gates/aguardar regras configuradas. |
| Hotfix criado de master para master | Mesmos gates, sem PATCH forçado. |
| Merge do bootstrap | Uma tag anotada v0.0.1 e uma Release no SHA integrado. |
| Nova mudança com CONFIGURABLE | PATCH nativo, mesma versão para quatro artefatos. |
| Checkpoint MINOR/MAJOR | Versão escolhida pelo nativo; base de governança ignora checkpoint leve sem v. |
| Reexecutar publicação no mesmo SHA | `already-published`, sem duplicação. |
| Tag criada, Release falhou | Retry cria só Release ausente. |
| Tag em outro SHA/ref alterada durante espera | Falha fechada, sem sobrescrita. |
| Checkout da tag e build | Mesma versão e SHA publicados. |
| Registry parcial ou versão já ocupada | Diagnóstico por coordenada; intervenção antes de retry. |
| Consumidor externo com cache vazio | BOM/starter resolvem os artefatos da entrega. |

Antes/depois de cada caso, registre branches, SHAs, tags, Releases, artifacts e
coordenadas no registry. Não fechar issues de negócio dos pilotos como efeito
da validação. Os primeiros testes remotos dependem de publicação do central
e autorização separada para alterar/distribuir o piloto.

## Gates locais e fontes

```bash
node tests/versioning/run.mjs --local
node tests/versioning/run.mjs --real-go
node tests/versioning/maven-setup.mjs
node tests/versioning/real-jgitver.mjs
node tests/versioning/real-maven-reactor.mjs
node tests/versioning/real-jgitver-prefix.mjs
```

Exigem Node24, Python3.12/PyYAML6.0.1, Git Bash no Windows, os runtimes nativos
e Go fixado conforme o [guia comum](versioning.md#verificação).
`maven-setup` exige Java disponível e rede para download Apache; é executado
separadamente na CI. `real-jgitver` precisa de Maven3.9.9/Java21 e rede/cache
de dependências; não usa GitHub Packages nem publica no GitHub.

Na CI, `versioning` roda fixtures, os três adaptadores reais, instalador/checksum e
reactor real. O gate local atualizado tem 118 assertions Maven, incluindo
dirty deliberado preservado e mudança somente em core. O guia Maven possui
`facts.nativeEvidence.properties` e `explanation.kind: derived`, com seções
distintas no Markdown. Go conserva o guia anterior. A
[evidência da conciliação](../.specs/features/reconcile-native-profiles/evidence.md)
registra os gates executados; a revisão independente é o gate final antes do envio.

Actionlint1.7.12 precisa do filtro específico para
`job.workflow_repository/workflow_sha`, desconhecidos por esse linter, mas
documentados no GitHub Cloud. Isso não substitui a validação hospedada.

- [Extensão e configuração jgitver](https://github.com/jgitver/jgitver-maven-plugin).
- [Estratégias e semântica das tags](https://jgitver.github.io/).
- [Reactor Maven](https://maven.apache.org/guides/mini/guide-multiple-modules.html).
- [Encadeamento e GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- [Contextos do job reutilizável](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts).
