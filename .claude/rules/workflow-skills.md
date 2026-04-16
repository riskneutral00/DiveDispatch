---
description: Skill execution, ticket workflow, and pipeline behavioral rules
---

## Skills execute immediately
When a skill is invoked, do the thing. Don't explain, prompt, or review config. Skills are buttons, not documentation pages.

## Skills are either user-invocable or agent-dispatched
User-invocable skills (`/board`, `/spec`, `/vault`, `/post-spec`, etc.) are triggered by Matt typing the command. Agent-dispatched skills (`escalate`, `ticket-create`, etc.) are called by agents via `Skill()`. Both are valid — neither is "dead code."

## Skills are conversational agents
Interactive skills (spec, design, QA) spawn agents with the skill's knowledge baked in. Reserve one-shot execution for non-dialogue skills (gate, vault, post-spec).

## Surface skills proactively
Matt loses track of available skills. When he's looking for a workflow entry point, mention the specific skill name: `/pre-spec`, `/spec`, `/post-spec`, `/board`, `/clerk-signin`, `/clerk-switch`, `/agent-navigator`, `/design`, `/agent-feature`, `/vault`.

## /board for all ticket operations
Use `/board` for create, pick, done, sync. Never write `.tickets/DD-*.md` files manually.

## /post-spec for all ticket work
ALL ticket implementation uses `/post-spec`. Pipeline: `/pre-spec` → `/spec fill` → `/post-spec`. The Car flow (driver/backseat/patrol) is retired.

## Tickets auto-promote to ready
Tickets with non-empty `**Spec:**` and `**Acceptance:**` default to `ready`, not `backlog`. Exception: gate-sourced tickets open `in_progress` (see "Gate tickets close same session" below).

## Gate tickets close same session
`/gate` writes tickets with `source: gate` and `status: in_progress` as an audit paper trail for every CRITICAL/HIGH finding. Phase 7 closes them to `.tickets/done/` (status `done` or `dismissed`) before session end. `/vault` blocks commit if any gate-sourced ticket is still `in_progress` or flagged `human_required: true`. Explicit dismissal allowed via `/board dismiss <ID> "<reason>"` — dismissed tickets count as closed. Gate tickets are not a backlog; they are the record of what was found and immediately fixed (or consciously set aside).

## Thin ticket specs
Product Definition is canonical. Tickets are thin: PD reference, TDD test cases, "Do Not Touch" list, visual regression screenshots, smoke test.

## /vault is explicit only
Only run `/vault` when Matt types `/vault`. Never auto-trigger on "goodnight" or session-ending phrases.

## /vault reads gate tickets, ignores product tickets
`/vault` blocks on open gate-sourced tickets (see above) but never reads, modifies, or closes `source: board | spec | navigator` product tickets. Product tickets are Matt's work queue; gate tickets are session audit state.
