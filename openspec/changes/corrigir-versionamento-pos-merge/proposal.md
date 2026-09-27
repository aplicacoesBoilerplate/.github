# Proposal

## Why

O workflow compartilhado atual exige prévia SemVer no PR e versão Node já alterada antes do merge, embora o contrato desejado seja homologar a release em `develop` e versionar exclusivamente depois da integração na branch principal. Os testes locais simulados não verificam esse percurso, nem os gates de PR de integração e as ferramentas reais no GitHub.

## What Changes

- **BREAKING**: substituir a prévia SemVer obrigatória por validação de PR conforme sua finalidade: feature → release exige sub-issue/milestone; release → develop exige épica encerrada e milestone concluída após a homologação breve; develop → branch principal exige a conclusão da homologação completa e revisão, sem exigir sub-issue de feature nos PRs de integração. Changelog provisório na homologação é opcional e nunca bloqueia o merge por indisponibilidade de geração.
- **BREAKING**: calcular e persistir a versão do consumidor somente depois do merge em `main`/`master` (branch principal configurada). Para ferramentas que alteram arquivos, propor commit versionado por PR de automação revisável após a integração; publicar tag e GitHub Release apenas quando o commit versionado estiver na branch principal. Para perfis derivados de Git, não inventar alteração de arquivo.
- Preservar a publicação conservadora: mesmo SHA e mesma versão permitem retomada, tag divergente nunca é movida; não confundir o `unset` dentro do subprocesso `prepare-release.sh` com perda do token de `publish.sh`.
- Documentar contrato de callers, gates, permissões e procedimento manual de homologação no LocalLabs por quatro perfis, com versões/tags distintas por rodada, testes reais hospedados e build/testes do consumidor em CI; manter testes locais focados em lógica e falhas.

## Capabilities

### New Capabilities

- `versionamento-por-sprint`: fluxo de validação de entregas/homologação e versionamento pós-merge com quatro adaptadores e publicação rastreável. O mesmo caminho está presente numa mudança anterior **ainda não sincronizada**; este delta representa o contrato corrigido e precisa ser reconciliado com `openspec/changes/versionamento-por-sprint` antes de sincronização/arquivamento.

### Modified Capabilities

Nenhuma: `openspec/specs/` ainda não contém uma capacidade registrada.

## Impact

- Workflows `.github/workflows/version-preview.yml` e `version-publish.yml`, scripts em `scripts/versioning/`, fixtures/testes de contrato e `docs/versioning.md`; a especificação de referência `specs/001-versionamento-por-sprint/` e o plano OpenSpec anterior apresentam requisitos conflitantes a conciliar.
- Callers consumidores e seu CI, proteções de branch, environment de homologação, permissões de escrita e credencial de automação para PRs de versionamento quando necessários. LocalLabs é laboratório descartável: a execução hospedada só começa após disponibilizar revisão fixa do compartilhado e as proteções/credenciais apropriadas.
