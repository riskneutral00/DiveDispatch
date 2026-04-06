# Component + State Invariants

> Canonical rules for UI components, design tokens, and state management. Referenced by CLAUDE.md and skills.
> Last updated: 2026-04-06

## Component Rules

1. **The component system is the ONLY rendering path.** No raw `<button>`, `<input>`, `<select>`, or `<textarea>` elements in feature code (`src/app/`, `src/components/booking/`, `src/components/profiles/`, etc.). Use `Button`, `GlassButton`, `IconButton`, `Input`, `GlassInput`, etc.
   - Enforced by: PostToolUse hooks block undersized touch targets. `/gate` flags raw interactive elements in feature code.
   - Violation history: 15+ raw `<button>` elements with inline `min-h-[44px]`. Each one was a copy-paste of touch target enforcement that the component system already handles.
   - **Legacy exception:** ~60 raw buttons exist in compound patterns (calendar grids, tab bars, drag handles, equipment increment/decrement). These are tracked as component redesign tickets. New code MUST NOT add more. The hook blocks undersized raw buttons (sub-44px touch targets).

2. **One component, all roles. NEVER per-role pages.** DD has 12 stakeholder roles. A booking calendar, a dashboard, a profile form — each is ONE component parameterized by role via `dashboard-config.ts`. Do not create `agent-booking-list.tsx`, `instructor-dashboard.tsx`, etc.
   - Enforced by: `/review-frontend` flags new role-specific page components
   - Violation history: Per-role implementations (`agent-booking-list.tsx`, `referral-tracker.tsx`) were built, then deleted after consolidation into `BookingCalendar`. This happened THREE TIMES before the rule was established. The cost of violating this rule is measured in weeks of wasted work.

3. **No `className` for visual properties.** Components expose `variant`, `size`, `intent` props. Style customization happens by creating a new variant, not by passing arbitrary CSS. Feature components do not override component visuals via className.
   - Enforced by: `/design-review` references this file
   - Context: SkinCommerce requires every visual property to flow through tokens so skin switching propagates automatically. `className` overrides bypass the token system and become visual bugs when skins change.

4. **All visual values through design tokens.** No hardcoded Tailwind utility classes that bypass the token system.
   - `text-body` not `text-sm` (both 14px, but only `text-body` tracks `--font-size-body`)
   - `text-label` not `text-xs` (both 12px, but only `text-label` tracks `--font-size-label`)
   - `rounded-[var(--border-radius-button)]` not bare `rounded`
   - `var(--transition-speed)` not `duration-150`
   - CSS variable color tokens not inline `color-mix()` in feature code
   - Enforced by: PostToolUse hooks (`type-scale-enforcement.sh`, `design-token-enforcement.sh`) — hard block on `text-sm`, `text-xs`, `rounded-*` variants, inline hex/rgb, Tailwind palette colors
   - Escape hatch: `{/* design-ok */}` on the same line (for genuinely exceptional cases like `text-[10px]` in dense data tables)

5. **Shared hooks for shared patterns.** If a pattern appears in 2+ components, extract a hook. Do not copy-paste `useEffect` + `addEventListener` + cleanup.
   - Violation history: 4 inline outside-click handlers in `select.tsx`, `pill-toggle.tsx`, `booking-calendar.tsx`, `dev-switcher.tsx`. Each was a copy of the same mousedown listener + cleanup pattern.

6. **`useProfileForm` is the only form system.** All stakeholder profile forms use `useProfileForm` + `ProfileFormShell` + `FormGrid` + `FieldShell`. No manual `useState` for form fields in profile components.
   - Violation history: `organizer-basic-step.tsx` managed its own `name`, `location`, `email`, `phone`, `saving`, `error`, `initialized` state — a complete bypass of the form system.

## State Management Rules

7. **Booking, reservation, and payment mutations are always pessimistic.** Wait for the server round-trip. No optimistic updates for financial or commitment operations.
   - Existing implementation: `acceptReservation`, `declineReservation`, `cancelBooking` all wait for Convex round-trip. This is correct.
   - Both Airbnb and Uber independently arrived at this same rule.

8. **Optimistic updates require explicit rollback on error.** No empty `catch {}` blocks. If an optimistic update fails, revert the local state AND surface the error to the user.
   - Enforced by: `/ai-slop`, `/review-frontend` flag empty catch blocks in optimistic handlers
   - Violation history: `useOptimisticNotifications` had empty `catch {}` blocks at lines 83, 114, 148. If `markAsRead` failed, the UI showed success but server state never changed.

9. **Optimistic updates are permitted only for non-financial, non-commitment state.** Notifications, preferences, UI toggles — yes. Bookings, reservations, payments — never.

## Token Type Scale

5-stop scale. Each stop is clearly distinct — no two adjacent stops within 1px.

| Token | Size | Tailwind class |
|-------|------|---------------|
| `--font-size-section-header` | 11px | `text-section-header` |
| `--font-size-label` | 12px | `text-label` |
| `--font-size-body` | 14px | `text-body` |
| `--font-size-card-title` | 16px | `text-card-title` |
| `--font-size-page-title` | 28px | `text-page-title` |

## Exceptions

- `ui/` and `glass/` component internals MAY use `color-mix()` — they are the component-level variant definitions using CSS variables as inputs. Feature components may not.
- `rounded-full` is permitted (MASTER.md sanctioned for pills/avatars).
