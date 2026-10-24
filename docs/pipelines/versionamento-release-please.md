# Versionamento centralizado com Release Please

O caller pertence à aplicação. Ele aguarda a CI do commit integrado e chama o workflow central por SHA. O Release Please é o único motor de versão, changelog, PR técnico, tag e GitHub Release.

## Dois momentos

1. **Entrega funcional para master:** após merge humano e CI, o orquestrador exige milestone SemVer, inclusive para hotfix. No modo milestone, ela determina a versão desejada; no modo native, agrupa a entrega e cada componente mantém seu cálculo independente.
2. **PR técnico gerado pelo Release Please para master:** depois da revisão, CI e merge humano, o motor cria a tag e a GitHub Release. Não se exige outra milestone nem se reaplica o override da entrega funcional.

A branch de origem pode ser develop ou hotfix; o caller filtra o destino master. Fechar sem merge não publica. O fluxo atual identifica PR técnico pelo prefixo release-please da branch; isso não autentica o autor e é uma limitação de governança conhecida. Regras de milestone 100%, fechamento automático e conflitos ficam para outra etapa.

## Etapa 1 e etapa 2

Na etapa 1 os três consumidores usam **publish-artifacts: false**. Tag e GitHub Release são produzidas pelo motor; npm publish, mvn deploy e GoReleaser permanecem desligados mesmo quando uma Release é criada.

A etapa 2 cuidará da distribuição. Os publishers legados são opt-in e só atendem ao resultado single da Action; **publish-artifacts=true não é suportado para o SDK configurado nem para o manifest com vários componentes**. Este contrato não promete publicação de pacotes Maven/npm nem de binários Go.

## Contrato do called

| Entrada | Default | Uso |
| --- | --- | --- |
| project-type | obrigatório | node, go, maven, gradle ou simple |
| central-ref | master | Fixar o mesmo SHA completo usado no uses |
| publish-artifacts | false | Manter false nesta etapa |
| release-config-file | vazio | Config nativo versionado na aplicação; vazio usa single |
| release-manifest-file | .release-please-manifest.json | Seeds e estado nativo por caminho |
| version-policy | milestone | milestone para raiz única; native para versões independentes |

Config e manifest precisam existir no consumidor, permanecer dentro do repositório e informar versões SemVer para todos os componentes. Caminhos absolutos, traversal e symlinks para fora são rejeitados.

| Modo | Execução | Configuração efetiva |
| --- | --- | --- |
| Single sem config | Action oficial | release-type e release-as transitório pelos outputs TS |
| Manifest independente | Action oficial | config-file/manifest-file remotos, sem release-type nem override escalar |
| Raiz configurada + milestone | SDK oficial 17.3.0 | Manifest.fromManifest com override transitório, depois createReleases/reload/createPullRequests |

A Action v4 ignora config-file quando release-type é informado e não encaminha release-as no manifest-mode. Por isso a ponte TS existe apenas para a raiz configurada. Ela usa APIs públicas do mesmo motor, sem algoritmo próprio de incremento. O config do consumidor nunca é sobrescrito; o JSON de inspeção gerado no modo single não configura sozinho a Action.

## Caller na aplicação

Use o [único exemplo genérico](../../.github/workflows/examples/version-release-please-caller.yml) como orientação. A aplicação mantém seu próprio YAML e sua CI precisa aceitar workflow_call. Não é necessário copiar um exemplo central para cada linguagem.

O caller aceita pull_request closed para master. O job validate, com contents:read, executa a CI local reutilizável; release depende dele, exige merged=true e chama o called. Somente release recebe contents:write, pull-requests:write e issues:write. GITHUB_TOKEN é fornecido pelo GitHub; nenhum secret de registry precisa ser herdado na etapa 1.

Fixe **o mesmo SHA remoto revisado** no uses do called e em central-ref. Não combine um called fixado com scripts de master. O exemplo usa uma revisão publicada do contrato; os consumidores devem usar a revisão testada registrada na entrega. As referências locais do self-caller executam o commit integrado e usam central-ref=github.sha.

A administração do repositório/organização precisa permitir criação de PRs por Actions. Se o PR automatizado ficar aguardando aprovação da execução, use Approve workflows to run; não dispense a CI. Nenhuma política administrativa é modificada por este código.

## Três consumidores

