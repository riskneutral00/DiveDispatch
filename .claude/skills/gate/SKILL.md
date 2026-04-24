---
name: gate
description: "Pre-commit quality gate. Scoped to this session's touched files by default; pass --all to gate the entire working tree. Dispatches review skills + invariant sweep, aggregates findings, invokes /escalate once (tickets open in_progress), fixes ALL CRITICAL/HIGH same-session via three routes (AUTO/OPUS-BLIND/INTERVIEW, max 2 cycles). Gate-sourced tickets close same session — no deferral. Emits .patrol-ran sentinel."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Agent, AskUserQuestion
user-invocable: true
---

# /gate — Pre-Commit Quality Gate

You are a senior architect reviewing uncommitted changes before they reach `git commit`. Classify what changed, dispatch the right review skills, check invariant-adjacent code, and deliver a GO/NO-GO verdict. Write the sentinel (`.patrol-ran-<session-id>` scoped, `.patrol-ran` full-tree) so `/vault` can read the result.

**Execute immediately. No preamble, no methodology explanation.**

---

## Scope Resolution (runs before Phase 0)

Matt's workflow opens multiple concurrent sessions. Default behavior is **scoped** — `/gate` only reviews files this session touched. Pass `--all` to restore whole-tree behavior.

```bash
SCOPE_MODE="scoped"
case " $* " in *" --all "*) SCOPE_MODE="all" ;; esac

SID="${CLAUDE_SESSION_ID:-}"
[ -z "$SID" ] && [ -f .claude/session-state/current-id ] && SID=$(cat .claude/session-state/current-id)
TOUCHED=".claude/session-state/$SID/touched.txt"

# Auto-fall-through to --all when session state is missing or empty
if [ "$SCOPE_MODE" = "scoped" ] && { [ -z "$SID" ] || [ ! -s "$TOUCHED" ]; }; then
  echo "Session state missing or empty — falling back to --all."
  SCOPE_MODE="all"
fi

if [ "$SCOPE_MODE" = "scoped" ]; then
  SENTINEL=".patrol-ran-$SID"
  SCOPE_FILTER="grep -Ff $TOUCHED"
else
  SENTINEL=".patrol-ran"
  SCOPE_FILTER="cat"
fi
```

Every subsequent `git diff --name-only` / `git diff --cached --name-only` / `git ls-files --others --exclude-standard` call in this skill is piped through `$SCOPE_FILTER`. Every `git diff` / `git diff --cached` (full diff) is restricted to scoped paths via `--` path args computed from `$TOUCHED` (or unrestricted in `--all` mode).

The sentinel filename for this run is `$SENTINEL`.

---

## Phase 0: Cache Check + Test Verification

### Step 0a — Compute diff hash

Compute a single hash of the session-scoped working-tree state (unstaged + staged + untracked file names):

```bash
if [ "$SCOPE_MODE" = "scoped" ]; then
  SCOPED_PATHS=$(xargs -a "$TOUCHED" 2>/dev/null || true)
  DIFF_HASH=$( (git diff -- $SCOPED_PATHS; git diff --cached -- $SCOPED_PATHS; git ls-files --others --exclude-standard | $SCOPE_FILTER) | shasum -a 256 | awk '{print $1}' )
else
  DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) | shasum -a 256 | awk '{print $1}' )
fi
```

Store `DIFF_HASH` for the entire gate run — it's reused in the sentinel write.

### Step 0a-bis — Compute SIZE

Compute one **SIZE** classification from the current scoped diff. Both `/gate` and `/vault` use the same taxonomy; each computes independently from the live diff (not `touched.txt` count, which is historical session state — a file edited then reverted is still in it). Persist `size` in the sentinel JSON for diagnostic / audit purposes; it does **not** override `/vault`'s independent recomputation.

