# Component Catalog

**Read this before writing JSX or creating a new file under `src/components/`.** If a primitive or composition listed here covers the concept, import it. Raw HTML elements, hand-rolled form patterns, and inline re-implementations are code smells.

Governance: `.claude/rules/existing-components-first.md` + `.claude/rules/dry-first.md` + `.claude/rules/form-field-consistency.md` + `.claude/rules/design-change-routing.md`. Drift test: `src/components/__tests__/catalog.test.ts`.

---

## Buttons & interactive

| Component | Import | Use for |
|---|---|---|
| `Button` | `@/components/ui/button` | Every `<button>` outside `ui/`. Variants: primary, secondary, ghost, destructive, destructive-ghost. Sizes: sm/md/lg. |
| `IconButton` | `@/components/ui/icon-button` | Icon-only actions. Touch-target compliant. |
| `MenuButton` | `@/components/ui/menu-button` | Navigation items, tab entries, dropdown rows. |
| `ActionLink` | `@/components/ui/action-link` | Internal `<a>` links styled as inline actions. Never use raw `<a href>`. |
| `SaveButton` | `@/components/ui/save-button` | Save/Submit with dirty/saved/loading states. Supports submit AND standalone onClick. |
| `ButtonGroup` | `@/components/ui/button-group` | Segmented control / grouped toggle buttons. |
| `TabButton` | `@/components/ui/tab-button` | Tab-bar triggers. |
| `PillToggle` / `PillToggleGroup` | `@/components/ui/pill-toggle` | Multi-select pill UI. |
| `PillToggleSection` | `@/components/ui/pill-toggle-section` | Labeled `<fieldset>`+`<legend>` wrapper with reading-plane chrome. Used by both pill groups and `CheckboxGroup`. Props: `hideLabel` (sr-only legend, preserves a11y) + `gap` (`'sm'` = `gap-1.5` for pills, `'md'` = `gap-2` for checkbox groups). Consumer provides layout as children. |

## Form fields

| Component | Import | Use instead of |
|---|---|---|
| `Input` | `@/components/ui/input` | Raw `<input type="text\|number\|password\|search">`. Supports floating label, error, helper, leading/trailing icons. |
| `Textarea` | `@/components/ui/textarea` | Raw `<textarea>`. |
| `SimpleSelect` | `@/components/ui/simple-select` | **The default for every dropdown.** Wraps native `<select>` — the OS draws the listbox, so opacity / positioning / shadow / z-index come for free. Any flat list of `{value, label}` options goes here. |
| `NumberPicker` | `@/components/ui/number-picker` | Numeric dropdown — SimpleSelect with auto-generated options from min/max/step. Use for any bounded numeric field (ranges, counts, percentages, depths, passengers, days). Matches BirthdayField's dropdown pattern for app-wide consistency. |
| `Checkbox` | `@/components/ui/checkbox` | Raw `<input type="checkbox">`. |
| `CheckboxGroup` | `@/components/ui/checkbox-group` | Multiple checkboxes sharing a label. |
| `DayPicker` | `@/components/ui/day-picker` | Single-date calendar picker. |
| `DayToggleGroup` | `@/components/ui/day-toggle-group` | Day-of-week selection (Mon–Sun). |
| `SortableOverlayList` | `@/components/ui/sortable-overlay-list` | DnD-reorderable list with overlay preview. |

## Specialized field primitives

Each primitive applies a default `field-*` width token internally via `resolveFieldWidth` (`@/lib/utils/field-width`). **Universal rule: single-line inputs max out at 50% mobile (`field-md`). Only three exceptions: `EmailField` (`field-lg`), `LanguageField` (content-driven full-width), and `Textarea` (`field-xl`, multi-line).** Never pass `className="field-lg"` or `field-xl"` at a callsite on a single-line input; rely on horizontal scroll for overflow.

