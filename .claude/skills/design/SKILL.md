---
name: design
description: "Interactive design skill. Critique → Design → Prototype → Propagate. Screenshots at 375/768/1440, programmatic layout audit, collaborative fixes, app-wide propagation."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_click, mcp__playwright__browser_close, mcp__playwright__browser_resize, mcp__playwright__browser_tabs, mcp__playwright__browser_evaluate, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_hover
user-invocable: true
---

# /design

One skill, four phases. Matt stays in the loop throughout.

**Execute immediately. No preamble.**

## Args

| Arg | Behavior |
|-----|----------|
| *(none)* | Review the current page, starting at Phase 1 |
| `<url>` | Navigate to URL, then start at Phase 1 |
| `propagate` | Skip to Phase 4 using the approved pattern from this session |

## Startup (silent)

Read these sources in order before acting:

1. `design-system/MASTER.md`
2. `design-system/pages/` — read the override for the current route if one exists
3. `Architecture/component-invariants.md`
4. `.claude/rules/design-change-routing.md`
5. `.claude/rules/layout-stability.md`
6. `.claude/rules/mobile-first.md`
7. `.claude/rules/paired-column-density.md`
8. `.claude/rules/spacing-tokens.md`

Use this authority chain throughout the session:

`Design.md` → `/design` → `design-system/MASTER.md` → Convex theme seed + `src/themes/default-themes.ts`

Page overrides layer on top of `MASTER.md`. Route-specific override wins on conflict.

## Three-Width Screenshot Protocol

Every screenshot step captures all three viewports. Never approve on a single width.

| Width | Height | Class |
|-------|--------|-------|
| 375 | 812 | Mobile |
| 768 | 1024 | Tablet |
| 1440 | 900 | Desktop |

At each checkpoint: `browser_resize` → `browser_take_screenshot`.

---

## Phase 1: Critique

**Goal:** Find what is wrong before proposing changes.

### Step 1: Capture

Take the three-width screenshots for the target page.

### Step 2: Programmatic layout audit

Run source-code and DOM checks before any aesthetic judgment. Focus on the current page's files plus the shared components it renders. Report only real violations, not theoretical risk.

Audit against these rules:

- `layout-stability.md` — stable grids, fixed-height non-field hints, no layout-shifting conditionals, overlay containment
- `mobile-first.md` — mobile baseline, 44px touch targets, no page-level horizontal scroll, bottom action bar, bottom-nav clearance, full-width mobile fields
- `paired-column-density.md` — pair short fields with dense content blocks instead of wasting vertical space
- `spacing-tokens.md` — spacing is additive; no tighter desktop than mobile
- `component-invariants.md` — no raw interactive elements in feature code, no visual `className` overrides, new components need stories, no empty optimistic `catch {}`

Check these concrete patterns:

```bash
# Semantic input types on mobile-focused forms
grep -rn 'type="text".*inputMode=\|inputMode=.*type="text"' src/app/ src/components/

# Missing min-w-0 on flex/grid children
grep -rn 'flex \|grid ' src/app/ src/components/

# overflow-y without overflow-x pairing
grep -rn 'overflow-y-auto' src/app/ src/components/

# Spacing inversions (desktop tighter than mobile)
grep -rn 'p-[5-9] sm:p-[1-4]\|gap-[5-9] sm:gap-[1-4]' src/app/ src/components/

# Unprefixed multi-column grids
grep -rn 'grid-cols-[2-9]' src/app/ src/components/

# Raw Tailwind palette colors
grep -rn 'text-red-\|text-blue-\|text-green-\|bg-red-\|bg-blue-\|bg-green-\|border-red-\|border-blue-\|border-green-' src/app/ src/components/

# Type scale drift
grep -rn 'text-sm\|text-xs\|text-lg\|text-xl\|text-2xl\|text-3xl' src/app/ src/components/

# 100vw usage
grep -rn '100vw' src/app/ src/components/

# Raw interactive elements in feature code
grep -rn '<button\|<input\|<select\|<textarea' src/app/ src/components/

# Empty catch blocks in optimistic handlers
grep -rn 'catch\s*{\s*}' src/app/ src/components/ src/lib/

# New components without stories
grep -rn 'export .*function\|export const ' src/components/
```

Then run DOM/layout checks on the rendered page via Playwright evaluation:

