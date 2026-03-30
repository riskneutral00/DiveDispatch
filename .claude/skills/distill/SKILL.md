---
name: distill
description: "Read failure vault entries, cluster by pattern, propose CLAUDE.md rules. Never auto-writes — all suggestions require explicit approval."
allowed-tools: Read, Glob, Grep, Bash
user-invocable: true
---

# /distill — Failure Pattern Distillation

Reads all structured failure entries from `Vaults/DiveDispatch/Failures/`, clusters by recurring pattern, and proposes tight CLAUDE.md rules for Matt to approve.

**Never auto-writes to CLAUDE.md.** Output is suggestions only.

---

## Execution

### Step 1: Gather failure entries

```bash
ls ~/Desktop/RiskNeutral/Vaults/DiveDispatch/Failures/*.md 2>/dev/null | grep -v template
```

If no entries exist: `No failure entries found. Failures are captured by /vault at session close.` Stop.

Read all failure files. Parse each `##` section, extracting: title, date, root cause, proposed rule, frequency, severity, tags.

### Step 2: Cluster by pattern

Group failures by **root cause similarity** — not by tag alone, but by the underlying mistake pattern. Two failures with different tags but the same root cause (e.g., "didn't check existing code before writing new code") belong in the same cluster.

For each cluster:
- **Pattern name:** Short slug (e.g., "duplicate-before-search", "stale-import-path")
- **Count:** How many entries
- **Severity range:** lowest–highest in cluster
- **Representative entries:** List the 2-3 most illustrative failures
- **Dates:** First and last occurrence

### Step 3: Score clusters

Score each cluster for rule-worthiness:

| Signal | Points |
|--------|--------|
| Count >= 3 | +20 |
| Count = 2 | +10 |
| Count = 1 | +0 |
| Any severity = critical | +15 |
| Any severity = high | +10 |
| Span > 7 days (recurring over time) | +10 |
| Proposed rules in cluster are consistent | +5 |

Only surface clusters scoring **>= 15** as candidates.

### Step 4: Draft proposed rules

For each qualifying cluster, draft a candidate CLAUDE.md rule:

```
## Proposed Rule: {pattern name}
Score: {N} (count:{N} severity:{N} span:{N} consistency:{N})
Based on {N} failures: {dates}

**Rule:**
{1-2 sentence rule, imperative voice, actionable}

**Evidence:**
- {failure title 1} ({date}) — {one-line summary}
- {failure title 2} ({date}) — {one-line summary}

**Where in CLAUDE.md:** {suggest section — e.g., "Mutation Patterns", "Design Workflow", new section}
```

### Step 5: Present to Matt

Print all qualifying clusters sorted by score (highest first).

If no clusters qualify: `No recurring patterns detected yet. Need more failure data — keep running /vault.`

End with:
```
{N} patterns found, {M} qualify for CLAUDE.md rules.
To apply: tell me which rules to add. I'll show the exact diff for approval.
```

---

## Rules

- **Read-only.** Never modify CLAUDE.md, failure files, or any other file.
- **Cluster by root cause, not surface symptoms.** "Wrong file path" and "stale import" might be the same pattern (didn't verify before acting).
- **Prefer tight rules over broad ones.** "Always grep before creating a new utility" beats "Be more careful."
- **Deduplicate against existing CLAUDE.md.** If a proposed rule already exists (even worded differently), skip it and note: `Already covered by: {existing rule section}`.
- **Single failures can qualify** if severity is critical — don't wait for a pattern when the cost is high enough.