| Component | Import | Default width | Use instead of |
|---|---|---|---|
| `NameField` | `@/components/ui/name-field` | `field-md` (all scopes — given / family / nickname / organization) | Raw input for names. Enforces `NAME_MAX_LENGTH`. |
| `EmailField` | `@/components/ui/email-field` | `field-lg` *(exception — long addresses)* | Raw `<input type="email">`. |
| `PhoneField` | `@/components/ui/phone-field` | `field-md` | Raw `<input type="tel">` with country selector + E.164 normalization. |
| `CountryField` | `@/components/ui/country-field` | `field-md` | Country picker. |
| `BirthdayField` | `@/components/ui/birthday-field` | `field-md` (container; internal `grid grid-cols-3` divides into year/month/day) | Three-select DOB. Stores ISO string. |
| `DateField` | `@/components/ui/date-field` | `field-md` | Raw `<input type="date">`. |
| `NumberPicker` | `@/components/ui/number-picker` | `field-xs` (112px — fits 5 digits; all integers share this width) | (listed under Form fields too — numeric dropdown.) |
| `Textarea` | `@/components/ui/textarea` | `field-xl` *(exception — multi-line, vertical scroll)* | (listed under Form fields too — long-form text.) |
| `LanguageField` | `@/components/ui/language-field` | full-width *(exception — content-driven)* | Language picker with FieldShell (label + required + error). Takes `label: string` (translated) + `max?: number` (default 4). For single-language app-locale selection, pass `max={1}`. Aligns with every other field primitive — label ownership is internal. |

## Field scaffolding

| Component | Import | Purpose |
|---|---|---|
| `FieldShell` | `@/components/ui/field-shell` | Wraps a field with label, required asterisk, error slot, helper slot. |
| `FieldLabel` | `@/components/ui/field-shell` | The ONLY label primitive. Renders required asterisk via `required` prop. Never hand-roll `<label>`. |
| `FieldError` | `@/components/ui/field-shell` | Accessible error slot keyed to field id. |
| `MetaField` | `@/components/ui/meta-field` | Read-only label/value display. |
| `RequiredAsterisk` | `@/components/ui/required-asterisk` | The `*` glyph. Don't hand-roll; `FieldLabel` consumes it via `required`. |
| `FieldRow` | `@/components/ui/field-row` | The single canonical row-of-fields parent. Unlabeled: `<FieldRow>` renders a responsive 6-col mobile / flex-wrap `items-end` desktop row. Labeled: `<FieldRow label="..." required error="...">` adds `<fieldset>`/`<legend>`/`RequiredAsterisk` with `role="group"` + `aria-describedby` to an error `<p role="alert">`. Caller supplies translated `label` + `error` strings. Children use `field-xs/sm/md/lg/xl` tokens for width. Props: `className` (outer wrapper — fieldset in labeled, div in unlabeled), `innerClassName` (inner grid in both modes — use for gap/responsive overrides), `density` (`'default'` or `'compact'`; maps to `sm:gap-4` or `sm:gap-3` — use `'compact'` for dense data layouts like inventory). |

## Form containers

