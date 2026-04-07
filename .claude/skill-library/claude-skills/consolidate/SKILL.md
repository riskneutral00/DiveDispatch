---
name: consolidate
description: "Codebase DRY audit + auto-fix. Finds and fixes all duplication: constants, types, schemas, components, helpers, and backend dispatch. Makes design decisions autonomously. Runs /ai-slop-cleaner on changes."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, Skill
user-invocable: true
---

# /consolidate — Codebase DRY Audit & Auto-Fix

You are a senior engineer auditing the DiveDispatch codebase for code duplication and consolidation opportunities. Your job is to find copy-pasted code that should be shared, then fix the mechanical cases automatically. Adversarial mindset: "what breaks when someone updates one copy but forgets the others?"

**Execute immediately. No preamble. Silent research, findings only.**

---

## Phase 1: Inventory (silent)

Build the project map:

1. Read `.SKELETON.md` — project structure, key directories
2. Read `CLAUDE.md` — dependency direction rules, core vs adapter boundary
3. Glob `src/components/**/*.tsx` — all component files
4. Glob `src/lib/**/*.ts` — all lib files (constants, utils, hooks, schemas, types)
5. Glob `convex/**/*.ts` (exclude `convex/_generated/**`) — all backend files
6. Read `src/lib/constants/roles.ts` — canonical role registry (has `tableName`, `profileTabs`)
7. Find most recent vault review: `ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/consolidate-*.md 2>/dev/null | sort | tail -1`
   - If found: read it, extract the scoreboard for delta comparison
   - If not found: note "baseline review, no delta"

**Do not output anything yet.**

---

## Phase 2: Audit (silent, 3 parallel Explore agents with model: "sonnet")

Launch 3 Explore agents, each scanning a different layer:

### Agent 1 — Frontend Components
Scan `src/components/` for:
- **Near-identical components:** Components with 80%+ structural similarity (same JSX tree, same hooks, differing only in prop names or labels). Compare file pairs by reading them.
- **Duplicated guard patterns:** Identical conditional-render guards (e.g., "if (!existing) return <Card>message</Card>") across multiple files.
- **Copy-pasted state/effect blocks:** Identical `useState`/`useEffect`/`useCallback` blocks in multiple components.
- **Dead components:** Exported components with zero consumers (grep for import statements).
- **Duplicated dialog/modal structures:** Near-identical Dialog wrappers differing only in title/description.

For each finding: `file:line — [TYPE] description — similarity% — est. lines saved`

### Agent 2 — Backend (Convex)
Scan `convex/` (exclude `_generated/`) for:
- **Role-to-table switch/if-else chains:** Any switch or if-else mapping stakeholder role strings to table names. Should use `ROLE_TABLE_MAP` from `convex/lib/profileHelpers.ts`.
- **Inline ownership checks:** `ownerId !== user.slug` patterns that should use `assertOwnership` from `convex/lib/auth.ts` or `requireOwnerOrResourceAccess`.
- **Duplicated query pipelines:** Same sequence of queries repeated across functions (fetch → join → transform pattern).
- **Throw vs null variants:** Functions that exist in both throwing and non-throwing forms with identical logic.
- **Duplicated utility functions:** Identical helper functions defined in multiple files (especially seed files).
- **profileHelpers bypass:** Files that query profile tables directly instead of using `profileByUserId` from `convex/lib/profileHelpers.ts`.

For each finding: `file:line — [TYPE] description — similarity% — est. lines saved`

### Agent 3 — Shared Layer (constants, types, schemas)
Scan `src/lib/` for:
- **Constants defined in multiple files:** Same string array, enum, or label map defined in 2+ places (grep for identical array literals, `Record<string, string>` with same keys).
- **Type aliases defined in multiple files:** Same interface/type shape defined in 2+ files (especially prop types for role-specific components).
- **Schemas with unused base:** Zod schemas that define a base but don't use it (check for `.extend()` opportunities).
- **Duplicate locationSchema / contactSchema patterns:** Same Zod object shape defined in multiple files.
- **Inline values that should be constants:** Hardcoded string arrays that match existing constants but aren't imported.
- **Dead exports:** Exported values/types with zero consumers.

For each finding: `file:line — [TYPE] description — consumer count — est. lines saved`

**Do not output anything yet.**

---

## Phase 3: Classify

For each finding, assign:

