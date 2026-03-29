---
video_id: UPtmKh1vMN8
url: https://www.youtube.com/watch?v=UPtmKh1vMN8
title: "CLAUDE CODE ADVANCED COURSE — 3 HOURS"
channel: Nick Saraev
assessed: 2026-03-29
topic: ai-agents
technique_count: 21
---

# CLAUDE CODE ADVANCED COURSE — 3 HOURS — Library Entry

**Channel:** Nick Saraev
**Topic:** ai-agents
**URL:** https://www.youtube.com/watch?v=UPtmKh1vMN8

## Outline

### 1. System Prompts and claude.md Optimization
The claude.md file acts as the core system prompt, providing knowledge compression, user preferences, declaration of agent capabilities, and a running log of failures/successes.
- **Global Scope (`~/.claude/claude.md`):** Loaded on every session across all workspaces. Use for high-level reasoning strategies, user profile context, core interaction rules, and global programming conventions.
- **Local Scope (`.claude/claude.md` or `claude.md` in project root):** Project-specific configurations, API documentation context, file architecture summaries, and local workspace rules.
- **Optimization Commands:**
  - `/init`: Scans entire workspace and auto-generates a compressed claude.md summarizing architecture and dependencies.
  - `/context`: Displays token usage statistics to verify compressed claude.md is saving context window space.
  - `/insights`: Analyzes historical conversation logs to identify recurring failures. Output should be manually reviewed and added to Global claude.md.
- **Continuous Improvement:** Add meta-prompt: "When you have made a mistake, update the claude.md with a running log of things not to try next time" (Lab Notes section).

### 2. Agent Harnesses
A harness is the wrapper code surrounding the LLM that grants it agency (tool calling, memory management, file system access).
- **Primary Harness:** Claude Code.
- **Alternative Harnesses:** CodeEx, Langchain, Droid (Factory AI), PI.DEV (open-source coding agent).
- **Harness Impact:** Different harnesses adjust context compaction, tool permissions (e.g., blocking `rm -rf`), and token limits.

### 3. Task Parallelization and Multi-Agent Orchestration
Running multiple specialized agents simultaneously reduces total task time, minimizes context window bloat ("zone of good"), and leverages stochasticity.
- **Fan-out / Fan-in:** Spawn multiple cheaper/faster agents (Sonnet/Haiku) for parallel research. Feed isolated outputs into single Opus Synthesizer for aggregation.
- **Stochastic Consensus:** Spawn n agents (e.g., 10) with identical/varied prompts to independently solve a problem. Count solution frequency for consensus. Flag outlier ideas.
- **Debate / Model-Chat:** Agents in shared conversation environment read each other's outputs in sequential rounds to challenge assumptions and refine solutions.
- **Sequential Pipeline (Handoff):** Tasks pass linearly through specialized agents with fresh context windows (Developer -> Bug Fix -> QA). Aligns incentives without polluting context.
- **Claude Code Agent Teams:** Native feature. `Shift + Down` to view/monitor parallel sub-agent threads.

### 4. Context Management and Workspace Organization
- **Sub-agents vs. Skills:** Functionally identical. Both use markdown files (skill.md) with SOPs, names, descriptions, allowed tools.
- **Directory Architecture:** Separate Business/ and Personal/ roots. Client-specific nested environments. Never pollute root directory — use active/ or tmp/ subdirectories.
- **Workspace Maintenance:** Periodically clean active/ folder via Claude.
- **Visual Distinctions:** VS Code header colors per workspace type.

### 5. Autonomous Research (Auto Research)
Recursive self-improvement framework based on Karpathy's auto-research.
- **Requirements:** Strict quantitative metric, fast change method, fast automated assessment tool.
- **Steps:** Clone github.com/karpathy/auto-research. Configure program.md. Run train.py loop (hypothesis -> modify -> assess -> keep/revert).
- **Warning:** If change/assessment loop >30 seconds, improvement negligible. AI may break visual design to optimize speed — constrain with screenshot comparison.

