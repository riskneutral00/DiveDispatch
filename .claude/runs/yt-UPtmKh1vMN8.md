---
video_id: UPtmKh1vMN8
url: https://www.youtube.com/watch?v=UPtmKh1vMN8
title: "CLAUDE CODE ADVANCED COURSE — 3 HOURS"
channel: Nick Saraev
assessed: 2026-03-29
topic: ai-agents
technique_count: 21
knowledge_items: 43
---

# CLAUDE CODE ADVANCED COURSE — 3 HOURS — Library Entry

**Channel:** Nick Saraev
**Topic:** ai-agents
**URL:** https://www.youtube.com/watch?v=UPtmKh1vMN8

## Outline

### 1. System Prompts & Context Compression (claude.md)

**Mental Model — The 4 Pillars:** claude.md serves 4 distinct functions:
1. **Knowledge Compression** — Summarizes codebase so agent doesn't re-read every file
2. **User Preferences** — Custom programming conventions, output formats
3. **Declaration of Capabilities** — Explicitly tells AI it has permission/tools so it doesn't underestimate its agency
4. **Log of Failures/Successes** — "Lab Notes" section that shrinks future search space by recording what NOT to try

**Content Routing — What Goes Where:**
- **Global (`~/.claude/claude.md`):** High-level reasoning strategies (e.g., "always read API docs first"), personal profile context (age, businesses, goals, constraints), token conservation rules. Loaded on every session across all workspaces.
- **Local (`.claude/claude.md` or `claude.md` in project root):** Low-level knowledge, compressed file architectures, project-specific API documentation rules.

**Commands:**
- `/init` — Scans workspace, auto-generates highly compressed claude.md summarizing architecture (e.g., compressing 1100 tokens down to 22)
- `/context` — Displays token usage to verify compression efficiency
- `/insights` — Analyzes historical conversation logs to identify recurring AI failures

**Workflow Sequence — Continuous Improvement Loop:**
1. *Local Loop:* Plan feature → Instantiate → AI makes mistakes → Update local claude.md with learnings
2. *Global Loop:* Run `/insights` across hundreds of runs → **Manually review** output → Update global claude.md with high-ROI rules

**Configuration Example — Lab Notes Meta-Prompt:** Add to claude.md: *"When you have made a mistake, update the claude.md with a running log of things not to try next time"* (formatted as "Lab Notes" section)

**Anti-pattern:** Do not blindly append AI-generated `/insights` to global prompts without human review. AI probability errors compound (three layers of 90% accuracy = 73% total accuracy).

### 2. Agent Harnesses

**Mental Model — Gun and Bullet Analogy:** LLM = bullet/gunpowder (text-in/text-out brain). Harness = gun barrel that wraps around the model, grants agency via tool access, memory compaction, shell policies.

- **Primary Harness:** Claude Code
- **Alternatives:** CodeEx, Langchain, Droid (Factory AI), PI.DEV (open-source)
- **Impact:** Different harnesses adjust context compaction, tool permissions (e.g., blocking `rm -rf`), and token limits

**Anti-pattern:** Poorly configured harnesses can execute destructive commands. Without strict shell policies, agents have executed `rm -rf` or equivalent scripts to delete entire hard drives.

### 3. Task Parallelization & Multi-Agent Orchestration

**Mental Model — Zone of Good:** LLM performance degrades as context length increases. Parallelizing tasks across multiple sub-agents with fresh, isolated context windows keeps all models operating in optimal zone.

**Philosophy:** Running tasks serially leads to context bloat, lower quality, and wasted time. Parallelization reduces execution time and leverages stochasticity (averaging varied outputs).

**Decision Framework — Model Routing:** Use cheaper/faster models (Sonnet/Haiku) for bulk data extraction and research. Reserve expensive models (Opus) purely for synthesis and final code generation.