```bash
if [ "$SCOPE_MODE" = "scoped" ]; then
  SCOPED_PATHS=$(xargs -a "$TOUCHED" 2>/dev/null || true)
  CHANGED_PATHS=$( (
    git diff --name-only -- $SCOPED_PATHS
    git diff --cached --name-only -- $SCOPED_PATHS
    git ls-files --others --exclude-standard | $SCOPE_FILTER
  ) | sort -u )
else
  CHANGED_PATHS=$( (
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  ) | sort -u )
fi

FILES=$(printf '%s\n' "$CHANGED_PATHS" | grep -c .)

if   [ "$SCOPE_MODE" = "all" ]; then SIZE="FULL"
elif [ "$FILES" -le 3  ];      then SIZE="TRIVIAL"
elif [ "$FILES" -le 8  ];      then SIZE="LIGHT"
elif [ "$FILES" -le 20 ];      then SIZE="STANDARD"
else                                SIZE="FULL"
fi
```

`SIZE` informs the verdict-length short-circuit in Phase 6 and the heavy-housekeeping skip rule below. It does **not** change which review skills are dispatched — a 3-file frontend diff still gets `review-frontend-dry`. Smaller-scope optimizations (per-skill `--diff-scope` parameter, scoped vitest) are deliberately out of scope for this iteration.

**Heavy housekeeping skip for TRIVIAL.** When `SIZE = TRIVIAL`, do not introduce any heavy work via `/gate` that `/vault` is explicitly avoiding (e.g. OpenSpace evolution, full-narrative formatting beyond the short verdict). The verdict format itself is the only TRIVIAL-specific behavior in this skill.

### Step 0b — Full short-circuit

Read `$SENTINEL` if it exists (`.patrol-ran-<id>` in scoped mode, `.patrol-ran` in `--all` mode). If **all three** conditions are true:
1. File exists
2. `diffHash` field matches `$DIFF_HASH`
3. `verdict` is not `BLOCKED`

Then **stop immediately** with cached output:

```
Gate — {YYYY-MM-DD}
Cached: {verdict} (unchanged since {ran timestamp})
Critical: {N} | High: {N}
Ready for /vault: YES
```

No skills dispatched. No tests run. No phases executed. Done.

### Step 0c — Test verification (on cache miss)

If no cache hit, run the test suite. If tests fail, nothing else matters.

**5-minute skip:** Check if `.vitest-last-pass` exists and its timestamp is within the last 5 minutes:

```bash
if [ -f .vitest-last-pass ] && [ $(( $(date +%s) - $(cat .vitest-last-pass) )) -lt 300 ]; then echo "SKIP"; else echo "RUN"; fi
```

- If **SKIP** → print `Tests: skipped (passed {N}s ago)` and continue to Phase 1.
- If **RUN** → execute `npx vitest run 2>&1`:
  - If **any tests fail** → mark `TESTS_FAIL = true`. Store the failure output for Phase 7. Continue to Phase 1 (review skills still run — they may find related issues). Phase 7 will attempt to fix test failures before the final verdict.
  - If all tests pass → write timestamp: `date +%s > .vitest-last-pass` → capture pass count and continue.

---

## Phase 1: Diff Classification

1. Run `(git diff --name-only; git diff --cached --name-only) | $SCOPE_FILTER | sort -u` → deduplicated changed file list. In `--all` mode `$SCOPE_FILTER` is `cat`; in scoped mode it's `grep -Ff $TOUCHED`.
2. Run `git status --short | $SCOPE_FILTER` → check for untracked files. Include in classification.
3. If no changes at all (empty list after filtering), output `Nothing to gate.` (scoped mode appends `— no session-touched files.`) and write CLEAN sentinel. Stop.
4. Classify each file into buckets:

| Bucket | File patterns |
|--------|--------------|
| `schema` | `convex/schema.ts` |
| `backend` | `convex/**/*.ts` excluding `convex/schema.ts` and `convex/_generated/**` |
| `frontend` | `src/app/**`, `src/components/**`, `src/lib/**`, `design-system/**` |
| `ui-primitives` | `src/components/ui/**` (subset of frontend — dispatches the variant audit on top of the general frontend review) |
| `tests` | `tests/**`, `e2e/**`, any `*.test.ts` or `*.spec.ts` |
| `config` | `package.json`, `tailwind.config.*`, `tsconfig.*`, `next.config.*`, `.env*` |

A file can land in multiple buckets.

5. Map buckets to skills:

| Bucket | Skills to dispatch |
|--------|-------------------|
| `schema` | `/review-backend-schema` |
| `backend` | `/review-backend-mutations`, `/review-backend-auth` |
| `frontend` | `/review-frontend-dry` — cross-file duplicate utilities, local type aliases, leftover tokenizable inline styles, raw buttons, dialog-literal i18n leaks |
| `ui-primitives` | `/review-ui-variants` — when `src/components/ui/**` changed: detect missing variants (className overrides for visual properties) |
| `tests` | `/review-tests` |
| `config` | No skill — note in output |

6. Deduplicate the skill list.

7. Compute per-bucket diff hashes for incremental caching. In scoped mode, restrict each bucket's `git diff` to paths that appear in both the bucket pattern AND `$TOUCHED`:

```bash
if [ "$SCOPE_MODE" = "scoped" ]; then
  # Intersect touched list with each bucket's glob
  scoped_paths() { grep -E "$1" "$TOUCHED" 2>/dev/null | tr '\n' ' '; }
  S_SCHEMA=$(scoped_paths '^convex/schema\.ts$')
  S_BACKEND=$(scoped_paths '^convex/.*\.ts$' | tr ' ' '\n' | grep -v '^convex/schema\.ts$' | grep -v '^convex/_generated/' | tr '\n' ' ')
  S_FRONTEND=$(scoped_paths '^(src/(app|components|lib)/|design-system/)')
  S_TESTS=$(scoped_paths '^(tests|e2e)/')

  hash_bucket() { (git diff -- $1; git diff --cached -- $1) 2>/dev/null | shasum -a 256 | awk '{print $1}'; }
  SCHEMA_HASH=$(hash_bucket "$S_SCHEMA")
  BACKEND_HASH=$(hash_bucket "$S_BACKEND")
  FRONTEND_HASH=$(hash_bucket "$S_FRONTEND")
  TESTS_HASH=$(hash_bucket "$S_TESTS")
else
  SCHEMA_HASH=$( (git diff -- convex/schema.ts; git diff --cached -- convex/schema.ts) | shasum -a 256 | awk '{print $1}' )
  BACKEND_HASH=$( (git diff -- 'convex/**/*.ts' ':!convex/schema.ts' ':!convex/_generated/**'; git diff --cached -- 'convex/**/*.ts' ':!convex/schema.ts' ':!convex/_generated/**') | shasum -a 256 | awk '{print $1}' )
  FRONTEND_HASH=$( (git diff -- 'src/app/**' 'src/components/**' 'src/lib/**' 'design-system/**'; git diff --cached -- 'src/app/**' 'src/components/**' 'src/lib/**' 'design-system/**') | shasum -a 256 | awk '{print $1}' )
  TESTS_HASH=$( (git diff -- 'tests/**' 'e2e/**'; git diff --cached -- 'tests/**' 'e2e/**') | shasum -a 256 | awk '{print $1}' )
fi
```

8. Read `.patrol-ran`'s `bucketHashes` and `skillResults` (if file exists). For each bucket that has files in it:
   - If the bucket's hash matches the cached `bucketHashes` entry → **skip** that bucket's skills. Reuse `skillResults` from the cached sentinel.
   - If the bucket's hash differs or the bucket has no cached entry → **dispatch** that bucket's skills.

This produces two lists: `skillsToDispatch` (fresh) and `skillsCached` (reused from sentinel).

**Do not output anything yet.**

---

## Phase 2: Scoped Dispatch

Display the dispatch header. Show both fresh and cached skills:

```
Gate — {YYYY-MM-DD}
Changed: {N} files ({schema: N, backend: N, frontend: N, tests: N, config: N})
Dispatching: {comma-separated skillsToDispatch list}
Cached: {comma-separated skillsCached list} (unchanged since {ran timestamp})
───────────────────────
```

If `skillsCached` is empty (first run or all buckets changed), omit the Cached line.

**Spawn one Agent per skill in `skillsToDispatch`, all in a SINGLE message** so they run truly in parallel. Use `subagent_type: "general-purpose"` and `model: "sonnet"`. Do NOT use `Skill()` for fan-out — `Skill()` is conversational substitution and cannot parallelize. Each Agent executes the underlying skill in an isolated context and returns structured findings, which this orchestrator can then aggregate.

Per-agent prompt template:

```
Run the {SKILL-NAME} skill end-to-end and return its structured findings.

Steps:
1. Invoke the skill via the Skill tool: Skill({skill: "{skill-name}"}).
2. Let the skill execute its full process (inventory → audit → vault review → return findings).
3. Capture the structured findings block it emits (the JSON-like block listing severity/file/line/summary/proposed_fix).
4. Return ONLY that findings block as your response — no commentary, no preamble.

Context: orchestrated by /gate for pre-commit verification. Stay focused. Diff scope is the current uncommitted working tree.
```

Possible skills (spawn one Agent per skill that appears in `skillsToDispatch`):
- `review-backend-schema`
- `review-backend-auth`
- `review-backend-mutations`
- `review-tests`
- `review-prerequisite-gates`
- `review-frontend-dry`
- `review-ui-variants`

**Review skills return findings only — they do NOT invoke `/escalate`.** `/gate` is the single escalator; it aggregates findings in Phase 6 and calls `/escalate` once.

After all spawned Agents return (the runtime delivers all their results before the next phase), collect each skill's CRITICAL/HIGH/MEDIUM/LOW findings + the full finding list (file, line, severity, summary, proposed fix) from each agent's response. Merge with cached `skillResults` from the sentinel for the full picture.

---

## Phase 3: Invariant Sweep

### Step 3a — Read canonical invariant files

Read ALL architecture invariant files before scanning. These are LAW — violations are findings:

- `Architecture/schema-invariants.md`
- `Architecture/query-invariants.md`
- `Architecture/auth-model.md`
- `Architecture/component-invariants.md`
- `Architecture/fsm-invariants.md`
- `Architecture/error-invariants.md`
- `Architecture/testing-invariants.md`

### Step 3b — Scan for invariant violations

Regardless of which skills ran, if ANY file in the `schema` or `backend` bucket changed:

1. Run `git diff -U0` + `git diff --cached -U0` to get the minimal diff of `convex/` files.
2. Scan added/modified lines (lines starting with `+`) for invariant-adjacent keywords:

| Invariant | Keywords to grep |
|-----------|-----------------|
| 1: Exclusive overlap | `inventoryUnits`, `Exclusive`, `inventoryType`, `overlapping` |
| 2: Pooled blocking | `pooledCount`, `decrement`, `availableCount`, `pooled` |
| 3: Snapshot atomicity | `AvailabilitySnapshot` AND `Reservation` in same hunk |
| 4: Direct status patch | `.patch(` + `status:` on bookings/reservations outside `bookings/status.ts` (fsm-invariants Rule 1) |
| 5: Unbounded collect | `.collect()` without `.take(` on same chain (query-invariants Rule 1) |
| 6: Raw interactive element | `<button`, `<input`, `<select`, `<textarea` in `src/app/` or `src/components/booking/` or `src/components/profiles/` (component-invariants Rule 1) |
| 7: Error shape | `ConvexError` with `message:` instead of `reason:` (error-invariants Rule 1) |
| 8: Auth bypass | `getAuthUser` in mutation files, `checkHasRole` or `assertOwnership` without `authorize()` (auth-model Rule 1) |

3. If any match, add an INVARIANT CHECK entry to the verdict. Items 4-8 are hard blocks (CRITICAL), not informational.

---

## Phase 4: Test Gap Detection

For each file in the `schema`, `backend`, or `frontend` bucket, check if there's a corresponding change in the `tests` bucket.

Heuristic: for `convex/foo.ts`, look for `tests/foo.test.ts` or any test file importing from `convex/foo` in the changed file list. For `src/components/Foo.tsx`, look for test files containing `Foo` in the changed file list.

If source changed but no corresponding test changed → TEST GAP entry.

Skip this check if:
- The source change is trivial (only comments or whitespace)
- The file is config/types-only (`.d.ts`, `schema.ts` index changes)

---

## Phase 5: Backseat Queue + Unreviewed Count

Check backseat queue:
```bash
grep -rl 'source: backseat' .tickets/DD-*.md 2>/dev/null | xargs grep -l 'status: ready\|status: in_progress' 2>/dev/null | xargs grep -L 'human_required: true' 2>/dev/null | wc -l
```

If non-zero → add QUEUE WARNING to verdict.

Count unreviewed merges:
```bash
ls .car/merged/*.json 2>/dev/null | wc -l
```

Report in output but doesn't affect verdict.

---