| Component | Import | Purpose |
|---|---|---|
| `FormShell` | `@/components/ui/form-shell` | Generic form wrapper. |
| `FormFooter` | `@/components/ui/form-footer` | Submit/Cancel row. |
| `FormSectionHeader` | `@/components/ui/form-section-header` | Labelled section divider with optional action. |
| `WizardStepShell` | `@/components/ui/wizard-step-shell` | Wizard step container (title, description, content). |
| `BottomActionBar` | `@/components/ui/bottom-action-bar` | Fixed mobile bottom action bar (primary Save on mobile). |
| `SectionDivider` | `@/components/ui/section-divider` | Horizontal divider between sections. |
| `ItemCard` | `@/components/ui/item-card` | Removable card in a list (credentials, routes, fleet entries). Never hand-roll trash buttons. Optional `onSave` + `canSave` + `saving` + `saved` props render a Save icon-button next to the trash icon (used by draft-row-with-Save patterns like the Equipment Gear tab). |
| `EntityCardList` | `@/components/ui/entity-card-list` | **Legacy.** Responsive card editor for embedded-entities lists. Still consumed by `VenueCapabilitiesSection` (Phase 8 of Wave-2 deferred). New code prefers `InlineRowList` or `ExpandingCardList`. |
| `InlineRowList` | `@/components/profiles/collection-editors` | Generic add/remove row list for owner-edited inline-array shapes. Always-expanded rows (1–3 fields each). Caller supplies `renderRow(item, update, index)`. Drop-in replacement for ad-hoc `<ItemCard>+map+Add` patterns. Anchor consumers: `PersonalCredentialsSection`, `BoatFleetSection.routes` (nested inside ExpandingCardList). |
| `ExpandingCardList` | `@/components/profiles/collection-editors` | Collapsible card list — each row is a header that expands in place to reveal a form body. `itemKey` is required (use stable identifier or `String(index)`). Built-in optional `getCompleteness` badge, `onSave` per-row spinner, `saveErrors`/`removeErrors` keyed by item key, `defaultExpandFirst`. Anchor consumer: `BoatFleetSection`. Use for medium-complexity entities (4–8 fields) where collapse-by-default reduces scroll. |
| `SettingBlock` | `@/components/profiles/collection-editors` | Section wrapper: `FormSectionHeader` + content slot + optional `surface='glass'` chrome. Reach for when a form section needs a header + action button + content cluster. Use sparingly — most form sections don't need it. |
| `CredentialFields` | `@/components/profiles/credential-fields` | Module-scope row body for instructor credentials inside `InlineRowList`. Renders Agency / Level / AgencyID + conditional specialty-instructor-ratings checkbox. Use only via `PersonalCredentialsSection`; not a standalone primitive. |
| `ListRow` | `@/components/ui/list-row` | Reusable row with compact variant. |

## Cards & content headers

| Component | Import | Purpose |
|---|---|---|
| `Card` | `@/components/ui/card` | Generic container with padding variants. |
| `CardTitle` | `@/components/ui/card-title` | Card heading with weight/tag options. |
| `PageTitle` | `@/components/ui/page-title` | Page-level title + description + leading element. |

## Status & badges

| Component | Import | Purpose |
|---|---|---|
| `Badge` | `@/components/ui/badge` | Generic status pill. Variants: default, success, warning, destructive, info, muted. |
| `StatusBadge` | `@/components/ui/status-badge` | Semantic status badge wired to booking/reservation/bag states. |
| `ColorBadge` | `@/components/ui/color-badge` | Color swatch badge. |

## Display helpers

| Component | Import | Purpose |
|---|---|---|
| `FlagEmoji` | `@/components/ui/flag-emoji` | Country flag emoji render helper. Also exports `countryCodeToEmoji` (ISO-2 → emoji lookup). Not a badge — a display utility. |

## Feedback — errors, empty, loading

| Component | Import | Purpose |
|---|---|---|
| `InlineError` | `@/components/ui/inline-error` | Compact inline error message. |
| `ErrorCard` | `@/components/ui/error-card` | Full-card error state (section-level). |
| `ErrorAlert` | `@/components/ui/error-alert` | Banner-style alert. |
| `EmptyState` | `@/components/ui/empty-state` | Empty collection placeholder with icon + message. Requires i18n message (`empty-state-i18n.sh` hook). |
| `NotFoundCard` | `@/components/ui/not-found-card` | 404-style inline card. |
| `Spinner` | `@/components/ui/spinner` | Small loading spinner. |
| `FullPageSpinner` | `@/components/ui/full-page-spinner` | Full-viewport loading state. |
| `LoadingState` | `@/components/ui/loading-state` | Section-level loading skeleton frame. |
| `LoadingCard` | `@/components/ui/loading-card` | `LoadingState` preset for card scope (callsite alias for `<LoadingState scope="card" variant={variant} message={message} />`). Preferred over calling `LoadingState` directly when the intent is "card-shaped skeleton" — same pattern as `SaveButton`/`FullPageSpinner` preset wrappers. |
| `Skeleton` | `@/components/ui/skeleton` | Raw skeleton primitive (rect / circle). |

## Overlays