**Workflow Patterns:**
- **Fan-out / Fan-in:** Parent spawns multiple parallel Sonnet researchers → feeds isolated outputs into single Opus synthesizer → Opus merges overlaps and outliers
- **Stochastic Consensus:** Spawn n agents (e.g., 10) with identical/varied prompts to independently solve a problem. Count solution frequency for statistical mode (consensus). Flag high-variance outliers.
- **Debate (Model-Chat):** Sequential time-step rounds using `model-chat.py`. Each round, agents read all other agents' previous outputs to challenge assumptions and refine solutions.
- **Sequential Pipeline (Handoff):** Developer → Bug Fix → QA with fresh context windows. Aligns incentives: one agent builds, the other breaks.

**Commands:** `Shift + Down` in Claude Code terminal UI to monitor parallel Agent Teams threads.

**Anti-pattern — Human-like Hierarchies:** CEO→CTO→Dev agent chains don't work. Agents are "spiky" (hyper-competent at specific tasks, terrible at others). Each layer of AI delegation without human-in-the-loop compounds hallucination probability (0.9^3 = 73%).

**Anti-pattern — Combining Dev and QA:** Fast development conflicts with rigorous testing. Developer agent is biased to build quickly; QA agent must be incentivized to break. Always pass to fresh QA agent with zero build context.

**Demonstration — Tomatillo Sauce:** 10 agents with different chef personas independently invented tomatillo sauces. Showed statistical consensus answers alongside high-variance outliers (e.g., French butter sauce using tomatillo pectin) in seconds.

### 4. Context Management & Workspace Organization

**Mental Model — Sub-agents = Skills:** Functionally identical. Both are isolated markdown files (skill.md) containing Name, Description, Allowed Tools. Multi-agent hierarchies and skill files are the same concept.

**Organizational Principles — Directory Layout:**
- Isolate at OS level: separate `Business/` and `Personal/` root folders to prevent context cross-contamination
- Nest clients inside Business (e.g., `Business/Client A/`). Each client folder must contain its own `.env`, `.claude/skills/`, and local `claude.md`
- Inside `Personal/`, organize by domain (e.g., `Citizenship/`, `Health/`)
- **"Never Pollute the Root" Rule:** Generated files, downloads, temp files go strictly into `active/` or `tmp/` subdirectories
- **Skill.md dump locations:** Each skill.md must specify exact output file paths (e.g., "dump inside active/model-chat") to prevent AI from scattering files

**Workflow:** Periodically prompt: "Clean up my active/ folder by categorizing loose files into logical subdirectories and deleting temp files"

**Configuration Example — Visual Context Switching:** Modify `.vscode/settings.json` to change IDE header color per workspace type (e.g., green for Personal). Prevents "monkey brain" from executing business commands in wrong context.

### 5. Autonomous Research (Auto Research)

**Mental Model — Decreasing Human Involvement:** Development progresses through 4 stages:
1. Manual coding (Wright brothers flying manually)
2. Vibe coding (writing prompts)
3. Agentic engineering (directing parallel sub-agents)
4. Auto-research (setting a metric, letting AI run closed-loop experiments while you sleep)

**Framework Requirements:** Three prerequisites:
1. Strict quantitative metric (e.g., Lighthouse LCP/FCP/TBT scores)
2. Fast change method (e.g., editing HTML/CSS)
3. Fast automated assessment tool (e.g., local Lighthouse script)

**Heuristic — <30 Second Threshold:** The change + assessment loop must execute in under 30 seconds to enable compound exponential improvement.

**Implementation:**
1. Clone `github.com/karpathy/auto-research`
2. Configure `program.md` — restrict what files agent may modify, where to log scores
3. Run `train.py` loop (hypothesis → modify → assess → keep/revert)

**Warning:** Add explicit visual constraints (pixel-perfect screenshot comparison) so AI doesn't break layout just to improve speed scores.

### 6. Web and Computer Automation

**Decision Framework — The Automation Scale (4 levels, cheapest to most capable):**