```js
const results = {
  bgImageCount: document.querySelectorAll('.bg-image').length,
  bgOverlayCount: document.querySelectorAll('.bg-overlay').length,
  mainEl: (() => {
    const main = document.querySelector('main');
    if (!main) return null;
    const s = getComputedStyle(main);
    return { display: s.display, justifyContent: s.justifyContent, alignItems: s.alignItems };
  })(),
  glassEl: (() => {
    const g = document.querySelector('.glass-elevated') || document.querySelector('.glass') || document.querySelector('.glass-container');
    if (!g) return null;
    const s = getComputedStyle(g);
    return { display: s.display, flexDirection: s.flexDirection, alignItems: s.alignItems, textAlign: s.textAlign };
  })(),
  contentZIndex: (() => {
    const shell = document.querySelector('.app-shell') || document.querySelector('main');
    return shell ? getComputedStyle(shell).zIndex : 'none';
  })(),
  hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
};
return results;
```

If structural checks fail, lead with those failures before any aesthetic commentary.

### Step 3: Visual analysis

Evaluate the three screenshots like a senior product designer. Check:

- Visual hierarchy and reading order
- Mobile ergonomics first; desktop refinement second
- Whitespace balance and paired-column density
- Alignment to grid and stable card geometry
- Touch targets ≥44px on mobile
- Contrast at all three widths
- Responsive adaptation without overflow or cramped half-width fields
- Glass backed by a real background stack, not isolated chrome
- Consistency with `MASTER.md` and the active page override

### Step 4: Present findings

Group findings by severity: **CRITICAL / HIGH / MEDIUM / LOW**.

Lead with structure, then visual drift, then polish.

Ask:

**"Are these the problems you want to solve, or is there something else?"**

Matt can confirm, narrow, add issues, or skip straight to Phase 3.

---

## Phase 2: Design

**Goal:** Agree on the right fix at the right layer.

For each approved finding, recommend:

- **What** — the exact visual or structural change
- **Which layer** — token → component → page override → instance layout only
- **How at all widths** — what changes at 375 / 768 / 1440
- **Why** — grounded in `MASTER.md`, page overrides, or rule files

Rules:

- Token-level before instance-level. If it should propagate, do not patch locally.
- `className` is only for layout positioning or semantic token classes — never ad-hoc visual styling.
- If Matt cannot name the preference, offer vocabulary: density, contrast, temperature, weight, formality.
- Maximum 3 design rounds. If alignment stalls, prototype the top 2 options and let Matt react visually.

Transition with:

**"Let me prototype this."**

---

## Phase 3: Prototype

**Goal:** Edit, verify, and iterate until the design is actually right.

### Loop

1. **Edit** — change the correct layer per `design-change-routing.md`
2. **Verify structurally** — rerun any relevant layout audits first
3. **Verify visually** — three-width screenshots against the agreed target
4. **Self-fix** — maximum 2 self-fix cycles before showing Matt
5. **Present** — three screenshots + one-line summary of what changed
6. **React** — iterate until Matt says "done"

### Quality gates (silent unless they fail)

```bash
npx tsc --noEmit
```

### Rules

- All three widths shown every round. Never single-width approval.
- Fix breakage at any width before showing the result.
- If Phase 1 found structural bugs, do not present a beauty pass that leaves them unresolved.
- Lead with the changed outcome, not a long explanation. Matt sees HMR.

---

## Phase 4: Propagate

**Goal:** Apply the approved pattern everywhere it belongs, then update the spec.

### Step 1: Extract the approved pattern

List what Phase 3 changed:

- tokens
- component variants/defaults
- page layout rules
- responsive behavior
- spacing/density patterns

### Step 2: Find affected pages

Search all route files:

```
Glob: src/app/**/page.tsx
```

For each route, identify pages still using the old pattern. Skip pages that already comply.

For read-only discovery of propagation targets, use parallel Explore agents. All edits stay sequential.

### Step 3: Apply sequentially

For each affected page:

1. Apply the approved pattern
2. Run the relevant structural checks
3. Capture all three widths
4. Verify before moving on

### Step 4: Update docs

Update only what the approved pattern changed:

- `design-system/MASTER.md`
- `design-system/pages/*.md`
- `Architecture/component-invariants.md`
- `.claude/rules/*.md`

If the approved change is local to one page, prefer a page override rather than bloating `MASTER.md`.

### Step 5: Quality gates

```bash
npx tsc --noEmit
npx vitest run
```

Take three-width screenshots of every modified page.

### Step 6: Report

Report:

- pages updated
- patterns propagated
- docs changed
- verification performed
- test results

## Always enforce

- Layout before aesthetics. Always.
- Mobile-first decisions win when mobile and desktop disagree.
- Glass needs a real background stack.
- `MASTER.md` is the technical design truth unless a page override intentionally supersedes it.
- Design and review are separate passes; do not blur critique with implementation.
