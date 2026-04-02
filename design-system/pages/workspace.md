# Workspace Page — Design Override

> Route: `/{slug}/{roleSlug}/workspace`
> Overrides: MASTER.md
> Purpose: Operational behaviour — how the system acts on the stakeholder's behalf.

---

## Page Intent

These are system levers, not identity fields. A DiveCenter operator adjusts their acceptance
mode here; they don't describe themselves. Changes take effect immediately on future bookings.
Stakes are moderate — wrong settings cause booking friction, not data loss.

Tone: functional, efficient. Dense where appropriate. No hand-holding copy.

---

## Layout

Same structure as Profile page:

```
DashboardShell
└── page container  max-w-2xl mx-auto px-4 pt-6 pb-28 (mobile) / pb-10 (desktop)
    ├── Page title          "Workspace"  — 28px / 700 / -0.03em
    ├── Page subtitle       Role label  — 13px / secondary text
    ├── ProfileSectionTabBar  horizontal tab strip (shared component with Profile page)
    └── Tab content pane    GlassCard
        └── Save row        right-aligned, or sticky mobile footer (same spec as Profile)
```

Mobile sticky footer: identical spec to Profile page (`bottom: 60px`, surface-elevated bg,
full-width button on narrow screens).

---

## Tab Bar

Uses the same `ProfileSectionTabBar` component as the Profile page (same visual spec).

### Tabs by role group

**Organizer roles** (DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite):
```
Booking  |  Availability  |  Resources
```

**Human resource roles** (Instructor, DiveMaster):
```
Booking  |  Availability
```

**Physical resource roles** (Boat, Equipment, Pool, Compressor):
```
Asset Details  |  Booking  |  Availability
```

Note: Physical resource roles have no Profile page — Workspace is their only self-management
destination. "Asset Details" absorbs what would otherwise be their profile form.

---

## Tab Content: Booking

For all roles. Controls how the stakeholder's availability is offered and confirmed.

### Acceptance Mode

Three-option radio card group. Each option is a `GlassCard` tile — NOT a standard radio input.

```
┌───────────────────────────────┐  ┌───────────────────────────────┐  ┌───────────────────────────────┐
│  Auto-accept                  │  │  Pre-pay required             │  │  Post-pay allowed             │
│  Confirmed automatically      │  │  Payment before confirmation  │  │  Confirm before payment       │
│  when all slots are filled.   │  │                               │  │                               │
└───────────────────────────────┘  └───────────────────────────────┘  └───────────────────────────────┘
```

- Card width: equal thirds on desktop, full-width stacked on mobile.
- Selected state: border `var(--color-primary)`, 2px. Background: `var(--color-glass-bg-hover)`.
- Unselected: standard glass border, standard fill.
- Transition: border-color 0.3s ease.
- Each card has a title (bold, 14px) and a description (secondary, 13px).

### Confirmation toggles

Below the Acceptance Mode cards:

```
[ ] Confirm before accepting a booking request
[ ] Confirm before declining a booking request
```

Standard checkbox + label. 44px touch target row. 8px gap between the two rows.

### Section spacing

24px between the Acceptance Mode group and the Confirmation toggles group.
A faint section divider (`border-top: 1px solid var(--color-glass-border)`) between groups
on desktop only — not on mobile (spacing alone suffices).

---

## Tab Content: Availability

Controls working hours and buffer time.

```
Max hours per day     GlassInput  type="number"  min=1 max=16   suffix="hrs"
Post-job buffer       GlassInput  type="number"  min=0 max=480  suffix="min"
```

- Both fields in a single-column stack, 16px gap.
- Helper text below each input in secondary color, 12px:
  - Max hours: "Maximum time bookable in a single calendar day."
  - Buffer: "Break between jobs before the next booking can start."
- Validation: show error inline below the field if value is out of range on blur.

---

## Tab Content: Resources (Organizer roles only)

Top of tab: **CoverageStatus widget** — existing component. Full width. Displays whether the
organizer has at least one confirmed resource of each type. Keep this at the top; it's the
"health check" before the lists.

Below: five preferred-resource lists, stacked vertically with 24px gap between sections.
Each section:

```
SECTION HEADER (11px / 600 / 0.08em / uppercase) — e.g. "INSTRUCTORS"
[ + Add preferred instructor ]
  ─ slug card  ─ slug card  ─ slug card
```

- Section header: `var(--color-text-secondary)` at the section header style from MASTER.
- Add button: `GlassButton` secondary, compact (32px height). Sits at top-right of section on desktop, full-width below header on mobile.
- Resource slug cards: displayed as a wrapping tag cloud, not a list.
  Each tag: `GlassCard` micro (28px height, 8px h-padding), role icon (16px) + slug text (12px).
  Remove `×` on each tag: 24px touch target, `var(--color-text-secondary)` color.
- Empty section: "None added yet" in secondary text (no empty state illustration needed).

Five sections in order: Instructors → Venues → Equipment → Boats → Compressors.

---

## Tab Content: Asset Details (Physical resource roles only)

This tab absorbs the role-specific profile form for Boat, Equipment, Pool, Compressor.
These are operational specs, not public identity:

- **Boat:** fleet type, routes, max passengers, hull number.
- **Equipment:** tank sizes, inventory count, condition notes.
- **Pool:** dimensions, depth range, filtration type.
- **Compressor:** fill types, max pressure, fill stations count.

Layout: single-column GlassInput stack within the GlassCard. Same field spacing as other tabs (16px).

---

## Save Feedback

Identical to Profile page:
- In-flight: button disabled + spinner.
- Success: "Saved ✓" for 2 seconds in `var(--color-active-fg)`.
- Error: inline message below Save button.

Each tab saves independently — no cross-tab dependency.

---

## Empty / Loading States

Same shimmer skeleton spec as Profile page.

---

## Accessibility

Same `role="tablist"` / `role="tab"` / arrow-key navigation spec as Profile page.
Acceptance Mode radio cards: `role="radio"` / `role="radiogroup"` / `aria-checked`.
Keyboard: Space to select a radio card, Tab to move between groups.

---

## Anti-patterns (do not use)

- No profile fields on this page (location, credentials, associations, languages). Those live on Profile.
- No wizard chrome (StepIndicator). Independent tabs only.
- Do NOT merge Booking + Availability into one tab — they're edited on different cadences.
- Do NOT show the Resources tab to Instructor or DiveMaster roles — they don't manage resources.
- Do NOT use a dropdown for Acceptance Mode — the three-card radio group communicates the options far better.