| Level | Tool | Speed/Cost | When to use |
|-------|------|-----------|-------------|
| 1 | HTTP Requests (Web Fetch) | Fastest, cheapest | Direct API, basic scraping. Fragile, easily blocked |
| 2 | Chrome DevTools MCP | Moderate | Dynamic JS sites, bypasses basic blocks |
| 3 | Browser Use Platform | Moderate, paid | Shielded sites (social media). Custom fingerprinting, undetectable |
| 4 | Computer Use (Claude Desktop) | Slowest, most expensive | Non-web GUI tasks. Universal but token-intensive |

**Workflow Sequence:** Prototype with Chrome DevTools MCP → validate logic → instruct Claude to read raw network requests → convert to pure HTTP API requests for massive token savings.

**Configuration Rule:** Add to global claude.md: *"When using Chrome DevTools MCP, always kill stale Chrome processes in a clear profile before starting. If tools fail twice, stop and ask the user."*

**Demonstration — Vancouver Rentals:** Agent navigated rental site, adjusted filters ($3k/month, 1-bedroom, pool), bypassed anti-bot via JS interaction.

**Demonstration — Thumbnail Rename:** Agent physically moved mouse, opened Finder, typed search, renamed file. Proved universal capability but took significantly longer than bash script.

### 7. Monoculture Risk & Diversification

**Mental Model — Monoculture Blight:** (Interstellar analogy) Over-relying on single AI harness means total productivity collapse during provider outages or silent performance degradations.

**Heuristic — 70/30 Rule:** Allocate 70% workflows to Claude Code, 30% across alternatives (Codex, Gemini, local models).

**Implementation:**
- **Conductor app** — Parallel isolated workspaces combining CodeEx and Claude Code in same GUI
- **CodeEx MCP Server** — `npm i -g @openai/codex` — call CodeEx from within Claude Code when Anthropic degrades
- **Cross-platform prompts** — Sync claude.md to generic `agents.md` or `gemini.md` for instant portability

### 8. Security Anti-Patterns & Best Practices

**Heuristic — 80/20 Security:** Fix low-hanging fruit to make hacking more effort than the reward. Accept that complete invulnerability is impossible.

**Anti-pattern — Chat History API Leaks:** Claude logs all conversations in plain text JSONL at `~/.claude/`. Never paste API keys in chat. Use .env exclusively.

**Anti-pattern — Hallucinated NPM Packages:** LLMs hallucinate library names (e.g., `acorns` instead of `acorn`). Typosquatters register these names with malware that exfiltrates `~/.claude/` logs. Always audit npm install lists.

**Anti-pattern — Unsecured Databases:** Failing to enable RLS on platforms like Supabase allows any authenticated user to read/write/delete entire database.

**Anti-pattern — Raw Public Endpoints:** Exposing agent endpoints on public VPS IPs → immediate breach by bot farms scanning open ports.

**Anti-pattern — PCI Violations:** Never let agents process/store raw credit card strings. Delegate entirely to Stripe.

**Anti-pattern — Biased Security Audits:** Never ask the building agent to audit its own work — it ignores its own flaws. Run audits in completely fresh chat session or different model.

### 9. The Future of Agentic Engineering

**Mental Model — Shifting Economic Moat:** Writing software will have zero inherent value due to infinite AI supply. Future business moats: distribution channels, brand reputation, legal/regulatory compliance, vendor networks.

**Demonstration — Netflix in 5 Minutes:** Built functional Netflix replica using fast mode. Argued software quality is no longer a defensible business asset.

**Heuristic — 0.9^3 = 73%:** Each AI layer without human oversight compounds error probability. Three layers of 90% accuracy = 73% total.

**Auto Mode:** Claude Code feature bypassing manual execution permissions. Represents shift from human-in-the-loop to full autonomous execution.

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

## Mental Models

