# ultraplan/

Local-file bridge for the `/ultraplan` browser session.

`/ultraplan` runs in a browser and cannot read local files. Everything it needs must be committed to this repo. `ultraplan/` is the staging folder: symlinks expose the live project context (skills, hooks, rules, agents, design system, root `CLAUDE.md`), and plans authored in opencode get dropped here manually before a browser run.

## How to use

1. (Optional) Drop the opencode-authored plan file into this folder as `<topic>.md`
2. Commit + push the branch
3. In the browser, start `/ultraplan <brief> per ultraplan/<plan-file>.md` — or omit the file reference if the symlinked context is all it needs
4. Review the plan, leave inline comments
5. Execute on web (auto-PR) or teleport back to terminal

## What's exposed (symlinks)

All relative paths — live-updating, no manual sync.

| Link | Target | What the browser session reads |
|------|--------|--------------------------------|
| `agents/` | `../.claude/agents/` | Agent personas |
| `skills/` | `../.claude/skills/` | Skill definitions |
| `hooks/` | `../.claude/hooks/` | PostToolUse enforcement hooks |
| `rules/` | `../.claude/rules/` | Path-scoped design + code rules |
| `settings.json` | `../.claude/settings.json` | Hook registry |
| `design-system/` | `../design-system/` | MASTER.md + page overrides |
| `CLAUDE.md` | `../CLAUDE.md` | Project invariants (points to vault — vault content is not in repo, so follow-pointers will dead-end in the browser) |

**Caveat on `CLAUDE.md`:** the root `CLAUDE.md` is minimal and routes most context to `Vaults/DiveDispatch/` which is not checked into the repo. A browser session cannot follow those pointers. When a brief depends on vault content, inline the relevant excerpt into the plan file rather than relying on `CLAUDE.md` alone.

## Return-Path Convention (PR body template)

When a browser-authored PR lands, `scripts/vault-pr-scrape.sh` (via `.git/hooks/post-merge`) routes structured sections into the vault. Structure the PR description with these H2s:

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

Only `## Lessons`, `## Findings`, `## Followups` are parsed. `Summary` and `Test plan` are ignored by the hook. The scrape runs on any merge (not just browser PRs) — any author can use this template to feed the vault.

## Briefs

- **Active briefs** (if any): top-level `*.md` files. Empty at rest is normal.
- **Archived briefs**: `archive/shipped/` (work that shipped), `archive/retired-theme-plans/` (ideas no longer pursued).
