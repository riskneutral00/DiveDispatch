---
name: vault
description: "End-of-session closer. Scoped to this session's touched files by default; pass --all to vault the entire working tree. Commits code, captures observations to Vaults, updates TODO, manages memory, syncs NotebookLM. Execute immediately, no prompts."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, Skill, mcp__openspace__execute_task
user-invocable: true
---

# /vault — Session Close

Run this before ending a session. No questions, no prompts — just execute all jobs (5 core + team shutdown).

---

## Right-sizing (drives every Job's behavior)

Scoped `/vault` runs need to *feel* lighter than `--all` runs, not just filter inputs identically. A 3-file fix should not produce 600 lines of vault content. The mechanism: compute one **SIZE** classification from the current scoped diff, then drive every Job through the table below.

### Size taxonomy

Compute SIZE once, immediately after Scope Resolution and before Pre-flight. Use the **current diff**, not `touched.txt` count — `touched.txt` is the historical session-state list (a file edited then reverted is still in it). `--all` always routes to FULL.

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

`/gate` independently computes its own SIZE and persists it in the sentinel JSON for audit. `/vault` recomputes here — both skills are authoritative for their own behavior.

### Per-Job behavior by size

| Job | TRIVIAL (≤3) | LIGHT (4–8) | STANDARD (9–20) | FULL (`--all` or 20+) |
|---|---|---|---|---|
| Pre-flight `/gate` | yes | yes | yes | yes |
| Job 0 Untracked triage | run | run | run | run |
| Job 1 Session file | **skip unless trigger fires** ¹ | 10-line cap, `## What` + `## Next` only | 30-line cap, full template | full current behavior |
| Job 1 Failure scan | **diff-caused only** ² | diff-caused only | all session failures | all |
| Job 1.1 24h summary | trigger check | trigger check | trigger check | trigger check |
| Job 1.2 Pattern file | **DELETED** ³ | DELETED | DELETED | DELETED |
| Job 1.5 Skeleton update | only if launch-checklist state changed | only if changed | only if changed | always check |
| Job 2 Tickets + mirror | only if `.tickets/` changed | only if `.tickets/` changed | run | run |
| Job 3 Active-thread file | append one bullet to current state; no rotation | append one bullet; no rotation | rotate current → previous, then write new current | rotate |
| Job 3 `MEMORY.md` description | skip unless NEXT changed | only if NEXT or milestone changed | full update | full update |
| Job 4 Smart-batch commit | run | run | run | run |
| Job 4.5 OpenSpace evolution | **skip** | skip | run | run |
| Job 5 Post-spec cleanup | run if `.post-spec/` exists | same | same | same |
| Job 6 Compile (entity creation) | concept-only gate ⁴ | concept-only gate | concept-only gate | concept-only gate |
| Job 7 Lint | run | run | run | run |

**¹ Session-file trigger.** Write only when **any** of:
- `/gate` surfaced ≥1 CRITICAL or HIGH finding (audit trail)
- the diff introduced a new concept that Job 6 will compile into an entity (the session file is the raw source)
- `SIZE ≥ STANDARD`
- the change is a schema or data-shape migration

Otherwise skip. Commit message + plan file + log entry are sufficient narrative for small fixes.

**² Diff-caused failure scan.** Replace any broader scan instruction with: *Did this session's diff cause the failure?* If yes, log to `raw/Failures/`. Pre-existing flakes surfaced by `/gate`, agent hallucinations on code outside the diff, and tool crashes that would have happened regardless do **not** belong in the session's failure log. They may justify tickets; they don't justify failure entries.

**³ Pattern file removed.** Nothing in the workflow consumes `.claude/patterns/*.md`. `/distill` reads `raw/Failures/*.md`. Lesson candidates have a real home in `wiki/Architecture/Lessons.md` with `status: draft`. Do **not** delete historical `.claude/patterns/*.md` files — just stop writing new ones.

**⁴ Concept-only gate (Job 6).** Before creating an entity, ask: *Is this a concept (load-bearing distinction, invariant, reusable pattern a future Claude with no context would benefit from) or a task (what this session did)?* Only concepts become entities. Tasks stay in session artifacts (if Job 1 fired) or stay out of the vault.

---

## Scope Resolution (runs before everything)

Matt's workflow overlaps multiple concurrent sessions. Default is **scoped** — `/vault` only commits files this session touched. Pass `--all` to commit the entire working tree (the legacy behavior).

