# Agent instructions

## Spec-driven development

Use the `tlc-spec-driven` skill for feature specification, design, task
breakdown, implementation, and validation in this repository.

Install the pinned skill globally for OpenAI Codex with Node.js 24 or newer:

```powershell
npx --yes @tech-leads-club/agent-skills@1.4.10 install `
  --skill tlc-spec-driven `
  --agent codex `
  --global
```

Restart the Codex session after installation so the skill is discovered.

Do not treat the skill's structural validators as the sole evidence that a
change is correct. Run the repository's real tests and require an independent
review before delivery.

Existing OpenSpec artifacts are historical input during the migration to
`.specs/`. Preserve them until the equivalent TLC specification has been
reviewed and validated.
