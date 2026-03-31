---
name: vault
description: "End-of-session closer. Commits code, captures observations to Vaults, updates TODO, manages memory, syncs NotebookLM. Execute immediately, no prompts."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, mcp__openspace__execute_task
user-invocable: true
---

# /vault — Session Close

Run this before ending a session. No questions, no prompts — just execute all jobs (5 core + team shutdown).

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

### Pre-flight: Patrol Verdict Check

Before anything else, check Patrol's sentinel and merge backlog:

```bash
PATROL=$(cat .patrol-ran 2>/dev/null)
UNPROCESSED=$(ls .car/merged/*.json 2>/dev/null | wc -l | tr -d ' ')
```

**Verdict dispatch (4 cases):**

1. If `.patrol-ran` exists and `verdict` is `CLEAN` or `CLEAN_UNREVIEWED` → proceed silently.
2. If `.patrol-ran` exists and `verdict` is `BLOCKED` → block: `❌ Patrol reports build/test failure. Fix before vaulting.` Stop.
3. If `.patrol-ran` is missing AND `UNPROCESSED > 0` → warn: `⚠ {UNPROCESSED} tickets merged but not reviewed by Patrol. Run /gate to check safety, or /driver to process the backlog. Continue anyway? (y/n)` If the user says no, stop.
4. If `.patrol-ran` is missing AND `UNPROCESSED = 0` → proceed silently (Car agents never ran or already fully completed).

**Quick sanity** — even if Patrol says CLEAN, double-check:
```bash
grep -rl 'source: backseat' .tickets/DD-*.md 2>/dev/null | xargs grep -l 'status: ready' 2>/dev/null | xargs grep -L 'human_required: true' 2>/dev/null
```
If any unresolved non-human_required backseat tickets exist → warn: `⚠ {N} backseat fix tickets still open. Driver may not have finished. Continue anyway? (y/n)` If the user says no, stop.

After Job 4 (commit) succeeds, clean up sentinels and write session timestamp:
```bash
rm -f .patrol-ran .patrol-observations.md
date -u +%Y-%m-%dT%H:%M:%SZ > .last-session-ts
```

---

### Job 0: Untracked File Triage

Run before all other jobs. Goal: ensure no ghost files, stale duplicates, or garbage get committed. If there are no untracked files (`??` in `git status --porcelain`), skip this job entirely.

**Round 0** — single Bash call:
```bash
git status --porcelain | grep '^??' | cut -c4- && echo '---RECENT-DELS---' && git log --diff-filter=D --name-only --pretty=format: -20 | sort -u
```

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