### 6. Web and Computer Automation
Three levels of complexity:
- **HTTP Requests (Web Fetch):** Direct GET/POST. Fastest/cheapest. Fragile, easily blocked.
- **Chrome DevTools MCP:** Local Chrome instance, JavaScript manipulation, dynamic page interaction.
- **Browser Use Platform:** Third-party, custom browser fingerprinting, undetectable automation.
- **Computer Use (Claude Desktop):** OS-level mouse/keyboard via screen parsing. Universal but slow/expensive.
- **Optimization Workflow:** Prototype with Chrome DevTools MCP -> convert to pure HTTP API requests.

### 7. Monoculture Risk Mitigation
- **Diversification:** ~70% Claude / 30% alternatives.
- **Conductor Platform:** Parallel isolated workspaces combining CodeEx and Claude Code.
- **CodeEx MCP Server:** `npm i -g @openai/codex` — call CodeEx from within Claude Code.
- **Cross-Compatibility:** Sync claude.md to generic formats (agents.md, gemini.md) for portability.

### 8. Security Best Practices
- **Chat History Leaks:** Claude logs in plain text JSONL at `~/.claude/`. Never paste API keys in chat. Use .env only.
- **Hallucinated NPM Packages:** LLMs occasionally hallucinate library names. Malicious actors register typos. Always audit npm install lists.
- **Database RLS:** Must explicitly enable Row Level Security on backend platforms.
- **PCI Compliance:** Never allow agent to process raw credit card strings. Use Stripe.
- **Unbiased Audits:** Run security audits in fresh chat sessions to prevent context bias.

### 9. The Future of Agentic Engineering
- **Auto Mode:** Claude Code's native feature bypassing manual execution permissions.
- **Economic Moats:** Writing software will have zero inherent value. Future moats: distribution, brand, legal compliance, network effects.

## Techniques Identified

1. claude.md Global/Local Optimization — Global and local system prompt configuration with /init, /context, /insights
2. Sub-agents & Skills — Skill.md SOPs in .claude/skills/, Parent-Researcher-QA architecture
3. Fan-out/Fan-in Parallelization — Spawn cheap sub-agents for parallel research, Opus synthesizer
4. Stochastic Consensus & Debate — N agents with varied prompts, solution frequency consensus, multi-round debate
5. Autonomous Research (Auto Research) — Karpathy pattern: quantitative metric + fast change/assess loop
6. Web Fetch Automation — Direct HTTP GET/POST for API/scraping
7. Chrome DevTools MCP — Local Chrome instance for dynamic page interaction
8. Browser Use Platform — Third-party anti-detection browser automation
9. Computer Use — OS-level mouse/keyboard via Claude Desktop
10. Automation Workflow Optimization — Prototype with DevTools, convert to HTTP
11. Monoculture Risk Mitigation — 70/30 AI provider diversification
12. CodeEx MCP Server — @openai/codex integration within Claude Code
13. Cross-Platform System Prompts — Sync claude.md to agents.md/gemini.md
14. Workspace Organization — Business/Personal isolation, client nesting
15. Active/Tmp Directory Pattern — Generated files in active/ or tmp/ subdirectory
16. Visual Context Switching — VS Code header colors per workspace
17. API Key Security — Secrets in .env only, never in chat
18. Dependency Audit — Audit npm install lists for hallucinated packages
19. Database RLS Enforcement — Row Level Security on backend platforms
20. Fresh Session Security Audits — Security audits in fresh sessions, no context bias
21. Auto Mode — Bypass manual execution permissions

---

# DiveDispatch Assessment — 2026-03-29

**Applicable:** 4 | **Already done:** 4 | **Not applicable:** 11 | **Future:** 2

## Technique Table

