# Release versioning validation

## Validation: PASS

- Date: 2026-10-24.
- Spec: `.specs/features/release-versioning/spec.md`.
- Diff: `29e47bc9aaa959aaad48910cb6efaf46fe135da7` plus current working-tree changes and new feature files. Final feature commit follows this report.
- Independent verifier: `verify_iteration`, author != verifier. Implementation files were read only.
- No GitHub writes, remote releases, registry publication or deployment were performed.

## Spec-anchored acceptance criteria

All 14 acceptance criteria match the specified outcomes. Runtime evidence uses tests of domain outcomes and the pinned official SDK. Documentation evidence uses source inspection and rendered output.

| Criterion | Expected outcome | File:line and assertion/evidence | Verdict |
| --- | --- | --- | --- |
| Declaration 1: milestone or Release-As | Resolve SemVer without requiring both | `ci-scripts/tests/release-version-policy.test.ts:6` asserts footer resolves to 0.0.2; line 9 asserts milestone normalization; `ci-scripts/tests/release-version-validator.test.ts:38` asserts version 0.0.2 and technical false without milestone | PASS |
| Declaration 2: conflicting sources | Reject disagreement | `ci-scripts/tests/release-version-policy.test.ts:26` and line 29 assert throws for milestone/footer and inter-commit conflicts | PASS |
| Declaration 3: duplicate tag from either origin | Reject new delivery before merge and publication | `ci-scripts/tests/release-version-validator.test.ts:29` iterates milestone/footer and merged/unmerged, asserting tag rejection; `ci-scripts/tests/manifest-release.test.ts:114` rejects a calculated SDK candidate with existing tag; line 125 rejects real SDK createRelease and line 126 asserts REMOTE_WRITE false | PASS |
| Declaration 4: legitimate technical retry | Preserve same-commit idempotence | `ci-scripts/tests/release-version-validator.test.ts:48` asserts technical true for legitimate tagged bot PR; `ci-scripts/tests/release-tag-guard.test.ts:25` accepts same SHA; line 22 rejects different SHA and line 29 checks annotated-tag mismatch | PASS |
| Declaration 5: API error or over 250 commits | Fail closed | `ci-scripts/tests/release-version-validator.test.ts:42` rejects HTTP 403; line 57 rejects 251 commits; `ci-scripts/tests/release-tag-guard.test.ts:32` rejects 403 at tag boundary | PASS |
| Projects 1: node at docs | Update docs JSON/lock without root package | `ci-scripts/tests/manifest-release.test.ts:35` asserts no root package update; lines 37, 40 and 41 assert docs package and both lock fields become 0.0.2 through real SDK updaters | PASS |
| Projects 2: omitted path | Use root | `ci-scripts/tests/release-please.test.ts:44` asserts packages['.'] for omitted PROJECT_PATH; `ci-scripts/tests/release-project-config.test.ts:6` preserves '.' | PASS |
| Projects 3: native config | Preserve adapters and independent versions | `ci-scripts/tests/release-project-config.test.ts:15` asserts node/maven entries and prefixes; `ci-scripts/tests/manifest-release.test.ts:56` and line 57 assert override only for a; line 64 checks actual SDK version 0.9.0; lines 140, 141 and 154 assert five package identities and distinct versions/tags | PASS |
| Projects 4: ambiguous scalar | Reject multiple targets | `ci-scripts/tests/release-version-validator.test.ts:87` rejects footer affecting two packages; `ci-scripts/tests/release-project-config.test.ts:45` rejects top-level release-as with multiple selected packages | PASS |
| Projects 5: component duplicate | Block matching namespace only | `ci-scripts/tests/release-version-validator.test.ts:91` accepts b when only a-v0.0.2 exists; line 96 rejects b-v0.0.2; line 109 checks package-config release-as | PASS |
| Projects 6: publish-artifacts false | Disable called publishers | `.github/workflows/version-release-please-called.yml:144`, line 153 and line 160 require publish-artifacts and legacy mode; `ci-scripts/tests/release-please.test.ts:127` asserts exact conditions for all three publishers | PASS |
| Documentation 1: practical guide | Cover artifacts, events, conflicts, required check, paths, manifest, publishing | `docs/pipelines/versionamento-release-please.md:25` explains required protection; `docs/pipelines/release-please/artefatos.md:5`, `docs/pipelines/release-please/versoes-conflitos.md:19`, `docs/pipelines/release-please/subdiretorios.md:3`, `docs/pipelines/release-please/monorepos.md:41`, `docs/pipelines/release-please/publicacao.md:19` cover other contracts; seven rendered pages inspected | PASS |
| Documentation 2: five copyable examples | Keep observed bases and independent identities | `docs/pipelines/release-please/monorepos.md:9` lists all paths and bases; `examples/versioning/packages-vue/.release-please-manifest.json:6` preserves vuetify 1.1.1 and other entries preserve 0.0.1; `ci-scripts/tests/manifest-release.test.ts:154` asserts five SDK tags; lines 186-189 assert workspace lock changes only released core version | PASS |
| Documentation 3: self caller | Update docs JSON/lock without recreating TXT | `ci-scripts/tests/manifest-release.test.ts:93` asserts no version.txt; lines 95-97 assert docs version fields; `.github/workflows/version-release-please-self-caller.yml:41` selects native config; `docs/.vitepress/config.mts:4` reads docs/package.json | PASS |

