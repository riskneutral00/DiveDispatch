# Gate Fix: Preferences Editor Tests + Frontend Components

Approved 2026-04-07. Run from CLI:

```
/ultraplan fix all quality gate blocking findings per ultraplan/gate-fix-preferences-frontend.md
```

## Context

The `/gate` run produced a NO-GO verdict: 2 CRITICAL + 5 HIGH findings from `review-frontend` and `review-tests`. All findings are MANUAL (no auto-fix). This plan addresses every blocking finding to get the gate to CLEAN.

## Context Files (via symlinks in this folder)

| Symlink | Target | Purpose |
|---------|--------|---------|
| `rules/` | `.claude/rules/` | Design rules (mobile-first, spacing, i18n, etc.) |
| `design-system/` | `design-system/` | MASTER.md + page overrides |
| `CLAUDE.md` | `CLAUDE.md` | Project invariants |

Key files to read before starting:
- `Architecture/testing-invariants.md` — testing rules (Rule 1: no mocked Convex)
- `Architecture/component-invariants.md` — Rule 1: no raw HTML, Rule 10: stories required
- `tests/preferencesUpsert.test.ts` — existing backend integration tests (258 lines, covers upsert + Agent role)
- `tests/helpers/convex-helpers.ts` — `makeT()` for real Convex test contexts

---

## Part A — Test Architecture (CRITICAL-1, CRITICAL-2, HIGH-3, HIGH-4)

### Problem
`tests/components/preferences-editor.test.tsx` uses `vi.mock('convex/react')` to stub `useQuery`/`useMutation` — violating testing-invariants Rule 1. Assertions are weak (getAllByText tautology). Agent role path is untested.

### Approach: Extract Inner + Test with Props

**Why not just fix mocks?** `convex-test` has no React-compatible client (no `.client` property for `<ConvexProvider>`). We can't render the component against a real in-memory Convex. The only way to satisfy Rule 1 (no mock of `convex/react`) while still testing rendering is to split data fetching from rendering.

**Backend integration already exists:** `tests/preferencesUpsert.test.ts` (258 lines) tests the upsert mutation with `makeT()` — including Agent role, all 5 resource arrays, and role validation. Rule 4 is satisfied.

### Changes

**1. `src/components/account/preferences-editor.tsx`** — Extract `PreferencesEditorInner`

Split ~5 lines out. The connected wrapper calls `useQuery`/`useMutation` and delegates:

```tsx
// Thin connected wrapper (stays as default export behavior)
export function PreferencesEditor({ section, roleSlug }: PreferencesEditorProps) {
  const prefs = useQuery(api.stakeholderPreferences.mine)
  const upsert = useMutation(api.stakeholderPreferences.upsert)
  return <PreferencesEditorInner section={section} roleSlug={roleSlug} prefs={prefs} upsert={upsert} />
}

// Inner: all existing logic, but prefs + upsert come from props
export function PreferencesEditorInner({ section, roleSlug, prefs, upsert }: PreferencesEditorInnerProps) {
  // ... existing 550 lines unchanged, just using props instead of hooks
}
```

The `savePreferences` callback, `useProfileForm`, state, effects — all stay in Inner. Only `useQuery` and `useMutation` move to the wrapper.

**Important:** The type for `upsert` prop is the return type of `useMutation(api.stakeholderPreferences.upsert)`. Use `ReactMutation<typeof api.stakeholderPreferences.upsert>` from `convex/react` or just infer it.

**2. `tests/components/preferences-editor.test.tsx`** — Full rewrite

- Remove `vi.mock('convex/react')` entirely
- Import `PreferencesEditorInner` instead of `PreferencesEditor`
- Pass `prefs` and `upsert` as props (typed correctly from Convex)
- Keep `vi.mock('next/navigation')` (Next.js routing, not Convex)
- Keep preferred-list component stubs (leaf components with own test coverage)
- `upsert` prop: use `vi.fn()` typed as the mutation function — this is a callback prop, NOT a Convex mock

**Fix weak assertion (HIGH-3):** Replace `getAllByText('Instructors').length >= 1` with:
```tsx
const tabs = screen.getAllByRole('tab')
expect(tabs.map(t => t.textContent)).toEqual(['Instructors', 'Venues & Boats', 'Equipment', 'Compressors'])
```
`ProfileSectionTabBar` renders `role="tab"` on each button (confirmed at `src/components/account/profile-section-tab-bar.tsx:59`). `SimpleSelect` for mobile renders a `<select>`, not tabs — no false matches in jsdom.

**Add Agent role coverage (HIGH-4):**
```tsx
it('renders Operator sub-tab for Agent role', () => {
  render(<PreferencesEditorInner section="resources" roleSlug="agent" prefs={null} upsert={mockUpsert} />)
  const tabs = screen.getAllByRole('tab')
  expect(tabs.map(t => t.textContent)).toContain('Operator')
})
```

Note: `PreferredOperatorPicker` is NOT stubbed, but it only renders when `resourceSubTab === 'operator' && activeRole === 'Agent'`. On initial render the default sub-tab is `'instructors'`, so it won't render. If a test navigates to the operator tab, stub `PreferredOperatorPicker` to avoid its 4 `useQuery` calls — add it to the existing component stub block.

**Critical files:**
- `src/components/account/preferences-editor.tsx` (extract inner, ~195-264 are the lines to split)
- `tests/components/preferences-editor.test.tsx` (full rewrite)

---

## Part B — Frontend Component Fixes (HIGH-5, HIGH-6, HIGH-7)

