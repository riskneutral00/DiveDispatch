---
name: backseat-poll
description: "Check git log for new merges since baseline. Returns commit list or 'idle'."
allowed-tools: Bash
user-invocable: false
---

# backseat-poll

Called by `/backseat` each loop iteration. Args: `{baseline_sha}`

## Check for New Commits

```bash
git log --oneline {baseline_sha}..HEAD 2>/dev/null
```

If new commits → return the commit list (SHAs + one-line messages).

If no new commits → return "idle".

If more than 5 unreviewed commits → flag: `⚠ Backlog: {N} unreviewed commits — batch reviewing`
