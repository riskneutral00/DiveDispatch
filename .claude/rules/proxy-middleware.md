## Proxy, not middleware

Next.js 16 renamed `middleware.ts` → `proxy.ts`. The auth proxy lives at `src/proxy.ts`.

**Never create `src/middleware.ts`.** It conflicts and crashes the dev server. `.gitignore` blocks it, and `middleware-guard.sh` blocks PreToolUse:Write on that path.

If a framework example references `middleware.ts`, port the code into `src/proxy.ts` instead.
