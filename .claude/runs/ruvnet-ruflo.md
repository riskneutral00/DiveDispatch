---
repo: ruvnet/ruflo
url: https://github.com/ruvnet/ruflo
assessed: 2026-03-30
type: cli-tool + mcp-server
domain: ai
maintenance: active
---

# ruflo — Library Entry

**Purpose:** Enterprise AI agent orchestration platform (formerly claude-flow). Adds persistent vector memory, self-learning pattern loop, context autopilot, and 313 MCP tools on top of Claude Code. The LLM does the actual work; ruflo is the ledger that coordinates, remembers, and routes.

**npm package:** `claude-flow` (v3.5.48) — also installable as `ruflo@latest`

**Capabilities:**
- Persistent vector memory (HNSW semantic search, cross-session pattern storage via AgentDB)
- Self-learning loop: RETRIEVE > JUDGE > DISTILL > CONSOLIDATE — automatic post-task pattern extraction
- Context Autopilot: intercepts Claude Code PreCompact hook, archives conversation turns to SQLite, restores importance-ranked entries
- 313 MCP tools exposed via `npx ruflo mcp start`
- 27 lifecycle hooks across 8 categories (Session, Agent, Task, Tool, Memory, Swarm, File, Learning)
- 130+ built-in skills, 12 background workers
- Multi-LLM routing: Claude/GPT/Gemini/Ollama with Q-Learning Router + MoE (8 experts)
- IPFS plugin marketplace (19 official plugins)
- WASM Agent Booster: skips LLM for simple code transforms (<1ms)
- Hierarchical memory tiers: working (fast, evicted) > episodic (importance-ranked) > semantic (permanent, consolidated)
- Memory decay via Ebbinghaus forgetting curves and spaced repetition
- MemoryGraph with PageRank for surfacing most-referenced insights

## Architecture

```
User > CLI / MCP Server > AIDefence > Router (Q-Learning + MoE) > Swarm > Agents > Memory > LLM Providers
                                                                    ^                    |
                                                                    +-- Learning Loop ---+
```

Key modules:
- CLI: 26 commands (swarm, agent, task, memory, hooks, mcp, init, doctor)
- MCP Server: 313 tools via stdio transport for Claude Code integration
- Router: Q-Learning + MoE (8 experts) — simple tasks > WASM (<1ms), medium > Haiku, complex > Opus+Swarm
- Swarm: coordination records — hierarchical/mesh/ring/star/adaptive topologies, Raft/BFT/Gossip/CRDT consensus
- AgentDB v3: 20+ controllers — HierarchicalMemory, MemoryConsolidation, SemanticRouter, MemoryGraph (PageRank)
- RuVector: SONA, EWC++, Flash Attention, HNSW/HnswLite, ReasoningBank, LoRA, 9 RL algos
- RVF Storage: pure TypeScript binary format (replaces 18MB sql.js WASM), <50ms cold start
- Plugin SDK: PluginBuilder, MCPToolBuilder, HookBuilder, WorkerPool — IPFS distribution

Runtime deps: 2 (semver, zod). Optional: @ruvector/core, @ruvector/router, @ruvector/sona, agentdb, agentic-flow (all first-party ruvnet packages).

## Security and Ecosystem

- **CVEs:** None directly assigned. GHSA-22r3-9w55-cj54 (v2.x pkg bundler, patched). CI bypass in alpha builds (fixed v2.0.0-alpha.62). 413 TS errors in CLI layer (quality flag). 0 npm audit v3.5.x.
- **Permissions:** network (MCP server, LLM providers, IPFS), fs (./data/memory, config), shell (hooks via SafeExecutor execFile shell:false)
- **Maintenance:** ACTIVE — 5,800+ commits, 28,363 stars, last push 2026-03-30, security SLA 48h
- **Notable:** Shell hook surface is highest-risk vector. First-party optional deps lack independent audits.

## Interactive Steps

1. `claude mcp add ruflo -- npx -y ruflo@latest mcp start` (manual-config, one command)
2. `npx ruflo@latest init --wizard` (cli-wizard, optional, only for full setup)

## NotebookLM Sources

- README.md — source_id: 5328b5fd-f485-41f9-bf9b-9b147f29eb58 (in `Matrix — GitHub` notebook)

---

# Assessment — DiveDispatch — 2026-03-30

**Project state at time of assessment:**
- Incumbent: DD's `.claude/skills/` system (39 skills) + Claude Code directly + Car workflow (driver/backseat/patrol). 11 hook scripts across 5 types. No cross-session memory. No context autopilot.
- Switching cost: N/A — decision was REFERENCE (extract patterns natively, no ruflo installation)
- Prior library entries: None (first ai-domain entry)

**Verdict:** REFERENCE
**Risk:** N/A — no integration, patterns extracted natively
**Verdict reasoning:** Ruflo's highest-value capabilities (persistent memory, context autopilot, self-learning loop, memory decay) are patterns simple enough to implement natively in DD's hook/skill system without adding a 313-tool MCP dependency. DD's existing 39 skills, Car workflow, and 11 hooks are better than ruflo's generic equivalents for everything DD-specific. The repo stays in the library as a pattern source for future re-assessment if DD's needs outgrow the native approach.

