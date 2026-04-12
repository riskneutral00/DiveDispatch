---
name: happypath
description: >
  Execute the DiveDispatch happy-path walkthrough end-to-end via Playwright.
  Reads Stops.md as spec, uses Fixture.md for inputs, logs to Runs/, deduplicates
  findings into Observations.md. Interactive by default — pauses on failure for
  Matt to inspect. Supports --from, --only, --autopilot, --diff flags.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

Execute immediately. No preamble.

## Arguments

| Flag | Behavior |
|------|----------|
| *(none)* | Full run, interactive (pause on failure). |
| `--from STOP_N` | Resume from stop N (run stops N..end). |
| `--only STOP_N` | Run only stop N. |
| `--autopilot` | Non-interactive: log findings, never pause. |
| `--diff` | Do not execute. Print delta between last run and the prior run. |

Stop numbers match H2 headings in `Stops.md` (e.g. `STOP_4` → "## Stop 4 — Itinerary Step").

## Inputs

- **Spec:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/HappyPath/Stops.md`
- **Fixture:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/HappyPath/Fixture.md`
- **Observations:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/HappyPath/Observations.md`

## Outputs

- **Run log:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/HappyPath/Runs/YYYY-MM-DD-HHMM.md`
- **Screenshots:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/HappyPath/Runs/YYYY-MM-DD-HHMM/stop{N}-{375|768|1440}.png`
- **Observations:** new findings appended; seen count bumped for recurrences.

## Procedure

### Phase 0 — Parse

1. Read `Stops.md`. Split on H2 headings (`## Stop N — Title`). For each stop, extract the five labeled blocks:
   - `**Where:**` — URL or trigger description
   - `**Action:**` — bullet list of steps
   - `**Expect:**` — bullet list of acceptance criteria
   - `**Audit:**` — bullet list of design/invariant checks
   - `**Known issues:**` — bullet list (may be "none")
2. Read `Fixture.md`. Extract operator credentials, customer data, booking parameters, auto-filled resource slugs.
3. Read `Observations.md` tail (last 50 lines) to populate the dedup cache for this run.

### Phase 1 — Gate

Before any browser interaction:
- Confirm Playwright MCP is available (search for `mcp__playwright__browser_navigate`). If not, stop with `Error: Playwright MCP not connected. Restart Claude Code.`
- Confirm Convex has fixture operator (`npx convex run users:bySlug '{"slug":"n7rq5j"}'`). If null, run `npm run seed:force`.

### Phase 2 — Execute Stops

For each stop in scope (respecting `--from` / `--only`):

1. **Read the Action block.** Translate bullets into Playwright calls. Common patterns:
   - "Click X" → `browser_snapshot` → find button → `browser_click`
   - "Type X" → `browser_type`
   - "Navigate to X" → `browser_navigate`
   - "Switch to {user}" → use Dev Switcher (click `matt` button → select in dropdown → click Switch → handle `beforeunload` dialog).
2. **Capture screenshots** at 375, 768, 1440 — save under the run's screenshot directory.
3. **Evaluate the Expect block.** For each expectation, check observable state (DOM snapshot, URL, visible text, computed CSS). Classify:
   - `PASS` — observable state matches.
   - `FAIL` — observable state does not match.
   - `UNVERIFIABLE` — expectation cannot be checked from the browser alone (e.g., backend-only state). Flag for human review.
4. **Evaluate the Audit block.** Same classification. Audit fails are logged but do not halt interactive mode by default.
5. **On FAIL (interactive mode):** Pause. Print expectation, observed state, diff. Ask:
   - `C`ontinue (log fail, proceed to next stop)
   - `R`etry (re-evaluate without re-running actions)
   - `S`kip (mark as skipped, proceed)
   - `A`bort (stop run, flush run log)
   - `T`icket (invoke `/ticket-create` with the failure detail)
6. **On FAIL (autopilot):** Log and continue. No pause.
7. **Dedup against Observations.md.** For each failure, compute a stable signature (stop + short expectation fingerprint). If the signature exists in Observations, bump `seen:`. Otherwise append new entry.

### Phase 3 — Run Log

Write `Runs/YYYY-MM-DD-HHMM.md` with this structure:

```markdown
# Happy Path Run — YYYY-MM-DD HHMM
**Duration:** Nm Ns
**Mode:** interactive | autopilot | from:STOP_N | only:STOP_N
**Result:** GREEN | YELLOW (N new findings) | RED (N failures, halted at STOP_N)

## Summary

| Stop | Title | Actions | Expect | Audit |
|------|-------|---------|--------|-------|
| 0 | Boot + Sign-In | ok | 3/3 pass | 2/2 pass |
| 1 | Dashboard Shell | ok | 3/3 pass | 3/3 pass |
| ... |

## New findings

- ...

## Recurring findings (seen before)

- ...

## Passing stops (unchanged from last run)

- Stop 0, Stop 1, Stop 2, ...

## Screenshots

Stored under `Runs/YYYY-MM-DD-HHMM/`. Significant diffs against last green run:
- `stop4-375.png` — N pixels changed (threshold: 1000 pixels).
- ...
```

### Phase 4 — Observations Update

For each failure:
- If signature is new: append structured entry to `Observations.md` under `## Open`.
- If signature exists: increment `seen:` counter + update `Last seen:` date.

### Phase 5 — Tag Green

If the run is GREEN (all stops pass):
1. Record tag: `git tag -f happy-path-green-YYYY-MM-DD-HHMM HEAD`
2. Print: `GREEN baseline tagged: happy-path-green-YYYY-MM-DD-HHMM`

### Phase 6 — Report

Print to stdout:

```
Happy Path Run — YYYY-MM-DD HHMM
Result: {GREEN | YELLOW | RED}
Stops: N passed / N failed / N skipped (of M)
New findings: N
Recurring: N
Log: Vaults/DiveDispatch/HappyPath/Runs/YYYY-MM-DD-HHMM.md
{tag line if GREEN}
{first failure summary if RED}
```

## Modes

### --autopilot

No pauses. Logs everything. Useful for:
- CI smoke runs (future)
- Regression sweeps after a big refactor
- Overnight drift detection

### --diff

Read the two most recent files in `Runs/`. Print:
- Stops that changed result (PASS → FAIL or vice versa)
- New findings not in earlier run
- Findings resolved since earlier run
- Screenshot diff summary

Do not execute any stops. Read-only.

### --from STOP_N

Skip stops 0..N-1. Start at stop N. Assumes prior stops' side effects are already in the expected state (operator signed in, booking created, etc.). Use when iterating on a single stop.

### --only STOP_N

Run stop N and nothing else. Implies `--from STOP_N` plus stops after N are skipped.

## Rules

- **Execute immediately.** No preamble, no prompts beyond stop-level interactive pauses.
- **Read the spec fresh every run.** Do not cache Stops.md or Fixture.md between runs — Matt edits these between runs.
- **Never auto-fix failures.** The skill records and pauses; a separate skill (`/post-spec` or manual edit) performs fixes.
- **Never skip interactive pauses unless `--autopilot`.** Interactive is the default because happy-path failures are structural, not cosmetic.
- **Preserve the fixture.** Do not modify `Fixture.md` as part of a run — it is read-only for the skill.
- **Append-only for Observations.md and Runs/.** Never rewrite history. Resolved findings move to the "Resolved" section; they do not disappear.
- **Playwright is the only browser mechanism.** No bash curl, no shell-based HTTP. All verification goes through the headed browser so Matt can watch.