1. The 4 Pillars of claude.md — Knowledge compression, user preferences, capability declaration, failure/success log
2. Gun and Bullet Analogy — LLM = bullet, Harness = gun barrel granting agency
3. Zone of Good — Performance degrades with context length; fresh sub-agents stay optimal
4. Sub-agents = Skills — Functionally identical markdown SOPs
5. Monoculture Blight — Single-provider dependency risk (Interstellar analogy)
6. Decreasing Human Involvement — Manual → vibe coding → agentic → auto-research
7. Shifting Economic Moat — Software value → zero; moats = distribution, brand, compliance, network

## Anti-Patterns (with reasoning)

1. Human-like agent hierarchies — Compounds hallucination probability (0.9^3 = 73%)
2. Combining Dev and QA in one agent — Conflicting incentives
3. Unreviewed /insights — Permanently biases future workflows
4. "Never pollute the root" — Generated files scatter without explicit routing
5. Biased security audits — Agent ignores its own flaws
6. Chat history API leaks — Plain text JSONL at ~/.claude/
7. Hallucinated npm packages — Typosquatters exfiltrate ~/.claude/ logs
8. Unsecured databases (no RLS) — Full read/write/delete exposure
9. Raw public agent endpoints — Immediate breach by bot farms

## Decision Frameworks

1. Model Cost vs Capability routing — Sonnet/Haiku for extraction, Opus for synthesis
2. Automation Scale — HTTP → Browser → OS (pros/cons/when for each)
3. Automation optimization pipeline — DevTools prototype → capture network → convert to HTTP

## Heuristics & Thresholds

1. 70/30 diversification rule — 70% Claude, 30% alternatives
2. <30-second auto-research threshold — Loop must be fast for compound improvement
3. 80/20 security rule — Low-hanging fruit; make hacking more effort than reward
4. 0.9^3 = 73% accuracy — Each AI layer compounds error probability

## Configuration Examples (exact text)

1. Lab Notes meta-prompt: "When you have made a mistake, update the claude.md with a running log of things not to try next time"
2. Chrome DevTools rule: "When using Chrome DevTools MCP, always kill stale Chrome processes in a clear profile before starting. If tools fail twice, stop and ask."
3. VS Code header colors: Modify .vscode/settings.json per workspace type

## Content Routing Rules

1. Global claude.md: reasoning strategies, personal profile, token conservation
2. Local claude.md: low-level knowledge, file architectures, project API rules
3. Skill.md dump locations: each skill specifies exact output paths
4. Client nesting: own .env, .claude/skills/, claude.md per client
5. Personal directory: organize by domain (Citizenship/, Health/)

## Demonstrations

1. Tomatillo sauce consensus — 10 chef-persona agents; consensus + French butter outlier
2. Vancouver rentals — Browser automation bypassing anti-bot on rental site
3. Thumbnail rename — Computer Use physical mouse/Finder interaction (slow but universal)
4. Netflix in 5 minutes — Software quality no longer defensible moat

---

# DiveDispatch Assessment — 2026-03-29

**Applicable:** 5 | **Already done:** 3 | **Not applicable:** 11 | **Future:** 2

## Technique Table