| Component | Import | Purpose |
|---|---|---|
| `Dialog` | `@/components/ui/dialog` | Modal dialog. `title` + `description` props MUST be `t(...)` calls (`dialog-title-i18n.sh` hook). |
| `DialogFooter` | `@/components/ui/dialog` | Canonical right-aligned action row for any `Dialog`. Supports single-button (omit `onSecondary`) or Cancel+Save. Use this instead of hand-rolling `<div className="flex gap-2 justify-end">`. |
| `ConfirmActionDialog` | `@/components/ui/confirm-dialog` | Confirmation dialog with destructive/primary variant. |
| `Tooltip` | `@/components/ui/tooltip` | Hover/focus tooltip. |
| `AppToaster` | `@/components/ui/app-toaster` | Root toast host (mounted once in providers). |

## Navigation

| Component | Import | Purpose |
|---|---|---|
| `Tabs` | `@/components/ui/tabs` | Canonical tablist container. Owns `activeTab` + `onChange` wiring, keyboard nav (ArrowLeft/Right with focus + active swap), `scrollIntoView` for active tab on mobile, and variant-driven trigger rendering (`underline` → `TabButton`, `pill` → `MenuButton`). Two input modes: `tabs: TabItem[]` (flat) or `groups: TabItem[][]` (multiple tab groups with a divider between them — e.g. profile-overlay static-tabs vs. role-tabs). Use for any multi-tab surface. |

## Progress

| Component | Import | Purpose |
|---|---|---|
| `StepIndicator` | `@/components/ui/step-indicator` | Wizard / onboarding step progress. |

## Role-specific

| Component | Import | Purpose |
|---|---|---|
| `RoleIcon` | `@/components/ui/role-icon` | Icon for a role key. |
| `RoleTile` | `@/components/ui/role-tile` | Large role-selection tile. |

---

## Booking compositions

| Component | Import | Purpose |
|---|---|---|
| `CustomerContactFields` | `@/components/booking/customer-contact-fields` | One customer's name + contact-method toggle (email/whatsapp/line) + language selector. Used by the booking wizard (`customer-step`) and the add-customer dialog. Takes labels via a `labels` prop; props cover variance (nameRequired, contactRequired, onRemove, hint). |
| `InstructorPicker` | `@/components/booking/instructor-picker` | Custom listbox for booking's instructor selection. Renders language flags, "Full match / Partial" badges, and collapsible tier sections (Preferred & matching / Matching / Preferred / All). **Do not reuse for generic selects — use `SimpleSelect` instead.** Its listbox carries the gold-standard floating-surface recipe (`glass-elevated glass-overlay-blur bg-surface-elevated border border-glass-border rounded-[var(--border-radius)] shadow-xl`). New custom listboxes anywhere else in the app must justify why SimpleSelect can't work. |

---

## Profile compositions

Role-agnostic building blocks for stakeholder profile forms (`PatternLibrary/one-component-all-roles`).

