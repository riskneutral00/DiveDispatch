## FieldLabel is the only label
Every field label in forms must use `FieldLabel` from `field-shell.tsx`. Never hand-roll `<label>` with inline required asterisks.

## Field primitives own their label
Every field primitive under `src/components/ui/` (`input.tsx`, `textarea.tsx`, `simple-select.tsx`, `select.tsx`, `number-picker.tsx`, `checkbox.tsx`, `checkbox-group.tsx`, `day-toggle-group.tsx`, `phone-field.tsx`, `email-field.tsx`, `name-field.tsx`, `country-field.tsx`, `birthday-field.tsx`, `date-field.tsx`, `language-field.tsx`) takes `label?: string` and renders `FieldLabel` internally via `FieldShell`. Never wrap a single field primitive in an external `FieldShell` at a callsite — if the primitive lacks a label prop, that's the bug; fix the primitive, not the callsite. `FieldShell` is reserved for composite sections that render multiple controls under one legend; for row-of-fields legends use `FieldRow` with its `label` prop instead.

`DayPicker` was deleted as a primitive (single callsite — the year-of-birth dropdown — uses a generic `SimpleSelect` with explicit `field-xs` instead). Do not reintroduce a day-of-month wrapper; if you need one, the right primitive is `DayToggleGroup` (day-of-week) or `BirthdayField` (full date). Never hand-roll a day dropdown.

## Truthful select values: the `SelectValue` discriminated union

`SimpleSelect` (and any wrapper select primitive) accepts a discriminated-union `SelectValue` instead of an overloaded `string | undefined`:

```
type SelectValue =
  | { kind: "empty" }                                       // no value chosen
  | { kind: "set"; value: string }                          // value is one of the options
  | { kind: "stale"; value: string; label?: string }        // persisted value no longer in options
  | { kind: "loading" };                                    // options still loading
```

Use `fromOptional(value)` (exported from `simple-select.tsx`) when adapting a legacy `string | undefined` form-state field — it normalizes to the union. The primitive auto-detects `stale` when a `set` value is not in `options`, and renders the loading placeholder when `loading` is `true`. Empty / loading / stale states are visibly distinct and ARIA-correct; never overload them onto `""` at the callsite.

**Stale-label resolver.** Pass `getStaleLabel?: (value: string) => string` to render a human label for a deprecated/missing option (e.g., agency renamed). When omitted, the primitive falls back to the i18n `common.deprecatedValue` template — never a raw value string. Placeholder, loading, and deprecated-value copy all flow through `useTranslations("common")` (`select`, `loading`, `deprecatedValue`) — no hardcoded English in the primitive or at callsites.

**Async option flows.** Any select whose options arrive from a query must thread `loading={isOptionsLoading}` so the primitive renders the loading kind instead of pretending the value is empty. Anchor: `PreferredOperatorPicker` and the booking itinerary select.

Locked by `tests/architecture/select-truth-contract.test.ts` — it covers empty, explicit-empty, stale (with and without resolver), loading, and required-empty cases. New select primitives or new "missing" states must extend the union and the test, not bypass it.

## Canonical row factories live next to their Zod schema

For every repeating-row Zod schema in `src/lib/schemas/profile-shared.ts` (agent associations, instructor credentials, dive-center associations, boat routes, boat fleet entries, venue capabilities, venue form), the file exports a `makeDefault<Row>(overrides?: Partial<Row>)` factory colocated with the schema. Editors and `fromProfile` adapters MUST import these factories — never define a component-local "blank row" builder, and never spread literal defaults inline at a callsite. `Partial<Row>` overrides are the only escape hatch for partial-record loads.

**Why colocated, not in the editor file.** A required field added to the Zod schema must force a corresponding factory default in the same file, or `tests/architecture/row-factory-contract.test.ts` (the schema-introspective lock) fails CI. The arch test walks every `(schema, fromProfile, factory)` triple and asserts the factory satisfies `safeParse` for both empty and partial-load shapes. A component-local factory escapes that lock — that is the defect class this rule prevents.

**The pool persistence corollary.** When a row's persisted shape differs from the input shape (e.g., `confinedCapable` is forced to `true` by the backend for `kind: "pool"`), the row factory and the `toPayload` adapter own that asymmetry — never the editor component. Anchor: `convex/venues.ts:166-170` + the venue capabilities factory in `profile-shared.ts`.

## Required = `required` prop, not label text
Required fields get `required` prop on Input/SimpleSelect/FieldShell → FieldLabel renders the asterisk. Never append "(optional)" to labels — absence of asterisk IS the optional signal.

## Number inputs need inputMode
All `type="number"` inputs must also set `inputMode="numeric"` (integers) or `inputMode="decimal"` (floats) for correct mobile keyboard.

## Form state types must match schema
If a Zod schema field is `z.number()`, the form state field must be `number` (not `string`). Parse in onChange, not in toPayload. `schema.safeParse(form)` runs on raw form state.

