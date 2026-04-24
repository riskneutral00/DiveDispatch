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

## Form fields

| Component | Import | Use instead of |
|---|---|---|
| `Input` | `@/components/ui/input` | Raw `<input type="text\|number\|password\|search">`. Supports floating label, error, helper, leading/trailing icons. |
| `Textarea` | `@/components/ui/textarea` | Raw `<textarea>`. |
| `SimpleSelect` | `@/components/ui/simple-select` | Raw `<select>` when options are a flat list. |
| `NumberPicker` | `@/components/ui/number-picker` | Numeric dropdown — SimpleSelect with auto-generated options from min/max/step. Use for any bounded numeric field (ranges, counts, percentages, depths, passengers, days). Matches BirthdayField's dropdown pattern for app-wide consistency. |
| `Select` | `@/components/ui/select` | Rich select with search, custom rendering, keyboard nav. |
| `Checkbox` | `@/components/ui/checkbox` | Raw `<input type="checkbox">`. |
| `CheckboxGroup` | `@/components/ui/checkbox-group` | Multiple checkboxes sharing a label. |
| `DayPicker` | `@/components/ui/day-picker` | Single-date calendar picker. |
| `DayToggleGroup` | `@/components/ui/day-toggle-group` | Day-of-week selection (Mon–Sun). |
| `SortableOverlayList` | `@/components/ui/sortable-overlay-list` | DnD-reorderable list with overlay preview. |

## Specialized field primitives

| Component | Import | Use instead of |
|---|---|---|
| `NameField` | `@/components/ui/name-field` | Raw input for names. Enforces `NAME_MAX_LENGTH`. |
| `EmailField` | `@/components/ui/email-field` | Raw `<input type="email">`. |
| `PhoneField` | `@/components/ui/phone-field` | Raw `<input type="tel">` with country selector + E.164 normalization. |
| `CountryField` | `@/components/ui/country-field` | Country picker. |
| `BirthdayField` | `@/components/ui/birthday-field` | Three-select DOB. Stores ISO string. |
| `DateField` | `@/components/ui/date-field` | Raw `<input type="date">`. |
| `LanguageField` | `@/components/ui/language-field` | Single-language picker. |

## Field scaffolding

| Component | Import | Purpose |
|---|---|---|
| `FieldShell` | `@/components/ui/field-shell` | Wraps a field with label, required asterisk, error slot, helper slot. |
| `FieldLabel` | `@/components/ui/field-shell` | The ONLY label primitive. Renders required asterisk via `required` prop. Never hand-roll `<label>`. |
| `FieldError` | `@/components/ui/field-shell` | Accessible error slot keyed to field id. |
| `MetaField` | `@/components/ui/meta-field` | Read-only label/value display. |
| `RequiredAsterisk` | `@/components/ui/required-asterisk` | The `*` glyph. Don't hand-roll; `FieldLabel` consumes it via `required`. |
| `FieldRow` | `@/components/ui/field-row` | The single canonical row-of-fields parent. Unlabeled: `<FieldRow>` renders a responsive 6-col mobile / flex-wrap `items-end` desktop row. Labeled: `<FieldRow label="..." required error="...">` adds `<fieldset>`/`<legend>`/`RequiredAsterisk` with `role="group"` + `aria-describedby` to an error `<p role="alert">`. Caller supplies translated `label` + `error` strings. Children use `field-xs/sm/md/lg/xl/checkbox` tokens for width. `className` lands on the outer wrapper only — in unlabeled mode the outer wrapper IS the inner grid, so callsite Tailwind overrides (e.g. `sm:gap-3`) work; in labeled mode `className` goes on the fieldset. |

## Form containers

| Component | Import | Purpose |
|---|---|---|
| `FormShell` | `@/components/ui/form-shell` | Generic form wrapper. |
| `FormFooter` | `@/components/ui/form-footer` | Submit/Cancel row. |
| `FormGrid` / `FormField` | `@/components/ui/form-grid` | Responsive field grid with span sizing. |
| `FormSectionHeader` | `@/components/ui/form-section-header` | Labelled section divider with optional action. |
| `WizardStepShell` | `@/components/ui/wizard-step-shell` | Wizard step container (title, description, content). |
| `BottomActionBar` | `@/components/ui/bottom-action-bar` | Fixed mobile bottom action bar (primary Save on mobile). |
| `SectionDivider` | `@/components/ui/section-divider` | Horizontal divider between sections. |
| `ItemCard` | `@/components/ui/item-card` | Removable card in a list (credentials, routes, fleet entries). Never hand-roll trash buttons. Optional `onSave` + `canSave` + `saving` + `saved` props render a Save icon-button next to the trash icon (used by draft-row-with-Save patterns like the Equipment Gear tab). |
| `EntityCardList` | `@/components/ui/entity-card-list` | Responsive card grid editor for a list of embedded entities. Handles FormSectionHeader + Add button, empty state, add/remove wiring, minItems/maxItems enforcement. Consumer supplies `renderCard(item, update, index)` for card interior and `emptyItem()` factory for new entries. Uses `ItemCard` internally. Grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. Use for any owner-edited array-of-entities pattern (venues, boat fleet, credentials, etc.); do NOT use for directory-pick lists — those use `SortableOverlayList`. |
| `AddEntityButton` | `@/components/ui/add-entity-button` | Canonical "add row" button — secondary, small, with Plus icon. Used inside `EntityCardList`'s header action slot; also composable standalone. |
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
| `FlagEmoji` | `@/components/ui/flag-emoji` | Country flag emoji. Also exports `countryCodeToEmoji`. |

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
| `LoadingCard` | `@/components/ui/loading-card` | Card-shaped loading skeleton. |
| `Skeleton` | `@/components/ui/skeleton` | Raw skeleton primitive (rect / circle). |