```bash
SCOPE_MODE="scoped"
case " $* " in *" --all "*) SCOPE_MODE="all" ;; esac

SID="${CLAUDE_SESSION_ID:-}"
[ -z "$SID" ] && [ -f .claude/session-state/current-id ] && SID=$(cat .claude/session-state/current-id)
TOUCHED=".claude/session-state/$SID/touched.txt"

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

**Untouched dirty files are left alone.** They remain in the working tree for whichever session owns them. Job 0 triage, Job 4 commit, and sentinel cleanup all respect `$SCOPE_FILTER`. `/gate` invocations (pre-flight and resume) propagate `--all` when that mode is active.

### Compute SIZE now (drives every Job below)

Run the SIZE classification block from the **Right-sizing** section above. The resulting `SIZE` variable (`TRIVIAL` / `LIGHT` / `STANDARD` / `FULL`) is the authoritative input for every per-Job behavior decision in this skill. If `/gate` ran first and wrote a sentinel, its `size` field is informational only — `/vault` recomputes here because the diff may have changed between gate and vault runs.

---

## Performance Rules

**Minimize tool-call rounds.** Every round adds LLM thinking latency. Target ≤ 5 rounds total.

1. **Batch bash commands** with `&&` — never run `git status`, `git diff`, `git log` as separate tool calls.
2. **Parallel tool calls** — Jobs 1/2/3 write to different files. Fire all writes in ONE response.
3. **Skip reads when overwriting** — Session file is always overwritten. Don't read it first.
### Ideal execution shape (5 rounds max, usually 4)

```
Round 0: Bash(git status --porcelain + git log --diff-filter=D --name-only -20) → classify untracked
         If ambiguous files exist, prompt once. Otherwise silent.
Round 1: Read(MEMORY.md) + Read(active thread) + Read(TODO.md) + Read(.SKELETON.md)
         + Read(Lessons.md tail) ← only if lesson needed
Round 2: Bash(session file heredoc) + Bash(lessons append) + Bash(TODO mirror) + Write(thread) + Edit(MEMORY.md)
         + Edit(.SKELETON.md) + Edit(.tickets/) ← all parallel, all write different files
Round 3: Bash(rm -rf [ghosts/stale] && git status && git diff && git log --oneline -5)
         → classify → Bash(git add <bucket1> && git commit ... && git add <bucket2> && git commit ...)
Round 4: Print output
```

If no untracked files, skip Round 0. If no git changes after Round 2, skip Round 3 entirely. If no lessons, drop that from Round 2.

---

## Instructions

Every `/vault` close runs these in order. No skipping. The Karpathy sub-commands (`compile`, `lint`) run automatically near the end — Matt should never need to type `/vault compile` or `/vault lint` himself.

### Pre-flight: Quality Gate (auto-gates if needed)

Before anything else, check if `/gate` has been run and is still current. Compute `DIFF_HASH` with the same scope as /gate would:

```bash
if [ "$SCOPE_MODE" = "scoped" ]; then
  SCOPED_PATHS=$(xargs -a "$TOUCHED" 2>/dev/null || true)
  DIFF_HASH=$( (git diff -- $SCOPED_PATHS; git diff --cached -- $SCOPED_PATHS; git ls-files --others --exclude-standard | $SCOPE_FILTER) | shasum -a 256 | awk '{print $1}' )
else
  DIFF_HASH=$( (git diff; git diff --cached; git ls-files --others --exclude-standard) | shasum -a 256 | awk '{print $1}' )
