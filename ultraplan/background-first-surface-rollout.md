# Background-First Surface Rollout

Approved 2026-04-09.

## How to run

```text
/ultraplan apply the background-first surface rollout per ultraplan/background-first-surface-rollout.md
```

## Decision

The background must remain the hero. Containers may show a visible perimeter so the user knows they are inside a bounded area, but the container body itself should not read as a separate glass slab.

**Input fields always carry subtle glass (blur + fill) for readability.** Typed text must be readable against the background. Hover/focus may intensify the effect. Transient overlays (menus, dropdowns, toasts) also keep elevated glass because they layer over other content.

## Perception model

Target perception for edit-heavy surfaces:

1. Background (always visible, the hero)
2. One visible container perimeter (transparent body)
3. Floating chrome (titles, tabs, actions, helper labels — crisp, no glass)
4. Input fields (always have subtle blur + fill for readability)
5. Transient overlays (menus, dropdowns, toasts — elevated glass for readability over UI content)

No extra readability cards, fog layers, or semi-opaque glass panels between the user and the background. Readability comes from field-level and overlay-level glass, not container-level slabs.

## Canonical rule set

- `glass-container` → perimeter only, no fill, no blur
- `glass-dialog` → perimeter shell, not a fogged readability panel
- Internal cards inside edit containers default transparent unless they represent a true sub-surface with its own boundary
- Tabs, chips, close buttons, and summary rows should read as chrome on the background, not as mini glass slabs
- Inputs always carry subtle glass (blur + fill) for readability; hover/focus intensifies

## Reference code shape

```css
.glass-container {
  background: transparent;
  border: 1px solid var(--color-glass-container-border);
  border-radius: var(--border-radius);
  box-shadow: none;
}

.glass-dialog {
  background: transparent;
  border: 1px solid var(--color-glass-dialog-border);
  backdrop-filter: none;
}

.field-underline {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  backdrop-filter: blur(8px);
}

.field-underline:hover,
.field-underline:focus,
.field-underline[data-selected='true'] {
  background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}
```

## Rollout order

### P0 — shared primitives
- `src/app/globals.css`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`

### P1 — shared shells and account/profile
- `src/components/layout/dashboard-shell.tsx`
- `src/components/profiles/profile-overlay.tsx`
- `src/components/profiles/profile-form-shell.tsx`
- `src/components/account/profile-tab.tsx`
- `src/components/account/preferences-editor.tsx`

### P2 — booking/dashboard surfaces
- `src/components/layout/dashboard-content.tsx`
- `src/components/booking/booking-calendar.tsx`
- `src/components/booking/itinerary-step.tsx`
- `src/components/profiles/preferred-list.tsx`
- `src/components/profiles/location-picker.tsx`

## Do not do

- Do not add ambient blur to whole containers
- Do not introduce nested readability cards by default
- Do not make tabs or close buttons feel like thick glass pills unless the interaction truly needs elevation
- Do not hide the background behind a tinted panel just to improve readability; solve readability at the field level first

## Verification

- Background remains clearly readable through every account/profile/dashboard container
- A user can identify the container bounds from the perimeter alone
- Inputs become the strongest interactive surface on hover/focus
- 375px and 1440px both preserve the same perception model
- `npx tsc --noEmit` passes
- relevant Vitest suites pass
