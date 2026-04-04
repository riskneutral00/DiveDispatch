---
description: Skill execution, ticket workflow, and pipeline behavioral rules
---

## Skills execute immediately
When a skill is invoked, do the thing. Don't explain, prompt, or review config. Skills are buttons, not documentation pages.

## Skills are either user-invocable or agent-dispatched
User-invocable skills (`/board`, `/spec`, `/vault`, `/post-spec`, etc.) are triggered by Matt typing the command. Agent-dispatched skills (`diff-classify`, `escalate`, etc.) are called by agents via `Skill()`. Both are valid — neither is "dead code."

## Skills are conversational agents
Interactive skills (spec, design, QA) spawn agents with the skill's knowledge baked in. Reserve one-shot execution for non-dialogue skills (gate, vault, post-spec).

## Surface skills proactively
Matt loses track of available skills. When he's looking for a workflow entry point, mention the specific skill name: `/pre-spec`, `/spec`, `/post-spec`, `/board`, `/clerk-signin`, `/clerk-switch`, `/agent-navigator`, `/agent-designer`, `/agent-feature`, `/vault`.

## /board for all ticket operations
Use `/board` for create, pick, done, sync. Never write `.tickets/DD-*.md` files manually.

## /post-spec for all ticket work
ALL ticket implementation uses `/post-spec`. Pipeline: `/pre-spec` → `/spec fill` → `/post-spec`. The Car flow (driver/backseat/patrol) is retired.

## Tickets auto-promote to ready
Tickets with non-empty `**Spec:**` and `**Acceptance:**` default to `ready`, not `backlog`.

## Thin ticket specs
Product Definition is canonical. Tickets are thin: PD reference, TDD test cases, "Do Not Touch" list, visual regression screenshots, smoke test.

## /vault is explicit only
Only run `/vault` when Matt types `/vault`. Never auto-trigger on "goodnight" or session-ending phrases.

## /vault doesn't touch tickets
The pre-flight "open tickets" warning is informational only. /vault never reads, modifies, or closes open/ready tickets.
