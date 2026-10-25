# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Ao reutilizar CI de PR no fluxo pós-merge, valide merge_commit_sha e teste a seleção do SHA nos dois contextos de evento.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `workflows` · harmful: 0
- features: release-please-consumer-pilots-stage1
- evidence: validation.md:F-SHA; Go/.github/workflows/ci.yml:19; Go/tests/versioning/test_caller.py:76 (workflows)
- last seen: 2026-10-24T06:57:17Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
