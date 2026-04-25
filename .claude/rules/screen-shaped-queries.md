## One screen, one query

A screen-level component reads **one aggregation query** that returns everything it needs. Sub-components consume from context or props — they don't subscribe themselves.

**Numeric form:** no non-provider component may issue more than **3** `useQuery` / `useStableQuery` calls.

## Why

Convex multiplexes subscriptions over one websocket, so the cost of N entity queries isn't network round trips — it's:

1. N server handlers running in parallel (sum of DB time).
2. N staggered re-renders as queries resolve at different moments.
3. N live subscriptions held open for the screen's lifetime.

One aggregation collapses all three.

## Carve-outs (exempt)

- **Provider files** — `*-provider.tsx`, `*Provider.tsx`. They ARE the aggregation layer.
- **Tests** — `__tests__/`, `*.test.tsx`.
- **Genuine multi-source widgets** — opt out with `// query-budget-ok: <specific reason>`. Reason must be concrete; "complex screen" is not a reason.

## Anchor example

`convex/themes.ts:myThemeContext` (added 2026-04-25). One query returns `{ user, selectedTheme, selectedThemeAppearance, savedSkins }`. Provider consumes it; `BgSwitcher` reads `savedSkins` from theme context — no subscription.

## How to apply when adding a new screen

1. List every `useQuery` you're about to write.
2. If more than 1–2 belong to the same domain, write a `screen.context` query in `convex/<domain>.ts`.
3. Auth-check once at the top of the handler (graceful-null pattern for unauthed if it's a public-ish screen).
4. Sub-components consume via context or props.

## How to apply when refactoring an existing screen

1. Survey existing subscriptions at the top of the file.
2. Group by source table / domain.
3. Write one aggregation query per group.
4. Migrate consumers; delete now-orphan entity queries in the same PR.

## Enforcement

- Hook: `.claude/hooks/screen-query-budget.sh` (PostToolUse on `src/components/**` and `src/app/**`).
- Test: `tests/architecture/query-budget.test.ts` (CI sweep).
- Pattern: `Vaults/DiveDispatch/wiki/PatternLibrary/screen-shaped-queries.md`.
