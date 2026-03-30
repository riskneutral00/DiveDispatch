---
description: Code style rules and codebase navigation patterns
---

## No AnyCtx
Never use `AnyCtx`, `GenericCtx`, or any `any` wrapper for Convex context. Use `QueryCtx` for reads, `MutationCtx` for writes, `DbCtx` for shared helpers. Never introduce `as any` to silence Convex type errors — fix the underlying type.

## Schema-driven interviews
Read the schema before asking seed data or entity questions. Ask about every required field. The schema is the source of truth for what questions need to be asked.

## Skeleton first
Read `.SKELETON.md` before launching broad Explore agents or grep sweeps. Follow its Reference Docs pointers instead of searching blind.