fi
GATE=$(cat "$SENTINEL" 2>/dev/null)
```

1. If `$SENTINEL` exists AND `verdict` is `BLOCKED` → stop: `Build/test failure OR open gate tickets detected. Fix before vaulting.`
2. If `$SENTINEL` exists AND `diffHash` matches `$DIFF_HASH` AND `scopeMode` matches `$SCOPE_MODE` AND verdict is `CLEAN` or `CLEAN_UNREVIEWED` → proceed to open-gate-ticket check (step 4). Continue to Job 0 only if that passes.
3. Otherwise (missing OR stale — `diffHash` doesn't match OR `scopeMode` mismatch) → invoke `/gate` via the Skill tool, propagating the current scope flag (`/gate` when scoped, `/gate --all` when `$SCOPE_MODE=all`). `/gate`'s "Resume Contract" section guarantees it will write the sentinel and return control to /vault Job 0 within the same turn after emitting `Gate complete (verdict: ...). Resuming /vault Job 0.`
   - When you see that resume line, proceed to open-gate-ticket check (step 4).
   - If `/gate` reports BLOCKED, stop without entering Job 0.
4. **Open-gate-ticket check** — before Job 0, scan for gate-sourced tickets still open:
   ```bash
   OPEN=$(grep -l 'source: gate' .tickets/DD-*.md 2>/dev/null | xargs grep -l 'status: in_progress\|status: ready' 2>/dev/null)
   ```
   If non-empty, stop with:
   ```
   ⚠ Gate tickets still open:
     DD-X: {title}
     DD-Y: {title}
   Fix in same session (re-run /gate to resume Phase 7), or run /board dismiss <ID> "<reason>".
   ```
   Do NOT enter Job 0. Matt must resolve before commit.

**Critical:** `Skill()` is conversational substitution, not a function call. After /gate's instructions execute and write the sentinel, /vault's instructions remain visible in conversation context — you (the LLM) are responsible for continuing through Jobs 0-7 in the same turn. Do not treat the `Skill(gate)` call as a stopping point.

After Job 4 (commit) succeeds, clean up sentinels and write session timestamp. In scoped mode, remove only this session's sentinel; in `--all` mode, also remove the plain sentinel:
```bash
rm -f "$SENTINEL"
[ "$SCOPE_MODE" = "all" ] && rm -f .patrol-ran
rm -f .patrol-observations.md
date -u +%Y-%m-%dT%H:%M:%SZ > .last-session-ts
```

---

### Job 0: Untracked File Triage

Run before all other jobs. Goal: ensure no ghost files, stale duplicates, or garbage get committed. If there are no untracked files (`??` in `git status --porcelain`) — or, in scoped mode, no untracked files that this session touched — skip this job entirely.

**Round 0** — single Bash call (apply `$SCOPE_FILTER` to untracked list):
```bash
git status --porcelain | grep '^??' | cut -c4- | $SCOPE_FILTER && echo '---RECENT-DELS---' && git log --diff-filter=D --name-only --pretty=format: -20 | sort -u
```

In scoped mode, untouched untracked files are left alone — not triaged, not deleted, not staged. They belong to another session.

**Classify each untracked path** (first match wins):

| Bucket | Detection | Action | Prompt? |
|--------|-----------|--------|---------|
| **Ghost** | Path (or parent dir) appears in recent deletions list | `rm -rf` | No |
| **Rename** | Same dir has a `D`-status tracked file with similar name (e.g., `auto-advance.ts` → `autoAdvance.ts`) | Stage normally — git detects rename | No |
| **Convention** | Matches project patterns: `src/**/*.tsx`, `src/lib/**/*.ts`, `tests/**/*.test.*`, `convex/**/*.ts`, `e2e/**/*.spec.ts`, `.claude/skills/*/SKILL.md` | Stage normally | No |
| **Ephemeral** | Matches .gitignore patterns that somehow leaked | Skip + note in output | No |
| **Stale duplicate** | Numbered suffix alongside canonical file (e.g., `skill 2.md` next to `SKILL.md`) | `rm -f` | No |
| **Ambiguous** | None of the above | Prompt once | **Yes** |

**If Bucket F (Ambiguous) is non-empty** — one prompt:
```
⚠ N untracked files need triage:
  path/file.ts — [reason it's ambiguous]
  path/other.ts — [reason]
Commit all / Delete all / Let me specify?
```
Then execute the user's choice.

**Merge deletions into Round 3** — the `rm -rf` calls go at the start of the commit Bash call.

### Job 1: Vault Observations + Session File

Vault path: `~/Desktop/RiskNeutral/Vaults/RiskNeutral/`

> **Important:** The vault is outside the project directory. Use `Bash` with heredoc writes for ALL vault file operations.

1. Scan conversation for vault-worthy items per the routing table:

   | What | Where |
   |---|---|
   | Reusable pattern | `DiveDispatch/PatternLibrary/<slug>.md` |
   | New app idea | `RiskNeutral/Ideas/Ideas.md` (append) |
   | Project architecture/schema | `DiveDispatch/Architecture/*.md` (update) |
   | Lesson / mistake to avoid | `DiveDispatch/Architecture/Lessons.md` (append dated section) |
   | Failure / mistake that happened | `DiveDispatch/Failures/YYYY-MM-DD.md` (append) |
   | Session summary | `DiveDispatch/Sessions/YYYY-MM-DD.md` (overwrite) |
   | Code review | `DiveDispatch/Reviews/<slug>.md` |
   | Risk Neutral strategy/vision | `RiskNeutral/Strategy/*.md` (update) |
   | Founder insight/background | `RiskNeutral/Founder/Matt.md` (update) |

2. **Failure scan — diff-caused only.** Ask: *Did this session's diff cause the failure?* If yes, write a structured entry to `DiveDispatch/Failures/YYYY-MM-DD.md` (append, one `##` section per failure, following `.template.md` format). If the failure was a pre-existing flaky test surfaced by `/gate`, an agent hallucination on code outside the diff, or a tool crash that would have happened regardless — **do not write an entry**. Those may justify tickets; they don't inflate the session's failure log. Behavior is the same at every SIZE. If no diff-caused failures, skip — don't write an empty file.
3. **Session file — conditional.** Write only when **any** of:
   - `/gate` surfaced ≥1 CRITICAL or HIGH finding (audit trail)
   - the diff introduced a new concept that Job 6 will compile into an entity (the session file is the raw source for that entity)
   - `SIZE ≥ STANDARD`
   - the change is a schema or data-shape migration

   Otherwise **skip entirely** — commit message + plan file + log entry are sufficient narrative for small fixes. When written, **overwrite** (do NOT read first). Length budget per SIZE: TRIVIAL skips; LIGHT 10-line cap with `## What` + `## Next` only; STANDARD 30-line cap with full template; FULL full template uncapped.
4. For observations that append (Lessons, Patterns, Failures): read the tail in Round 1 to check for duplicates and match format.
5. Fire all vault writes as **parallel Bash calls** in Round 2.

   - **Lessons format:** `## Title — YYYY-MM-DD` with subsections: what happened, root cause, the fix, rule. Cross-ref line.
   - **Failures format:** Append to `DiveDispatch/Failures/YYYY-MM-DD.md`. Each entry is a `##` section following the template in `Failures/.template.md`: Context, What failed, What was tried, Root cause, Proposed rule, Frequency, Severity, Tags. One file per day, multiple entries append. Failures differ from Lessons — failures are raw structured data for `/distill` to cluster; lessons are curated narratives.
   - **Patterns format:** `## The smell`, `## Why it's a problem`, `## The fix`, `## Prevention checklist`, `## Where this came from`.
   - **Session format** (frontmatter is MANDATORY — `raw/wiki/` lint enforces it via `frontmatter-schema.md`):
     ```
     ---
     type: raw
     tier: episodic
     summary: "Session — <one-line summary of what happened>"
     tags: [session, <topic>, <topic>]
     updated: YYYY-MM-DD
     decay: 365d
     status: active
     source: /vault
     ---

     # Session: YYYY-MM-DD — <Title>
     **Date:** YYYY-MM-DD

     ## What Happened
     [2-3 paragraph summary]

     ## Key Decisions
     [Bulleted list]

     ## Files Modified
     [Full paths]

     ## Resume Point
     **Next action:** [Specific enough for a fresh session to execute]
     ```

### Job 1.1: 24-Hour Summary (conditional)

Vault path: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Summaries/`
Template: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Summaries/.template.md`
Happy path reference: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/HappyPath.md`

**Trigger check** — in Round 1, read `.last-summary-ts`:
```bash
cat .last-summary-ts 2>/dev/null || echo "1970-01-01T00:00:00Z"
```

If less than 24 hours since last summary → skip silently.

If ≥ 24 hours → generate summary. Gather data in Round 1 (parallel with Job 1 reads):

1. **Sessions since last summary:** Read session files (`Sessions/YYYY-MM-DD*.md`) dated after last summary timestamp.

2. **Project vitals:** Read `.SKELETON.md` (already in Round 1) for launch gates and ticket counts. Get test count from most recent session.

3. **Skill ecosystem:**
   ```bash
   ls .claude/skills/ | wc -l && git log --since="$LAST_SUMMARY" --name-only --pretty=format: -- .claude/skills/ .claude/agents/ .claude/hooks/ | sort -u | grep -v '^$'
   ```
   Cross-reference with previous summary to identify new/modified/deprecated. **Always cover matrix-github and matrix-youtube specifically** — these are strategic skills.

4. **AutoResearch & OpenSpace:** Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/AutoResearch/Index.md`. Read `.openspace/skill_usage.jsonl` if it exists.

5. **Failures:** Read failure entries in `~/Desktop/RiskNeutral/Vaults/DiveDispatch/raw/Failures/` dated after last summary.

6. **Trajectory (Section 9):** Read `HappyPath.md` gap list. For each gap, check if the corresponding ticket changed status since last summary. Compute on-path ratio and drift indicator.

**Write in Round 2** (parallel with other writes):
```bash
cat > ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Summaries/YYYY-MM-DD.md << 'SUMMARY'
[filled template — all 9 sections]
SUMMARY
date -u +%Y-%m-%dT%H:%M:%SZ > .last-summary-ts
```

**Performance:** All reads fold into Round 1. Summary write + timestamp write fold into Round 2. Zero extra rounds.

### Job 1.2: Pattern File — REMOVED

Pattern files are no longer written by `/vault`. Nothing in the workflow consumes `.claude/patterns/*.md`: `/distill` reads `raw/Failures/*.md`, and lesson candidates have a real home in `wiki/Architecture/Lessons.md` with `status: draft`. Historical pattern files are left in place (gitignored) — just don't write new ones.

### Job 1.5: Skeleton Update

Path: `.SKELETON.md` (project root)

1. Read `.SKELETON.md` in Round 1 (parallel with other reads).
2. If any launch checklist items changed status this session (tickets fixed, coverage improved, deploy configured), update their status.
3. If no checklist items changed — skip.
4. Write via `sed -i ''` or Edit in Round 2 (parallel with other writes).

### Job 2: Ticket Board Update + Vault Mirror Sync

Source of truth: `.tickets/DD-*.md` files. Vault mirror: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md` (auto-generated, never edit directly).

1. Read `.tickets/` in Round 1 (parallel with other reads).
2. If nothing completed, no status changes needed — skip.
3. Otherwise: update ticket YAML frontmatter (status, assigned_to, updated date). Move completed tickets to `.tickets/done/`.
4. **Gate-sourced closures:** gate Phase 7 already moves `done`/`dismissed` gate tickets to `.tickets/done/`. Verify they're there; if any are still in `.tickets/` with `source: gate` AND `status: done|dismissed`, move them now.
5. Run vault mirror sync: regenerate TODO.md from `.tickets/` state (same logic as `/board sync`).
6. Session file's Resume Point should match the first ready ticket (exclude gate-sourced tickets — those are audit artifacts, not work queue).
7. Write ticket updates via Edit in Round 2 (parallel with other writes). Vault mirror sync via Bash heredoc. `.tickets/done/` changes commit in the Board bucket (Phase C).

### Job 3: Memory Management

1. Read MEMORY.md + active thread file in Round 1 (parallel with other reads).
2. **Active thread file — size-aware behavior:**
   - **`SIZE ≤ LIGHT`:** **append one bullet** to the existing Current state under a `### Session addenda` subheading (create the subheading if missing). Do NOT rotate — do NOT demote Current state to Previous state. The bullet records what shipped + the resume pointer in 1–2 sentences.
   - **`SIZE ≥ STANDARD`:** keep the existing rotation behavior — demote current `## Current state` to `## Previous state`, write a new `## Current state` section.
   - In all cases, refresh test baseline numbers, recent commits list (last 5), and date stamp.
3. **MEMORY.md description — size-aware behavior:**
   - **`SIZE = TRIVIAL`:** **skip unless NEXT changed.** If the active thread's `**NEXT:**` action is unchanged, leave MEMORY.md alone.
   - **`SIZE = LIGHT`:** update only if NEXT or a milestone changed.
   - **`SIZE ≥ STANDARD`:** full update — bold `**NEXT:**` tag with the exact next action on the active thread line, add/remove/merge memory file entries as needed.
   - Always: keep under 50 lines.
4. New memory files only for info that isn't already captured, will be useful in future sessions, and can't be derived from code/vault.
5. Write via Write/Edit tools in Round 2 (parallel with other writes).

### Job 4: Smart-Batch Git Commit (DiveDispatch)

Working directory: `~/Desktop/RiskNeutral/DiveDispatch`

This job runs **last** (after Jobs 1–3 have written all in-repo changes). This ensures ticket updates, skeleton edits, and `.claude/` changes are all captured in domain-bucketed commits — no orphaned files.

Matt works across multiple terminals on different tickets. **Never lump unrelated changes into one commit.** Classify files into logical groups and commit each group separately.

**Round 3** — single Bash call:
```bash
git status && git diff --stat && git diff --cached --stat && git log --oneline -5
```
If no changes, skip. In scoped mode, "no changes" means no files in `git status --porcelain` that intersect with `$TOUCHED` — untouched dirty files don't trigger this job.

Then classify → chain commits in a single Bash call.

#### Phase A: Classify into domain buckets

Read `git status --porcelain` output. In scoped mode, pipe the path column through `$SCOPE_FILTER` first — files this session didn't touch are dropped before classification. Assign each remaining file to exactly one bucket. **First match wins.**

| Pri | Bucket | Path patterns | Default prefix |
|-----|--------|--------------|----------------|
| 0 | **Renames** | `D` + `??` pair in same dir, similar basename | `refactor:` |
| 1 | **Tooling** | `.claude/**`, `.gitignore`, `scripts/**` | `chore:` |
| 2 | **Infra** | `package.json`, `package-lock.json` | `chore:` |
| 3 | **Booking backend** | `convex/bookings/**`, `convex/availability.ts`, `convex/bookingDraftMutations.ts` | varies |
| 4 | **Backend (other)** | `convex/**` (everything else) | varies |
| 5 | **Booking UI** | `src/components/booking/**`, `src/lib/booking/**` | varies |
| 6 | **Dashboard UI** | `src/components/dashboard/**`, `src/components/dashboards/**` | varies |
| 7 | **UI (other)** | `src/components/**`, `src/lib/**`, `src/app/**` | varies |
| 8 | **E2E** | `e2e/**` | `test:` |
| 9 | **Tests** | `tests/**`, `src/**/__tests__/**` | `test:` |
| 10 | **Board** | `.tickets/**` | — (never staged — symlink to vault) |

**Always exclude** from staging: `.env*`, `credentials*.json`, `*.pem`, `*.key`, `playwright-report/`, `test-results/`, `convex/_generated/**`, `.tickets/**`

**Why `.tickets/` and `convex/_generated/` are excluded:**
- `.tickets/` is a symlink → `../Vaults/DiveDispatch/wiki/Tickets`. `git add` fails with `fatal: pathspec is beyond a symbolic link`. Ticket moves (`mv .tickets/DD-N.md .tickets/done/`) modify vault files outside the repo — they don't need staging.
- `convex/_generated/` is gitignored. It appears in `git status` output but `git add` rejects it.

#### Phase B: Merge & pair

1. **Test pairing** — move test files to their source bucket if a matching source exists there. Strip `tests/`, `tests/components/`, `__tests__/` prefix and `.test.` suffix → compare basename AND parent directory path (e.g., `tests/components/booking/quick-book.test.tsx` matches `src/components/booking/`, not `convex/bookings/`). If exactly one bucket has a path-level match, merge the test there. If multiple buckets match by basename alone, prefer the one whose source path shares the most directory segments. Unpaired tests stay in Tests bucket.
2. **Cross-cutting files:**
   - `package.json` / `package-lock.json` → Infra, unless only 1 other bucket exists (merge there)
   - Seed cluster (`seed.ts`, `seedFixture.ts`, `seed-clerk.ts`, `e2e/helpers/seed.ts`) → merge into a backend bucket if one exists, otherwise own bucket
3. **Tiny buckets** — if a bucket has only 1 modified (not new) file, merge into nearest same-domain bucket (`convex/` → any backend, `src/` → any UI)
4. **Cap at 5 buckets** — if more, merge smallest into nearest neighbor until ≤5
5. **If only 1 bucket remains** — single commit, same as legacy behavior

#### Phase C: Commit chain

Commit order: **Tooling → Infra → Backend → UI → Tests → Board**

Never `git add -A`. Stage specific files per bucket. All commits in **one Bash call**, chained with `&&`:

```bash
git add <bucket1-files> && git commit -m "$(cat <<'EOF'
type: scope description

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" && \
git add <bucket2-files> && git commit -m "$(cat <<'EOF'
type: scope description

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Commit message format: `type(scope): message` where type is `feat|fix|refactor|test|chore|style|docs` and scope is `backend|frontend|schema|tooling|tests|board`. Example: `fix(backend): correct FSM guard in reservation patch`. Concise "why" not "what", 1–2 sentences. Include Tier/H#/SU Phase ref if known. If unknown, omit — don't guess.

---

## Output

Print exactly this format, omitting any line whose job was skipped:

```
Triage: deleted N ghosts, N stale; staged N renames, N new
Committed:
  <short-hash> <message> (N files)
  <short-hash> <message> (N files)
Vault: N observations → [locations]
Board: [brief summary of ticket updates + vault mirror synced]
Memory: [updated/cleaned/no changes]
Saved. Next session: /first → [exact next action]
```

If only 1 commit, use single-line format: `Committed: <short-hash> <message> (N files)`

The `Saved.` line is always present — from session file's Resume Point.

If all five jobs are skipped:
```
Nothing to vault.
```

---

### Job 4.5: OpenSpace Skill Evolution

Run **after** Job 4 (git commit) so skill files are in a clean state.

**Size gate:** if `SIZE` is `TRIVIAL` or `LIGHT`, **skip this job entirely** — small diffs don't produce useful skill-evolution signal, and OpenSpace runs cost 1–2 minutes wall-clock. The usage log is preserved for the next STANDARD/FULL run. Print nothing for this job at small sizes.

1. Check if `.openspace/skill_usage.jsonl` exists and has content:
   ```bash
   [ -s .openspace/skill_usage.jsonl ] && echo "HAS_USAGE" || echo "NO_USAGE"
   ```
   If `NO_USAGE`, skip this job silently.

2. Read the log. Count invocations per skill. Build a summary line:
   ```
   Skills used this session: board(3), gate(2), qa(1), spec(1), review-frontend(1)
   ```

3. **Snapshot skill frontmatter** before evolution (for rollback):
   ```bash
   for f in .claude/skills/*/SKILL.md; do head -10 "$f"; done > /tmp/dd-skill-frontmatter-snapshot.txt
   ```

4. Call OpenSpace evolution engine:
   ```
   mcp__openspace__execute_task(
     task: "Skills used this session: [summary from step 2]. Review each skill's SKILL.md definition in the skill directories. Compare instructions against what these skills actually need to do. Evolve skills that have unclear instructions, missing edge cases, outdated patterns, or redundant steps. Focus on the most-used skills first. Do not modify skills that are already clear and effective.

CRITICAL FORMAT RULES — you MUST preserve these in every skill file you modify:
- The YAML frontmatter block (between --- markers) must be preserved exactly, including: name, description, allowed-tools, user-invocable, and any other fields
- Never remove or rename frontmatter fields
- Only modify the instruction body below the frontmatter
- If a skill's instructions are already clear and effective, leave it unchanged",
     workspace_dir: "<project root>",
     skill_dirs: ["/Users/matthewlee/Desktop/RiskNeutral/DiveDispatch/.claude/skills"],
     search_scope: "local",
     max_iterations: 10
   )
   ```

5. **Validate evolved skills** — check that frontmatter survived:
   ```bash
   BROKEN=0
   for f in .claude/skills/*/SKILL.md; do
     if ! head -1 "$f" | grep -q '^---'; then
       echo "BROKEN FRONTMATTER: $f"
       BROKEN=$((BROKEN + 1))
     fi
   done
   ```
   If `BROKEN > 0`: revert ALL skill changes with `git checkout .claude/skills/` and report the failure. Do NOT clear the usage log (so evolution retries next session).

6. If validation passes, clear the usage log:
   ```bash
   > .openspace/skill_usage.jsonl
   ```

7. If `execute_task` failed or timed out: do NOT clear the usage log. Print `Evolution: skipped (OpenSpace error)` and continue — never block vault completion.

8. If any skills were evolved, commit them:
   ```bash
   git add .claude/skills/ && git commit -m "$(cat <<'EOF'
   chore: openspace skill evolution

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
   Output: `Evolution: N skills improved by OpenSpace`
   If none evolved: skip the output line.

**Note:** This step may take 1-2 minutes (OpenSpace runs its own analysis loop). It runs after commits are done so it never blocks the safety-critical parts of /vault. If it fails, vault still completes normally.

---

### Job 5: Clean Up Post-Spec Artifacts

Run **after** all other jobs complete. If `.post-spec/` exists, clean up working files (keep `plan.md` and `review-findings.md` for inspection). Remove stale sentinels.

---

### Job 6: /vault compile (auto-fires — Matt never types it)

After all commits land, run the Karpathy LLM-writes-wiki compile step. This is the whole point of the vault pattern — observations become reusable entity pages automatically.

**Concept-vs-task gate (runs first).** Before creating any entity, ask: *Is this a concept (a load-bearing distinction, invariant, or reusable pattern that a future Claude with no context would benefit from) or a task (what this session did)?* Only concepts become entities. Tasks stay in session artifacts (if Job 1 fired) or stay out of the vault. The compile marker (step 6 below) still fires regardless — it's metadata about the skill running, not vault content.

1. Read today's `log.md` entries (since the last compile marker).
2. Read `raw/Sessions/YYYY-MM-DD.md` just written in Job 2.
3. Read `git log --since "YYYY-MM-DD"` (last compile date, or last 24h if none).
4. **Identify concepts touched.** For each:
   - Apply the concept-vs-task gate above. If task-only, skip.
   - Look for existing entity in `wiki/Architecture/entities/<concept>.md`.
   - If exists: update with new insight, bump `updated:`, add `[[wiki-links]]` to code paths just modified.
   - If not: create new `wiki/Architecture/entities/<slug>.md` with frontmatter (`type: entity`, `tier: semantic`, `decay: 90d`, `source: /vault`).
5. If this session touched topics with existing drafts (`status: draft`) in entities/, promote or merge — don't leave drafts rotting.
6. Append marker to `log.md`: `YYYY-MM-DD HH:MM compile → {n} entities created, {m} updated, {k} drafts promoted`. Always fire (even when no entities created — `0 created, 0 updated, 0 promoted` is a valid marker).

Do not touch `raw/*` content (immutable after write). Do not delete entries from `log.md`.

---

### Job 7: /vault lint (auto-fires — Matt never types it)

Run the mechanical lint for drift detection. Output goes to `raw/Lint/YYYY-MM-DD.md`.

1. Execute `bash scripts/vault-lint.sh`. Capture exit code.
2. If CRITICAL > 0: print a short summary to terminal (e.g. "5 stale refs, 3 missing-frontmatter — see raw/Lint/YYYY-MM-DD-mechanical.md").
3. If HIGH > 0 and includes stale references to deleted symbols in code just committed: offer to auto-fix (sed replace vault refs).
4. If the lint report differs materially from yesterday's (new stale refs appeared): flag in terminal.

Never block `/vault` close on lint findings. Lint is informational; `/gate` is enforcement.

---

## Sub-Commands (Karpathy LLM-Wiki pattern)

The base `/vault` command (described above) is the session-close closer. Three sub-commands extend it for the Karpathy wiki pattern. Contracts live at `Vaults/DiveDispatch/Schema/`.

### `/vault compile`

LLM-writes-the-wiki flip. Runs automatically at the end of `/vault` close; can also be invoked standalone.

1. Read `Vaults/DiveDispatch/log.md` tail (entries since last compile marker).
2. Read most-recent `raw/Sessions/*.md` and `raw/Failures/*.md` (last 7 days).
3. Read `git log --since="last /vault compile"` for code context.
4. Identify concepts touched. For each, **update or create** an entity page in `wiki/Architecture/entities/<concept>.md`:
   - Frontmatter: `type: entity, tier: semantic, decay: 90d, source: /vault`.
   - Body: synthesis + `[[wiki-links]]` back to raw sources, code paths, hooks, rules.
5. If any pair of entities contradicts, propose `supersedes:` / `superseded_by:` diff for Matt approval (see `/vault lint`).
6. Update `index.md` only if a new `type` appears (Obsidian Bases auto-refresh otherwise).
7. Write a compile-marker line to `log.md`: `YYYY-MM-DD HH:MM compile → {n} entities created, {m} updated`.

Do **not** delete or rewrite existing raw content. `raw/` is immutable after write.

### `/vault lint`

Daily health check. Scheduled via launchd; also invocable on demand. Output goes to `raw/Lint/YYYY-MM-DD.md`. `/gate` reads the latest report.

Checks:
- **Frontmatter validation** against `Schema/frontmatter-schema.md`. Missing `type`/`tier` → CRITICAL; unknown values → HIGH.
- **Stale references.** Grep vault for symbols deleted in code (parse `git log --diff-filter=D` since last lint run). Example known stale refs: `content-island`, `HOLD_TTL_MS`, `error-messages.ts`.
- **Orphan pages.** `type: entity, tier: semantic` pages with zero inbound `[[wiki-links]]` → HIGH.
- **Supersession detection.** Find entity pairs with overlapping `tags` where newer `updated` asserts a claim the older contradicts. Propose resolution by (a) most recent `updated`, (b) highest `confidence`, (c) most inbound backlinks. Emit diff: old page gets `status: superseded` + `superseded_by: [[new]]`; new page gets `supersedes: [[old]]`. Requires Matt approval before applying.
- **Decay enforcement.** Pages with `updated` past `decay` TTL flagged. If the surrounding domain has no recent code activity, auto-move to `raw/archive/<original-path>.md` and rewrite inbound links. `decay: never` pages never age.
- **Contradictions.** Cross-check `wiki/Architecture/invariants/*.md` against `.claude/rules/*.md` + repo-root `Architecture/*-invariants.md`. Same topic with different rules → CRITICAL.
- **Pattern contract.** Each `wiki/PatternLibrary/*.md` must satisfy `Schema/pattern-contract.md` (Problem, Pattern, Evidence, Enforcement sections; dangling `enforced_by` path → CRITICAL).
- **Self-heal** where safe: rewrite stale paths to new vault topology, stamp missing `updated`, add `tier` if inferrable from folder.

Report format:
```
# Lint Report — YYYY-MM-DD

CRITICAL (n): ...
HIGH (n): ...
MEDIUM (n): ...
Self-healed (n): ...
```

### `/vault capture`

Mid-session observation capture (without session close). Appends to `log.md` with a `tag` prefix.

- `/vault capture observation: <text>` → `YYYY-MM-DD HH:MM observation <text>`
- `/vault capture failure: <text>` → also writes a stub to `raw/Failures/YYYY-MM-DD.md`
- `/vault capture lesson: <text>` → flags for next `/vault compile` as entity candidate

Intended for times when Matt wants to record something without triggering the full close flow.
