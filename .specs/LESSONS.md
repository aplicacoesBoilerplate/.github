# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test every allowed association cardinality explicitly, including zero and multiple matches.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: M4 (versioning)
- last seen: 2026-10-01T11:14:19Z

### L-002 - Assert every release identity field independently during reconcile-before-write tests.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: M5 (versioning)
- last seen: 2026-10-01T11:14:20Z

### L-003 - Assert complete diagnostic payloads on blocked decisions, not only on authorized decisions.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: M6 (versioning)
- last seen: 2026-10-01T11:14:20Z

### L-004 - Assert rejected authorization evidence preserves the attempted actor and effective role.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: VER-03.3 (versioning)
- last seen: 2026-10-01T11:14:21Z

### L-005 - Inject failures independently at each external evidence endpoint after prior collection succeeds.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: VER-03.8 (versioning)
- last seen: 2026-10-01T11:14:22Z

### L-006 - Assert rejection diagnostics together with nonzero status and no-execution evidence.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: VER-01.5 (versioning)
- last seen: 2026-10-01T11:14:22Z

### L-007 - Keep pull-request review identity separate from integrated merge identity and test distinct head and merge SHAs in publication fixtures
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `versioning` · harmful: 0
- features: centralized-versioning-pipeline
- evidence: validation.md:F1; scripts/versioning/release-policy.mjs:47 (versioning)
- last seen: 2026-10-03T18:36:21Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
