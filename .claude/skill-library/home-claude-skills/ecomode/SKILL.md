---
name: ecomode
description: "Token-saving modifier. Forces cheaper model tiers for all agent spawns. Combine with any execution mode."
allowed-tools: Read, Write
user-invocable: true
---

# /ecomode — Token-Efficient Execution

Modifier that forces cheaper model tiers for all agent work in the current session. Not standalone — combine with execution skills.

## When to Use

- Running low on context/tokens and want to conserve
- Task is straightforward and doesn't need Opus reasoning
- User says `ecomode`, `save tokens`, `cheap mode`, `budget mode`
- Grinding through many small tasks where speed > depth

## How It Works

When ecomode is active, all agent spawns use downgraded tiers:

| Normal Tier | Ecomode Tier |
|-------------|-------------|
| Opus | Sonnet |
| Sonnet | Haiku |
| Haiku | Haiku (no change) |

## Usage

```
/ecomode on                     → Activate ecomode
/ecomode off                    → Deactivate
/ecomode                        → Toggle

Combine with skills:
  /ecomode on
  /ralph fix the type errors     → Ralph runs with Sonnet/Haiku instead of Opus/Sonnet
  /ultraqa --tests               → QA cycling with cheaper models
```

## Storage

Write ecomode state to `.claude/ecomode`:

```
active: true
activated: {timestamp}
```

All skills that spawn agents should check for `.claude/ecomode` and downgrade accordingly.

## Rules

- **Modifier, not standalone.** Ecomode changes how other skills behave.
- **Quality may decrease.** Cheaper models make more mistakes on complex reasoning.
- **Good for:** repetitive tasks, simple fixes, test running, file operations
- **Bad for:** architecture decisions, security reviews, complex debugging
- **Session-scoped.** Resets on session end unless manually persisted.
