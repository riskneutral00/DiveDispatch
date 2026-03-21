---
name: vault
description: "End-of-session closer. Commits code, captures observations to DiveVault, updates TODO. Execute immediately, no prompts."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
user-invocable: true
---

# /vault — Session Close

Run this before ending a session. Commits code, vaults observations, updates TODO. No questions, no prompts — just execute.

---

## Instructions

Run all three jobs. Each job is independent — skip silently if nothing to do.

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

### Job 2: Vault Observations (DiveVault)

Vault path: `~/Desktop/DiveVault/`

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

2. If nothing vault-worthy was discussed, skip this job entirely.
3. For each observation:
   - Read the target file first to preserve existing structure and check for duplicates.
   - If the observation already exists (same idea, same location), skip it.
   - Match sibling file conventions:
     - **Lessons:** Dated subsection (`## Title — YYYY-MM-DD`), with cross-ref line (`*→ RULES.md Phase N, Rule N · PatternLibrary: slug*`), then subsections: what happened, root cause, the fix, rule.
     - **Patterns:** Sections: `## The smell`, `## Why it's a problem`, `## The fix`, `## Prevention checklist`, `## Where this came from`.
     - **Sessions:** Format from `/amnesia` Step 2: `# Session: YYYY-MM-DD — <Title>`, `## What Happened`, `## Key Decisions`, `## Files Modified`, `## Resume Point`.
   - Plain markdown, no frontmatter, match surrounding files.
4. Always write today's session file (`Sessions/YYYY-MM-DD.md`) — this is the minimum vault output. Overwrite if exists (same-day idempotency).
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
7. Record a brief summary for output.

---

## Output

Print exactly this format, omitting any line whose job was skipped:

```
Committed: <short-hash> <message> (N files)
Vault: N observations → [locations]
TODO: [brief summary of position update]
```

Examples:
```
Committed: a1b2c3d feat: booking wizard inventory unit mapping (7 files)
Vault: 3 observations → Sessions/2026-03-20.md, DiveDispatch/Architecture/Lessons.md, PatternLibrary/slug-is-not-id.md
TODO: Step 8 done → Step 9 (Customer Portal)
```

```
Vault: 1 observation → Sessions/2026-03-20.md
```

If all three jobs are skipped (no code changes, nothing to vault, no TODO updates), output:
```
Nothing to vault.
```
