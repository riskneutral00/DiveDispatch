---
name: pre-spec
description: "Single-ticket idea capture. Matt describes a problem or desired outcome. Claude infers all metadata and produces exactly one ticket with needs_spec: true for /spec to fill in later."
allowed-tools: Read, Write, Edit, Bash
user-invocable: true
---

# /pre-spec — Single-Ticket Idea Capture

Matt describes a problem, complaint, or desired outcome. You infer ALL metadata. Matt only confirms or overrides — never fills in fields.

**One ticket per invocation. Always.**

**Max 2 questions. Everything else you figure out.**

**No code exploration. No Grep. No Glob. No Agent. No file:line references.**
Pre-spec captures Matt's words and infers metadata from domain knowledge only.
/spec does all codebase exploration later.

---

## Step 1: Dump

Let Matt talk. Accept whatever he gives you — vague or specific, one sentence or a wall of text. If Matt hasn't provided anything yet, ask: "What's the idea or problem?"

---

## Step 2: Confirm the one-liner

Reflect back a single sentence summarizing the ticket:

```
One ticket: "{one-line summary}"

Correct?
```

Wait for confirmation. If Matt says "actually that's two things" → ask which one to capture now; the other gets a separate /pre-spec call.

---

## Step 3: Quick interview (max 2 questions)

**Q1 (always ask):** "What should this look like when it's done?"

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

**That's it. Do NOT ask about size, category, area, dependencies, or side effects.**

---

## Step 4: Infer all metadata

Infer every field silently:

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

## Step 5: Confirm

Present the single ticket:

```
Pre-spec ready:
  DD-{N}: "{title}" ({priority}, {size}, {category}, {area})

Any corrections? (k to confirm)
```

Matt can:
- "k" → confirm, proceed to write
- Override specific fields → update and re-present

---

## Step 6: Write the ticket

Read `.tickets/.counter` for next number. Increment by 1.

Create `.tickets/DD-{NNN}.md`:

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

**Pre-spec notes:** {Domain-level guess: which area of the app this likely touches (e.g., "booking flow", "user profile", "availability calendar"). No file paths, no line numbers, no code analysis.}
```

Update `.tickets/.counter` with the new number.

---

## Step 7: Summary

```
Created DD-{N}: {title} (backlog)

Next: run /spec DD-{N} to fill it in, or run /spec on a related topic and it will find this one.
```

---

## Rules

- **One ticket per invocation.** Never decompose a single idea into implementation sub-tickets — that's /spec's job. If Matt's description has backend + frontend parts, it's still one ticket.
- **Max 2 questions.** Q1 (desired outcome) + Q2 (urgency, only if ambiguous). That's it.
- **Infer everything.** Matt doesn't know the field taxonomy. You do.
- **Preserve Matt's words.** The `**Problem:**` field is verbatim — don't rephrase into technical language.
- **No code exploration, period.** No reading source files. No grepping. No exploring. The only files you read are `.tickets/.counter` and `.tickets/DD-*.md` (for blocked_by dedup). Pre-spec is a 30-second conversation, not a research session. /spec does all exploration.
- **Deferred is OK.** If Matt defers Q1, record it. /spec will re-ask. If deferred at /spec time too → `human_required: true`.
- **Don't over-infer blocked_by.** Only set it if the dependency is obvious. False positives are worse than missing deps — /spec will catch real deps during exploration.