## Compatibility Matrix

```
                        | convex/ | src/lib | src/    | src/app | .claude/ | Config/
                        |         |         | comps   |         |          |
------------------------+---------+---------+---------+---------+----------+--------
Persistent Vector Memory| N/A     | N/A     | N/A     | N/A     | overlap  | N/A
Self-Learning Loop      | N/A     | N/A     | N/A     | N/A     | overlap  | N/A
Context Autopilot       | N/A     | N/A     | N/A     | N/A     | proj~    | N/A
Memory Decay            | N/A     | N/A     | N/A     | N/A     | proj~    | N/A
Swarm Coordination      | N/A     | N/A     | N/A     | N/A     | overlap  | N/A
Hooks Automation        | N/A     | N/A     | N/A     | N/A     | overlap  | N/A
130+ Built-in Skills    | N/A     | N/A     | N/A     | N/A     | overlap  | N/A
Multi-LLM Routing       | N/A     | N/A     | N/A     | N/A     | N/A      | N/A
```

## Incumbent Comparison

| Capability | Incumbent (DD) | Challenger (ruflo) | Winner | Delta |
|------------|---------------|-------------------|--------|-------|
| Cross-session memory | None — sessions isolated; /distill + /vault are manual file writes | HNSW semantic search, AgentDB, Ebbinghaus-decay tiers | challenger | significant |
| Context autopilot | None — long Car sessions can lose context | PreCompact hook archives to SQLite, restores ranked entries | challenger | significant |
| Self-learning loop | Manual: /distill requires explicit approval, /vault only on command | Automatic: post-task RETRIEVE > JUDGE > DISTILL > CONSOLIDATE | challenger | moderate |
| Memory decay | MEMORY.md entries never decay, accumulate | Ebbinghaus curves, working > episodic > semantic promotion | challenger | moderate |
| Swarm coordination | Car workflow (driver/backseat/patrol) — DD-specific, tmux, Convex+Clerk | Generic coordination records; LLM does actual work | incumbent | marginal |
| Hooks | 11 scripts, 5 types — tsc, N+1, dependency direction, schema preflight | 27 generic types — redundant with DD-specific hooks | incumbent | marginal |
| Built-in skills | 39 DD-specific (gate, qa, review-backend-auth, clerk-signin, vault, etc.) | 130+ generic dev skills | incumbent | marginal |
| Multi-LLM routing | Claude Code model selection | Q-Learning + MoE failover | tie | marginal |

**Summary:** Ruflo wins where DD has gaps (memory, context, learning, decay). DD wins where it has purpose-built solutions (swarm, hooks, skills). Decision: extract the winning patterns natively rather than adopting ruflo as a dependency.

## Patterns Extracted (ticket-ready)

### Pattern 1: PreCompact Hook — Context Archival
**Source:** Ruflo's Context Autopilot (PreCompact hook + SQLite archive + importance-ranked restore)
**DD native implementation:** Add PreCompact hook to .claude/settings.json. Shell script writes session decisions/observations to `.claude/context-archive/{date}.md`. /first reads archive on next session.
**Ticket:** DD-TBD

### Pattern 2: /first Enhancement — Pattern Retrieval
**Source:** Ruflo's session-start memory_search (HNSW semantic retrieval of past patterns)
**DD native implementation:** /first reads `.claude/patterns/` directory at session start. Surfaces relevant patterns alongside MEMORY.md. No vector search needed — Claude reads structured markdown.
**Ticket:** DD-TBD

### Pattern 3: /vault Enhancement — Pattern Storage
**Source:** Ruflo's post-task memory_store (automatic pattern extraction + storage)
**DD native implementation:** /vault writes structured pattern file to `.claude/patterns/{date}.md`. What worked, what failed, key decisions. Respects existing rule: only on explicit /vault command.
**Ticket:** DD-TBD

### Pattern 4: Memory Decay / Freshness
**Source:** Ruflo's Ebbinghaus forgetting curves + hierarchical tier promotion
**DD native implementation:** Add `last-accessed` to memory file frontmatter. /first flags entries older than 30 days. Periodic pruning prevents MEMORY.md noise.
**Ticket:** DD-TBD

## Decision Record

Matt's decision (2026-03-30): REFERENCE, not INTEGRATE. Reasoning:
- Ruflo's patterns are valuable but simple enough to implement natively
- Installing ruflo MCP adds 313 tools to namespace, creates two competing memory systems, and bypasses Matt's approval gates on /distill and /vault
- DD's skill system stays self-contained with no external orchestration dependency
- Library entry preserved for re-assessment if DD outgrows native approach

## Changelog

| Date | Verdict | Incumbent | Notes |
|------|---------|-----------|-------|
| 2026-03-30 | REFERENCE | .claude/skills/ (39 skills) + Claude Code | Initial. Patterns extracted: PreCompact hook, /first patterns, /vault patterns, memory decay. No ruflo installation. |