## Phase 6: GO/NO-GO Verdict

Aggregate findings from all dispatched skills + invariant sweep + test gaps + queue check.

Determine **CRITICAL count** and **HIGH count** = sum of all CRITICAL and HIGH findings from dispatched skills (not from test gaps or invariant checks — those are informational).

```
═══════════════════════════════
Quality Gate — {YYYY-MM-DD}
═══════════════════════════════

Changed: {N} files ({schema: N, backend: N, frontend: N, tests: N, config: N})
Skills dispatched: {freshly-run list}
Skills cached: {reused-from-sentinel list, or "none" if all fresh}

{GO or NO-GO}
───────────────────────

{If NO-GO — any CRITICAL or HIGH finding:}
BLOCKING:
  [{skill-name}] {summary of each CRITICAL and HIGH finding}

{If MEDIUM/LOW findings exist:}
WARNINGS:
  [{skill-name}] MEDIUM: {N} | LOW: {N}

{If invariant-adjacent changes found:}
INVARIANT CHECK:
  Invariant {N} — {file} touches {concept}. Verify before commit.

{If test gaps found:}
TEST GAPS:
  {file} changed — no corresponding test changes detected

{If backseat queue has non-human_required tickets:}
QUEUE WARNING:
  {N} non-human_required backseat fix tickets still open

Unreviewed: {N} tickets in .car/merged/

{If nothing found by any skill:}
All clear. Clean commit.

Vault artifacts written by: {list of skills that produced vault output}
Ready for /vault: {YES or NO}
```

### Threshold

- **NO-GO** → Any CRITICAL or HIGH finding from any dispatched skill OR tests fail. Verdict = `BLOCKED` (pending Phase 7 resolution).
- **GO** → No CRITICAL or HIGH findings. Verdict = `CLEAN` or `CLEAN_UNREVIEWED` (if unreviewed merges exist).

### Verdict-length short-circuit (TRIVIAL + CLEAN + zero findings)

When **all three** are true:
- `SIZE = TRIVIAL`
- verdict is `CLEAN` (no `CLEAN_UNREVIEWED` — no unreviewed merges)
- zero CRITICAL **and** zero HIGH **and** zero MEDIUM **and** zero LOW findings across all dispatched and cached skills
- no INVARIANT CHECK, TEST GAP, or QUEUE WARNING entries

…replace the full banner with a one-line verdict:

```
Gate — CLEAN. {N} file(s), {bucket}. No findings. Ready for /vault: YES.
```

Where `{bucket}` is the single bucket name (e.g. `frontend`) when only one bucket has files, or `mixed` otherwise.

If `/gate` was invoked from `/vault`, still emit the resume line (`Gate complete (verdict: CLEAN). Resuming /vault Job 0.`) on the next line. The short verdict + resume line replace the full banner block entirely.

In all other cases (any finding of any severity, any non-CLEAN verdict, any size > TRIVIAL), use the full banner above.

**If GO** → skip to Write Sentinel.
**If NO-GO** → pass the aggregated CRITICAL + HIGH + MEDIUM + LOW findings to `/escalate` in a single call (source: `gate`, reviewers: list of skills that fired). `/escalate` writes CRITICAL/HIGH tickets with `status: in_progress` + `started_at` (audit paper trail; MEDIUM/LOW → vault log, no ticket). Record each ticket's `DD-N` → finding mapping for Phase 7 close-tracking. Then fall through to Phase 7 (Same-Session Fix Loop).

---

## Phase 7: Same-Session Fix Loop (NO-GO only)

Gate stays an orchestrator — all code changes are delegated to spawned fix agents or Matt-directed fixes. Max **2 fix-verify cycles**. **Every CRITICAL and HIGH finding gets a fix attempt — no finding is skipped.** Tickets opened by Phase 6 (`status: in_progress`) must close to `.tickets/done/` by end of this phase or Matt explicitly dismisses them.

### Step 7a — Route Classification

Classify each CRITICAL and HIGH finding into exactly one of three routes:

| Route | Criteria | Handler |
|-------|----------|---------|
| **AUTO** | All of: specific `file:line`, concrete single-action fix (rename, add call, add guard), targets ≤ 3 files, not security/schema/FSM | Step 7c — Sonnet fix agent |
| **OPUS-BLIND** | Clear `file:line` + concrete fix BUT multi-file refactor OR non-trivial logic change OR involves cross-file implications; not security/schema/FSM/product-intent | Step 7c — Opus fix agent |
| **INTERVIEW** | Any of: security (auth bypass, ownership gap, role escalation), schema migration / new index, FSM transition in `convex/bookings/`, product intent decision, invariant-adjacent (Phase 3), no `file:line` reference, spans > 2 buckets | Step 7c — inline `AskUserQuestion` → Matt picks approach → Opus fix agent executes chosen direction |

No finding is allowed to skip the loop. Every CRITICAL/HIGH has a route.

### Step 7b — Fix Test Failures First

If tests failed in Phase 0:

1. Spawn 1 fix agent (`model: "sonnet"`, `subagent_type: "build-error-resolver"`) with the test failure output.
   - Agent fixes minimally — no refactoring, just get tests green.
2. After agent completes, re-run `npx vitest run`.
   - If tests **still fail** → exit loop. Proceed to Step 7f (Report) as BLOCKED.
   - If tests **pass** → write timestamp to `.vitest-last-pass`, continue to Step 7c.

### Step 7c — Fix Review Findings (three routes)

Process routes in order: INTERVIEW first (blocks for Matt), then AUTO + OPUS-BLIND in parallel.

#### 7c.1 — INTERVIEW route (blocks until Matt answers)

For each `INTERVIEW` finding, use `AskUserQuestion` to present the finding inline:

```
Q: "{severity} {skill-name}: {finding summary}

{file}:{line} — {description}

Proposed approaches:
  A (recommended): {first proposed fix}
  B: {alternative approach, if applicable}
  C: {dismiss with reason — false positive or intentional}"

header: "Fix approach"
```

For security/schema/FSM findings, include at least two concrete approach options when possible. When Matt picks an option:
- **A or B** → spawn Opus fix agent with the chosen direction (see dispatch template below). Record Matt's choice on the ticket (append `fix_direction: A|B|matt-text` to the ticket body).
- **C (dismiss)** → update ticket `status: dismissed`, `dismissed_reason: <Matt's reason>`, move to `.tickets/done/`. No fix agent spawned. Count as resolved for Step 7e.

#### 7c.2 — AUTO + OPUS-BLIND routes (parallel spawn)

Group findings by route × review-skill bucket:

| Skill | AUTO Fix Agent Scope | OPUS-BLIND Fix Agent Scope |
|-------|---------------------|---------------------------|
| `/review-backend-schema` | Single-file schema tweaks, type fixes | Multi-file schema changes, migration helpers |
| `/review-backend-auth` | Single-mutation validator fixes | Cross-mutation auth refactors (non-security) |
| `/review-backend-mutations` | Single `.take()` bounds, side-effect guards | Multi-file performance refactors |
| `/review-tests` | Single test fix | Cross-file test restructuring |
| `/review-frontend-dry` | Single-file dedupe | Multi-file component extraction |

For each non-empty (skill × route) bucket, spawn **1 fix agent** (`model: "sonnet"` for AUTO, `model: "opus"` for OPUS-BLIND and INTERVIEW). All non-INTERVIEW agents spawn in a single message to run in parallel.

Each fix agent receives:
- The list of findings for its bucket (severity, file:line, description, fix instruction, ticket ID)
- For INTERVIEW findings: Matt's chosen `fix_direction` (A/B/free-text)
- `CLAUDE.md` context (invariants, dependency direction)
- Instruction: **"Apply each fix. Minimal diff. Run `npx tsc --noEmit` after all fixes to verify type safety. Do not change unrelated code. Return a line `FIXED: DD-N, DD-M` listing which tickets you resolved."**

After **all** fix agents complete, run `npx vitest run` once to check for regressions.
- If tests fail → treat as a test failure for the next cycle (Step 7b handles it).

#### 7c.3 — Close resolved tickets

For each ticket listed in agent `FIXED:` responses, update the ticket file:
```
status: done
completed_at: <ISO-8601>
fix_agent: {auto-sonnet | opus-blind | opus-interview}
```
Then move the file to `.tickets/done/DD-N.md`. If multiple findings mapped to one ticket (consolidation), close only when all findings are FIXED.