| # | Technique | Classification | Risk | Implementation | Test Type | Effort | Project Layers |
|---|-----------|---------------|------|----------------|-----------|--------|----------------|
| 1 | claude.md Global/Local Optimization | already-done | --- | --- | --- | --- | .claude, CLAUDE.md |
| 2 | Sub-agents & Skills | already-done | --- | --- | --- | --- | .claude/skills |
| 3 | Fan-out/Fan-in Parallelization | future | --- | --- | --- | --- | .claude (needs orchestrator) |
| 4 | Stochastic Consensus & Debate | not-applicable | --- | --- | --- | --- | --- |
| 5 | Autonomous Research | not-applicable | --- | --- | --- | --- | --- |
| 6 | Web Fetch Automation | not-applicable | --- | --- | --- | --- | --- |
| 7 | Chrome DevTools MCP | already-done | --- | --- | --- | --- | package.json, .claude/skills |
| 8 | Browser Use Platform | not-applicable | --- | --- | --- | --- | --- |
| 9 | Computer Use | not-applicable | --- | --- | --- | --- | --- |
| 10 | Automation Workflow Optimization | applicable | LOW | Refactor clerk-signin to HTTP | integration | M | .claude/skills, src |
| 11 | Monoculture Risk Mitigation | not-applicable | --- | --- | --- | --- | --- |
| 12 | CodeEx MCP Server | not-applicable | --- | --- | --- | --- | --- |
| 13 | Cross-Platform System Prompts | not-applicable | --- | --- | --- | --- | --- |
| 14 | Workspace Organization | not-applicable | --- | --- | --- | --- | --- |
| 15 | Active/Tmp Directory Pattern | applicable | LOW | New pattern | hook | S | .claude, .gitignore |
| 16 | Visual Context Switching | not-applicable | --- | --- | --- | --- | --- |
| 17 | API Key Security | already-done | --- | --- | --- | --- | .gitignore, CLAUDE.md |
| 18 | Dependency Audit | applicable | MED | New skill + hook | unit | M | package.json, .claude/skills |
| 19 | Database RLS Enforcement | future | --- | --- | --- | --- | convex (needs Convex RLS support) |
| 20 | Fresh Session Security Audits | applicable | MED | New agent | integration | L | .claude/agents |
| 21 | Auto Mode | not-applicable | --- | --- | --- | --- | --- |

## Implementation Specs

### Spec: Automation Workflow Optimization
**Source:** CLAUDE CODE ADVANCED COURSE — 3 HOURS
**Build:** refactor
**Project layers:** .claude/skills, src
**Files affected:** .claude/skills/clerk-signin/SKILL.md, src/proxy.ts
**Effort:** M
**Risk level:** LOW
**Test type:** integration
**Risk:** Clerk API may not expose direct HTTP endpoints for all auth flows; token generation may require browser-based PKCE flow

**What it does:**
Converts the clerk-signin Playwright-based skill to pure HTTP API calls where possible. Prototyping with Chrome DevTools/Playwright first, then extracting the network request patterns to create a faster, cheaper HTTP-only authentication flow for development sign-ins.

**How to build it:**
1. Capture network requests during Playwright clerk-signin flow to identify Clerk API endpoints
2. Create HTTP-based auth helper using Clerk Backend API for dev token generation
3. Keep Playwright fallback for flows requiring browser-based interaction (PKCE, MFA)
4. Benchmark: measure time/tokens for Playwright vs HTTP approach

**Ticket-ready:** Yes -- /spec ready

---

### Spec: Active/Tmp Directory Pattern
**Source:** CLAUDE CODE ADVANCED COURSE — 3 HOURS
**Build:** new-pattern
**Project layers:** .claude, .gitignore
**Files affected:** .claude/tmp/, .gitignore
**Effort:** S
**Risk level:** LOW
**Test type:** hook
**Risk:** Minimal — only affects generated file organization

**What it does:**
Establishes a .claude/tmp/ directory for transient generated artifacts (test outputs, temp analysis files, build artifacts) that shouldn't clutter the project root. Extends the existing .claude/runs/ pattern already used by matrix skills.

