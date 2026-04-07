---
description: Code style rules and codebase navigation patterns
---

## No AnyCtx
Never use `AnyCtx`, `GenericCtx`, or any `any` wrapper for Convex context. Use `QueryCtx` for reads, `MutationCtx` for writes, `DbCtx` for shared helpers. Never introduce `as any` to silence Convex type errors — fix the underlying type.

## Schema-driven interviews
Read the schema before asking seed data or entity questions. Ask about every required field. The schema is the source of truth for what questions need to be asked.

## Skeleton first
Read `.SKELETON.md` before launching broad Explore agents or grep sweeps. Follow its Reference Docs pointers instead of searching blind.

## No comments
Do not add comments to code. No inline comments (`//`), no block comments (`/* */`), no JSDoc, no TODO comments, no section dividers.
The codebase is AI-generated and AI-maintained — the code is the documentation.
Exception: `{/* design-ok */}` and `{/* comments-ok */}` escape hatches required by hooks.