**Severity:**
- **CRITICAL** — Identical logic in 3+ places (high divergence risk)
- **HIGH** — Identical logic in 2 places, or near-identical in 3+
- **MEDIUM** — Structurally similar but not mechanical to fix
- **LOW** — Minor cleanup (cosmetic, small savings)

All findings are fixable. When a fix requires a design decision (prop API, function signature, abstraction boundary), make it — use existing codebase patterns as precedent, prefer the simpler option.

---

## Phase 4: Report

Output a single scoreboard:

```
## Consolidation Audit — {date}

### Summary
CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
Findings: N  |  Est. lines saved: N

### Findings

| # | Severity | Layer | Type | Files | Description | Lines |
|---|----------|-------|------|-------|-------------|-------|
| 1 | CRITICAL | frontend | constant | file1, file2, file3 | BOAT_TYPES defined 3x | ~30 |
| ... |
```

If a previous review exists, add a **Delta** section: N resolved, N new, N regressed.

---

## Phase 5: Auto-Fix

For each AUTO-fixable finding, in order from lowest-risk to highest:

### 5a. Dead code deletion
- Verify zero consumers (grep for import/require of the export name)
- Delete the file or remove the dead export
- If unsure, skip — do not delete code that *might* have consumers

### 5b. Constant extraction
- Create `src/lib/constants/{name}.ts` with the canonical definition
- Update all consumer files to import from the new location
- Remove inline definitions, leave a comment: `// Imported from @/lib/constants/{name}`

### 5c. Type/interface extraction
- Create or extend `src/lib/profile-form/types.ts` (or appropriate shared file)
- Update all consumer files to import/extend from the shared type
- For role-specific extensions: use `BaseType & { extraProp: Type }`

### 5d. Schema consolidation
- Wire role schemas to use base via `.extend()` or direct assignment
- Verify Zod inference still produces the same shape

### 5e. Utility extraction
- Move to `src/lib/utils/{name}.ts` (frontend) or `convex/lib/{name}.ts` (backend)
- Update all consumer files

### 5f. Backend dispatch consolidation
- Replace switch/if-else chains with `ROLE_TABLE_MAP` lookups
- Replace inline auth checks with shared helpers

### 5g. Component abstraction
- Identify the shared structure across near-identical components
- Design a unified component with a prop API that covers all variants (use existing codebase patterns as precedent)
- Extract to a shared file, update all consumers to use the new component
- Delete the now-redundant component files

### 5h. Helper API extraction
- Design function signature based on existing call patterns
- Extract to the appropriate shared module (`src/lib/utils/` or `convex/lib/`)
- Update all call sites to use the new helper

### 5i. Cross-cutting refactors
- Execute multi-file refactors with consistent patterns
- When choosing between approaches, prefer the simpler option with fewer moving parts

After all fixes:
1. Run `npx tsc --noEmit` — must have zero *new* errors (pre-existing errors are acceptable)
2. Run `npx vitest run` — must have zero *new* failures
3. If either fails: diagnose root cause, fix, re-verify

---

## Phase 6: Slop Clean

Invoke `/ai-slop-cleaner` on the changed files to clean up any AI-generated artifacts from the auto-fix phase.

---

## Phase 7: Vault & Final Report

1. Write vault review to `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Reviews/consolidate-{YYYY-MM-DD}.md`
   - Include: scoreboard, all findings (AUTO + MANUAL), delta from last run, files changed
2. Output final summary:

```
Consolidation — {date}
  CRITICAL: N  |  HIGH: N  |  MEDIUM: N  |  LOW: N
  Fixed: N findings across M files
  Lines saved: ~N
  Build: PASS  |  Tests: PASS (N/N)
  Slop clean: done

↳ Vault: review written to Reviews/consolidate-{date}.md
```

---

## Rules

- Execute immediately. No preamble.
- Silent research — only the scoreboard + final summary are output.
- Every finding must cite file:line + specific code.
- All findings are fixable. When a fix requires a design decision, make it — use existing codebase patterns as precedent, prefer the simpler option.
- Never modify `.claude/`, `scripts/`, `design-system/`, or test files during auto-fix.
- Never introduce new abstractions for one-time use. Three copies = extract. Two copies = report.
- Complement sibling review skills — don't audit auth, performance, or test quality. Only duplication and consolidation.
- The 3-copy threshold for CRITICAL is a guideline. Two copies of security-adjacent code (auth checks, ownership guards) are CRITICAL regardless.
