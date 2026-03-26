# DiveDispatch — Launch Skeleton

> **Goal:** MVP production launch
> **Last updated:** 2026-03-26

---

## Launch Readiness Checklist

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | Security: input sanitization | **BLOCKED** | DD-069 (P1, review NO-GO). Portal mutations missing sanitization, ZWJ/ZWNJ edge cases. |
| 2 | Security: rate limiting | **BLOCKED** | DD-081 (P3, review NO-GO). 4 portal mutations missing limits, no TTL cleanup. |
| 3 | E2E: edit + cancel flows | **IN REVIEW** | DD-019 (P2). |
| 4 | E2E: happy path walkthrough | **IN REVIEW** | DD-094 (P0). Browser walkthrough confirming end-to-end. |
| 5 | Frontend: enhanced directory | **IN REVIEW** | DD-058 (P3). Language filter bug (ISO 639-1 vs country codes), a11y gaps. |
| 6 | Backend test coverage ≥ 77% | **DONE** | Currently 76.63% overall, bookings at 92%. |
| 7 | Frontend test coverage ≥ 50% | **NOT DONE** | Currently ~30%. |
| 8 | Deploy config (Vercel + Convex prod) | **NOT DONE** | No production deploy yet. |
| 9 | Sentry integration | **NOT DONE** | DD-015 (P1, ready). Zero prod error visibility. |
| 10 | Screenshot-ready for ASPN deck | **NOT DONE** | 3 views needed: dashboard, resource provider, customer portal. |

---

## Ticket Summary

| Status | Count | Details |
|--------|-------|---------|
| Done | 55 | In `.tickets/done/` |
| Review (NO-GO) | 5 | DD-069, DD-081, DD-058, DD-019, DD-094 |
| Backlog | 27 | Remaining `.tickets/DD-*.md` files |

---

## Open Decisions

| Decision | Options | Needed by |
|----------|---------|-----------|
| Screenshot views for ASPN deck | Which 3 pages to polish? (dashboard, resource provider, portal proposed) | Apr 1 |

---

## Reference Docs

| Document | Location |
|----------|----------|
| Architecture + invariants | `CLAUDE.md` |
| Design system | `design-system/MASTER.md` |
| Ticket board | `.tickets/` |
| Product decisions vault | `~/Desktop/RiskNeutral/Vaults/DiveDispatch/` |
| Test coverage report | `coverage/index.html` |