2. **Failure scan** — Review the conversation for anything that went wrong: bugs hit, wrong approaches taken, tools that misbehaved, regressions introduced, time wasted on dead ends. If any failures occurred, write structured entries to `DiveDispatch/Failures/YYYY-MM-DD.md` (append, one `##` section per failure, following `.template.md` format). If no failures this session, skip — don't write an empty file.
3. Session file is always written (overwrite). **Do NOT read it first.**
4. For observations that append (Lessons, Patterns, Failures): read the tail in Round 1 to check for duplicates and match format.
5. Fire all vault writes as **parallel Bash calls** in Round 2.

   - **Lessons format:** `## Title — YYYY-MM-DD` with subsections: what happened, root cause, the fix, rule. Cross-ref line.
   - **Failures format:** Append to `DiveDispatch/Failures/YYYY-MM-DD.md`. Each entry is a `##` section following the template in `Failures/.template.md`: Context, What failed, What was tried, Root cause, Proposed rule, Frequency, Severity, Tags. One file per day, multiple entries append. Failures differ from Lessons — failures are raw structured data for `/distill` to cluster; lessons are curated narratives.
   - **Patterns format:** `## The smell`, `## Why it's a problem`, `## The fix`, `## Prevention checklist`, `## Where this came from`.
   - **Session format:**
     ```
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

1. **Sessions since last summary:** Read session files (`Sessions/YYYY-MM-DD*.md`), driver debriefs, and backseat debriefs dated after last summary timestamp.

2. **Project vitals:** Read `.SKELETON.md` (already in Round 1) for launch gates and ticket counts. Get test count from most recent session or driver debrief.

3. **Skill ecosystem:**
   ```bash
   ls .claude/skills/ | wc -l && git log --since="$LAST_SUMMARY" --name-only --pretty=format: -- .claude/skills/ .claude/agents/ .claude/hooks/ | sort -u | grep -v '^$'
   ```
   Cross-reference with previous summary to identify new/modified/deprecated. **Always cover matrix-github and matrix-youtube specifically** — these are strategic skills.

4. **AutoResearch & OpenSpace:** Read `~/Desktop/RiskNeutral/Vaults/DiveDispatch/AutoResearch/Index.md`. Read `.openspace/skill_usage.jsonl` if it exists.

5. **Failures:** Read failure entries in `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Failures/` dated after last summary.

6. **Trajectory (Section 9):** Read `HappyPath.md` gap list. For each gap, check if the corresponding ticket changed status since last summary. Compute on-path ratio and drift indicator.

**Write in Round 2** (parallel with other writes):
```bash
cat > ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Summaries/YYYY-MM-DD.md << 'SUMMARY'
[filled template — all 9 sections]
SUMMARY
date -u +%Y-%m-%dT%H:%M:%SZ > .last-summary-ts
```

**Performance:** All reads fold into Round 1. Summary write + timestamp write fold into Round 2. Zero extra rounds.

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
4. Run vault mirror sync: regenerate TODO.md from `.tickets/` state (same logic as `/board sync`).
5. Session file's Resume Point should match the first ready ticket.
6. Write ticket updates via Edit in Round 2 (parallel with other writes). Vault mirror sync via Bash heredoc.

### Job 3: Memory Management

1. Read MEMORY.md + active thread file in Round 1 (parallel with other reads).
2. Update active thread — it's a **pointer to TODO.md**, only update:
   - Test baseline numbers
   - Recent commits list (last 5)
   - Date stamp
3. Update MEMORY.md:
   - Bold **NEXT:** tag with exact next action on active thread line.
   - Add/remove/merge memory file entries as needed.
   - Keep under 50 lines.
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
If no changes, skip.

Then classify → chain commits in a single Bash call.

#### Phase A: Classify into domain buckets

Read `git status --porcelain` output. Assign each file to exactly one bucket. **First match wins.**

| Pri | Bucket | Path patterns | Default prefix |
|-----|--------|--------------|----------------|
| 0 | **Renames** | `D` + `??` pair in same dir, similar basename | `refactor:` |
| 1 | **Tooling** | `.claude/**`, `.gitignore`, `scripts/**` | `chore:` |
| 2 | **Infra** | `package.json`, `package-lock.json`, `convex/_generated/**` | `chore:` |
| 3 | **Booking backend** | `convex/bookings/**`, `convex/availability.ts`, `convex/bookingDraftMutations.ts` | varies |
| 4 | **Backend (other)** | `convex/**` (everything else) | varies |
| 5 | **Booking UI** | `src/components/booking/**`, `src/lib/booking/**` | varies |
| 6 | **Dashboard UI** | `src/components/dashboard/**`, `src/components/dashboards/**` | varies |
| 7 | **UI (other)** | `src/components/**`, `src/lib/**`, `src/app/**` | varies |
| 8 | **E2E** | `e2e/**` | `test:` |
| 9 | **Tests** | `tests/**`, `src/**/__tests__/**` | `test:` |
| 10 | **Board** | `.tickets/**` | `chore:` |

**Always exclude** from staging: `.env*`, `credentials*.json`, `*.pem`, `*.key`, `playwright-report/`, `test-results/`

#### Phase B: Merge & pair

1. **Test pairing** — move test files to their source bucket if a matching source exists there. Strip `tests/`, `tests/components/`, `__tests__/` prefix and `.test.` suffix → compare basename AND parent directory path (e.g., `tests/components/booking/quick-book.test.tsx` matches `src/components/booking/`, not `convex/bookings/`). If exactly one bucket has a path-level match, merge the test there. If multiple buckets match by basename alone, prefer the one whose source path shares the most directory segments. Unpaired tests stay in Tests bucket.
2. **Cross-cutting files:**
   - `convex/_generated/api.d.ts` → first backend bucket
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

Commit message per bucket: conventional prefix, concise "why" not "what", 1–2 sentences. Include Tier/H#/SU Phase ref if known. If unknown, omit — don't guess.

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

### Job 5: Shutdown Car Team

Run **after** all other jobs complete. Check if a Car tmux session is active:

```bash
tmux has-session -t car 2>/dev/null
```

If the session exists:

1. Write exit sentinels so agents shut down gracefully:
   ```bash
   echo "vault" > .car/exit-driver
   echo "vault" > .car/exit-backseat
   echo "vault" > .car/exit-patrol
   ```

2. Wait up to 30 seconds for agents to finish current work, then kill the session:
   ```bash
   sleep 10 && tmux kill-session -t car 2>/dev/null
   ```

3. Print: `Car team shut down.`

If no tmux session exists, skip this job silently.