- **PackagesJava:** uma versão para parent, BOM, core e starter. Config Maven com skip-snapshot=true; extra-files XML atualiza também a propriedade revision. O override vem da milestone e não fica gravado como release-as permanente.
- **PackagesVue:** cinco bibliotecas com versões independentes, componentes com nome completo e tags nome-do-pacote@versão. Plugin node-workspace atualiza ranges e lockfile. Docs privado participa como dependente, com skip-github-release e skip-changelog; raiz privada e ferramentas sem alteração de versão permanecem fora do manifest.
- **boilerplate-cli:** estratégia Go para changelog/tag/Release; CI Go existente preservada. A integração antiga go-gitsemver é aposentada. GoReleaser/configuração de empacotamento permanecem para a etapa 2.

Os seeds refletem as versões atuais; não se movem tags antigas nem se reduz a versão de componentes renomeados. As integrações entram nas branches release existentes, sem promover trabalho funcional a master.

## Execução dos scripts

O runner faz checkout da aplicação na raiz e do repositório central em .ci-scripts. Dentro desse segundo checkout, o projeto Node chama-se ci-scripts. Portanto .ci-scripts/ci-scripts é **pasta de checkout + pasta do projeto**, não uma recursão.

O passo run executa Node com o CLI do tsx instalado pelo lockfile e o entrypoint TypeScript central. Na produção, npm ci --omit=dev --ignore-scripts instala tsx, semver e release-please; o Node é configurado antes. Scripts de lifecycle não são executados nessa instalação.

Consulte o [README dos workflows](../../.github/workflows/README.md) e o [README dos scripts](../../ci-scripts/README.md) para os caminhos e responsabilidades.

## Teste funcional central

O arquivo ci-scripts/tests/release-please.test.ts mantém um fluxo funcional ampliado e os contratos existentes. A suíte integral tem sete casos superiores, sem skips. O fluxo lê os YAMLs reais, executa o orquestrador no layout declarado e utiliza o SDK real para Simple, Maven e workspace npm.

As fixtures verificam versão, changelog, PR/tag propostos, revision/pais Maven, versões independentes, dependente privado e lockfile. Somente dados/eventos e transporte GitHub são isolados; não se simula o cálculo. O cliente SDK não pode acessar a rede. O gate é:

```text
npm ci --ignore-scripts
npm ci --prefix ci-scripts --ignore-scripts
npm test --prefix ci-scripts
npm run typecheck --prefix ci-scripts
```

Esse teste executado no Actions comprova o contrato hospedado, **não** a criação real de PR/tag/Release dos consumidores. Cada aplicativo ainda precisa de seu ciclo após os merges humanos.

## Evidências e roteiro

O piloto interno neste próprio repositório já completou os dois momentos: [PR17 de entrega](https://github.com/aplicacoesBoilerplate/.github/pull/17), [PR18 técnico](https://github.com/aplicacoesBoilerplate/.github/pull/18) e [Release v0.0.1](https://github.com/aplicacoesBoilerplate/.github/releases/tag/v0.0.1), no SHA 564f1bba751ed605931beffa5e9fed00e42fec4c. A issue #4 permanece fechada por decisão do usuário.

Para cada consumidor, revisar o PR de integração, executar os gates da aplicação e seguir seu Git Flow até master. Uma entrega fix:/feat: com milestone deve produzir PR técnico. Conferir seus arquivos/versões e ausência de distribuição; integrar por decisão humana; conferir tag no SHA do merge, notas e GitHub Release. Registrar PRs, runs e SHAs. A entrega de configuração e a comprovação desses ciclos são estados distintos.

## Fontes oficiais

- [Action: seleção de modo e opções](https://github.com/googleapis/release-please-action/blob/5c625bfb5d1ff62eadeeb3772007f7f66fdcf071/src/index.ts).
- [Manifest e API pública do SDK](https://github.com/googleapis/release-please/blob/891bcf6253b390e39df9ff3e1c059a836bd39c98/src/manifest.ts).
- [Estratégia Maven](https://github.com/googleapis/release-please/blob/891bcf6253b390e39df9ff3e1c059a836bd39c98/src/strategies/maven.ts), [plugin node-workspace](https://github.com/googleapis/release-please/blob/891bcf6253b390e39df9ff3e1c059a836bd39c98/src/plugins/node-workspace.ts).
- [Workflows reutilizáveis](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), [execuções originadas de outro workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).
