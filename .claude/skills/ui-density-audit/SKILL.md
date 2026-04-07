---
name: ui-density-audit
description: "Layout stability + paired-column density audit. Finds CLS violations (input types, flex sizing, hint containers, conditional renders) and vertical waste (dense blocks isolated from short fields). Auto-fixes with --fix flag."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /ui-density-audit — Layout Stability & Paired-Column Density

Scan all UI components for two classes of layout defect:

1. **Layout shift (CLS)** — elements that move when toggling state, switching tabs, or changing input values
2. **Vertical waste** — dense content blocks (flag grids, checkbox matrices, file uploads) stacked vertically with short fields instead of paired side-by-side

**Execute immediately. No preamble. Silent research, findings only.**

**Arguments:**
- `/ui-density-audit` — audit only, report findings
- `/ui-density-audit --fix` — audit + auto-fix all violations

---

## Phase 1: Inventory (silent)

1. Read rules:
   - `.claude/rules/layout-stability.md`
   - `.claude/rules/paired-column-density.md`
2. Glob `src/components/**/*.tsx` — collect all component files
3. Glob `src/app/**/*.tsx` — collect all page files with inline forms

**Do not output anything yet.**

---

## Phase 2: Layout Stability Sweep (silent, Explore agent with model: "sonnet")

Launch 1 Explore agent to scan for these violations:

### Check 1: Input type violations
Grep for `type="email"`, `type="tel"`, `type="url"` on raw `<input>` elements (not Input — that auto-converts). Pattern: `type="(email|tel|url)"` in `.tsx` files. Exclude `input.tsx` itself.

### Check 2: Flex columns with percentage widths
Grep for `flex-row` combined with `w-1/`, `w-2/`, `w-3/` on children. These should be CSS Grid instead. Pattern: containers using `flex` + `sm:flex-row` where children have `sm:w-*` percentage classes.

### Check 3: Variable-height hint/error containers
Grep for `min-h-\[` on `<span>` or `<p>` elements that contain validation hints or error text. These should be fixed `h-*` with `truncate`. Also check for conditional renders (`{error && <p>...`) where the element's absence shifts siblings — should use opacity toggle instead.

### Check 4: Missing min-w-0 on flex/grid children
Grep for `flex-1` or `flex-grow` without `min-w-0` on elements containing text inputs or variable-length content.

### Check 5: Content-driven sizing
Look for inputs whose `type` attribute changes conditionally (e.g., `type={condition ? 'email' : 'text'}`). The type should always be `"text"` with `inputMode` for keyboard hints.

For each finding, report: `file:line — [CHECK N] description — current code → fix`

---

## Phase 3: Paired-Column Density Sweep (silent, Explore agent with model: "sonnet")

Launch 1 Explore agent to scan for vertical waste:

### Check 6: Isolated dense blocks
Find `LanguageField`, `LanguagePicker`, `SpecialtyField`, `CheckboxGroup`, or file upload components that are the sole child of a grid or flex container, with short text inputs (`Input`, `<input>`) in a separate container above or below.

### Check 7: Stacked short fields above/below dense blocks
Find 3+ consecutive `Input` or `<input>` elements stacked in a single column (`flex-col` or `grid-cols-1`) where a dense block exists in the same form card but isn't paired.

### Check 8: Single-column grids wasting space
Find `grid grid-cols-1 sm:grid-cols-2` where only one column is populated (e.g., LanguageField alone in a 2-col grid with no sibling).

For each finding, report: `file:line — [CHECK N] description — suggested pairing`

---

## Phase 3b: Mobile Card Pattern Sweep (silent, Explore agent with model: "sonnet")

Launch 1 Explore agent to scan for entity list violations per MASTER.md Card Density Pattern:

### Check 9: Stacked entity rows instead of card grid
Find entity lists (instructors, vessels, equipment, routes) rendered as repeated sibling flex-row or stacked div containers without a grid parent. Pattern: 3+ similar sibling elements using `flex` layout instead of `grid grid-cols-2`.

### Check 10: Single-column entity lists
Find `map()` or `.map(` rendering 3+ items into a `flex-col` or `space-y-*` container. These should use `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4`.

### Check 11: Missing card min-width
Find grid containers rendering entity cards without `min-w-[140px]` on children — prevents squeeze on narrow viewports.

For each finding, report: `file:line — [CHECK N] description — current layout → card grid fix`

---

## Phase 4: Report

Output a single scoreboard:

```
## UI Density Audit

### Layout Stability
| # | File:Line | Check | Issue | Fix |
|---|-----------|-------|-------|-----|
| 1 | ... | ... | ... | ... |

### Paired-Column Density
| # | File:Line | Check | Issue | Suggested Pairing |
|---|-----------|-------|-------|--------------------|
| 1 | ... | ... | ... | ... |

**Totals:** N stability violations, M density violations
```

---

## Phase 5: Auto-Fix (only if `--fix` flag)

If `--fix` was passed:

1. For each **Check 1** violation: change `type="email"` → `type="text" inputMode="email"` (same for tel, url)
2. For each **Check 2** violation: change `flex flex-col sm:flex-row` → `grid grid-cols-1 sm:grid-cols-2`, remove `sm:w-*` from children, add `min-w-0`
3. For each **Check 3** violation: change `min-h-[*]` → fixed `h-4 truncate`
4. For each **Check 4** violation: add `min-w-0` to the element's className
5. For each **Check 5** violation: change conditional type to `type="text"` + `inputMode`
6. For each **Check 6-8** violation: restructure into `grid grid-cols-1 sm:grid-cols-2` with short fields left, dense block right
7. For each **Check 9-10** violation: restructure entity list into `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4` with compact card anatomy (name, badges, metadata, action)
8. For each **Check 11** violation: add `min-w-[140px]` to card children

After all fixes: run `npx tsc --noEmit` to verify clean build.

Report: `Applied N fixes across M files. Build: PASS/FAIL`

---

## Rules

- Execute immediately. No preamble.
- Silent research — only the scoreboard is output.
- Every finding must cite file:line + specific code.
- `--fix` applies mechanical fixes only. Complex restructuring (ambiguous pairing choices) is reported but not auto-fixed — flagged as `MANUAL`.
- Never modify `input.tsx` — it already handles type interception at the component level.
