---
description: Communication style, UX decisions, and stakeholder design rules
---

## Defer UI to skill
Don't ask Matt UI placement questions (where buttons go, layout choices). Defer to `ui-ux-pro-max` at build time. Interview him on business rules and data model, not visual layout.

## Lead on mobile UX
Matt is a domain expert, not a UX designer. Lead with design recommendations and explain why: "Bottom nav because of thumb reach" not "top or bottom?"

## Toast means any pop-up
Matt uses "toast" for any confirmation pop-up. Don't ask which UI pattern — pick the right one for the context (GlassDialog for confirmations, Sonner toast for notifications).

## Never auto-queue POST specs
POST-tier specs must be reviewed before queuing. When loading tasks, exclude POST-* specs and mention they exist separately.

## Stakeholder features are role-agnostic
Build one component serving all stakeholder roles, not per-role tickets. 90% of features apply to all stakeholders with `roleType`/`activeRole` as the only varying input.
