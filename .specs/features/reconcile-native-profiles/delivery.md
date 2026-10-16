# Relatório da conciliação dos perfis nativos

## Realização

Implementação local aprovada na revisão independente rodada2. G1 foi resolvido:
bootstrap real passou2 replays e4 rejeições; sensor agregado7/7 sem sobreviventes.
O [relatório independente](validation.md) registra provas e o incidente de isolamento npm.
O PR12 preserva seu
fluxo técnico Node e ganha coleta Maven verificável, registro modular e
separação entre cálculo somente leitura e publicação. Os resultados por tarefa
estão em [evidence.md](evidence.md); push e CI hospedada serão registrados após
a revisão. Nenhum piloto foi alterado e nenhuma Release foi criada.

## Fontes modificados

- `.github/workflows/README.md`
- `.github/workflows/ci.yml`
- `.github/workflows/version-preview.yml`
- `.github/workflows/version-publish.yml`
- `.specs/LESSONS.md`
- `.specs/STATE.md`
- `.specs/features/reconcile-native-profiles/delivery.md`
- `.specs/features/reconcile-native-profiles/design.md`
- `.specs/features/reconcile-native-profiles/evidence.md`
- `.specs/features/reconcile-native-profiles/pr13-compatibility.md`
- `.specs/features/reconcile-native-profiles/spec.md`
- `.specs/features/reconcile-native-profiles/tasks.md`
- `.specs/features/reconcile-native-profiles/validation-round-1.md`
- `.specs/features/reconcile-native-profiles/validation.md`
- `.specs/lessons.json`
- `README.md`
- `docs/versioning-jgitver.md`
- `docs/versioning-standard-version.md`
- `docs/versioning.md`
- `examples/callers/go/.github/workflows/go-publish.yml`
- `examples/callers/jgitver/.github/workflows/maven-ci.yml`
- `examples/callers/jgitver/.github/workflows/maven-publish.yml`
- `examples/callers/jgitver/README.md`
- `examples/callers/standard-version/.github/workflows/node-publish.yml`
- `examples/callers/standard-version/README.md`
- `scripts/versioning/README.md`
- `scripts/versioning/adapter-registry.mjs`
- `scripts/versioning/adapters/go-gitsemver.mjs`
- `scripts/versioning/adapters/jgitver.mjs`
- `scripts/versioning/adapters/standard-version.mjs`
- `scripts/versioning/collect-version-report.mjs`
- `scripts/versioning/collect-version-report.sh`
- `scripts/versioning/git-inputs.mjs`
- `scripts/versioning/homologation-guide.mjs`
- `scripts/versioning/install-maven.sh`
- `scripts/versioning/java-properties.mjs`
- `scripts/versioning/paths.sh`
- `scripts/versioning/prepare-publication.sh`
- `scripts/versioning/prepare-version-pr.sh`
- `scripts/versioning/process-runner.mjs`
- `scripts/versioning/publish.sh`
- `scripts/versioning/release-gates.sh`
- `scripts/versioning/validate-version-pr.sh`
- `scripts/versioning/version-bundle.mjs`
- `scripts/versioning/version-pr.mjs`
- `scripts/versioning/version-report.mjs`
- `tests/versioning/adapter-registry.mjs`
- `tests/versioning/adapter-report.mjs`
- `tests/versioning/annotated-publish.mjs`
- `tests/versioning/collect-version-report.mjs`
- `tests/versioning/git-inputs.mjs`
- `tests/versioning/go-adapter.mjs`
- `tests/versioning/java-properties.mjs`
- `tests/versioning/jgitver-adapter.mjs`
- `tests/versioning/jgitver-report.mjs`
- `tests/versioning/maven-setup.mjs`
- `tests/versioning/native-workflows.mjs`
- `tests/versioning/process-runner.mjs`
- `tests/versioning/real-jgitver-prefix.mjs`
- `tests/versioning/real-jgitver.mjs`
- `tests/versioning/real-maven-reactor.mjs`
- `tests/versioning/real-standard-bootstrap.mjs`
- `tests/versioning/real-standard-version.mjs`
- `tests/versioning/reconciled-report.mjs`
- `tests/versioning/run.mjs`
- `tests/versioning/standard-adapter.mjs`
- `tests/versioning/standard-flow.mjs`
- `tests/versioning/standard-precomputed.mjs`
- `tests/versioning/version-bundle.mjs`
- `tests/versioning/version-pr.mjs`
- `tests/versioning/version-report.mjs`
- `tests/versioning/workflow-contract.mjs`

## p/ teste

1. Consulte o [PR12](https://github.com/aplicacoesBoilerplate/.github/pull/12)
   e confirme o SHA entregue e os checks da execução correspondente.
2. Nos testes locais, rode `node tests/versioning/run.mjs --local`. Eles
   simulam o GitHub e não publicam nada de verdade.
3. Consulte os guias [Maven](../../../docs/versioning-jgitver.md) e
   [Node](../../../docs/versioning-standard-version.md) para preparar um
   ensaio autorizado com a configuração da sua aplicação.
4. Em uma solicitação para develop, confira guia com versão/SHA, alterações
   e verificações pendentes, sem tag ou publicação.
5. Na entrega para master, teste milestone ausente, coincidente, inválida
   e divergente. Uma divergência só passa com as duas autorizações previstas.
6. Para Maven, confira versão comum aos módulos e tag anotada no commit
   integrado. Para Node, confira primeiro o PR de arquivos de versão; só a
   integração revisada desse PR deve publicar no commit que contém esses arquivos.
7. Reexecute a publicação: deve conservar a mesma tag/Release, sem duplicação.
   Conflito de SHA, revisão antiga ou origem desatualizada deve bloquear.
8. Não execute os scripts de publicação manualmente com credenciais reais
   para aprender seu funcionamento. O ensaio remoto dos pilotos ainda é outra etapa.

## O que há de novo

A mesma pipeline atende Go, Java/Maven e Node com cálculo nativo, evidência
auditável e publicação sem executar ferramentas da aplicação com token de escrita.
