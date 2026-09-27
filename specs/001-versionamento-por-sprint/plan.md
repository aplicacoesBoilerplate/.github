# Implementation Plan: Versionamento por sprint

**Branch**: `feature/issue-2` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-versionamento-por-sprint/spec.md`

## Summary

Corrigir o check de PR para diferenciar feature, entrada da release em develop e
integração homologada na principal; resumo/changelog provisório não bloqueia PR.
Depois do merge funcional, adaptadores Node preparam alterações de versão em PR
revisável e só publicam no commit versionado; Go/Java derivados de Git publicam
no SHA integrado. A publicação continua serializada e conserva tags existentes.
Decisões técnicas e riscos completos: [OpenSpec design](../../openspec/changes/corrigir-versionamento-pos-merge/design.md).

## Technical Context

**Language/Version**: YAML de GitHub Actions; comandos das ferramentas instaladas no consumidor

**Primary Dependencies**: GitHub Actions, GitHub Releases, Git, adaptadores `standard-version`,
Changesets/Turbo, `jgitver` e `go-gitsemver` conforme perfil do consumidor

**Storage**: Git tags/releases, PR de versionamento pós-merge e arquivos de versão/changelog do consumidor

**Testing**: validação de YAML/contratos e dos três PRs, ensaio hospedado dos quatro perfis,
simulação de concorrência/reexecução e build/testes próprios do consumidor. O laboratório é o
[LocalLabs](https://github.com/GersonTekSystem/LocalLabs).

**Target Platform**: GitHub Actions de repositórios autorizados a chamar workflows reutilizáveis

**Project Type**: automação compartilhada para repositórios GitHub

**Performance Goals**: check de PR em tempo compatível com revisão; publicação observa aprovação de PR de versão quando aplicável

**Constraints**: nenhum push na principal a partir de PR de feature; PR de versionamento somente após merge funcional; aprovação humana e proteção no consumidor; tags imutáveis; permissões mínimas; callers fixam revisão já existente

**Scale/Scope**: quatro perfis de consumidor; release por repositório e branch de destino

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I: coordenação e contratos comuns ficam aqui; exemplos de CI do consumidor são curtos.
- II: check de PR, preparação e publicação possuem entradas/saídas e revisões fixas documentadas;
  nenhum breaking change silencioso.
- IV: check de PR é somente leitura; PR de versão e release exigem token mínimo pós-merge; nada de secrets
  em código não confiável.
- V: quatro exemplos e cenários de falha/concorrência previstos para validação.

**Rechecagem pós-design**: contrato em `contracts/`, cenário em `quickstart.md`,
PR versionado sob revisão e impossibilidade de mover tags mantêm os gates satisfeitos.

## Project Structure

### Documentation (this feature)

```text
specs/001-versionamento-por-sprint/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/versioning.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/version-preview.yml   # check de PR, leitura
.github/workflows/version-publish.yml   # preparação pós-merge e publicação
scripts/versioning/                    # validações por fase, adaptadores, reconciliação
docs/versioning.md                     # contrato, migração e roteiro LocalLabs
```

**Structure Decision**: Os dois workflows e scripts já existem no compartilhado;
serão adaptados sem alterar templates de issue. Os exemplos e testes locais estão
no consumidor externo `GersonTekSystem/LocalLabs`; seu caller de publicação só
deve ser ativado após revisão fixa, proteção, ambiente e ensaio das prévias.

## Complexity Tracking

Sem violações constitucionais identificadas.
