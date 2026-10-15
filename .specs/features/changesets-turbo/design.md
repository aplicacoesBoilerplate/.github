# Design

Changesets status JSON is the release-plan source. The report retains `native.result.releases` and exposes normalized `releases` sorted by package name. The existing scalar report fields are a compatibility projection of the first release, used only by existing policy and homologation renderers; public scalar outputs are blank for a multi-package batch.

One technical PR carries the origin PR/SHA and plan digest. Its branch is `versioning/changesets/<origin-sha-prefix>`. `changeset version` updates all workspace manifests, dependency ranges and changelogs. npm refreshes the root lockfile. The technical PR validator compares all planned versions, changed-file scope and lockfile workspace entries before publication.

The package publisher preflights every tag and Release, then writes missing resources in deterministic order. Reexecution on the current branch may complete a partial batch; a stale push may only return `already-published` after the entire batch exists. Any conflict fails closed. Each package tag is `<package-name>@<version>`, matching Changesets convention. `releases_json` is the machine-readable output for downstream jobs.
