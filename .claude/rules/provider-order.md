## Provider nesting order

Top-level providers nest in this order:

```
ClerkProvider
  └ ConvexClerkProvider
      └ ThemeProvider
          └ {children}
```

- **ClerkProvider** owns auth state — must be outermost so Convex and UI both see it.
- **ConvexClerkProvider** bridges Clerk auth into the Convex client. Requires ClerkProvider as parent.
- **ThemeProvider** runs last; it reads from Convex (skin/theme selection).

Any other order crashes on boot. Enforced by `provider-nesting.sh` (PostToolUse) on `src/app/layout.tsx` and `src/app/providers.tsx`.