| Component | Import | Purpose |
|---|---|---|
| `ProfileFormShell` | `@/components/profiles/profile-form-shell` | Wraps a profile section with header + footer. |
| `ProfileBasicInfo` | `@/components/profiles/profile-basic-info` | Name + location + email + phone inputs. Used by every role's contact section. |
| `ProfileAgencyInfo` | `@/components/profiles/profile-agency-info` | Agency/certification info block (generic over row type). |
| `ProfileOverlay` | `@/components/profiles/profile-overlay` | Full-screen profile editor overlay. |
| `ProfileCompletionBadge` | `@/components/profiles/profile-completion-badge` | RadialProgress ring (no chrome, no label) that opens the profile overlay on the first incomplete tab. Rendered in TopNav whenever `profileCompletion.percentage < 100` (hidden at 100%). Single top-nav indicator; there is no separate "start" banner. |
| `AccessControlSection` | `@/components/profiles/access-control-section` | Allow/Block dive-center picker. Renders `<DiveCenter, Allow, Block>` grid with mutual exclusion + free-form (no allowlist + no blocklist = open). Exports `accessFromProfile`, `accessToPayload`, `deriveAccessMode`, `INITIAL_ACCESS_CONTROL`. Used standalone for DiveCenter access on resources. |
| `VenueCapabilitiesSection` | `@/components/profiles/venue-capabilities-section` | Single Venue surface with internal Pool / Dive Site sub-tabs. Both sub-tabs use `ExpandingCardList` for inline editing — no modal. Pre-seeds one expanded draft when the active sub-tab has 0 rows of that kind. Per-sub-tab drafts and expansion state are preserved on tab switch. Per-row Save (floppy icon). `getCompleteness` consumes server-supplied `incomplete: string[]` from `api.venues.mine` so collapsed rows enumerate missing fields. |
| `VenueFormBody` | `@/components/profiles/venue-form-body` | Polymorphic inline venue form rendered inside `VenueCapabilitiesSection`'s `ExpandingCardList`. Takes a `kind: VenueKind` prop. Pool branch: Name *, Email *, Phone *, Location *, Max Depth *, Max Capacity * + `GasMixFields`. Dive Site branch: Name *, Email *, Phone *, Location *, Max Depth *, Confined Capable, Features picker (`CheckboxGroup` over `VENUE_FEATURES`), `AccessControlSection`, `GasMixFields`. Stateless. Exports `EMPTY_VENUE_FORM` and `isVenueFormSubmittable(form, kind)`. |
| `CompressorContactSection` | `@/components/profiles/compressor-contact-section` | Compressor Contact sub-tab. Mirrors `EquipmentContactSection`/`BoatContactSection` — `BusinessContactSection` wrapper inheriting from other roles via `inheritFromOtherRoles="Compressor"`. |
| `CompressorGasMixesSection` | `@/components/profiles/compressor-profile-form` | Compressor Gas Mix sub-tab. Inline single-row form: `CheckboxGroup` (Air/Nitrox, required) + conditional `FieldRow` with min/max `NumberPicker`s when Nitrox is selected. Reads/writes the first compressor row via `BaseProfileSectionProps` (page wrapper provides `compressorId`-injected `update`). |
| `GasMixFields` | `@/components/capabilities/gas-mix-fields` | Compound field group: "has compressor" checkbox + gas-mix selector + optional nitrox range. Used by `VenueFormBody` (per-venue inline, both kinds). Host-agnostic — any stakeholder that can offer gas fills consumes it. |
| `LocationPicker` | `@/components/profiles/location-picker` | Map-backed place picker. Trigger renders eagerly; the modal (Maps SDK + places + countries) lazy-loads via `next/dynamic` on first open. Importing this does NOT pull the Maps SDK. |
| `LocationPickerModal` | `@/components/profiles/location-picker-modal` | Implementation detail of `LocationPicker` — the heavy modal chunk (Maps SDK + places autocomplete + i18n-iso-countries). Loaded only via `LocationPicker`'s `next/dynamic` import. Do not import directly from consumers. |
| `LanguagePicker` | `@/components/profiles/language-picker` | Multi-language selection with flag pills. |
| `SpecialtyField` | `@/components/profiles/specialty-field` | Specialty picker for instructors/dive-masters. |
| `LanguageFlags` | `@/components/profiles/language-flags` | Flag-only display. Exports `languageFlagText`. |
| `PreferredList` (presets: `PreferredInstructorList` / `PreferredVenueList` / `PreferredBoatList` / `PreferredEquipmentList` / `PreferredCompressorList`) | `@/components/profiles/preferred-list` | One parameterized "preferred" editor list — five named exports share a single implementation. Import the role-specific preset at the callsite; under the hood it's one file. |
| `RoleProfileForm` | `@/components/profiles/connected-role-forms` | Dynamic dispatcher. Reads `ROLE_SECTION_REGISTRY`, wires Convex queries/mutations via `ROLE_API_MODULES`, passes canonical `BaseProfileSectionProps` to the registered section. Use `hasConnectedForm(roleKey)` to check availability. |
| `ROLE_SECTION_REGISTRY` | `@/components/profiles/role-section-registry` | `Record<RoleKey, Partial<Record<sectionId, ComponentType<BaseProfileSectionProps>>>>`. Adding a new role section = export section component from its `*-profile-form.tsx`, register it here. Covered by `tests/profileSectionRegistry.test.ts` (every non-overlay `profileTabs` id must have a registered component). |
| `BusinessContactSection` | `@/components/profiles/business-contact-section` | Canonical Contact tab for every role. Props: `nameLabel` (omit for Instructor-style no-name forms), `schema`, `inheritFromOtherRoles?`, `createOverride?`, `afterSuccessfulSave?`, `extras?` (defaults + fromProfile + toPayload + render prop for role-specific add-ons like `LanguageField`). DiveCenter/Instructor/Boat/Equipment all delegate to this — never hand-roll another contact form. |
| `InstructorCardContent` | `@/components/profiles/instructor-card` | Compact instructor card body. |

