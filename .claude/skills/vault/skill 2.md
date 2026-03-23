---
name: vault
description: "End-of-session closer. Commits code, captures observations to DiveVault, updates TODO, manages memory, syncs NotebookLM. Execute immediately, no prompts."
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

### Ideal execution shape (5 rounds)

```
Round 1: Bash(git status && git diff && git diff --cached && git log --oneline -5)
         + Read(MEMORY.md) + Read(active thread) + Read(TODO.md)
         + Read(Lessons.md tail) ← only if lesson needed
Round 2: Bash(git add -A && git reset HEAD [secrets] && git commit ...)
Round 3: Bash(session file heredoc) + Bash(lessons append) + Bash(TODO sed) + Write(thread) + Edit(MEMORY.md)
         ← all parallel, all write different files
Round 4: Bash(nlm source add ... && nlm source add ...)
Round 5: Print output
```

If no git changes, skip Round 1's diff and Round 2 entirely. If no lessons, drop that from Round 3.

---

## Instructions

### Job 1: Git Commit (DiveDispatch)

Working directory: `~/Desktop/DiveDispatch`

**Round 1** — single Bash call:
```bash
git status && git diff --stat && git diff --cached --stat && git log --oneline -5
```
If no changes, skip to Jobs 2–5.

**Round 2** — single Bash call:
```bash
git add -A && git reset HEAD playwright-report/ test-results/ .env* credentials*.json *.pem *.key 2>/dev/null; git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Commit message: conventional prefix, concise "why" not "what", 1–2 sentences.

### Job 2: Vault Observations + Session File (DiveVault)

Vault path: `~/Desktop/DiveVault/`

> **Important:** DiveVault is outside the project directory. Use `Bash` with heredoc writes for ALL vault file operations.

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

Path: `~/Desktop/DiveVault/DiveDispatch/Product/TODO.md`

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
Committed: <short-hash> <message> (N files)
Vault: N observations → [locations]
TODO: [brief summary of position update]
Memory: [updated/cleaned/no changes]
NotebookLM: N sources synced
Saved. Next session: /continue → [exact next action]
```

The `Saved.` line is always present — from session file's Resume Point.

If all five jobs are skipped:
```
Nothing to vault.
```
