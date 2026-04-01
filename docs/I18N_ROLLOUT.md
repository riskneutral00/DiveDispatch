# i18n rollout (next-intl)

## Namespaces

| Namespace    | Purpose |
|-------------|---------|
| `app`       | Marketing / landing |
| `nav`       | Global navigation labels |
| `auth`      | Sign-in, sign-up, role selection |
| `booking`   | Operator booking UI (status, actions) |
| `common`    | Shared actions, loading, retries |
| `onboarding`| Dashboard onboarding banner |
| `errors`    | Route error boundaries (`error.tsx` segments) |
| `portal`    | Tokenized customer portal |

Typed list: [`src/i18n/namespaces.ts`](../src/i18n/namespaces.ts).

## Migration order (incremental)

1. **Done:** Dashboard shell onboarding banner, `/dashboard` redirect spinner, route error boundaries + `RouteErrorPage` retry, portal token page shell (steps, headers, completion/closed states).
2. **In progress:** Booking wizard — shell copy in `booking.wizard.*` (`booking-wizard.tsx`). **Next within booking:** wizard step components + booking calendar.
3. **Then:** Settings, directory, notifications.
4. **Ongoing:** New user-visible copy goes into `messages/en.json` first; mirror keys in `zh-CN`, `zh-TW`, `th`, `fr`, `ko` before merge.

## Verification

- Run `npm run i18n:verify` — ensures every locale file has the same key tree as `en.json`.

## Lint / review

- ESLint does not flag raw JSX strings yet (would be noisy until migration advances). Prefer `useTranslations(ns)` / `getTranslations({ namespace: ns })` for new screens.
- PR review: avoid new hardcoded English in migrated areas listed above.