---

## Form helpers (`src/lib/profile-form/*`)

| Export | Import | Purpose |
|---|---|---|
| `BaseProfileSectionProps` | `@/lib/profile-form/types` | **Every** profile form section extends this. Never define a local type alias (`local-type-alias-guard.sh` enforces). |
| `contactFieldsFromProfile` | `@/lib/profile-form/location` | Extract contact fields from a profile record. |
| `locationToPayload` | `@/lib/profile-form/location` | Serialize `LocationValue` to Convex payload. |
| `defaultFromMe` | `@/lib/profile-form/location` | Seed form state from current user. |
| `languages.*` | `@/lib/profile-form/languages` | Language field helpers. |
| `customerLanguagesBlock` / `teachingLanguagesBlock` | `@/lib/profile-form/merged-states` | Reusable form-state blocks (`{ defaults, fromProfile, toPayload }`) for the common Languages composition. Pass directly to `BusinessContactSection` `extras` instead of inlining `languagesFromProfile` / `languagesToPayload` boilerplate. |
| `composeBlocks` / `FormBlock` | `@/lib/profile-form/merged-states` | Generic factory composing N blocks into one merged `defaults` + `fromProfile` + `toPayload`. Use when a new role adds a novel feature block alongside Contact + Languages. |

## Canonical hooks (`src/lib/hooks/*`)

| Hook | Purpose |
|---|---|
| `use-profile-form` | Profile form state machine (dirty, saving, errors, on-blur via `validateField` / `fieldProps`). |
| `use-floating-label` | Floating-label behavior for Input/Select. |
| `use-click-outside` | Dismiss on outside click. |
| `use-focus-trap` | Modal focus containment. |
| `use-debounce` | Debounce a value. |
| `use-copy-feedback` | Copy-to-clipboard with success state. |
| `use-mutation-with-feedback` | Convex mutation + toast + error parsing. Anchor consumers: `organizer-languages-step`, `manage-roles-connected.handleSelectRole`. Boundary: NOT a substitute for `use-profile-form` — that hook owns full form orchestration; this one is for one-shot mutations. |
| `use-stable-query` | Stable reference for Convex queries. |
| `use-dashboard-session` | Dashboard-policy wrapper around `use-session-identity`. Exposes `status` (`loading`/`unauthenticated`/`no-role`/`ready`), `redirectPath`, `validateSlug`, `validateRoleKey`, `hasRole`. **Wrapper-only — never call `api.users.me` directly.** Architecture guard at `tests/architecture/dashboard-session-boundary.test.ts`. |
| `use-guarded-redirect` | Declarative `useEffect`-replacement for `if (cond) router.replace(to)`. Pairs with `use-dashboard-session.redirectPath`. |
| `use-current-user` | Session user accessor. |
| `use-locale-sync` | Sync next-intl locale cookie. |
| `use-booking-*` | Booking wizard data/model/effects/DnD/actions. |
| `use-portal-*` | Customer portal hooks (out of scope for most work). |
| `use-operator-defaults` | Operator default loader. |
| `use-organizer-role-api` | Role-specific API wrapper. |
| `use-blocked-date-toggle` | Calendar blocked-date toggle. |
| `use-calendar-range` | Range selection state. |
| `use-optimistic-notifications` | Optimistic notification updates. |
| `use-returning-customer` | Detect returning customer. |
| `use-wizard-preferences` | Wizard preference persistence. |

