# DiveDispatch

Multi-stakeholder dive booking platform. Operator creates booking; resource stakeholders confirm their slices; customers complete portal via tokenized link.

## Vault is truth

Canonical knowledge: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`. Follows Karpathy LLM-Wiki three-layer pattern — `raw/` (immutable sources) → `wiki/` (LLM-compiled entities) → `Schema/` (governance). **Read `index.md` first.**

Session context (log tail, lint status, followups, in-progress tickets, vault-first checklist) is auto-injected at session start by `.claude/hooks/session-start-vault-context.sh`. Follow its pointers.

## Three Non-Negotiable Invariants (LAW)

1. No exclusive-unit inventory held by two bookings for overlapping session windows.
2. Pooled inventory decrements on hold placement; blocks only when count reaches zero.
3. All AvailabilitySnapshot updates occur in the same Convex mutation as the Reservation write.

## Governance

- **Invariants** (architectural laws, hook-enforced): `Architecture/*-invariants.md` + `Architecture/auth-model.md`
- **Rules** (path-scoped, hook-enforced): `.claude/rules/*.md`
- **Vault schema contracts**: `Vaults/DiveDispatch/Schema/*.md`
- **Declared imports list** (drift-checked by `schema-imports-guard.sh`): `Vaults/DiveDispatch/Schema/imports.md`

Full decision record + implementation checklist: `Vaults/DiveDispatch/wiki/Architecture/Industry-Alignment-Decisions.md`

## Vault routing

| Artifact | Canonical home |
|---|---|
| Plan | `Vaults/DiveDispatch/wiki/Plans/<topic>.md` (mirrored via symlinks from `.claude/plans/`, `.cursor/plans/`, `.sisyphus/plans/`) |
| Ticket | `Vaults/DiveDispatch/wiki/Tickets/DD-*.md` (mirrored to `.tickets/`) |
| Entity (concept) | `Vaults/DiveDispatch/wiki/Architecture/entities/<slug>.md` |
| Pattern | `Vaults/DiveDispatch/wiki/PatternLibrary/<slug>.md` |
| Session / Failure / Review / Ingest / Lint | `Vaults/DiveDispatch/raw/<kind>/YYYY-MM-DD*.md` |
| Chronological log (working tier) | `Vaults/DiveDispatch/log.md` |
| Cross-vault reference | `[[vault:<name>/<path>]]` → see `Vaults/shared/index.md` |

## Happy-path audit + run spec

The happy-path spec set lives in `ultraplan/`. **Read `ultraplan/INDEX.md` first** for the routing table and resume pointer. Five-artifact joint ledger: `skeleton.md` + `canonical.json` + `canonical.schema.json` + `choreography.md` + `assertions.yaml`. Nothing goes in `.claude/plans/` for this work.
