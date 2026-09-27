# Implementation Plan: Templates de issues e PRs

**Branch**: `feature/issue-4` → `master` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-templates-issues-prs/spec.md`

## Summary

Formulários por tipo e um template de PR com conteúdo padronizado; aplicar `type`, título e
labels quando suportados, sem fixar `projects` globalmente. Instruir preenchimento manual
dos metadados restantes e migrar pilotos sem perder o bug da CLI.

## Technical Context

**Language/Version**: Markdown e YAML de Issue Forms do GitHub

**Primary Dependencies**: GitHub Issue Forms e PR templates

**Storage**: arquivos versionados de templates; metadados de issues/PRs/Projects no GitHub

**Testing**: validação YAML/schema e formulário na UI, cinco tipos de issue e PR de exemplo,
verificação de pendências manuais e comparação com templates piloto

**Target Platform**: repositório organizacional `.github` e consumidores GitHub compatíveis

**Project Type**: catálogo de templates de colaboração com integração GitHub opcional

**Performance Goals**: preencher novo card de tipo conhecido em até 5 min

**Constraints**: forms suportam `type` e `projects` (este último exige permissão), mas não
criam parent/milestone/Issue Fields/valores de Project; não presumir Project/assignees globais

**Scale/Scope**: cinco categorias de issue e um PR; migração de dois templates piloto

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I/III: formatos reutilizáveis, distinguíveis e com apenas campos úteis; piloto específico
  da CLI fica identificado como exceção existente, sem forçar consumidores.
- II: formato, limitação e migração documentados, sem alteração silenciosa.
- IV: nenhum workflow com escrita nem credencial adicional nesta entrega.
- V: exemplo de consumo, cenários de UI e ausência de Projects no quickstart.

**Rechecagem pós-design**: separação entre metadados nativos e edição posterior explícita;
preservação de `issueCLI.yml` e migração de `issuePai.yml` previstas. Gates satisfeitos.

## Project Structure

### Documentation (this feature)

```text
specs/003-templates-issues-prs/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/templates.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/ISSUE_TEMPLATE/issueCLI.yml    # existente; manter compatibilidade
.github/ISSUE_TEMPLATE/issuePai.yml    # existente; migrar épica
.github/ISSUE_TEMPLATE/release.yml     # proposto
.github/ISSUE_TEMPLATE/feature.yml     # proposto
.github/ISSUE_TEMPLATE/task.yml        # proposto
.github/ISSUE_TEMPLATE/hotfix.yml      # proposto
.github/PULL_REQUEST_TEMPLATE.md       # proposto
docs/templates.md                      # proposto; consumo e limitações
```

**Structure Decision**: reusar `issuePai.yml` para épica corrigindo-o, não criar formulário
duplicado; manter `issueCLI.yml` como bug da CLI. Automação de Issue Fields fica fora desta
entrega porque workflows não são herdados e exigiriam contrato, permissão e adoção próprios.

## Complexity Tracking

Sem violações constitucionais identificadas.