### Fix 1: Raw drag handle buttons (HIGH-5)

**Files:** `src/components/profiles/preferred-list.tsx` (lines 195-202, 565-567)

Replace both raw `<button>` drag handles with the existing `Button` component (already imported at line 17):

```tsx
<Button
  ref={handleRef}
  variant="ghost"
  size="icon"
  className="shrink-0 cursor-grab active:cursor-grabbing"
  aria-label={t('dragToReorder')}
>
  <GripVertical size={14} />
</Button>
```

- `Button size="icon"` gives `min-h-[44px] min-w-[44px]` touch target automatically
- Add `import { useTranslations } from 'next-intl'` at top of file
- Add `const t = useTranslations('common')` to both `SortableInstructorCard` and `SortableOverlayCard`
- Add `dragToReorder` key to all 6 locale files under `common` namespace

**i18n files to update:** `messages/en.json`, `fr.json`, `ko.json`, `th.json`, `zh-CN.json`, `zh-TW.json`

Translations:
- en: `"dragToReorder": "Drag to reorder"`
- fr: `"dragToReorder": "Glisser pour réorganiser"`
- ko: `"dragToReorder": "드래그하여 순서 변경"`
- th: `"dragToReorder": "ลากเพื่อเรียงลำดับใหม่"`
- zh-CN: `"dragToReorder": "拖动以重新排序"`
- zh-TW: `"dragToReorder": "拖曳以重新排序"`

### Fix 2: BottomActionBar desktop layout (HIGH-6)

**Files:** `src/components/ui/bottom-action-bar.tsx`, `src/components/profiles/profile-form-footer.tsx`

**Root cause:** Line 21 inner wrapper has `[&>div]:w-full [&>div]:md:w-auto` which forces child divs to shrink-wrap on desktop. When `ProfileFormFooter` wraps leftAction + SaveButton in a `flex justify-between` div, that div shrinks and `justify-between` can't spread.

**Fix:** Add `fullWidth` prop to `BottomActionBar`:

```tsx
interface BottomActionBarProps {
  children: ReactNode
  className?: string
  fullWidth?: boolean
}

export function BottomActionBar({ children, className, fullWidth }: BottomActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-[60px] inset-x-0 z-[var(--z-sticky)] p-3 glass border-t border-glass-border',
        'md:static md:border-t-0 md:p-0 md:bg-transparent md:backdrop-blur-none md:shadow-none',
        !fullWidth && 'md:flex md:justify-end',
        className,
      )}
    >
      <div className={cn(
        'w-full',
        !fullWidth && 'md:w-auto',
        '[&>button]:w-full [&>button]:md:w-auto',
      )}>
        {children}
      </div>
    </div>
  )
}
```

Key changes from current:
- `fullWidth` prop (default false) — existing consumers unchanged
- `[&>div]:w-full [&>div]:md:w-auto` removed — was forcing child divs to shrink
- `[&_button]` changed to `[&>button]` — direct child only, don't reach into nested components

In `profile-form-footer.tsx`: pass `fullWidth={!!leftAction}` and add `gap-3` to the leftAction flex wrapper (currently missing gap).

### Fix 3: Missing Storybook stories (HIGH-7)

**New file:** `src/components/ui/bottom-action-bar.stories.tsx`

Check existing story patterns first: `ls src/components/ui/*.stories.tsx` — match the Meta/StoryObj pattern used in those files.

3 stories:
- `SingleAction` — default case, single save button (tests right-alignment on desktop, full-width on mobile)
- `FullWidth` — leftAction case with two buttons + justify-between (tests `fullWidth` prop)
- `WithClassName` — demonstrates className passthrough (tests the `pt-4` pattern used by preferences-editor)

Use `parameters: { layout: 'fullscreen' }` because the component uses `fixed` positioning on mobile.

---

## Execution Order

1. Extract `PreferencesEditorInner` (production code, safe — no behavior change)
2. Rewrite test file (depends on step 1)
3. Fix `bottom-action-bar.tsx` — add `fullWidth` prop, fix selectors
4. Fix `profile-form-footer.tsx` — wire `fullWidth={!!leftAction}`, add `gap-3`
5. Create `bottom-action-bar.stories.tsx`
6. Fix drag handles in `preferred-list.tsx`
7. Add i18n keys to all 6 locale files
8. Run `npx vitest run` — verify all 4475+ tests pass
9. Run `npx tsc --noEmit` — type safety
10. Run `/gate` — verify CLEAN verdict

Steps 1-2 are independent of steps 3-7. Can parallelize.

---

## Do NOT Touch

- `tests/preferencesUpsert.test.ts` — already correct, uses real Convex via `makeT()`
- `src/components/account/__tests__/preferences-editor.test.ts` — pure function tests for `buildResourceSubTabs`, already correct
- Other component test files that mock `convex/react` — out of scope, systemic migration
- z-index tokens in `globals.css` — MEDIUM finding, not blocking, separate ticket
- `mock-form/page.tsx` — prototype page, separate migration ticket

## Verification

1. `npx vitest run` — all tests pass (4475+ existing + new Agent role test)
2. `npx tsc --noEmit` — type safety
3. `npx vitest run tests/components/preferences-editor.test.tsx` — targeted test run
4. `/gate` — CLEAN verdict, 0 CRITICAL, 0 HIGH
5. Confirm `PreferencesEditor` connected wrapper still works (grep for all import sites — they import `PreferencesEditor`, not the inner component)
