---
name: diff-classify
description: "Map changed files from commits to review skill names."
allowed-tools: Bash, Grep
user-invocable: false
---

# diff-classify

Called by Backseat agent after poll returns commits. Args: `{commit_list}`

## Classify Changed Files

For each commit (or batch), get changed files:

```bash
git diff --name-only {parent_sha}..{commit_sha}
```

Map files to review skills:

| Pattern | Review Skill |
|---------|-------------|
| `convex/schema.ts` | `/review-backend-schema` |
| `convex/**/*.ts` (not schema, not `_generated/`) | `/review-backend-mutations` |
| `convex/**/*.ts` matching auth/portal/token/role | `/review-backend-auth` |
| `src/components/**`, `src/app/**`, `src/lib/**` | `/design` |
| `tests/**`, `e2e/**` | `/review-tests` |

A file can trigger multiple reviews. Deduplicate the skill list.

## Output

Return the review plan: `{skill_name: [file_list]}` for each triggered skill.
