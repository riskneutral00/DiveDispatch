---
description: Playwright CLI-first routing; MCP only for exploratory/interactive work
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/e2e/**"
---

**CLI** (`npx playwright test`) is the default for anything repeatable: running specs, writing new specs, visual regression, accessibility checks, full suite.

**MCP** (`browser_*` tools) only for inherently interactive work: "show me" exploration, live debugging, design review, one-off visual checks.

After MCP usage that reveals a repeatable behavior, note it could become a CLI test.
