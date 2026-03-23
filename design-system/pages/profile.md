# Profile Page — Design Override

> Route: `/{role}/{slug}/profile`
> Overrides: MASTER.md
> Purpose: Public role identity — location, contact, credentials/associations, languages.

---

## Page Intent

This is the user's public face on the platform. What other stakeholders see in the Directory.
Changes here stamp onto bookings and resource cards. Consequence is real — design for
deliberate editing, not quick taps.

Tone: calm, authoritative. Not an onboarding form. A professional's record.

---

## Layout

```
DashboardShell (bg-image + bg-overlay already handled by shell)
└── page container  max-w-2xl mx-auto px-4 pt-6 pb-28 (mobile) / pb-10 (desktop)
    ├── Page title          "Profile"  — 28px / 700 / -0.03em
    ├── Page subtitle       Role label (e.g. "Dive Center") — 13px / secondary text
    ├── SettingsTabBar      horizontal tab strip (see Tab Bar section)
    └── Tab content pane    GlassCard wrapping the active tab's fields
        └── Save row        right-aligned GlassButton "Save" + saved confirmation
```

Mobile: the Save row becomes a **sticky footer strip** pinned above the mobile nav bar.
`position: fixed; bottom: 60px; left: 0; right: 0; padding: 12px 16px;`
Background: `var(--color-surface-elevated)` with top border `var(--color-glass-border)`.
The Save button inside is full-width on screens < 480px.

Desktop (≥ 768px): Save stays inside the GlassCard, right-aligned, no sticky behaviour.

---

## Tab Bar (`SettingsTabBar` component)

Horizontal strip of text tabs. **Not** numbered steps — no forward/back dependency.
Each tab saves independently. User can jump between tabs freely.

```
┌────────────┬──────────────┬─────────────────────┐
│  Contact   │  Languages   │  Credentials / Assoc │
└────────────┴──────────────┴─────────────────────┘
```

### Visual spec

| State    | Color                          | Border-bottom            | Weight |
|----------|--------------------------------|--------------------------|--------|
| Active   | `var(--color-text-primary)`    | 2px `var(--color-primary)` | 600  |
| Inactive | `var(--color-text-secondary)`  | none                     | 400    |
| Hover    | `var(--color-text-primary)`    | none                     | 400    |

- Tab height: 40px. Min tab width: 72px. Padding: 0 16px.
- Tab strip border-bottom: `1px solid var(--color-glass-border)` (the rail).
- Active tab's 2px border sits on top of the rail (negative margin-bottom: -1px).
- Tab strip scrolls horizontally on mobile (`overflow-x: auto; white-space: nowrap`).
  No scrollbar visible (`scrollbar-width: none`).
- Tab strip has NO glass background of its own — it floats above the page background.
- Transition: color 0.3s ease (MASTER constraint — no other animations).

### Tab content pane

`GlassCard` — uses `.glass-container` class (no blur, no shadow — just the ghost border).
Padding: 24px desktop / 16px mobile.
Full width within the page container.

### Tabs by role

**All human roles** always get Contact + Languages.

| Role | Tab 3 |
|---|---|
| Instructor, DiveMaster | Credentials |
| DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel | Associations |
| DiveSite | (no Tab 3) |

**Resource roles (Boat, Equipment, Pool, Compressor):** No profile page at this route.
These roles are redirected to Settings if they navigate here.

---

## Tab Content: Contact

Fields rendered as a single-column stack, 16px gap between each field group.

```
Location          LocationPicker (Google Places + draggable pin)
Contact email     GlassInput  type="email"   label="Contact email"
Contact phone     GlassInput  type="tel"     label="Phone"
```

LocationPicker renders at full width. It's already the most complex widget on the page —
give it breathing room. No field is hidden behind a disclosure; all three are always visible.

---

## Tab Content: Languages

Checkbox grid. Languages the stakeholder works in (teaches, guides, operates in).

- 2-column grid on desktop, 1-column on mobile (< 480px).
- Each row: checkbox + language name. 44px minimum touch target height.
- No "Select all" affordance — deliberate choice per language.
- If zero checked on save: show inline error "Select at least one language" in
  `var(--color-urgent-fg)` directly below the grid.

---

## Tab Content: Credentials (Instructor / DiveMaster)

Add/remove rows. Each row: agency name + certification level + ID number.

- "Add credential" button: `GlassButton` variant secondary, full-width on mobile, left-aligned on desktop.
- Remove: small `×` button on the right of each row. 44px touch target.
- Empty state: "No credentials added yet" in secondary text, centered.
- No maximum row count enforced in UI (backend validates).

---

## Tab Content: Associations (Operator roles)

Same add/remove pattern as Credentials.
Each row: agency name + membership number.

---

## Save Feedback

After successful save: button label changes to "Saved ✓" for 2 seconds, then reverts.
Use `var(--color-active-fg)` (green) for the "Saved ✓" state.
On error: show a toast or inline error message below the Save button.
Button is disabled (and shows spinner) while the mutation is in-flight.

---

## Empty / Loading States

- Tab content loading: skeleton rows (2–3 placeholder lines) inside the GlassCard.
  Use `var(--color-glass-bg)` animated shimmer (opacity 0.5 → 1 → 0.5, 1.5s, `prefers-reduced-motion` respected).
- If user has no data yet for a tab, show the blank form — not an empty state illustration.
  Profile editing is always available; emptiness is the natural starting state.

---

## Accessibility

- Tab bar uses `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`.
- Tab panels use `role="tabpanel"` with matching `id`.
- Keyboard: arrow keys navigate between tabs (standard tab widget pattern).
- All form inputs have `<label>` — never placeholder-only.
- Save button: `aria-busy="true"` when in-flight.
- Sticky footer on mobile: `z-index: 30` (above content, below DashboardShell header at z-40).

---

## Anti-patterns (do not use)

- No linear wizard chrome (StepIndicator, "Next →", progress bar). This is not onboarding.
- No full-page spinner while switching tabs — tabs should feel instant.
- No auto-advance on save — user decides when to switch tabs.
- No confirmation modal before saving — profile edits are low-risk, can be re-edited.
- No collapsible sections within a tab — if a tab has enough content to need collapse, split it into another tab.