## ItemCard for removable list items
Use `ItemCard` for any removable card in a list (credentials, routes, fleet entries). Never hand-roll trash buttons.

## DayToggleGroup for day-of-week selection
Use `DayToggleGroup` from `ui/day-toggle-group.tsx`. Never hand-roll day toggle buttons with inline styles.

## Profile form state extends BaseProfileSectionProps
Every `src/components/profiles/*-profile-form.tsx` must extend `BaseProfileSectionProps` from `@/lib/profile-form/types`. No local `type *FormState = ContactFormState & {...}` aliases — that's duplication of a canonical shape. Enforced by `local-type-alias-guard.sh` PostToolUse hook. Grandfathered `// dry-ok` comments are debt slated for the merged-state factory (`@/lib/profile-form/merged-states`, plan Tier 1 F1).

## Universal rule: single-line inputs max out at 50% mobile (`field-md`)

Every single-line input defaults to `field-md` (50% mobile, 176px desktop). Inputs scroll horizontally when content exceeds the box — length is never a reason to widen. The 176px cap is content-defined, not viewport-defined: a phone number is ~16 chars regardless of whether you're on a 375px phone or a 1920px monitor. Fields do not grow with the viewport; wasted desktop space enables pairing (First + Last + Nickname + Phone on one row), not expansion.

**Three exceptions** allowed to exceed `field-md`:
1. **`EmailField`** (`field-lg`) — long addresses render full-width on mobile, cap at 256px on desktop.
2. **`LanguageField`** (content-driven full-width) — shows language chips; width is intrinsic to the picker.
3. **`Textarea`** (`field-xl`) — multi-line input; vertical scroll, not horizontal. Full-width is correct.

That's it. `CountryField`, `LocationPicker`, entity names (organization / venue / boat / dive-center business name), instructor names, any other single-line text — all `field-md`. The content scrolls if too long.

## Content-length buckets

Every field primitive has a default `field-*` width token baked in via `resolveFieldWidth` (`src/lib/utils/field-width.ts`). Callsites do NOT pass a width class unless genuinely overriding.

| Bucket | Content profile | Token | Mobile (of 6 cols) | Desktop px | Primitives |
|---|---|---|---|---|---|
| Integer | 1–5 digits | `field-xs` | span 2 (33%) | 112 *(fits 5 digits — "20251")* | `NumberPicker`, integer `<Input type="number">`, integer `<SimpleSelect>` (year/count) |
| Short code | 5–8 chars | `field-sm` | span 2 (33%) | 112 *(visually equivalent to field-xs; kept for semantic intent — gender / blood type / currency)* | explicit only — no primitive default |
| **Default for single-line inputs** | 8–20+ chars (scrolls if longer) | `field-md` | span 3 (50%) | 176 | `NameField` (all scopes), `PhoneField`, `BirthdayField`, `DateField`, `CountryField`, `LocationPicker`, entity-name `<Input>` |
| Email *(exception)* | 20–40 chars | `field-lg` | span 6 (full-mobile) | 256 | `EmailField` only |
| Textarea *(exception)* | multi-line | `field-xl` | span 6 (full) | 100% | `Textarea` only |

**Mobile parent contract.** Span-of-6 tokens only resolve when the parent is `grid grid-cols-6` — `FieldRow` is the canonical wrapper. Forms that wrap fields in `grid grid-cols-1 sm:grid-cols-2` are drift; migrate them to `FieldRow`.

**Composite fields** (BirthdayField, future time/range pickers): the *container* picks its bucket; internal sub-cells use `grid grid-cols-N gap-2` to divide. Never re-apply a `field-*` class on a sub-cell.

**When to override at a callsite.**
- Integer fields that need `field-xs` / `field-sm` explicitly on a generic primitive (`SimpleSelect` for a count, `<Input type="number">`).
- Layout pattern that bypasses the grid (e.g., `className="flex-1"` inside a flex container).
- Never to force `field-lg` or `field-xl` on a single-line input that isn't email. Rely on horizontal scroll for overflow.
- Never to re-apply the primitive's default — that's redundant.

**Generic primitives** (`Input`, `SimpleSelect`, `Select`) have *no* default and require an explicit `field-*` (or passthrough / `design-ok` / `flex-1`) at every callsite inside a `FieldRow`. Enforced by `.claude/hooks/field-width-required.sh`.

**Integer parity.** Every integer-valued input across the app renders at `field-xs` (112px). Year, tank count, depth, diver capacity, percent, gear size counts — same width everywhere. `NumberPicker` applies the default automatically. For a `SimpleSelect` holding numeric options, or a raw `<Input type="number">`, the callsite must pass `className="field-xs"` explicitly (generic primitive contract).

**Changing sizing in the future.**
- **Global** ("make every first name narrower"): edit the `resolveFieldWidth('field-md', …)` default in `src/components/ui/name-field.tsx`. Every callsite updates automatically.
- **Per-callsite** ("narrower only on account page"): pass `className="field-sm"` at that specific callsite.