## Canonical constants (`src/lib/constants/*`)

See `.claude/rules/dry-first.md` for the full list. Key entries:

- `ROLE_BY_KEY`, `ROLE_BY_CLERK_ROLE`, `tableName`, `profileTabs` — `roles.ts`
- `BOAT_TYPES` — `boat-types.ts`
- `GAS_MIXES` — `gas-mixes.ts`
- `BUTTON_SIZE_MAP`, `ICON_BUTTON_SIZE`, `MENU_BUTTON_SIZE_MAP`, `TOUCH_TARGET_CLASS` — `button-sizes.ts`

## Canonical utilities (`src/lib/utils/*`)

- `parseNumber` — `numbers.ts`
- `formatDateRange`, `formatDateRangeLocalized`, `formatDateRangeCompact`, `formatDateShort`, `toISODateString`, `addDays`, `diffDays` — `date.ts`
- `parseConvexErrorI18n` — `convex-error.ts` (pair with `useTranslations('errors')`)

## Backend helpers (`convex/lib/*`)

For completeness; Convex code imports these, not the frontend:

- `authorize`, `authorizeWithRole`, `requireAuth` (internal) — `auth.ts`
- `profileByUser`, `profileBySlug`, `profileMine`, `ROLE_TABLE_MAP` — `profileHelpers.ts`
- `getAllUserRoles` — `userRoleHelpers.ts`
- `assertBookingTransition`, `assertReservationTransition`, `assertBagTransition` — `fsm.ts`
- `assertSnapshotImmutability` — `snapshotFields.ts`
- `getRequiredUserBySlug` — `auth.ts`

---

## When creating a new component is justified

Three signals must all be true:

1. **No existing primitive covers the concept.** Verified via grep of this catalog + `src/components/ui/` + `src/components/profiles/`.
2. **The pattern appears (or will appear) in 2+ callsites.** One-off layouts don't need extraction. At 2 semantically-identical callsites, consolidate — don't wait for a third to arrive before extracting (by then all three have diverged).
3. **The new component lives under `src/components/<feature>/` or `src/components/ui/`.** Never inline in a page/route file.

Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<dialog>`, `<a href>` outside `src/components/ui/` is a code smell. If genuinely needed (compound-control internals, DnD handles, sr-only toggles), add `{/* design-ok: <reason> */}` on the line — bare `design-ok` without a reason is blocked.

When a visual pattern repeats via className (colors, radii, overflow, animation), it is a **missing variant**, not a styling choice. Add a variant to the component — don't duplicate the className.

## Primitives at or below threshold — monitor, don't extract

These patterns exist in feature code but haven't crossed the 2-callsite extraction threshold. Extract immediately on a third appearance; do not wait for a fourth.

| Pattern | Current callsites | Notes |
|---|---|---|
| Accordion / Disclosure | `src/components/booking/boat-manifest-widget.tsx`, `src/components/profiles/location-picker.tsx` | Two semantically-distant uses (manifest group vs. autocomplete dropdown). Extract when a third collapsible section appears. |
| Popover (anchored content) | `src/components/booking/booking-calendar.tsx` | One true Popover among hand-rolled files; other "popover-shaped" surfaces were reclassified as Combobox (`resource-picker`) or Banner (`offline-indicator`). `src/components/layout/top-nav.tsx` + `src/components/notifications/notification-bell.tsx` use `react-aria-components.Popover` instead — do not conflate. Extract when a 2nd non-react-aria Popover surface appears. |
| DropdownMenu (keyed menu) | `src/components/dev/dev-switcher.tsx` | One true DropdownMenu among hand-rolled files. Same `react-aria` caveat as Popover above. Extract on a 2nd non-react-aria keyed menu. |