## Overlays

| Component | Import | Purpose |
|---|---|---|
| `Dialog` | `@/components/ui/dialog` | Modal dialog. `title` + `description` props MUST be `t(...)` calls (`dialog-title-i18n.sh` hook). |
| `ConfirmActionDialog` | `@/components/ui/confirm-dialog` | Confirmation dialog with destructive/primary variant. |
| `Tooltip` | `@/components/ui/tooltip` | Hover/focus tooltip. |
| `AppToaster` | `@/components/ui/app-toaster` | Root toast host (mounted once in providers). |

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

## Profile compositions

Role-agnostic building blocks for stakeholder profile forms (`PatternLibrary/one-component-all-roles`).

| Component | Import | Purpose |
|---|---|---|
| `ProfileFormShell` | `@/components/profiles/profile-form-shell` | Wraps a profile section with header + footer. |
| `ProfileFormHeader` | `@/components/profiles/profile-form-header` | Section header with role name and create/update hint. |
| `ProfileFormFooter` | `@/components/profiles/profile-form-footer` | Save / close footer. |
| `ProfileFormLoading` | `@/components/profiles/profile-form-loading` | Loading skeleton for profile forms. |
| `ProfileBasicInfo` | `@/components/profiles/profile-basic-info` | Name + location + email + phone inputs. Used by every role's contact section. |
| `ProfileAgencyInfo` | `@/components/profiles/profile-agency-info` | Agency/certification info block (generic over row type). |
| `ProfileOverlay` | `@/components/profiles/profile-overlay` | Full-screen profile editor overlay. |
| `ProfileCompletionPill` | `@/components/profiles/profile-completion-pill` | % completion badge that opens the overlay (kind: 'partial'). |
| `ProfileStartBanner` | `@/components/profiles/profile-start-banner` | "Start your X profile" destructive-tone banner when role-table row is missing (kind: 'not_started'). |
| `BusinessContactSection` | `@/components/profiles/business-contact-section` | Contact fields for business roles (name, location, email, phone). |
| `AccessControlSection` | `@/components/profiles/access-control-section` | allow/not-allow controls. Exports `accessFromProfile`, `accessToPayload`, `INITIAL_ACCESS_CONTROL`. |
| `VenueCapabilitiesSection` | `@/components/profiles/venue-capabilities-section` | Multi-venue list editor. Uses `EntityCardList` + `VenueEditDialog` for Add/Edit. Each card shows read-only summary of one venue row with an Edit button. |
| `VenueContactSection` | `@/components/profiles/venue-contact-section` | Venue Contact sub-tab. Reads/writes the operator's `organizations` row (business name, email, phone, address) — NOT venue rows. Multi-venue operators have a single business identity; individual venues are edited in Capabilities. |
| `VenueEditDialog` | `@/components/profiles/venue-edit-dialog` | Shared Create/Edit dialog for individual venue rows. Collects name, subtype, location, depth, capacity, confined, hasCompressor, access-control slug lists. Consumed by `VenueCapabilitiesSection`. |
| `LocationPicker` | `@/components/profiles/location-picker` | Map-backed place picker. Use `location-picker-lazy` for dynamic import. |
| `LanguagePicker` | `@/components/profiles/language-picker` | Multi-language selection with flag pills. |
| `SpecialtyField` | `@/components/profiles/specialty-field` | Specialty picker for instructors/dive-masters. |
| `LanguageFlags` | `@/components/profiles/language-flags` | Flag-only display. Exports `languageFlagText`. |
| `PreferredInstructorList` / `PreferredVenueList` / `PreferredBoatList` / `PreferredEquipmentList` / `PreferredCompressorList` | `@/components/profiles/preferred-list` | Role-specific "preferred" editor lists. |
| `RoleProfileForm` | `@/components/profiles/connected-role-forms` | Dynamic dispatcher for role → profile form. Use `hasConnectedForm(roleKey)` to check availability. |
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
| (planned) merged-state factory | `@/lib/profile-form/merged-states` | Contact + languages + access merged-state composition. Drops local `FormState = ContactFormState & {...}` aliases across roles. See plan Tier 1 F1. |

## Canonical hooks (`src/lib/hooks/*`)

| Hook | Purpose |
|---|---|
| `use-profile-form` | Profile form state machine (dirty, saving, errors). |
| `use-floating-label` | Floating-label behavior for Input/Select. |
| `use-click-outside` | Dismiss on outside click. |
| `use-focus-trap` | Modal focus containment. |
| `use-debounce` | Debounce a value. |
| `use-copy-feedback` | Copy-to-clipboard with success state. |
| `use-mutation-with-feedback` | Convex mutation + toast + error parsing. |
| `use-stable-query` | Stable reference for Convex queries. |
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
2. **The pattern appears (or will appear) in 3+ callsites.** One-off layouts don't need extraction.
3. **The new component lives under `src/components/<feature>/` or `src/components/ui/`.** Never inline in a page/route file.

Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<dialog>`, `<a href>` outside `src/components/ui/` is a code smell. If genuinely needed (compound-control internals, DnD handles, sr-only toggles), add `{/* design-ok */}` on the line.

When a visual pattern repeats via className (colors, radii, overflow, animation), it is a **missing variant**, not a styling choice. Add a variant to the component — don't duplicate the className.