## Edge cases and runtime boundary review

- HTTP 403, same numeric version in distinct components, unsafe paths and a human branch named like the bot have direct assertions at `ci-scripts/tests/release-version-validator.test.ts:42`, line 91, `ci-scripts/tests/release-project-config.test.ts:11`, and `ci-scripts/tests/release-version-validator.test.ts:51`.
- Installed SDK 17.3.0 inspection confirmed the used Manifest.fromManifest path-filter position and string version outputs. createReleases can inspect other pending PRs; the final createRelease wrapper guards every actual write, including candidates beyond the event PR.
- Technical tag validation dereferences annotated tags and compares the final commit with the merged PR SHA. New deliveries do not receive this exemption.
- release-please and its transitive lock entries are production dependencies, retained by npm ci --omit=dev.
- Guides accurately limit supported bot labels, Gradle behavior, registry/build setup, required branch protection, migration examples and local-only delivery. No remote rollout is claimed.

## Gates and limits

- Independent `npm test` in ci-scripts: 59 passed, 0 failed, 0 skipped, exit 0.
- Independent `npm run typecheck`: exit 0. Both ran with local Node 24.19.0 and exact release-please 17.3.0.
- Reviewed base had 7 tests; final suite has 59 (+52). No tests were deleted or skipped; existing assertions changed for intentional native self-caller behavior.
- Author-run docs build: from validation-runtime, `node node_modules/vitepress/bin/vitepress.js build docs`, VitePress 1.6.4, exit 0. Independently inspected overview, releases and five topic HTML pages: snippets included, five package identities, vuetify 1.1.1 and node-workspace present.
- Independently compared all 23 docs/example source files with built runtime snapshot: byte-identical.
- Docs build used cached fallback dependencies, including Vue 3.5.43 versus lockfile 3.5.44. Exact-lock hosted Node 22 CI remains pending. This limits dependency/environment validation, not the observed SDK or documentation outcomes.
- Concurrent author gates encountered Windows allocation pressure; the independent final 59-test run and typecheck completed. Author serialized the test command afterward; this changes scheduling only.

## Discrimination sensor

The sensor copied scripts, selected tests, fixtures and dependencies into an OS temporary directory. Windows denied a junction; full copies were used instead. The isolated baseline passed all 25 selected tests.

| Mutation | Boundary | Observed outcome |
| --- | --- | --- |
| Accept tag from wrong commit by removing SHA comparison | `ci-scripts/scripts/CReleaseTagGuard.ts:21` | Killed: wrong-SHA technical, annotated-tag and actual publication-boundary tests failed |
| Drop validated package override | `ci-scripts/scripts/CManifestRelease.ts:22` | Killed: SDK override, self-caller, five-package and workspace tests failed |
| Allow top-level release-as across multiple selected packages | `ci-scripts/scripts/CReleaseProjectConfig.ts:54` | Killed: global-config ambiguity assertion failed |

Sensor: 3 injected, 3 killed, 0 survived. Temporary files were removed. Real-tree git status --porcelain was exactly equal before and after. No implementation files were changed by the verifier.

## Verdict

PASS for the local feature artifact: no remaining blocker or uncovered acceptance criterion. Branch protection, caller adoption, pinning the reviewed revision, exact-lock hosted CI and remote release/publication remain operational follow-up outside this local delivery. There are no surviving mutants or open validation gaps to distill into lessons.


## Integração no PR #19

A entrega foi conciliada com o head remoto `f8bba96496be87e4dc309698aa25525ef11ac630`, preservando os pilotos Maven e npm/workspaces já existentes. Os aliases `release-config-file`, `release-manifest-file` e a política `native` foram preservados; publicação de artefatos continua opt-in, com default false. O runtime manifest usa o SDK oficial com guardas de tags, incluindo o namespace scoped npm dos pilotos.

Validação da integração: npm test passou 61 casos em sete arquivos, sem skips; npm run typecheck passou. Dois casos adicionais verificam compatibilidade da política e PR técnico individual cujo corpo nativo omite o componente, resolvido pela branch oficial. Imports internos do SDK continuam presos a 17.3.0.

Dependências foram restauradas do cache local. O build VitePress 1.6.4 passou com o runtime de validação previamente registrado; o CI hospedado usa Node 22 e instala os lockfiles. Não houve publicação de pacote, criação de release, merge ou teste real de registry neste procedimento.

Revisão independente da conciliação encontrou e acompanhou correções de política inválida, identidade scoped em PR individual e paridade do preview. O relatório anterior permanece como evidência da implementação inicial.

Consulta da branch master em 2026-10-24 retornou protected=false, required_status_checks.enforcement_level=off e contexts/checks vazios; a lista de rulesets também estava vazia. A suíte roda automaticamente em PRs, mas o bloqueio obrigatório de merge depende de configuração administrativa de proteção da branch. Nenhuma proteção administrativa foi modificada.


Publicação pendente: o conector retornou HTTP 403 (Resource not accessible by integration) ao tentar criar o primeiro blob. Nenhum commit ou ref remoto foi alterado. O GitHub CLI local também não conseguiu autenticar/conectar. A integração está disponível em patch local para aplicar sobre o head do PR #19; os checks hospedados dessa atualização ainda não foram disparados.
