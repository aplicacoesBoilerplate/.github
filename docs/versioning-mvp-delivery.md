# Entrega do MVP de versionamento - issue #4

## Realização

Implementada a automação central de prévia, guia de homologação e publicação
Go com milestone opcional, override auditável, environment opcional e
reexecução idempotente. A aprovação permanece vinculada ao SHA do PR; a
publicação usa o SHA integrado. Verificação independente local aprovada:
43 critérios, sete casos de borda e cinco mutações detectadas, incluindo
hotfix criado a partir de master e publicado no SHA do merge real.

Esta entrega segue por `codex/issue-4-versioning-mvp` diretamente para
`master` do repositório `aplicacoesBoilerplate/.github`. Não integra nem
modifica `boilerplate-cli`. Não cria release ou faz merge automaticamente.

Publicação remota em 2026-10-03: branch enviada e SHA remoto conferido.
A criação do PR foi negada pela restrição OAuth da organização na CLI e
por falta de permissão de escrita no conector GitHub. Não há PR criado;
o usuário precisa autorizar acesso ou abrir a comparação com destino `master`.

Extensão hotfix concluída e verificada em 2026-10-04 (T25/T26): nove fixtures
locais, adaptador Go real e 18 arquivos YAML aprovados. O exemplo aponta para
`07bd5372f7fc4a34a1b04134a84a0b9f4aba3b45`, com os mesmos gates para
`develop -> master` e `hotfix/<nome> -> master`. Evidência hospedada continua
pendente; o piloto e seu job go-ci não foram alterados.

## Fontes modificados

- `.github/workflows/ci.yml`
- `.github/workflows/version-preview.yml`
- `.github/workflows/version-publish.yml`
- `.specs/LESSONS.md`
- `.specs/STATE.md`
- `.specs/features/centralized-versioning-pipeline/context.md`
- `.specs/features/centralized-versioning-pipeline/design.md`
- `.specs/features/centralized-versioning-pipeline/spec.md`
- `.specs/features/centralized-versioning-pipeline/tasks.md`
- `.specs/features/centralized-versioning-pipeline/validation.md`
- `.specs/lessons.json`
- `AGENTS.md`
- `docs/versioning.md`
- `docs/versioning-mvp-delivery.md`
- `examples/callers/go/.github/workflows/go-publish.yml`
- `examples/callers/go/README.md`
- `scripts/versioning/collect-pr-policy.sh`
- `scripts/versioning/collect-version-report.sh`
- `scripts/versioning/homologation-guide.mjs`
- `scripts/versioning/preview.sh`
- `scripts/versioning/publish.sh`
- `scripts/versioning/release-gates.sh`
- `scripts/versioning/release-policy.mjs`
- `scripts/versioning/version-report.mjs`
- `tests/versioning/go-version.mjs`
- `tests/versioning/homologation-guide.mjs`
- `tests/versioning/post-merge.mjs`
- `tests/versioning/pr-check.mjs`
- `tests/versioning/pr-policy.mjs`
- `tests/versioning/real-go-gitsemver.mjs`
- `tests/versioning/release-policy.mjs`
- `tests/versioning/run.mjs`
- `tests/versioning/runner-self-test.mjs`
- `tests/versioning/version-report.mjs`
- `tests/versioning/workflow-contract.mjs`

## p/ teste

1. No PR desta entrega, conferir os checks da CI central, especialmente
   `Validate centralized versioning`; o PR não deve publicar uma aplicação.
2. Para repetir os testes locais, executar `node tests/versioning/run.mjs
   --local` com Git Bash no PATH no Windows. As fixtures usam repositórios
   temporários e simulação da API, sem publicar no GitHub.
3. Com Go e a revisão fixada do adaptador instalados, executar
   `node tests/versioning/run.mjs --real-go`.
4. Conferir `validation.md`: merge com SHAs distintos, aprovação antiga
   bloqueada, publicação no SHA integrado e dez repetições sem novas escritas.
5. Aguardar autorização antes de instalar o caller ou criar PRs de ensaio no
   `boilerplate-cli`; a integração hospedada do consumidor ainda não foi feita.

## O que há de novo

Uma aplicação Go poderá reutilizar as mesmas regras de versão, planejamento
e publicação, com um guia para homologação e sem duplicar a lógica no caller.

## Limites deste MVP

PRs `develop -> master` e `hotfix/<nome> -> master` são as únicas transições
finais permitidas. A extensão hotfix solicitada em 2026-10-04 aplica todas
as mesmas regras de cálculo, milestone, override, CI, environment, SHA e
idempotência; não força PATCH nem autoriza origens genéricas.

O caller já declara seus três jobs em um workflow. A CI Go é reutilizada de
um segundo arquivo; pode ser inline em futura adoção mantendo dependências
e permissões. Nenhuma consolidação adicional foi realizada nesta entrega.
