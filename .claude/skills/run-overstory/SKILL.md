---
name: run-overstory
description: >
  Start Overstory overnight batch runner with memory safety watchdog.
  Use when starting Overstory, running the coordinator, or processing
  the ticket backlog overnight.
allowed-tools: Bash, Read, Grep, Glob
user-invocable: true
---

When this skill is invoked, do the following steps in order — no questions, no prompts:

**Step 1 — Sync unqueued specs into issues.jsonl**

Read all spec files in `.overstory/specs/` and all existing entries in `.seeds/issues.jsonl`. For any spec file that matches `L[0-9]+-*.md` (NOT `POST-*.md`) and does not already have a corresponding entry in issues.jsonl (match by checking if the spec filename slug appears in any existing title or description), add it as a new open issue. Use this shape:

```json
{"id":"DiveDispatch-XXXX","title":"<tier-nn>: <title from spec>","status":"open","type":"task","priority":1,"createdAt":"<now>","updatedAt":"<now>","description":"<one line from spec description>. Full spec: .overstory/specs/<filename>","labels":["auto-queued"]}
```

Generate the id as `DiveDispatch-` + 4 random hex chars. Never add POST-tier specs.

**Step 2 — Launch the runner**

```bash
cd /Users/matthewlee/Desktop/DiveDispatch && ./scripts/overstory-runner.sh
```

Run in the background.

**Step 3 — Report**

Tell the user: how many new specs were queued in step 1, total open tasks now, and that logs are at `.overstory/logs/runner.log`.

## Reference (do not show unless asked)

### What It Does
1. Launches memory watchdog (swap monitor, auto-kills runaway processes)
2. Counts remaining open tasks in `.seeds/issues.jsonl`
3. Runs `ov coordinator start` in batches (up to `maxSessionsPerRun`)
4. Loops until all tasks done or 5-batch safety cap reached

### Config (`.overstory/config.yaml`)
| Key | Value | Controls |
|---|---|---|
| `agents.maxConcurrent` | `4` | Parallel agent processes |
| `agents.maxSessionsPerRun` | `8` | Tasks per coordinator batch |
| `agents.staggerDelayMs` | `2000` | Spawn delay (reduces memory spike) |

### Watchdog Thresholds (`scripts/memory-watchdog.sh`)
| Threshold | Value | Action |
|---|---|---|
| `WARN_SWAP_GB` | `10 GB` | Log warning |
| `KILL_SWAP_GB` | `14 GB` | SIGTERM oldest claude process |
| `EMERGENCY_SWAP_GB` | `18 GB` | SIGTERM all claude processes |

### Logs
- `tail -f .overstory/logs/runner.log`
- `tail -f .overstory/logs/watchdog-memory.log`

### Troubleshooting
| Problem | Fix |
|---|---|
| Swap spikes, processes killed | Lower `agents.maxConcurrent` to 2–3 |
| Coordinator hangs | Check `runner.log`, Ctrl+C, re-run |
| Watchdog not found | `chmod +x scripts/memory-watchdog.sh` |
| 5 batches done, tasks remain | Re-run the script |