### Step 7d — Re-Verify

After auto-fix, verify with targeted checks rather than full re-dispatch:
1. Run `npx tsc --noEmit` — type safety check across all fixed files
2. Run `npx vitest run` — regression check
3. For each fixed finding, grep the specific pattern that triggered it — confirm it's gone

Only re-dispatch the full review skill if the targeted checks reveal new issues. This avoids the same skill validating its own finding's fix (confirmation bias).

Collect new CRITICAL/HIGH counts. Merge with MANUAL findings carried forward.

### Step 7e — Loop or Exit

```
remaining_critical = new CRITICAL count from Step 7d
remaining_high = new HIGH count from Step 7d

if remaining_critical == 0 AND remaining_high == 0:
    → verdict = GO (all fixed same-session)
    → exit loop → Step 7f → Write Sentinel
elif cycle < 2:
    → cycle++
    → goto Step 7a with new findings (re-classify remaining)
else:
    → 2 cycles exhausted. For each still-open gate ticket:
        - Update ticket: status: ready, human_required: true, cycles_exhausted: 2
        - Leave in .tickets/ (do NOT move to done/)
        - Append finding details to ticket body if missing
    → verdict = BLOCKED
    → exit loop → Step 7f → Write Sentinel
```

Tickets updated to `human_required: true` are the escape valve — they're the only gate-sourced tickets allowed to survive a session. `/vault` will still block commit on them (verdict = BLOCKED).

### Step 7f — Same-Session Fix Report

Append to the Phase 6 verdict output:

```
FIX REPORT:
───────────────────────
Cycles: {N}/2
Route breakdown:
  AUTO: {N} attempted, {N} fixed
  OPUS-BLIND: {N} attempted, {N} fixed
  INTERVIEW: {N} attempted, {N} fixed, {N} dismissed

Tickets closed:
  DD-N: done — {finding summary}
  DD-M: dismissed — {reason}

{If cycles exhausted with remaining:}
TICKETS FLAGGED human_required (will block /vault):
  DD-X: {severity} {summary} — 2 cycles failed
  DD-Y: {severity} {summary} — 2 cycles failed

{Updated verdict: GO | BLOCKED}
Ready for /vault: {YES or NO}
```

---

## Write Sentinel

After printing the verdict, count any gate-sourced tickets still open in `.tickets/`:

```bash
OPEN_GATE_TICKETS=$(grep -l 'source: gate' .tickets/DD-*.md 2>/dev/null | xargs grep -l 'status: in_progress\|status: ready' 2>/dev/null | wc -l | tr -d ' ')
```

Then write the sentinel (`$SENTINEL` — resolved to `.patrol-ran-<id>` in scoped mode, `.patrol-ran` in `--all` mode) with cache data for incremental reuse:

```bash
VERDICT="CLEAN"
if [ {CRITICAL_COUNT} -gt 0 ] || [ {HIGH_COUNT} -gt 0 ] || [ {TESTS_FAIL} = true ]; then
    VERDICT="BLOCKED"
elif [ "$OPEN_GATE_TICKETS" -gt 0 ]; then
    VERDICT="BLOCKED"
elif [ {UNREVIEWED_COUNT} -gt 0 ]; then
    VERDICT="CLEAN_UNREVIEWED"
fi

FILE_HASH=$(git log --oneline -1 --format=%h 2>/dev/null || echo "unknown")
```

Any gate-sourced ticket still `in_progress` OR escalated to `human_required: true, status: ready` blocks `/vault`. Dismissed tickets (moved to `.tickets/done/`) do not count.

**If Phase 7 ran**, recompute `DIFF_HASH` and bucket hashes — the fix agents changed files. Use the same scope mode as Phase 0:

```bash
if [ "$SCOPE_MODE" = "scoped" ]; then
  # Phase 7 fixes may have touched new files; refresh touched.txt via tracker before hashing
  bash .claude/hooks/session-touched-tracker.sh 2>/dev/null || true
  SCOPED_PATHS=$(xargs -a "$TOUCHED" 2>/dev/null || true)
  DIFF_HASH=$( (git diff -- $SCOPED_PATHS; git diff --cached -- $SCOPED_PATHS; git ls-files --others --exclude-standard | $SCOPE_FILTER) | shasum -a 256 | awk '{print $1}' )
else
  DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) | shasum -a 256 | awk '{print $1}' )
fi
```

