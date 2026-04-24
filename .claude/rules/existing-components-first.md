## Catalog-first workflow

Before writing any JSX under `src/components/` or `src/app/`, grep `src/components/CATALOG.md` for the semantic concept. If a hit exists, import it. If not, check whether extending an existing primitive (new prop / variant) covers the case. Only then author a new component. This is the default author flow — not a checklist to run if something feels wrong.

## Existing components first

Before writing JSX or creating a new file under `src/components/`, check `src/components/CATALOG.md`. If a primitive or composition covers the concept, import it — do not hand-roll, do not define a one-off wrapper, do not duplicate via className.

## Three-signal test for new components

Creating a new component requires **all three**:

1. **No existing primitive covers the concept.** Verified by grep of `src/components/CATALOG.md`, `src/components/ui/`, and `src/components/profiles/`.
2. **The pattern appears (or will appear) in 2+ callsites.** Single-use layout doesn't need extraction — put it inline. Two semantically-identical callsites trip the rule; don't wait for a third to arrive before consolidating (by the time it does, all three have diverged).
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

## `design-ok` discipline

Every `design-ok` comment MUST include a colon-prefixed justification:

- `{/* design-ok: DnD handle requires raw button */}` — passes
- `{/* design-ok: safe-area inset, env() is dynamic */}` — passes
- `{/* design-ok */}` — blocked by `design-ok-justification.sh`

Bare `design-ok` is blocked because a justified suppression is reviewable and a bare one is invisible. The hook exempts `src/components/ui/**` (primitive internals inside variant Record objects), tests, and stories.

## Missing variants vs. styling

If a visual pattern repeats via `className` (colors, radii, overflow, animation, spacing beyond layout positioning), it is a **missing variant** on the underlying primitive, not a one-off styling choice. Add a prop or variant to the component — don't duplicate the className across callsites. Three similar `className` strings on the same primitive = extract a variant.

## Profile form shapes

Every `src/components/profiles/*-profile-form.tsx` must extend `BaseProfileSectionProps` from `@/lib/profile-form/types`. No local `type *FormState = ContactFormState & {...}` aliases — that's duplication of a canonical shape. `local-type-alias-guard.sh` enforces this. Grandfathered `// dry-ok` comments are debt slated for the merged-state factory (`@/lib/profile-form/merged-states`, plan Tier 1 F1).

## Why this matters

Every new primitive or hand-rolled wrapper is a future refactor. Every raw `<button>` or inline `<label>` is a drift opportunity against the design system. The catalog is the contract: if it's not there, it doesn't exist yet — grep first, write second, extract at 2 callsites rather than waiting for 3.
