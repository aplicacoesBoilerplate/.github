# Changesets/Turbo coordinated release

## Problem Statement

The active versioning collector and publisher handle one version/tag, while Changesets produces a coordinated multi-package release plan. Without a batch contract, independent callers can publish inconsistent dependencies and lockfiles.

## Goals

One consumer caller coordinates every package in an npm-workspaces/Turborepo release. Changesets supplies the release plan and writes manifests/changelogs; the central workflow opens a reviewed technical PR and publishes immutable package tags and GitHub Releases on its merge.

## Out of Scope

| Feature | Reason |
| --- | --- |
| npm registry publication | This central workflow publishes GitHub tags and Releases; package registry release requires a separate credential and provenance design. |
| pnpm and Yarn | The first coordinated profile has a verifiable npm lockfile contract. |
| `boilerplate-cli` modifications | The pilot is reference-only. |

## Assumptions & Open Questions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Workspace manager | npm with root `package-lock.json` | Lockfile can be validated with npm and CI. | y |
| Tag name | `<package>@<version>` | Matches Changesets native package tag convention. | y |
| Multi-package scalar outputs | Empty | An arbitrary package version is unsafe for downstream release jobs. | y |

**Open questions: none.**

## User Stories

### P1: Prepare and publish a coordinated Changesets batch

**User Story**: As a monorepo maintainer, I want one version plan and one reviewed version PR so related packages remain consistent.

**Acceptance Criteria**:

1. WHEN a monorepo preview runs, the collector SHALL use `changeset status --output` and SHALL preserve every release, including dependent packages, without calculating a replacement SemVer. (CST-01)
2. WHEN the functional merge passes gates, the publisher SHALL run `changeset version` once at repository root, update the npm lockfile, and open one technical PR containing the complete release plan. It SHALL create no tag on the functional SHA. (CST-02)
3. WHEN that PR is reviewed and merged, the publisher SHALL verify its origin, complete package versions, changelogs, lockfile and changed-file scope before writing package tags or Releases on the integrated SHA. (CST-03)
4. WHEN package tags and Releases are published, each package SHALL have its own immutable `name@version` tag. Reexecution SHALL reconcile an identical partial publication and reject a conflicting tag or Release without moving it. (CST-04)
5. WHEN a release contains multiple package versions, the called SHALL return `releases_json`; scalar `version`, `tag` and `release_url` SHALL be empty to avoid selecting an arbitrary package. `published_sha` SHALL identify the technical merge after complete publication. (CST-05)
6. WHEN copied to a consumer, the repository SHALL provide one npm-workspaces/Turborepo caller, dependency/configuration guidance, and a hosted CI gate for the real Changesets fixture. (CST-06)

## Requirement Traceability

| ID | Source | Status |
| --- | --- | --- |
| CST-01 | AC 1 | Verified |
| CST-02 | AC 2 | Pending |
| CST-03 | AC 3 | Pending |
| CST-04 | AC 4 | Pending |
| CST-05 | AC 5 | Pending |
| CST-06 | AC 6 | Pending |

## Implementation limits

- First Changesets profile supports npm workspaces with a committed root `package-lock.json`, Changesets CLI pinned by that lockfile, and stable package SemVer. pnpm/Yarn and npm registry publishing require later work.
- No Changesets package or pilot repository is modified by this central PR. Consumer example files are templates only.
- A milestone names a single version. For a multi-package batch with differing versions, the milestone is omitted; per-package versions are governed by Changesets and human review of the technical PR.
