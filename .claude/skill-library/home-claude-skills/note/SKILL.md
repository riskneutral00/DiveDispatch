---
name: note
description: "Three-tier in-session notepad: Priority (always injected), Working (7-day auto-prune), Manual (permanent). Lightweight scratchpad between vault sessions."
allowed-tools: Read, Write, Edit
user-invocable: true
---

# /note — Session Notepad

Lightweight scratchpad for in-session context. Three tiers with different retention policies. Sits between "remember in conversation" (lost on session end) and vault (heavy, end-of-session).

## When to Use

- Save context that should survive context compaction but isn't vault-worthy
- Track decisions, blockers, or findings during a long session
- User says `note`, `remember this`, `save for later`, `write that down`

## Tiers

| Tier | Retention | Use Case |
|------|-----------|----------|
| **Priority** | Always injected into context | Critical constraints, active blockers, must-not-forget |
| **Working** | 7-day auto-prune | Session findings, temporary decisions, in-progress state |
| **Manual** | Permanent until manually removed | Reference notes, stable decisions, recurring context |

## Usage

```
/note <text>                    → Add to Working tier (default)
/note --priority <text>         → Add to Priority tier
/note --manual <text>           → Add to Manual tier
/note --list                    → Show all notes by tier
/note --clear working           → Clear working tier
/note --clear all               → Clear everything
```

## Storage

Notes stored in `.claude/notepad.md`:

```markdown
## Priority
- {timestamp}: {note}

## Working
- {timestamp}: {note}

## Manual
- {timestamp}: {note}
```

## Auto-Prune

On each `/note` invocation, check Working tier entries. Remove any older than 7 days.

## Rules

- **Priority tier is small.** Max 5 entries. If adding a 6th, prompt which to remove.
- **Working tier auto-prunes.** Don't accumulate stale context.
- **Manual tier is permanent.** Only explicit `--clear` removes entries.
- **Not a vault replacement.** End-of-session observations still go to `/vault`.
- **Not a TODO list.** Use tasks for tracking work items.
