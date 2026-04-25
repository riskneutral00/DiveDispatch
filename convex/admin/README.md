# convex/admin/

Privileged dev-tool ops. Each file exports `run` as a regular `mutation` or `query` with explicit `args` and `returns` validators, gated by `requireDevEnvironment()` from `convex/lib/devGuard.ts`. One operation per file. Companion `scripts/<operation>.ts` mirrors the export and calls it via `ConvexHttpClient`.

Current ops:
- `promoteAreaOrg` — flips `organizations.isAreaOrg = true` for a given slug.
- `auditOrgRelationships` — verifies the user/org/role/profile graph against the five Phase 3 invariants.

See `Vaults/DiveDispatch/wiki/PatternLibrary/dev-tool-internal-mutation-cli.md` for the reusable pattern.
