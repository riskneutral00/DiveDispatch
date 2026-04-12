---
name: review-frontend-dry
description: "Cross-file frontend DRY audit. Detects duplicate utilities, local type aliases shadowing BaseProfileSectionProps, leftover tokenizable inline styles, raw buttons, i18n literal leaks in Dialog chrome. Dispatched automatically by /gate on src/lib/** or src/components/** changes — never run manually. Emits CRITICAL/HIGH/MEDIUM/LOW with file:line findings and pipes through /escalate."
allowed-tools: Read, Glob, Grep, Bash, Skill
user-invocable: false
---

# /review-frontend-dry — Frontend DRY + Consistency Audit

Dispatched by `/gate` when `src/lib/**` or `src/components/**` files are in the diff. **Never run manually** — the edit-time hooks already cover individual-file checks; this skill does the cross-file work that hooks can't.

**Execute immediately. No preamble.**

---

## Phase 1: Scope

1. Read the diff bucket hashes from `.patrol-ran` to understand which files changed.
2. Focus the audit on changed files plus their direct importers (1 hop).
3. Skip `*.test.*`, `*.stories.*`, and `_generated/` entirely.

## Phase 2: Checks

Run each check and collect findings with `{severity, file, line, summary, fix}`:

**A. Duplicate utility functions (HIGH)**
- Grep for `function formatDateRange`, `function parseNumber`, `function format*`, `function parse*` outside `src/lib/utils/` and `src/lib/profile-form/`.
- For each match: if a function of the same name exists in the canonical module, flag as duplicate.

**B. Local type aliases shadowing shared shapes (HIGH)**
- Search changed files under `src/components/profiles/*-profile-form.tsx` for `type *FormState = ContactFormState &`.
- Search for local `type *SectionProps = { profile: ..., me: ..., create: ..., update: ...}` that duplicates `BaseProfileSectionProps`.

**C. Leftover tokenizable inline styles (MEDIUM)**
- Grep changed files outside `src/components/ui/` for `style={{` referencing `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-on-primary)`, `var(--color-success)`, `var(--color-warning)`, `var(--color-destructive)`, `var(--color-accent)`, `var(--color-glass-bg)`, `var(--color-surface*)`, `var(--color-glass-border)`.
- Count per file. File with 3+ occurrences → HIGH, 1-2 → MEDIUM.

**D. Raw `<button>` outside ui/ (HIGH)**
- Grep changed files outside `src/components/ui/` for `<button ` without a preceding `/* design-ok */` comment.

**E. Dialog chrome i18n leaks (CRITICAL)**
- Grep changed `.tsx` files for `<Dialog` / `<ConfirmActionDialog` usages where `title=` / `description=` is a string literal rather than `t(...)`.

**F. Three-copies-equal-extract (MEDIUM)**
- For each helper function defined locally in the changed set, grep the rest of the codebase for functions with the same name. If it exists in 3+ files, flag as extraction candidate.

## Phase 3: Report

Write markdown report to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-frontend-dry-<YYYY-MM-DD>.md`:

```
# Frontend DRY Review — YYYY-MM-DD

## CRITICAL
- {file}:{line} — {summary} → {fix}

## HIGH
...
```

Include a scoreboard header with counts.

## Phase 4: Return Findings

**Do NOT invoke `/escalate` directly.** `/gate` is the single escalator. Return structured findings; the caller aggregates and escalates. Include the report path so `/gate` can pass it to `/escalate` when aggregating.

## Phase 5: Emit sentinel entry

Return to `/gate` caller with:

```
review-frontend-dry: {verdict} | C: {N} | H: {N} | M: {N} | L: {N}
Report: {vault path}
```

---

## Notes

- This skill is the cross-file companion to the edit-time hooks (`dry-check.sh`, `inline-style-drift.sh`, `dialog-title-i18n.sh`, `local-type-alias-guard.sh`, `date-formatter-guard.sh`). Hooks catch individual violations at Edit time; this skill catches patterns that only emerge when viewing the whole repo.
- Execution is automatic via `/gate` dispatch. No user invocation path exists.
