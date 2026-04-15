## Existing components first

Before writing JSX or creating a new file under `src/components/`, check `src/components/CATALOG.md`. If a primitive or composition covers the concept, import it — do not hand-roll, do not define a one-off wrapper, do not duplicate via className.

## Three-signal test for new components

Creating a new component requires **all three**:

1. **No existing primitive covers the concept.** Verified by grep of `src/components/CATALOG.md`, `src/components/ui/`, and `src/components/profiles/`.
2. **The pattern appears (or will appear) in 3+ callsites.** Single-use layout doesn't need extraction — put it inline.
3. **The new file lives under `src/components/<feature>/` or `src/components/ui/`.** Never inline a component inside a page/route file or nested inside another component's render body (breaks controlled inputs — see `feedback_inline_component_remount.md`).

## Raw HTML is a code smell

Outside `src/components/ui/`, these elements are blocked by hooks or require `{/* design-ok */}`:

- `<button>` → `Button`, `IconButton`, `MenuButton`, `ActionLink`, `SaveButton`
- `<input type="tel|email|date">` → `PhoneField`, `EmailField`, `DateField`, `BirthdayField`
- `<input>` (other types) → `Input`, `Checkbox`
- `<select>` → `SimpleSelect`, `Select`
- `<textarea>` → `Textarea`
- `<label>` → `FieldLabel`
- `<dialog>` → `Dialog`, `ConfirmActionDialog`
- `<a href>` for internal navigation → `ActionLink`, `MenuButton`

`{/* design-ok */}` is reserved for compound-control internals: search filters inside pickers, sr-only toggles, DnD handles, native-accent HTML attributes. Never as a shortcut.

## Missing variants vs. styling

If a visual pattern repeats via `className` (colors, radii, overflow, animation, spacing beyond layout positioning), it is a **missing variant** on the underlying primitive, not a one-off styling choice. Add a prop or variant to the component — don't duplicate the className across callsites. Three similar `className` strings on the same primitive = extract a variant.

## Profile form shapes

Every `src/components/profiles/*-profile-form.tsx` must extend `BaseProfileSectionProps` from `@/lib/profile-form/types`. No local `type *FormState = ContactFormState & {...}` aliases — that's duplication of a canonical shape. `local-type-alias-guard.sh` enforces this. Grandfathered `// dry-ok` comments are debt slated for the merged-state factory (`@/lib/profile-form/merged-states`, plan Tier 1 F1).

## Why this matters

Every new primitive or hand-rolled wrapper is a future refactor. Every raw `<button>` or inline `<label>` is a drift opportunity against the design system. The catalog is the contract: if it's not there, it doesn't exist yet — grep first, write second, extract only when the three-signal test passes.
