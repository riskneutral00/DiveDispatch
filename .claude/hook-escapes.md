# Hook Escape Hatches

Canonical reference for every escape comment recognized by a hook in `.claude/hooks/`.

## Convention

- **JSX context** (inside JSX/TSX render trees) → `{/* foo-ok */}` on the same line or parent element.
- **TS context** (imports, top-level code, non-JSX files) → `// foo-ok: <reason>` on the offending line.
- Always include a short reason when the token supports `:reason` form — future-you will thank you.

## Table

| Token | Hook(s) | Scope | Format |
|---|---|---|---|
| `design-ok` | `design-token-enforcement.sh`, `mobile-viewport-check.sh`, `style-classname-boundary.sh`, `glass-enforcement.sh`, `raw-button-blocker.sh`, `type-scale-enforcement.sh`, `date-formatter-guard.sh`, `inline-style-drift.sh` | Design-system/visual violations | `{/* design-ok */}` (JSX) or `// design-ok` (TS) |
| `comments-ok` | `no-comments-guard.sh` | Allow a comment in a file | `{/* comments-ok */}` or `// comments-ok` |
| `batch-exempt` | `n-plus-one-guard.sh` | Sequential DB operations that are intentional | `// batch-exempt: <reason>` |
| `fsm-ok` | `fsm-status-guard.sh` | Direct status patch inside canonical gateway file | `// fsm-ok` |
| `snapshot:` | `schema-preflight.sh` (via invariant check) | Denormalized field annotation | `// snapshot: <description>` |
| `bounded:` | `unbounded-query-guard.sh` | `.collect()` that's provably bounded | `// bounded: <reason>` |
| `catch-ok:` | `empty-catch-guard.sh` | Empty catch that is genuinely a no-op | `// catch-ok: <reason>` |
| `error-ok:` | `convex-error-guard.sh` | `throw new Error()` that isn't for user-facing flows | `// error-ok: <reason>` |
| `dev-only:` | `convex-error-guard.sh` | Dev-only code path | `// dev-only:` |
| `error-shape-ok:` | `error-shape-guard.sh` | ConvexError using `{ message }` instead of `{ code, reason }` for legitimate reason | `// error-shape-ok: <reason>` |
| `anyctx-ok:` | `anyctx-guard.sh` | `as any` / `AnyCtx` / `GenericCtx` that's truly unavoidable | `// anyctx-ok: <reason>` |
| `i18n-ok` / `i18n-ok:` | `i18n-guard.sh`, `dialog-title-i18n.sh` | User-facing string that is legitimately non-translatable (internal markers, debug) | `{/* i18n-ok */}` or `// i18n-ok: non-user-facing` |
| `dry-ok` | `dry-check.sh`, `local-type-alias-guard.sh` | Duplicate pattern that would complicate an import chain | `// dry-ok: <reason>` |

## Rules

- **One escape per token** — don't invent new ones. Extend an existing one if you need a new scope.
- **Reason required** where the format shows `:reason`. Bare tokens (e.g. `design-ok`) are allowed but weaker — reviewer has no context.
- **Escape on the offending line** — most hooks use a simple `grep -v` filter, which only suppresses on the same line. Parent-element JSX suppression works only for hooks that strip whole JSX blocks.
- **Never suppress a CRITICAL finding** — if the hook is blocking, the escape is for documented exceptions only. If you're reaching for it to silence a genuine problem, stop and fix the code.

## When an escape is missing

If you encounter a block with no documented escape here, it's probably a mandatory invariant. File a ticket with `/board` instead of patching the hook.