Write the sentinel as JSON with these fields:

```json
{
  "ran": "{ISO timestamp}",
  "verdict": "{CLEAN|CLEAN_UNREVIEWED|BLOCKED}",
  "headSha": "{short hash}",
  "diffHash": "{DIFF_HASH — recomputed if Phase 7 ran}",
  "critical": {N},
  "high": {N},
  "tests": true,
  "invariants": true,
  "fixCycles": 0,
  "fixedTickets": [],
  "dismissedTickets": [],
  "humanRequiredTickets": [],
  "openGateTickets": 0,
  "bucketHashes": {
    "schema": "{SCHEMA_HASH}",
    "backend": "{BACKEND_HASH}",
    "frontend": "{FRONTEND_HASH}",
    "tests": "{TESTS_HASH}"
  },
  "skillResults": {
    "{skill-name}": {"critical": N, "high": N, "medium": N, "low": N}
  },
  "scopeMode": "{scoped|all}",
  "sessionId": "{SID — empty string when scopeMode=all}",
  "touchedFileCount": {N — count of files in touched.txt at gate time; 0 when scopeMode=all},
  "size": "{TRIVIAL|LIGHT|STANDARD|FULL — from Step 0a-bis; informational, /vault recomputes}",
  "changedFileCount": {N — count of files in CHANGED_PATHS at gate time; what SIZE was computed from}
}
```

- `fixCycles`: number of Phase 7 cycles executed (0 if Phase 7 did not run)
- `fixedTickets`: ticket IDs closed to `.tickets/done/` with `status: done` this run
- `dismissedTickets`: ticket IDs closed via INTERVIEW route dismissal this run
- `humanRequiredTickets`: ticket IDs escalated to `human_required: true` after 2 cycles (these block `/vault`)
- `openGateTickets`: count of gate-sourced tickets still `in_progress` or `human_required` (blocks `/vault` if > 0)

`skillResults` includes both freshly-dispatched and cached skill results (merged). This is what future gate runs read for incremental dispatch.

`DIFF_HASH` and bucket hashes were computed in Phase 0 / Phase 1 and recomputed after Phase 7 if fixes were applied.

Exit code: 0 on GO, 1 on NO-GO.

---

## Resume Contract (when invoked by /vault)

If `/vault` invoked this skill (the conversation context above contains `/vault` skill instructions that haven't completed), continue executing `/vault` from **Job 0** (Untracked File Triage) immediately after the sentinel write. Do NOT stop after the verdict line.

The `Skill()` boundary is conversational substitution, not a function-call return. You are the same LLM instance, both skill bodies are visible in conversation context, and `/vault`'s remaining instructions (Jobs 0-7) are still your responsibility. Treat the gate verdict line as a checkpoint, not a stopping point.

Emit this line right before continuing:

```
Gate complete (verdict: {CLEAN|CLEAN_UNREVIEWED|BLOCKED}). Resuming /vault Job 0.
```

Then proceed:
- `BLOCKED` → stop after the resume line (don't enter Job 0).
- `CLEAN` / `CLEAN_UNREVIEWED` → continue to /vault Job 0 in the SAME turn.

If `/gate` was invoked directly by the user (no `/vault` context above), stop after the verdict — no resume.

---

## Rules

- **Dispatch, don't duplicate.** Gate classifies and dispatches. Skills own their domains.
- **Parallel dispatch via Agent fan-out.** Spawn one Agent per review skill in a single message. Never use `Skill()` for fan-out — it can't parallelize.
- **Invariant sweep is always on.** Fast safety net even if skills already ran.
- **Test gaps are informational.** They appear in verdict but never block.
- **Config-only changes skip review.** Report them and skip to verdict.
- **Gate orchestrates, not edits.** Gate classifies, dispatches, and orchestrates. Code fixes are delegated to spawned fix agents. Dispatched skills handle their own vault writes + H-specs + baseline updates.
- **Resume /vault automatically.** When invoked by `/vault` preflight, continue to /vault Job 0 in the same turn after writing the sentinel.
- **Execute immediately.** No preamble. Classify, dispatch, verdict.