| # | Technique | Classification | Risk | Implementation | Test Type | Effort | Project Layers |
|---|-----------|---------------|------|----------------|-----------|--------|----------------|
| 1 | claude.md Optimization | applicable | LOW | meta-prompts + /insights workflow | hook | S | .claude, CLAUDE.md |
| 2 | Sub-agents & Skills | already-done | --- | --- | --- | --- | .claude/skills |
| 3 | Fan-out/Fan-in | future | --- | --- | --- | --- | .claude (needs orchestrator) |
| 4 | Stochastic Consensus | not-applicable | --- | --- | --- | --- | --- |
| 5 | Auto Research | not-applicable | --- | --- | --- | --- | --- |
| 6 | Web Fetch | not-applicable | --- | --- | --- | --- | --- |
| 7 | Chrome DevTools MCP | already-done | --- | --- | --- | --- | package.json, .claude/skills |
| 8 | Browser Use | not-applicable | --- | --- | --- | --- | --- |
| 9 | Computer Use | not-applicable | --- | --- | --- | --- | --- |
| 10 | Automation Workflow Opt | applicable | LOW | Refactor clerk-signin to HTTP | integration | M | .claude/skills, src |
| 11 | Monoculture Risk | not-applicable | --- | --- | --- | --- | --- |
| 12 | CodeEx MCP | not-applicable | --- | --- | --- | --- | --- |
| 13 | Cross-Platform Prompts | not-applicable | --- | --- | --- | --- | --- |
| 14 | Workspace Org | not-applicable | --- | --- | --- | --- | --- |
| 15 | Active/Tmp Pattern | applicable | LOW | New pattern | hook | S | .claude, .gitignore |
| 16 | Visual Context Switch | not-applicable | --- | --- | --- | --- | --- |
| 17 | API Key Security | already-done | --- | --- | --- | --- | .gitignore |
| 18 | Dependency Audit | applicable | MED | New skill + hook | unit | M | package.json, .claude |
| 19 | Database RLS | future | --- | --- | --- | --- | convex |
| 20 | Fresh Session Audits | applicable | MED | New agent | integration | L | .claude/agents |
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
**Risk:** Clerk API may not expose direct HTTP endpoints for all auth flows

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
Establishes a .claude/tmp/ directory for transient generated artifacts that shouldn't clutter the project root. Extends the existing .claude/runs/ pattern.

**How to build it:**
1. Create .claude/tmp/ directory with .gitkeep
2. Update .gitignore to exclude .claude/tmp/*
3. Update relevant skills/hooks to write transient output to .claude/tmp/

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
**Risk:** False positives on internal packages; npm registry rate limiting

**What it does:**
Creates a dependency audit skill that verifies package.json dependencies against npm registry, detects hallucinated/typosquatted packages, and flags outdated/insecure versions. Includes PreToolUse hook on npm install commands.

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
Creates a standalone security audit agent running in isolation (fresh session, no prior context) to prevent bias. Scans auth boundaries, state machine transitions, and ownership verification patterns.

**How to build it:**
1. Create .claude/agents/security-auditor.md with isolated execution rules
2. Define audit scope: convex/bookings/, src/proxy.ts, convex/users.ts
3. Create scripts/run-security-audit.sh to spawn fresh agent session
4. Output to .claude/runs/security-audit-{YYYY-MM-DD}.md
5. Trigger on convex/bookings/ or src/proxy.ts changes

**Ticket-ready:** Yes -- /spec ready

## Already Done in DiveDispatch

| Technique | Where in DiveDispatch |
|-----------|----------------------|
| API Key Security | .gitignore blocks .env; CLAUDE.md documents auth boundary; Config/.env.local centralized |
| Sub-agents & Skills | 37+ skill files in .claude/skills/ (driver, backseat, patrol, first, spec, qa, matrix-github, matrix-youtube, etc.) |
| Chrome DevTools MCP | Playwright (@playwright/test); agent-navigator skill; test:e2e scripts |
| API Key Security | .gitignore blocks .env; CLAUDE.md documents auth boundary; Config/.env.local centralized |

## Future Opportunities

| Technique | Dependency |
|-----------|-----------|
| Fan-out/Fan-in Parallelization | Needs orchestration layer for multi-agent coordination. Matrix skills currently run serial. |
| Database RLS Enforcement | Convex has no native RLS. Uses mutation/query auth gates + users.slug ownership checks. |

## Decision Points

None — all classifications are clear-cut.

## Changelog

| Date | Applicable | Already Done | Notes |
|------|-----------|-------------|-------|
| 2026-03-29 | 4 | 4 | Initial assessment |
| 2026-03-29 | 4 | 4 | Re-extracted with broadened queries: +7 mental models, +9 anti-patterns, +3 decision frameworks, +4 heuristics, +5 content routing rules, +4 demonstrations |
