---
description: Skill execution, ticket workflow, and Car pipeline behavioral rules
---

## Skills execute immediately
When a skill is invoked, do the thing. Don't explain, prompt, or review config. Skills are buttons, not documentation pages.

## Skills are either user-invocable or agent-dispatched
User-invocable skills (`/board`, `/spec`, `/vault`, etc.) are triggered by Matt typing the command. Agent-dispatched skills (`ticket-pick`, `escalate`, `diff-classify`, etc.) are called by Car agents via `Skill()`. Both are valid — neither is "dead code." Overstory is deprecated.

## Skills are conversational agents
Interactive skills (spec, design, QA) spawn agents with the skill's knowledge baked in. Reserve one-shot execution for non-dialogue skills (gate, vault, preflight).

## Surface skills proactively
Matt loses track of available skills. When he's looking for a workflow entry point, mention the specific skill name: `/first`, `/clerk-signin`, `/clerk-switch`, `/agent-navigator`, `/agent-designer`, `/agent-feature`, `/vault`.

## /board for all ticket operations
Use `/board` for create, pick, done, sync. Never write `.tickets/DD-*.md` files manually.

## /driver for all ticket work
ALL ticket implementation uses `/driver` (Car workflow). `/jira` is retired. `/spec` creates tickets → `/driver` picks them up → `/backseat` reviews.

## /first vs /driver
Both launch the full Car pipeline. `/first` adds context resume + hygiene + health check first. Never tell Matt he's using the wrong one.

## Tickets auto-promote to ready
Tickets with non-empty `**Spec:**` and `**Acceptance:**` default to `ready`, not `backlog`.

## Thin ticket specs
Product Definition is canonical. Tickets are thin: PD reference, TDD test cases, "Do Not Touch" list, visual regression screenshots, smoke test.

## Worker quality rules
Quality rules (no `as any`, no weak assertions, no dead imports) are baked into jira-worker. No separate de-sloppify step.

## Validate autonomous branches before merge
Run `bash scripts/validate-merge.sh <branch>` before merging any autonomous branch to main. It checks for duplicate tests, zero-value tests, banned patterns, tsc errors, and test failures. `jira-merge.sh` squash-merges worker branches onto main — one clean commit per ticket is intentional. The pre-commit hook catches trash at write time; validate-merge catches anything that slipped through.

## /vault is explicit only
Only run `/vault` when Matt types `/vault`. Never auto-trigger on "goodnight" or session-ending phrases.

## /vault doesn't touch tickets
The pre-flight "open tickets" warning is informational only. /vault never reads, modifies, or closes open/ready tickets.
