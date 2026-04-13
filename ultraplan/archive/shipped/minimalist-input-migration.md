> **Shipped 2026-04-09.** Input/Select/SimpleSelect/Textarea all migrated. Residual tablet sweep tracked in memory `project_minimalist_input_migration.md`.

# Minimalist Input Migration — Underline Floating Labels

Approved 2026-04-07. Profile page is done as reference implementation.

## How to run

```
/ultraplan complete the minimalist input migration per ultraplan/minimalist-input-migration.md — Profile page is already done as reference
```

## Reference Implementations

1. **Mock page** (standalone prototype): `src/app/(dashboard)/mock-form/page.tsx`
2. **Profile tab** (working production implementation): `src/components/account/profile-tab.tsx` — this is the reference for how real components use the new pattern

## Critical Technical Lessons (learned the hard way)

1. **ALL custom CSS classes MUST be inside `@layer utilities { }`** in globals.css. Tailwind v4 strips/optimizes raw CSS outside its layer system. This includes `.field-underline`, `.dialog-fullscreen-panel`, and all `.field-*` width classes.

2. **Mobile grid, desktop flex-wrap** for form field containers:
   ```
   grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4
   ```
   Grid column spans handle mobile pairing. Desktop uses fixed-width flex-wrap.

3. **`sm:` prefix does NOT work on custom CSS classes** (e.g., `sm:glass-container` fails silently). Use dedicated utility classes with `@media (min-width: 640px)` blocks inside `@layer utilities` instead.

4. **Dialog fullscreen transparency**: Use `.dialog-fullscreen-panel` class (already defined in globals.css). Mobile = transparent bg (background image shows through). Desktop = glass-container with opaque surface.

5. **Turbopack caching is aggressive**. If CSS changes don't appear in browser, check computed styles first — the assumption should be Tailwind stripping the rule, not a code bug.

## Context files (symlinks — always current)

| Link | What |
|------|------|
| `agents/` | Agent definitions |
| `skills/` | Skill definitions |
| `hooks/` | PostToolUse hooks |
| `rules/` | Design + code rules |
| `settings.json` | Hook registry |
| `design-system/` | MASTER.md + page overrides |
| `CLAUDE.md` | Project invariants |

## What's Already Done

- `src/components/ui/input.tsx` — floating underline labels, no glass, focused state colors primary
- `src/components/ui/simple-select.tsx` — same floating label treatment
- `src/components/ui/bottom-action-bar.tsx` — transparent bg, border-t only
- `src/components/profiles/profile-form-footer.tsx` — Cancel + Save paired grid when `onCancel` provided
- `src/components/profiles/profile-form-shell.tsx` — accepts `onCancel` prop
- `src/lib/hooks/use-profile-form.ts` — `resetToBaseline()` for cancel
- `src/components/account/profile-tab.tsx` — fully wired: floating labels, grid layout, Cancel+Save, onCancel
- `src/components/ui/dialog.tsx` — fullscreen uses `dialog-fullscreen-panel` (transparent mobile, glass desktop)
- `src/app/globals.css` — `.field-underline` + `.dialog-fullscreen-panel` in `@layer utilities`, field widths in `@layer utilities` with grid-column spans
- `src/themes/default-themes.ts` — `fieldUnderline` token per luminance class
- `src/themes/theme-types.ts` — `fieldUnderline` in `ColorPalette` interface
- `src/themes/theme-utils.ts` — generates `--color-field-underline` CSS var
- `design-system/MASTER.md` — updated glass assignments, documented `.field-underline`

## What Remains

### Phase A: Fix broken tests (2 files)
1. `tests/components/field-shell.test.tsx` — expects `FieldError` to always render with `opacity-0`. Now returns `null` when no message. Update test.
2. `tests/components/textarea.test.tsx` — expects `glass` class on textarea. Now `field-underline`. Update test.

### Phase B: Convert remaining components
3. `src/components/ui/textarea.tsx` — convert to floating underline label (same pattern as Input)
4. `src/components/ui/select.tsx` — convert to floating underline label (same pattern as SimpleSelect)
5. Assess compound pickers: `LanguagePicker`, `LocationPicker`, `EquipmentPicker`, `DayPicker` — these have custom layouts. Decide per-component whether underline applies.

### Phase C: Wire Cancel button on all forms
6. Every form using `ProfileFormShell` needs `onCancel={resetToBaseline}` passed. Files:
   - All role-specific profile forms in `src/components/profiles/`
   - `src/components/account/preferences-editor.tsx` (resource save buttons already use BottomActionBar)
   - Customer portal forms
   - Booking forms
   - Onboarding steps

### Phase D: Convert remaining form containers to grid
7. Any `flex flex-wrap gap-4` container with `field-*` children needs:
   `grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-4`
   Already done: profile-tab, profile-basic-info, dive-site-profile-form, step-contact (4 instances).
   Remaining: check all forms for unconverted containers.

### Phase E: Update hooks, skills, agents
8. `.claude/hooks/glass-enforcement.sh` — exempt input/select from glass requirement
9. `.claude/hooks/design-token-enforcement.sh` — add `--color-field-underline` to known tokens
10. `.claude/skills/ui-fix/SKILL.md` — reference underline as canonical input pattern
11. `.claude/skills/design-review/SKILL.md` — check for underline compliance, not glass
12. `Architecture/component-invariants.md` — update Input rules: underline, not glass

### Phase F: Skin-specific underline colors
13. Each skin in `skins.ts` should define its own `fieldUnderline` color. Currently only has defaults per luminance class. Matt wants blue underline on orange skins, orange on blue skins, etc.

### Phase G: Full-app sweep + cleanup
14. Run `/design-review` on every route at 375px + 1440px
15. Run `/ui-density-audit` across all pages
16. Delete `src/app/(dashboard)/mock-form/` after migration verified

## Do NOT Change

- Button glass styling (buttons keep glass)
- Card/dialog glass styling (containers keep glass, except fullscreen dialog mobile)
- The glass system itself (stays for non-input surfaces)
- Field-width CSS classes in `@layer utilities` (already migrated)
- `BottomActionBar` component structure (already correct)

## Verification

- Playwright at 375px: every form shows underline inputs, floating labels, background visible through fullscreen dialog, Cancel+Save paired
- Playwright at 1440px: desktop layout preserved, centered dialog has glass bg
- Focus an input → underline turns `--color-primary`, label floats small
- Switch skin → underline color changes per skin palette
- `npx tsc --noEmit` — zero new errors
- `npx vitest run` — all tests pass
- `/design-review` on Profile, Dive Center Contact, Customer Portal — PASS
