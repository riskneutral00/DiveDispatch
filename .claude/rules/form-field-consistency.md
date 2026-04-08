## FieldLabel is the only label
Every field label in forms must use `FieldLabel` from `field-shell.tsx`. Never hand-roll `<label>` with inline required asterisks.

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
