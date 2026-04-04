# Profile Page — Design Override

> Route: `/{slug}/{roleSlug}/profile`
> Also rendered inside: `ProfileOverlay` (fullscreen Dialog from dashboard)
> Overrides: MASTER.md
> Purpose: Public role identity — location, contact, credentials/associations, languages.

---

## Page Intent

This is the user's public face on the platform. What other stakeholders see in the Directory.
Changes here stamp onto bookings and resource cards. Consequence is real — design for
deliberate editing, not quick taps.

Tone: calm, authoritative. Not an onboarding form. A professional's record.

---

## Two Rendering Contexts

### 1. Profile Page (dedicated route)

```
DashboardShell (bg-image + bg-overlay already handled by shell)
└── page container  max-w-3xl mx-auto px-4 pt-6 pb-28 (mobile) / pb-10 (desktop)
    ├── Page title          "Profile"  — 28px / 700 / -0.03em
    ├── Page subtitle       Role label (e.g. "Dive Center") — 13px / secondary text
    ├── SettingsTabBar      horizontal tab strip (Contact | Languages | Affiliations)
    └── Tab content pane    Active tab's section from the profile form
        └── Save row        right-aligned Button "Save Changes" + saved confirmation
```

Each tab renders one `section` of the profile form. Tabs defined in `PROFILE_REGISTRY`.

### 2. Profile Overlay (slide-out panel)

```
Dialog fullScreen
├── Tab bar             Profile | Preferences | Account (overlay-level tabs)
└── Scrollable panel    max-w-3xl mx-auto px-4 py-6
    └── Profile tab     Full profile form (all sections in one scroll, no section filter)
```

The overlay renders the entire profile form as a single scroll — no sub-tabs.
Section headers (BASIC INFORMATION, LANGUAGES, AFFILIATIONS) and `<hr>` dividers
provide visual separation between groups.

---

## Layout Details

Mobile: the Save row becomes a **sticky footer strip** pinned above the mobile nav bar.
`position: fixed; bottom: 60px; left: 0; right: 0; padding: 12px 16px;`
Background: `var(--color-surface-elevated)` with top border `var(--color-glass-border)`.
The Save button inside is full-width on screens < 480px.

Desktop (≥ 768px): Save stays at the end of the form, right-aligned, no sticky behaviour.

---

## Tab Bar (`SettingsTabBar` component — profile page only)

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

## Section: Contact (Basic Information)

Fields rendered in a 2-column `FormGrid`, responsive — collapses to single column on mobile.

```
Business Name (lg)     Location (lg)           — FormField size="lg" (full row each)
Contact Email (md)     Contact Phone (sm)      — side-by-side on desktop
```

Uses `Input` for text fields, `LocationPicker` for location.

---

## Section: Languages

Flag-pill picker using `LanguagePicker` component. Languages the stakeholder works in
(teaches, guides, operates in). Stored on user record (`customerLanguages`), not on the
role-specific profile.

- Search input with counter (e.g. "2 / 4")
- Rows of flag pills grouped by region (Asian, European)
- 44px minimum touch target height per pill
- Max 4 languages by default

---

## Section: Credentials (Instructor / DiveMaster)

Add/remove rows. No card wrapper — fields sit directly on the page. Multiple credentials
separated by `<hr className="form-divider">` between each row (not before first).

- "Add credential" button: `Button` variant secondary, full-width on mobile, left-aligned on desktop.
- Remove: `Trash2` icon button, top-right of each row. 44px touch target.
- Empty state: "No credentials added yet" in secondary text, centered.
- No maximum row count enforced in UI (backend validates).

---

## Section: Associations (Operator roles)

Add/remove pattern. No card wrapper — fields sit directly on the page. Multiple
affiliations separated by `<hr className="form-divider">` between each group (not before first).

```
Agency (Select)     Member ID (Input)    — side-by-side, pr-10 for remove button
Default course #days     OW / AOW / O+A            — DayPicker selects
Default specialties      Toggle pill chips          — with "More..." overflow
```

- "+ Add" button: right-aligned, secondary text with Plus icon. 44px touch target.
- Remove: `Trash2` icon, absolute top-right of each group. 44px touch target.
- Internal spacing: `space-y-4` within each affiliation, `space-y-6` between groups.
- Empty state: "No affiliations added. Click Add to register one." in secondary text.
- Mandatory specialties show lock icon, cannot be toggled.

---

## Save Feedback

After successful save: button label changes to "Saved ✓" for 2 seconds, then reverts.
Button background changes to `var(--color-active-fg)` (green) for the "Saved ✓" state.
On error: show inline error message below the form.
Button is disabled (and shows spinner) while the mutation is in-flight.

---

## Empty / Loading States

- Tab content loading: skeleton rows (2–3 placeholder lines) inside the Card.
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
- Remove buttons: `aria-label="Remove affiliation"` or `aria-label="Remove credential"`.
- Sticky footer on mobile: `z-index: 30` (above content, below DashboardShell header at z-40).

---

## Anti-patterns (do not use)

- No linear wizard chrome (StepIndicator, "Next →", progress bar). This is not onboarding.
- No full-page spinner while switching tabs — tabs should feel instant.
- No auto-advance on save — user decides when to switch tabs.
- No confirmation modal before saving — profile edits are low-risk, can be re-edited.
- No collapsible sections within a tab — if a tab has enough content to need collapse, split it into another tab.
- No raw `<select>` or `<input>` elements — use Glass components for consistency.
