---
name: vault
description: "End-of-session closer. Commits code, captures observations to Vaults, updates TODO, manages memory, syncs NotebookLM. Execute immediately, no prompts."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /vault — Session Close

Run this before ending a session. No questions, no prompts — just execute all 5 jobs.

---

## Performance Rules

**Minimize tool-call rounds.** Every round adds LLM thinking latency. Target ≤ 5 rounds total.

1. **Batch bash commands** with `&&` — never run `git status`, `git diff`, `git log` as separate tool calls.
2. **Parallel tool calls** — Jobs 2/3/4 write to different files. Fire all writes in ONE response after Job 1.
3. **Skip reads when overwriting** — Session file is always overwritten. Don't read it first.
4. **Single NLM call** — chain all `nlm source add` with `&&` in one Bash call.

### Ideal execution shape (6 rounds max, usually 5)

```
Round 0: Bash(git status --porcelain + git log --diff-filter=D --name-only -20) → classify untracked
         If ambiguous files exist, prompt once. Otherwise silent.
Round 1: Bash(git status && git diff && git diff --cached && git log --oneline -5)
         + Read(MEMORY.md) + Read(active thread) + Read(TODO.md)
         + Read(Lessons.md tail) ← only if lesson needed
Round 2: Bash(rm -rf [ghosts/stale] && git add <bucket1> && git commit ... && git add <bucket2> && git commit ...)
Round 3: Bash(session file heredoc) + Bash(lessons append) + Bash(TODO sed) + Write(thread) + Edit(MEMORY.md)
         ← all parallel, all write different files
Round 4: Bash(nlm source add ... && nlm source add ...)
Round 5: Print output
```

If no untracked files, skip Round 0. If no git changes, skip Round 1's diff and Round 2 entirely. If no lessons, drop that from Round 3.

---

## Instructions

### Job 0: Untracked File Triage

Run before Job 1. Goal: ensure no ghost files, stale duplicates, or garbage get committed. If there are no untracked files (`??` in `git status --porcelain`), skip this job entirely.

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

**Merge deletions into Round 2** — the `rm -rf` calls go at the start of the commit Bash call.

### Job 1: Smart-Batch Git Commit (DiveDispatch)

Working directory: `~/Desktop/RiskNeutral/DiveDispatch`

Matt works across multiple terminals on different tickets. **Never lump unrelated changes into one commit.** Classify files into logical groups and commit each group separately.

**Round 1** — single Bash call:
```bash
git status && git diff --stat && git diff --cached --stat && git log --oneline -5
```
If no changes, skip to Jobs 2–5.

**Round 2** — classify → chain commits in a single Bash call.

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

**Always exclude** from staging: `.env*`, `credentials*.json`, `*.pem`, `*.key`, `playwright-report/`, `test-results/`

#### Phase B: Merge & pair

1. **Test pairing** — move test files to their source bucket if a matching source exists there. Strip `tests/`, `tests/components/`, `__tests__/` prefix and `.test.` suffix → compare basename. If exactly one bucket has the match, merge the test there. Unpaired tests stay in Tests bucket.
2. **Cross-cutting files:**
   - `convex/_generated/api.d.ts` → first backend bucket
   - `package.json` / `package-lock.json` → Infra, unless only 1 other bucket exists (merge there)
   - Seed cluster (`seed.ts`, `seedFixture.ts`, `seed-clerk.ts`, `e2e/helpers/seed.ts`) → merge into a backend bucket if one exists, otherwise own bucket
3. **Tiny buckets** — if a bucket has only 1 modified (not new) file, merge into nearest same-domain bucket (`convex/` → any backend, `src/` → any UI)
4. **Cap at 5 buckets** — if more, merge smallest into nearest neighbor until ≤5
5. **If only 1 bucket remains** — single commit, same as legacy behavior

#### Phase C: Commit chain

Commit order: **Tooling → Infra → Backend → UI → Tests**

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

### Job 2: Vault Observations + Session File

Vault path: `~/Desktop/RiskNeutral/Vaults/RiskNeutral/`

> **Important:** The vault is outside the project directory. Use `Bash` with heredoc writes for ALL vault file operations.

1. Scan conversation for vault-worthy items per the routing table:

   | What | Where |
   |---|---|
   | Design/UX observation | `Inspirations/<source>/<slug>.md` |
   | Reusable pattern | `PatternLibrary/<slug>.md` |
   | New app idea | `Ideas/Parallel Apps.md` (append) |
   | Project architecture/schema | `DiveDispatch/*.md` (update) |
   | Lesson / mistake to avoid | `DiveDispatch/Architecture/Lessons.md` (append dated section) |
   | Session summary | `Sessions/YYYY-MM-DD.md` (overwrite) |
   | Risk Neutral strategy/vision | `RiskNeutral/Strategy/*.md` (update) |
   | Founder insight/background | `RiskNeutral/Founder/Matt.md` (update) |

2. Session file is always written (overwrite). **Do NOT read it first.**
3. For observations that append (Lessons, Patterns): read the tail in Round 1 to check for duplicates and match format.
4. Fire all vault writes as **parallel Bash calls** in Round 3.

   - **Lessons format:** `## Title — YYYY-MM-DD` with subsections: what happened, root cause, the fix, rule. Cross-ref line.
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

### Job 3: TODO Update

Path: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Product/TODO.md`

1. Read in Round 1 (parallel with other reads).
2. If nothing completed, no gaps discovered, no position change needed — skip.
3. Otherwise: check off `[x]` completed items, update `### Current Position:` section, add new items/gaps.
4. If entire phase fully checked off, collapse to: `## Phase N: [Name] — DONE`
5. Session file's Resume Point should match the first unchecked TODO item.
6. Write via `sed -i ''` or Bash heredoc in Round 3 (parallel with other writes).

### Job 4: Memory Management

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
5. Write via Write/Edit tools in Round 3 (parallel with other writes).

### Job 5: NotebookLM Sync

If vault files were created/modified in Job 2, sync in **one Bash call**:

```bash
nlm source add <alias1> --file "<path1>" && nlm source add <alias2> --file "<path2>"
```

| Vault path prefix | Notebook alias |
|-------------------|---------------|
| `RiskNeutral/` | `rn-strategy` |
| `DiveDispatch/` (Product, Architecture, Legal, Reviews) | `dd-product` |
| `Sessions/`, `Ideas/`, `DiveDispatch/Architecture/Lessons.md` | `sessions` |

---

## Output

Print exactly this format, omitting any line whose job was skipped:

```
Triage: deleted N ghosts, N stale; staged N renames, N new
Committed:
  <short-hash> <message> (N files)
  <short-hash> <message> (N files)
Vault: N observations → [locations]
TODO: [brief summary of position update]
Memory: [updated/cleaned/no changes]
NotebookLM: N sources synced
Saved. Next session: /first → [exact next action]
```

If only 1 commit, use single-line format: `Committed: <short-hash> <message> (N files)`

The `Saved.` line is always present — from session file's Resume Point.

If all five jobs are skipped:
```
Nothing to vault.
```
