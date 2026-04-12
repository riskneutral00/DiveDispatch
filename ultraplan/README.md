# ultraplan/

Context folder for `/ultraplan` sessions. Contains execution prompts and symlinks to project infrastructure that the cloud session needs to read.

## How to use

1. Push this branch to GitHub
2. From your CLI, run: `/ultraplan <brief description> per ultraplan/<prompt-file>.md`
3. Review the plan in your browser, leave inline comments
4. Execute on web (auto-PR) or teleport back to terminal

## Symlinks

All symlinks point to live project files via relative paths. They auto-update — no manual sync needed.

| Link | Target | What |
|------|--------|------|
| `agents/` | `.claude/agents/` | Agent personas |
| `skills/` | `.claude/skills/` | Skill definitions |
| `hooks/` | `.claude/hooks/` | PostToolUse enforcement hooks |
| `rules/` | `.claude/rules/` | Design + code rules |
| `settings.json` | `.claude/settings.json` | Hook registry |
| `design-system/` | `design-system/` | MASTER.md + page overrides |
| `CLAUDE.md` | `CLAUDE.md` | Project invariants |

## Return-Path Convention (PR body template)

When the cloud `/ultraplan` session produces a PR, structure its description with these H2 sections so the local `.git/hooks/post-merge` (`scripts/vault-pr-scrape.sh`) routes findings into the vault automatically:

```markdown
## Summary
<what was done>

## Lessons
- <insight to carry forward — appended to Vaults/DiveDispatch/log.md>

## Findings
- <bug, gap, or concern uncovered — written to Vaults/DiveDispatch/raw/Failures/YYYY-MM-DD.md>

## Followups
- <deferred work — written to Vaults/DiveDispatch/wiki/Plans/<topic>-followups.md>

## Test plan
- ...
```

Only `## Lessons`, `## Findings`, `## Followups` are parsed. Other sections (Summary, Test plan) are ignored by the hook. The scrape runs on any merge (not just cloud PRs) — any PR author can use this to feed the vault.

## Execution Prompts

Each `.md` file (except this README) is a self-contained execution brief for an `/ultraplan` session.

- `minimalist-input-migration.md` — Underline floating-label inputs replacing glass containers (approved 2026-04-07)
- `background-first-surface-rollout.md` — Background-first container model: perimeter-only shells, background visible, glass reserved for active inputs (approved 2026-04-09)
- `gate-fix-preferences-frontend.md` — Fix 2 CRITICAL + 5 HIGH gate findings: test architecture + frontend components (approved 2026-04-07)
