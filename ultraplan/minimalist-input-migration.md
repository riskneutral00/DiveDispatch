# Minimalist Input Migration — Underline Floating Labels

Approved 2026-04-07. Run from CLI:

```
/ultraplan migrate all form inputs to underline floating-label pattern per ultraplan/minimalist-input-migration.md
```

## Reference Implementation

The mock at `src/app/(dashboard)/mock-form/page.tsx` is the approved design. Read it first — that IS the target.

## Context Files (via symlinks in this folder)

| Symlink | Target | Purpose |
|---------|--------|---------|
| `agents/` | `.claude/agents/` | Agent definitions (airbnb, designer archived) |
| `skills/` | `.claude/skills/` | Skill definitions (ui-fix, design-review, etc.) |
| `hooks/` | `.claude/hooks/` | PostToolUse hooks to update |
| `rules/` | `.claude/rules/` | Design rules (mobile-first, spacing, etc.) |
| `settings.json` | `.claude/settings.json` | Hook registry |
| `design-system/` | `design-system/` | MASTER.md + page overrides |
| `CLAUDE.md` | `CLAUDE.md` | Project invariants |

These are live symlinks — they always reflect the current state of the repo.

## Design Decisions (all approved by Matt)

- **Floating label**: label text + required asterisk sit inside the input area. Empty+unfocused: label at rest position. Focused or filled: label floats small above the value.
- **Underline only**: no glass container, no blur, no border-radius on inputs. Single bottom border. Background transparent.
- **Skin-tunable underline**: new CSS variable `--color-field-underline` per skin in `skins.ts`. Unfocused = `--color-field-underline`. Focused = `--color-primary`. Error = `--color-destructive`.
- **No phantom error containers**: error text only renders when error exists. No reserved h-4 space when empty.
- **Cancel + Save paired**: all save buttons accompanied by Cancel. Both in a `grid grid-cols-2 gap-3` row. Cancel = ghost (transparent + border), Save = primary. Inside `BottomActionBar` on mobile.
- **Field widths use CSS Grid**: parent containers are `grid grid-cols-6 gap-3`. Field-width classes (`.field-name` etc.) use `grid-column: span N` inside `@layer utilities` in globals.css. Already implemented — do not change.

## What to Change

1. `src/themes/skins.ts` + `theme-types.ts` — add `fieldUnderline` to palette, generate `--color-field-underline` CSS var per skin
2. `src/components/ui/input.tsx` — floating underline label, remove glass classes, collapse error container
3. `src/components/ui/field-shell.tsx` — FieldLabel becomes floating, FieldError conditional render (not opacity toggle)
4. `src/components/ui/select.tsx` + `simple-select.tsx` — same underline treatment
5. `src/components/ui/save-button.tsx` — render Cancel + Save paired
6. `src/components/profiles/profile-form-footer.tsx` — pass cancel handler, paired layout
7. `design-system/MASTER.md` — new "Input Pattern" section documenting underline floating labels, update Component Catalog glass assignments, update Field Width Scale to note grid parent requirement
8. `Architecture/component-invariants.md` — update Input rules (underline, not glass)
9. `.claude/hooks/glass-enforcement.sh` — exempt input/select elements from glass requirement
10. `.claude/hooks/design-token-enforcement.sh` — add `--color-field-underline` to known tokens
11. `.claude/skills/ui-fix/SKILL.md`, `design-review/SKILL.md` — reference new input pattern
12. Delete `src/app/(dashboard)/mock-form/` after migration verified

## Do NOT Change

- Button glass styling (buttons keep glass)
- Card/dialog glass styling (containers keep glass)
- Glass system itself (stays for non-input surfaces)
- Field-width CSS classes (already migrated to @layer utilities grid-column)
- BottomActionBar component (already exists, just add Cancel alongside Save)

## Verification

- Playwright at 375px: every form shows underline inputs with floating labels, Cancel+Save paired, no phantom spacing
- Playwright at 1440px: desktop layout preserved
- `npx tsc --noEmit` — zero new errors
- `npx vitest run` — all tests pass
- `/design-review` on Profile, Dive Center Contact, Customer Portal — PASS
- Focus an input → underline turns primary color, label floats
- Switch skin → underline color changes per skin
