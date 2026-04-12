---
name: review-ui-variants
description: "Missing-variant audit for src/components/ui/* primitives. Scans callsites that pass className with visual properties (colors, radii, overflow, animation) — those are missing variants, not styling choices. Dispatched automatically by /gate when ui/ primitives change. Never run manually."
allowed-tools: Read, Glob, Grep, Bash, Skill
user-invocable: false
---

# /review-ui-variants — UI Primitive Variant Audit

Dispatched by `/gate` when `src/components/ui/**` files are in the diff. **Never run manually.**

**Execute immediately. No preamble.**

---

## Phase 1: Inventory

1. For each changed file under `src/components/ui/`, read the exported component and enumerate its public props (especially `variant`, `size`, `shape`, and anything else accepting a union).
2. Grep the entire `src/` tree for callsites of that component.

## Phase 2: Detect missing variants

For each callsite, inspect the `className` prop (and inline `style` prop). Visual properties that should be variants, not overrides:

| Token class | Category |
|---|---|
| `text-red-*`, `text-blue-*`, `text-gray-*`, `bg-red-*`, `bg-blue-*`, `border-gray-*` | Hardcoded palette — should be semantic token OR variant |
| `rounded-none`, `rounded-full`, `rounded-lg`, `rounded-xl` (when the component already sets `rounded-theme`) | Radius override — should be `shape` prop |
| `overflow-hidden`, `overflow-auto` | Should be a component prop |
| `animate-*` | Should be a component prop |
| `text-primary`, `text-secondary`, `text-destructive`, `text-success`, `text-warning`, `bg-glass-bg`, `bg-surface-elevated`, `border-glass-border` | Semantic tokens — allowed as className |

Flag as **HIGH** when a visual property repeats 3+ times at different callsites (suggests missing variant). Flag as **MEDIUM** for 2. Ignore single occurrences.

## Phase 3: Detect inline style on ui/ own element

Grep the ui/ component's source for `style={{ ... var(--color-*) ... }}` on the outer element (outside a variant `Record<Variant, CSSProperties>`). Each is a missing variant.

## Phase 4: Report

Write markdown report to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/review-ui-variants-<YYYY-MM-DD>.md`:

```
# UI Variant Review — YYYY-MM-DD

## CRITICAL / HIGH / MEDIUM / LOW

- {component} → {suggested new prop} → used at {N} callsites
  - {file:line}
  - {file:line}
  ...
```

## Phase 5: Return Findings + sentinel

Same as `/review-frontend-dry`: **do NOT invoke `/escalate` directly.** Return structured findings + sentinel entry; `/gate` aggregates and calls `/escalate` once.

---

## Notes

- This skill exists because edit-time hooks can see one file at a time; variant audits need whole-repo visibility.
- Auto-dispatch only. No user invocation.
