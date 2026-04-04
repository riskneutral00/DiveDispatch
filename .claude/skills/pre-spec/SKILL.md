---
name: pre-spec
description: "Lightweight batch idea capture. Matt describes problems, Claude infers all metadata. Creates backlog tickets with needs_spec: true for /spec to fill in later."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

# /pre-spec — Batch Idea Capture

Matt describes problems, complaints, or desired outcomes. You infer ALL metadata. Matt only confirms or overrides — never fills in fields.

**Max 2 questions per issue. Everything else you figure out.**

---

## Step 1: Dump

Let Matt talk. He may list one issue or ten. He may be vague ("the availability thing is broken") or specific ("after confirming a booking, the instructor calendar still shows the old availability for 30 seconds"). Accept whatever he gives you.

If Matt hasn't provided anything yet, ask: "What's bugging you? List everything — one-liners are fine."

---

## Step 2: Decompose

Parse Matt's dump into discrete issues. Present back:

```
I see {N} issues:
1. {one-line summary}
2. {one-line summary}
3. {one-line summary}

Correct, or should I split/merge any?
```

Wait for confirmation before proceeding.

---

## Step 3: Quick interview (per issue, max 2 questions each)

For each issue, ask at most 2 questions:

**Q1 (always ask):** "What should {issue} look like when it's fixed?"

Matt can:
- Describe the desired outcome → record it
- Defer ("not sure yet", "you figure it out", "idk") → record as deferred, /spec will re-ask later

**Q2 (only if truly ambiguous):** "Is this urgent or can it wait?"

Only ask Q2 if you genuinely cannot distinguish P0/P1 from P2/P3 based on the language. Matt's tone usually tells you:
- "broken", "can't do X", "blocking" → P1 (don't ask)
- "annoying", "ugly", "would be nice" → P2/P3 (don't ask)
- Genuinely unclear → ask Q2

Matt answers in plain language. Map to priority:
- "it's blocking launch" → P0
- "it needs fixing soon" → P1
- "it's annoying but not blocking" → P2
- "whenever, no rush" → P3

**That's it. Move to the next issue. Do NOT ask about size, category, area, dependencies, or side effects.**

---

## Step 4: Infer all metadata

For each issue, infer every field silently:

| Field | How to infer |
|---|---|
| `title` | Concise problem statement from Matt's description |
| `priority` | Language urgency: "broken/can't/blocking" → P1, "annoying/ugly" → P2, "nice to have" → P3, "launch blocker" → P0. Override with Q2 answer if asked. |
| `size` | Scope: single field/value → S, flow/page change → M, cross-cutting/architectural → L |
| `category` | Problem type: broken behavior → bugfix, missing capability → feature, slow/inefficient → performance, visual/layout → ux, auth/data exposure → security |
| `area` | Keywords: booking/reservation/availability/inventory → backend, page/button/layout/component/form → frontend, table/field/index/schema → schema, test/fixture/assertion → testing, mixed → fullstack |
| `blocked_by` | Scan `.tickets/DD-*.md` titles and side_effects. If an existing ticket clearly must complete first, set it. If unsure, leave empty `[]`. |
| `side_effects` | Map Matt's description to known areas: booking state machine, auth boundary, seed fixtures, design system, shared validation, etc. |

---

## Step 5: Confirm batch

Present all tickets with inferred metadata in one block:

```
Pre-specs ready:
  DD-{A}: "{title}" ({priority}, {size}, {category}, {area})
  DD-{B}: "{title}" ({priority}, {size}, {category}, {area})
  DD-{C}: "{title}" ({priority}, {size}, {category}, {area}, blocked by DD-{X})

Any corrections? (k to confirm all)
```

Matt can:
- "k" → confirm all, proceed to write
- Override specific fields: "C is P0" or "A is actually frontend" → update and re-present
- Split or merge: "A and B are the same thing" → merge and re-present

---

## Step 6: Write tickets

Read `.tickets/.counter` for next number. Increment once per ticket.

For each issue, create `.tickets/DD-{NNN}.md`:

```yaml
---
id: DD-{NNN}
title: "{title}"
status: backlog
priority: {inferred}
category: {inferred}
area: {inferred}
assigned_to: null
branch: null
blocked_by: [{inferred, or empty}]
blocks: []
pr: null
side_effects: [{inferred, or empty}]
human_required: false
needs_spec: true
size: {inferred}
wave: 1
recommended_model: null
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

**Problem:** {Matt's description, verbatim — preserve his exact words}

**Desired outcome:** {Matt's answer from Q1, or "Deferred — /spec will ask"}

**Deferred:**
- {list of questions Matt deferred, for /spec to re-ask}
- {if none deferred, omit this section entirely}

**Pre-spec notes:** {Your initial analysis: what area of code is likely involved, which tables/mutations might be affected, preliminary thoughts on approach. Do NOT include file:line refs — those come from /spec's exploration.}
```

Update `.tickets/.counter` with the highest number used.

---

## Step 7: Summary

```
Created {N} pre-specs:
  DD-{A}: {title} (backlog, needs_spec)
  DD-{B}: {title} (backlog, needs_spec)
  DD-{C}: {title} (backlog, needs_spec)

Next: run /spec on a related topic — it will find these and offer to fill them in.
Or: run /spec DD-{A} to fill in a specific one.
```

---

## Rules

- **Max 2 questions per issue.** Q1 (desired outcome) + Q2 (urgency, only if ambiguous). That's it.
- **Infer everything.** Matt doesn't know the field taxonomy. You do.
- **Preserve Matt's words.** The `**Problem:**` field is verbatim — don't rephrase into technical language.
- **No code exploration.** Pre-spec is fast and cheap. /spec does the expensive exploration later.
- **Batch is the default.** Always accept multiple issues in one session.
- **Deferred is OK.** If Matt defers Q1, record it. /spec will re-ask. If deferred at /spec time too → `human_required: true`.
- **needs_spec: true is the marker.** This is how /spec and /board identify pre-specs.
- **Don't over-infer blocked_by.** Only set it if the dependency is obvious. False positives are worse than missing deps — /spec will catch real deps during exploration.
