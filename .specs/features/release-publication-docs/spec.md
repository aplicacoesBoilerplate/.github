# Release publication documentation specification

## Problem Statement
A documentação precisa explicar o contrato central, os artefatos distribuídos e callers completos, incluindo Gradle sem prometer uma estratégia inexistente, além de instruções manuais de quality gates e diagnóstico de conexão.

## Goals
- Três páginas principais com responsabilidades, fluxo, configuração e exemplos de node, maven, gradle, go e simple.
- Callers de consumidor e manifests coerentes com a implementação local aprovada do PR #19.
- Guia manual para master e diagnóstico sem exposição de credenciais.

## Acceptance Criteria
- AC-1: WHEN a reader opens the section, THE docs SHALL expose artifact, central-pipeline and caller pages and preserve the existing deep dives.
- AC-2: WHEN selecting an adapter, THE examples SHALL show its consumer prerequisites, immutable release checkout and publication permissions, or explicit no-publication behavior for simple.
- AC-3: WHEN selecting Gradle, THE docs SHALL use simple plus a generic gradle.properties updater and a consumer publication job, without claiming native release-type gradle.
- AC-4: WHEN configuring quality gates, THE guide SHALL use actual check names and distinguish a required check from conditional work, with no automatic bypass for a release branch name.
- AC-5: WHEN diagnosing connection, THE guide SHALL distinguish DNS, transport, authentication and authorization without printing the PAT.

## Scope
Documentation, example configurations and validation only. No central runtime changes, no branch-settings writes and no package or release publication. Existing authorization to update PR #19 is preserved; network/auth availability still gates remote delivery.

## Validation
Build VitePress; parse YAML/JSON examples; exercise Gradle updater with the pinned SDK and inspect native candidate files; independent review of source/example parity. No permanent test files are added for this documentation change.


## Out of Scope
Central runtime changes, new permanent tests, branch-settings writes, real registry uploads, release creation and pushing artificial snapshot history.

## Assumptions & Open Questions
| Decision | Chosen default | Reason | Confirmed |
| --- | --- | --- | --- |
| Structure | Three main pages plus operational guides | User specified artifacts, central and callers | Yes |
| Gradle | simple + generic property updater and consumer publish job | SDK has no native gradle strategy | Stated technical choice |
| Gate exemption | Document only; existing CI still runs | No implementation approved for classifier/exemption yet | Explicit scope |
| Remote delivery | Existing PR #19 when connection works | User authorized same PR; no browser access | Yes |

## User Stories
As a consumer maintainer, I want complete adapter examples so that I can configure versioning, authentication and publication in my project.
As a repository administrator, I want exact gate instructions so that I can require CI without silently bypassing technical PRs.
As a developer, I want layer-specific connection diagnostics so that I do not replace credentials to fix DNS failures.

## Requirement Traceability
| Criterion | Evidence | Gate |
| --- | --- | --- |
| AC-1 | navigation, hub and five new pages | VitePress build + rendered HTML |
| AC-2 | consumers/node,maven,gradle,go,simple examples | YAML/JSON parsing + independent review |
| AC-3 | Gradle config and properties | Native pinned SDK candidate/updater exercise |
| AC-4 | quality-gates.md | Actual ruleset/check API read + independent review |
| AC-5 | conexao-github.md | Secret-free command inspection + observed DNS/transport diagnostics |