**How to build it:**
1. Create .claude/tmp/ directory with .gitkeep
2. Update .gitignore to exclude .claude/tmp/*
3. Update relevant skills/hooks to write transient output to .claude/tmp/ instead of project root

**Ticket-ready:** Yes -- /spec ready

---

### Spec: Dependency Audit
**Source:** CLAUDE CODE ADVANCED COURSE — 3 HOURS
**Build:** skill + hook
**Project layers:** package.json, .claude/skills, .claude/settings.json
**Files affected:** .claude/skills/dependency-audit/SKILL.md, .claude/hooks/dependency-audit-gate.sh, .claude/settings.json
**Effort:** M
**Risk level:** MEDIUM
**Test type:** unit
**Risk:** False positives on internal packages; npm registry rate limiting during bulk audits

**What it does:**
Creates a dependency audit skill that verifies package.json dependencies against npm registry, detects hallucinated/typosquatted packages, and flags outdated/insecure versions. Includes a PreToolUse hook that runs audit on npm install commands.

**How to build it:**
1. Create .claude/skills/dependency-audit/SKILL.md with npm audit + typo-detection phases
2. Create .claude/hooks/dependency-audit-gate.sh to intercept npm install commands
3. Update .claude/settings.json with PreToolUse hook for Bash commands matching `npm install`
4. Maintain whitelist for known-safe packages

**Ticket-ready:** Yes -- /spec ready

---

### Spec: Fresh Session Security Audits
**Source:** CLAUDE CODE ADVANCED COURSE — 3 HOURS
**Build:** agent
**Project layers:** .claude/agents
**Files affected:** .claude/agents/security-auditor.md, scripts/run-security-audit.sh
**Effort:** L
**Risk level:** MEDIUM
**Test type:** integration
**Risk:** False positives from broad patterns; scope may miss novel attack vectors

**What it does:**
Creates a standalone security audit agent that runs in isolation (fresh session, no prior context) to prevent bias. Scans auth boundaries (src/proxy.ts), state machine transitions (convex/bookings/), and ownership verification patterns. Outputs findings to .claude/runs/.

**How to build it:**
1. Create .claude/agents/security-auditor.md with isolated execution rules
2. Define audit scope: convex/bookings/ (state transitions), src/proxy.ts (auth boundary), convex/users.ts (ownership)
3. Create scripts/run-security-audit.sh to spawn fresh agent session
4. Output to .claude/runs/security-audit-{YYYY-MM-DD}.md with severity matrix
5. Schedule: trigger on convex/bookings/ or src/proxy.ts changes

**Ticket-ready:** Yes -- /spec ready

## Already Done in DiveDispatch

| Technique | Where in DiveDispatch |
|-----------|----------------------|
| claude.md Global/Local Optimization | CLAUDE.md (project rules, invariants, dependency direction); .claude/settings.json (37+ PreToolUse/PostToolUse hooks enforcing commit gates, schema preflight, dependency direction, provider nesting) |
| Sub-agents & Skills | 37+ skill files in .claude/skills/ (driver, backseat, patrol, first, spec, qa, matrix-github, matrix-youtube, agent-navigator, clerk-signin, etc.) |
| Chrome DevTools MCP | Playwright (@playwright/test in package.json); agent-navigator skill for UI testing; test:e2e scripts |
| API Key Security | .gitignore blocks .env; CLAUDE.md documents auth boundary (Clerk-authenticated mutations, tokenized portal); Config/.env.local centralized |

## Future Opportunities

| Technique | Dependency |
|-----------|-----------|
| Fan-out/Fan-in Parallelization | Needs orchestration layer for multi-agent coordination. Matrix skills currently run serial analysis. Would require agent coordinator pattern. |
| Database RLS Enforcement | Convex has no native RLS concept. Uses mutation/query auth gates + ownership checks via users.slug. Would need Convex to add RLS support, or build application-level RLS middleware in convex/lib/. |

## Decision Points

None — all classifications are clear-cut for this video.

## Changelog

| Date | Applicable | Already Done | Notes |
|------|-----------|-------------|-------|
| 2026-03-29 | 4 | 4 | Initial assessment |
