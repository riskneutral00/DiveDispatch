# Account Page — Design Override

> Route: `/account`
> Overrides: MASTER.md
> Purpose: Clerk-bound personal identity and app-wide preferences. One per person, regardless of role.

---

## Page Intent

The least-visited page. Users come here to fix their name, change their language, or adjust
theme. Not a profile (public-facing), not settings (booking behaviour). Personal hygiene.

Tone: plain and efficient. No ceremony. A clean form that gets out of the way.

---

## Layout

No tabs. Single scrollable form. The content is shallow enough that tabs would add friction,
not clarity.

```
DashboardShell
└── page container  max-w-lg mx-auto px-4 pt-6 pb-10
    ├── Page title    "Account"  — 28px / 700 / -0.03em
    ├── GlassCard     contains all fields in a single-column stack
    │   ├── Section: Identity
    │   ├── ── (divider)
    │   ├── Section: App preferences
    │   └── ── (divider)
    └── Save row      right-aligned GlassButton, inside the GlassCard at the bottom
```

Max-width `max-w-lg` (672px) — narrower than Profile/Settings because this is a simple form,
not a multi-section layout. Full-width on mobile.

---

## Section: Identity

Fields that match the Clerk identity layer and business presentation:

```
First name      GlassInput  type="text"   required
Last name       GlassInput  type="text"   required
Business name   GlassInput  type="text"   required (hidden for personal roles: Instructor, DiveMaster)
Contact email   GlassInput  type="email"  optional  (note: not Clerk auth email — a contact address)
```

- 16px gap between fields.
- "Business name" is conditionally rendered. It is NOT disabled — it is absent from the DOM
  for roles where it doesn't apply (Instructor, DiveMaster).
- Contact email: helper text below: "Shown to booking parties. Different from your sign-in email."
  12px / `var(--color-text-secondary)`.

---

## Section Divider

```html
<hr style="border-color: var(--color-glass-border); margin: 24px 0;" />
```

Simple rule. No label on the divider itself — the first field of each section provides
enough context.

---

## Section: App Preferences

```
App language    GlassSelect   label="App language"
                              Options: same language list as sign-up wizard (flag + native name)
                              Current value: user.preferredLocale

Notifications   GlassSelect   label="Preferred channel"
                              Options: WhatsApp, LINE, Messenger, WeChat, KakaoTalk, Instagram, None
                              Current value: user.preferredChannel

Theme           [ThemeSwitcher inline or GlassSelect]
                              Already accessible via header icon — surface here too for discoverability.
                              If using GlassSelect: option labels = theme display names.
```

- App language: render the same flag + native script label style as the sign-up wizard.
  Do NOT use ISO codes as display text.
- Preferred channel: display the channel's icon (16px) alongside the name in the select options.
- Theme: if the existing header theme-switcher is a custom component, embed it inline here
  rather than building a second implementation. Import and render directly.

---

## Save

Single Save button at the bottom of the GlassCard. Right-aligned on desktop, full-width on mobile.

Same feedback pattern as Profile and Settings:
- In-flight: disabled + spinner.
- Success: "Saved ✓" for 2 seconds, `var(--color-active-fg)`.
- Error: inline message below button.

**One save covers all fields on this page** — no per-section saves. The form is short enough
that a single submit is the correct UX.

---

## Loading State

Skeleton for each field (single-line shimmer, 40px height, 100% width) inside the GlassCard.
Render 5 skeleton rows while data loads. Same shimmer spec as Profile/Settings.

---

## Danger Zone (future consideration — not in current scope)

A "Delete account" action would live below a second `hr` divider, in `var(--color-urgent-fg)`.
Not implemented now — placeholder only if the section is scaffolded.

---

## Accessibility

- All inputs have `<label>` elements with `for` pointing to input `id`.
- GlassSelect uses native `<select>` or ARIA combobox — not a custom click-outside-to-close div.
- No placeholder-only inputs.
- Tab order: First name → Last name → Business name → Contact email → App language → Channel → Theme → Save.

---

## Anti-patterns (do not use)

- No tabs on this page. Single form.
- No "Account" section repeated in the Profile or Settings pages — this page owns personal identity.
- Do NOT show role-specific fields here (location, credentials, associations). Those live on Profile.
- Do NOT require re-entering the Clerk auth email — that's managed by Clerk, not this form.
- No sticky footer on this page — the form is short enough that Save is always reachable by scrolling.
  Exception: if the form grows beyond 600px of content, revisit.
