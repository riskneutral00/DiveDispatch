# Session: Industry Alignment — Invariant Files

> **Date:** 2026-04-06
> **Duration:** Single session (from Vaults directory)
> **Files created:** 7 invariant files + CLAUDE.md update

---

## What Was Done

Analyzed the Industry Matrix (Airbnb/Uber comparison), conducted a 10-point interview with Matt on convergence decisions, ran a Planner/Architect/Critic deliberation loop, and wrote 7 canonical invariant files to the DiveDispatch repo.

### Files Created

All in `~/Desktop/RiskNeutral/DiveDispatch/Architecture/`:

| File | Rules | Key Law |
|------|-------|---------|
| `schema-invariants.md` | 7 | No dead fields. One name per concept. Snapshot semantics documented. |
| `query-invariants.md` | 5 | No `.collect()` without `.take(N)`. Client limits clamped. |
| `auth-model.md` | 4 | All auth through `authorize()`. Clerk roles ≠ DD types. |
| `component-invariants.md` | 9 | One component all roles. No raw elements. All values through tokens. |
| `fsm-invariants.md` | 5 | Single gateway. Terminal states irreversible. `decline_cascade` action. |
| `error-invariants.md` | 4 | Shape `{ code, reason }`. Every code has i18n. |
| `testing-invariants.md` | 7 | Real contexts. Fixtures. Time guards. |

### CLAUDE.md Updated

Added "Architecture Invariants (LAW — do not deviate)" pointer block at top of `DiveDispatch/CLAUDE.md`, referencing all 7 files.

### Vault Document

`Vaults/DiveDispatch/Architecture/Industry-Alignment-Decisions.md` — full decision record with checklist, execution order, enforcement architecture. This is the reference for all future sessions working on alignment items.

## What Was NOT Done

- Skill definition updates (add invariant file references to `/gate`, `/review-backend-*`, etc.)
- Phase 2 cleanup (FSM bypass, dead fields, error unification, component violations)
- Phase 3 infrastructure (Clerk Organizations, `authorize()`, Chromatic, blocked dates)

## Key Decisions Made

- DD leans Airbnb on 6 of 9 divergence points. Airbnb-primary/Uber-secondary on 3 (D1 data model, D4 components, D8 identity).
- Auth: hybrid Clerk Organizations (RBAC) + relationship table. Build now, not deferred.
- Clerk roles = permission tiers (~4), NOT DD stakeholder types (12). `userRoles` augmented, not replaced.
- Sketch tables stay (v0.1.1 scope) but get guard validators.
- D9 (Offline) stays Airbnb — only offline need is read access to medical forms during activity.
- No scope cuts — full .collect() audit, Chromatic/Percy, Phase 4 items all kept.
- Enforcement priority: rules first, clean second, enforce third. Invariant files are law, not suggestions.

## Resume Point

**Next session should open from `~/Desktop/RiskNeutral/DiveDispatch`.** CLAUDE.md will load the invariant pointers automatically. Start with:
1. Update skill definitions with invariant file references
2. Then Phase 2 of `Industry-Alignment-Decisions.md` — start with Track A (FSM: seal bypass + add Archived state)
