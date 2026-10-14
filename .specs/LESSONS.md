# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Revalide metadata de sessão antes de liberar resultados mesmo quando o arquivo local não mudou; ausência de refresh implica zero PUT, não zero consultas.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `llm/auth` · harmful: 0
- features: issue-9-llm-centralizado
- evidence: LLM-11; scripts/llm/persist-session.mjs:16; tests/llm/persistence.test.mjs:56 (llm/auth)
- last seen: 2026-10-13T23:56:54Z

### L-002 - Separe evidência de contratos offline de autenticação e recuperação reais, mantendo homologação pendente até executar o caller provisionado.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `llm/adoption` · harmful: 0
- features: issue-9-llm-centralizado
- evidence: LLM-24; .specs/features/issue-9-llm-centralizado/spec.md:109 (llm/adoption)
- last seen: 2026-10-13T23:56:54Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
