---
name: vault
description: "End-of-session closer. Commits code, captures observations to DiveVault, updates TODO, manages memory, syncs NotebookLM. Execute immediately, no prompts."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /vault — Session Close

Run this before ending a session. No questions, no prompts — just execute all 5 jobs.

---

## Instructions

Run all five jobs in order. Each job is independent — skip silently if nothing to do.

### Job 1: Git Commit (DiveDispatch)

Working directory: `~/Desktop/DiveDispatch`

1. `git status` — if no changes (staged, unstaged, or untracked), skip this job entirely.
2. `git diff` + `git diff --cached` to understand what changed.
3. `git add -A` to stage everything.
4. Unstage secrets and ephemeral files — run `git reset HEAD` on any of these if present:
   - `playwright-report/`
   - `test-results/`
   - `.env*`
   - `credentials*.json`
   - `*.pem`
   - `*.key`
5. `git log --oneline -10` to match the repo's commit message style (conventional commits: `feat:`, `fix:`, `refactor:`, etc.).
6. Generate a commit message: conventional prefix, concise "why" not "what", 1-2 sentences.
7. Commit with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer. Use HEREDOC format.
8. Record the short hash, message, and file count for output.

### Job 2: Vault Observations + Session File (DiveVault)

Vault path: `~/Desktop/DiveVault/`

> **Important:** DiveVault is outside the project directory. The `Write` and `Edit` tools may fail on external paths. For ALL file operations under `~/Desktop/DiveVault/`, use `Bash` with heredoc writes (`cat <<'EOF' > path`) instead of the Write tool, and `sed -i ''` or full rewrites via Bash instead of the Edit tool.

1. Scan the conversation for vault-worthy items. Categories per the global CLAUDE.md routing table:

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

2. If nothing vault-worthy was discussed (besides the session file), skip observations but still write the session file.
3. For each observation:
   - Read the target file first to preserve existing structure and check for duplicates.
   - If the observation already exists (same idea, same location), skip it.
   - Match sibling file conventions:
     - **Lessons:** Dated subsection (`## Title — YYYY-MM-DD`), with cross-ref line (`*→ RULES.md Phase N, Rule N · PatternLibrary: slug*`), then subsections: what happened, root cause, the fix, rule.
     - **Patterns:** Sections: `## The smell`, `## Why it's a problem`, `## The fix`, `## Prevention checklist`, `## Where this came from`.
4. Always write today's session file (`Sessions/YYYY-MM-DD.md`) — this is the minimum vault output. Overwrite if exists (same-day idempotency). Use this format:

   ```
   # Session: YYYY-MM-DD — <Title>
   **Date:** YYYY-MM-DD

   ## What Happened
   [2-3 paragraph summary — replace previous content entirely]

   ## Key Decisions
   [Bulleted list]

   ## Files Modified
   [Full paths]

   ## Resume Point
   **Next action:** [Specific enough for a fresh session to execute]
   ```

5. Record count and locations for output.

### Job 3: TODO Update

Path: `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md`

1. Read the current TODO.
2. If nothing was completed this session AND no new gaps were discovered AND no position change needed, skip this job entirely.
3. Check off `[x]` any items completed this session.
4. Update `### Current Position:` section with:
   - What was done
   - What's next
   - Any blockers or discoveries
5. Add new items or gaps discovered during the session to the correct phase/section.
6. If an entire phase is fully checked off, collapse to: `## Phase N: [Name] — DONE`
7. The next action from the session file's Resume Point should match the first unchecked item.
8. Record a brief summary for output.

### Job 4: Memory Management

1. Read `~/.claude/projects/-Users-matthewlee-Desktop-DiveDispatch/memory/MEMORY.md` and find the active thread file.
2. Update the active thread file — it is a **pointer to TODO.md**, not a state tracker. Only update:
   - Test baseline numbers (unit/integration count, E2E count, type errors)
   - Recent commits list (last 5)
   - Date stamp
3. Update MEMORY.md:
   - Update the active thread description with bold **NEXT:** tag and the exact next action.
   - Add entries for genuinely new memory files created this session.
   - **Remove** entries for memory files that are no longer relevant (delete the file too).
   - **Merge** memory files that overlap (combine into one, delete the other).
   - Keep MEMORY.md under 50 lines — if it's longer, consolidate.
4. Save new memory files only for information that:
   - Is NOT already captured in an existing memory file
   - Will be useful in future sessions (not just this one)
   - Cannot be derived from reading the codebase or vault
   - Update existing memory files instead of creating new ones when possible.
5. Record summary for output (updated/cleaned/no changes).

### Job 5: NotebookLM Sync

If vault files were created or modified in Job 2, push them to the correct NotebookLM notebook:

| Vault path prefix | Notebook alias |
|-------------------|---------------|
| `RiskNeutral/` | `rn-strategy` |
| `DiveDispatch/` (Product, Architecture, Legal, Reviews) | `dd-product` |
| `Sessions/`, `Ideas/`, `DiveDispatch/Architecture/Lessons.md` | `sessions` |

For each changed file, run: `nlm source add <alias> --file "<vault-path>"`
If a source already exists for that file, it will be updated.

If no vault files were modified, skip this job entirely.

---

## Output

Print exactly this format, omitting any line whose job was skipped:

```
Committed: <short-hash> <message> (N files)
Vault: N observations → [locations]
TODO: [brief summary of position update]
Memory: [updated/cleaned/no changes]
NotebookLM: N sources synced
Saved. Next session: /continue → [exact next action]
```

The final `Saved.` line is always present — it comes from the session file's Resume Point.

Examples:
```
Committed: a1b2c3d feat: booking wizard inventory unit mapping (7 files)
Vault: 3 observations → Sessions/2026-03-20.md, DiveDispatch/Architecture/Lessons.md, PatternLibrary/slug-is-not-id.md
TODO: Step 8 done → Step 9 (Customer Portal)
Memory: updated thread, cleaned 2 stale entries
NotebookLM: 3 sources synced
Saved. Next session: /continue → Write Customer Portal token validation tests
```

```
Vault: 1 observation → Sessions/2026-03-20.md
Saved. Next session: /continue → Resume inventory mapping
```

If all five jobs are skipped (no code changes, nothing to vault, no TODO updates, no memory changes, no sync needed), output:
```
Nothing to vault.
```
