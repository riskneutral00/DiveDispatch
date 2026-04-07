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

## Execution Prompts

Each `.md` file (except this README) is a self-contained execution brief for an `/ultraplan` session.

- `minimalist-input-migration.md` — Underline floating-label inputs replacing glass containers (approved 2026-04-07)
