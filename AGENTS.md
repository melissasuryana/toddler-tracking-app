## Agent skills

### Writing agent docs

Use the `writing-for-agents` skill when editing this file, writing or editing skills, or any document an agent consumes.

### Issue tracker

Issues and specs: GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

When triaging, use the label vocabulary in `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: see `docs/agents/domain.md`.

### Packages

Deep modules: see [packages/README.md](./packages/README.md) before adding or importing one.

### Bounded decisions (Jev)

Use the `jev-agent` skill proactively for any bounded decision — a classification into known options, an ordered score, or a yes/no gate. Examples: triaging issue urgency, choosing which package a change belongs in, checking task completeness before reporting success, gating a risky command.

Repo-specific rules:

- State must never include secrets, API keys, or child health data.
- Calls cost OpenRouter credits; call only when the task needs the decision.

Git hooks: `pre-commit` (leftover/credential check) and `pre-push` (risk score + missing-tests check) run Jev gates via `.husky/jev-hook.mjs`. They fail open when unconfigured or offline; bypass with `JEV_HOOK=off` or `--no-verify`. Decisions logged to `.git/jev-hook.log`.
