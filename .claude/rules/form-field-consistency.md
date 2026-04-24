## FieldLabel is the only label
Every field label in forms must use `FieldLabel` from `field-shell.tsx`. Never hand-roll `<label>` with inline required asterisks.

## Field primitives own their label
Every field primitive under `src/components/ui/` (`input.tsx`, `textarea.tsx`, `simple-select.tsx`, `select.tsx`, `number-picker.tsx`, `checkbox.tsx`, `checkbox-group.tsx`, `day-picker.tsx`, `day-toggle-group.tsx`, `phone-field.tsx`, `email-field.tsx`, `name-field.tsx`, `country-field.tsx`, `birthday-field.tsx`, `date-field.tsx`, `language-field.tsx`) takes `label?: string` and renders `FieldLabel` internally via `FieldShell`. Never wrap a single field primitive in an external `FieldShell` at a callsite — if the primitive lacks a label prop, that's the bug; fix the primitive, not the callsite. `FieldShell` is reserved for composite sections that render multiple controls under one legend; for row-of-fields legends use `FieldRow` with its `label` prop instead.

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
Every `src/components/profiles/*-profile-form.tsx` must extend `BaseProfileSectionProps` from `@/lib/profile-form/types`. No local `type *FormState = ContactFormState & {...}` aliases — that's duplication of a canonical shape. Enforced by `local-type-alias-guard.sh` PostToolUse hook.
