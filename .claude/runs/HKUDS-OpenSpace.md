---
repo: HKUDS/OpenSpace
url: https://github.com/HKUDS/OpenSpace
assessed: 2026-03-29
type: mcp-server
domain: devtools
maintenance: active
---

# OpenSpace — Library Entry

**Purpose:** Self-evolving skill framework for AI agents. MCP server that enables autonomous skill discovery, execution, analysis, and evolution. Skills improve automatically through repeated use via three triggers: post-execution analysis, tool degradation detection, and periodic metric monitoring.

**Capabilities:**
- Task delegation via `execute_task` (autonomous agent loop with skill injection)
- Skill discovery via `search_skills` (BM25 + embedding hybrid, local + cloud)
- Skill repair via `fix_skill` (manual FIX evolution trigger)
- Skill sharing via `upload_skill` (cloud community at open-space.cloud)
- Auto-evolution: FIX (repair in-place), DERIVED (enhanced version), CAPTURED (new pattern from execution)
- Quality monitoring: per-skill applied/completion/fallback rates
- Multi-backend execution: shell, web, GUI, MCP

## Architecture

**Core modules:**
- `tool_layer.py` — OpenSpace main class, orchestrates initialize → execute → analyze → evolve
- `mcp_server.py` — 4 MCP tools (execute_task, search_skills, fix_skill, upload_skill)
- `skill_engine/` — registry, analyzer, evolver, patch, store (SQLite), types
- `grounding/` — backends (shell, web, GUI, MCP), quality manager, security
- `cloud/` — client, search, auth, CLI tools
- `llm/client.py` — LiteLLM wrapper with retry

**API surface:**
- `OpenSpace.execute(task, workspace_dir, max_iterations)` — main entry point
- `SkillRegistry.discover()` / `select_skills(task, candidates)` — skill selection
- `ExecutionAnalyzer.analyze_execution(task, result, records)` — post-execution analysis
- `SkillEvolver.evolve(ctx: EvolutionContext)` — LLM-driven skill rewrite
- `SkillStore` — SQLite persistence with WAL for parallel reads

**Data model:**
- `skill_records` — master table: id, name, path, lineage (origin/generation/parents/diff/snapshot), quality metrics (selections/applied/completions/fallbacks)
- `execution_analyses` — per-task analysis with evolution suggestions
- `skill_judgments` — per-skill judgment within each analysis
- `skill_lineage_parents` — many-to-many parent-child DAG
- `skill_tool_deps` — tool dependencies per skill

**Evolution triggers:**
| Trigger | When | Confirmation |
|---------|------|-------------|
| ANALYSIS | After every execute_task | None — immediate |
| TOOL_DEGRADATION | Tool success rate drops | LLM self-confirms |
| METRIC_CHECK | Every 5th execution | LLM self-confirms |

No human approval. Skills are rewritten directly. FIX = in-place. DERIVED = new version alongside. CAPTURED = brand new skill.

## Security and Ecosystem

- **CVEs:** None found
- **Permissions:** Network (LLM API calls, cloud search), filesystem (skill read/write, SQLite), shell (command execution via grounding)
- **Dependencies:** ~15 runtime (litellm, anthropic, openai, mcp, flask, pydantic, pillow, numpy, pyautogui, etc.)
- **Maintenance:** Active (pushed 2026-03-29, regular commits, 2398 stars)
- **Bundle size:** N/A (Python tool, installed via uv)

## Interactive Steps

- **LLM API key setup:** Required. One of ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY.
- **Cloud API key:** Optional. OPENSPACE_API_KEY from open-space.cloud for community features.
- **Install:** `uv tool install --from ~/openspace --with websockets openspace --force`

## NotebookLM Sources

- README.md (GitHub raw URL)

---

# Assessment — DiveDispatch — 2026-03-29

**Project state at time of assessment:**
- Incumbent: OpenSpace v0.1.0 (already installed as MCP server)
- Incumbent evidence: `~/.claude/settings.json` MCP config, `~/openspace/` clone, `~/.local/bin/openspace-mcp` binary, 4 MCP tools available
- Switching cost: N/A — deepening integration, not switching
- Prior library entries: None (first matrix-github run)

**Verdict:** UPGRADE
**Risk:** LOW — no schema changes, no core logic changes, no new dependencies. Integration adds a shell hook and a vault skill step.
**Verdict reasoning:** OpenSpace was configured but dormant — zero `execute_task` calls in git history. This assessment deepens the integration by wiring skill usage tracking (PostToolUse hook) and automatic evolution (vault-triggered `execute_task`) into the existing workflow. All 35+ skills now feed the evolution engine.

## Compatibility Matrix

|                    | convex/ | src/lib | .claude/ | design-system/ | External API |
|--------------------|---------|---------|----------|----------------|-------------|
| Task delegation    | N/A     | N/A     | fit      | N/A            | N/A         |
| Skill discovery    | N/A     | N/A     | fit      | N/A            | cloud       |
| Skill repair       | N/A     | N/A     | fit      | N/A            | N/A         |
| Skill sharing      | N/A     | N/A     | fit      | N/A            | +1 var      |
| Auto-evolution     | N/A     | N/A     | fit      | N/A            | N/A         |
| Quality monitoring | N/A     | N/A     | proj~    | N/A            | N/A         |
| Cloud community    | N/A     | N/A     | skill    | N/A            | +1 var      |

All capabilities map to `.claude/` — OpenSpace is a dev tool, not a product feature.

## Adaptation Specs

### Adaptation: Quality Monitoring x .claude/

**Direction:** project adapts
**Why:** OpenSpace evolution only triggers inside `execute_task`. Normal skill usage via Claude Code's Skill tool is invisible to the evolution engine.

**Project side:**
1. PostToolUse hook on Skill tool → logs usage to `.openspace/skill_usage.jsonl`
2. Vault skill Job 4.5 → calls `execute_task` with usage summary, triggers evolution
- Files: `.claude/hooks/skill-usage-logger.sh`, `.claude/settings.json`, `.claude/skills/vault/SKILL.md`

**Effort:** S
**Risk:** Hook is read-only (just logging). Evolution runs after git commit. Worst case: bad rewrite → `git checkout` reverts.
**Build type:** hook + skill-change

### Adaptation: Cloud Community x .claude/

**Direction:** project adapts (optional, deferred)
**Why:** Sharing evolved skills to the cloud requires OPENSPACE_API_KEY.

**Project side:**
- Set `OPENSPACE_API_KEY` in environment
- Optionally add `upload_skill` call after successful evolution

**Effort:** S
**Risk:** None — opt-in feature
**Build type:** config-change

## Already Done in DiveDispatch

| Capability | Current Solution | Where | Notes |
|------------|-----------------|-------|-------|
| MCP server | Installed via uv | `~/.local/bin/openspace-mcp` | Working, 4 tools available |
| Skill dirs | Registered via env | `OPENSPACE_HOST_SKILL_DIRS` in `~/.claude/settings.json` | Auto-rescans on each call |
| Status monitoring | openspace-status script | `~/.local/bin/openspace-status` | Shows health, execution count, tool breakdown |

## Integration Plan

Already implemented in this session:

1. **Created** `.claude/hooks/skill-usage-logger.sh` — PostToolUse hook logging every Skill invocation
2. **Updated** `.claude/settings.json` — added Skill PostToolUse hook entry
3. **Updated** `.claude/skills/vault/SKILL.md` — added Job 4.5 (OpenSpace evolution step)
4. **Updated** `.gitignore` — added `.openspace/` (usage logs)
5. **Created** `.openspace/` directory

### Environment Variables

| Variable | Purpose | Where |
|----------|---------|-------|
| OPENSPACE_API_KEY | Cloud community (optional) | `~/.zshrc` or `Config/.env.local` |

### Files Created

| Path | Purpose |
|------|---------|
| `.claude/hooks/skill-usage-logger.sh` | Skill usage PostToolUse hook |
| `.openspace/skill_usage.jsonl` | Usage log (auto-created by hook, git-ignored) |

### Files Modified

| Path | Change |
|------|--------|
| `.claude/settings.json` | Added Skill PostToolUse hook |
| `.claude/skills/vault/SKILL.md` | Added Job 4.5 + mcp__openspace__execute_task to allowed-tools |
| `.gitignore` | Added `.openspace/` |

## Testing Strategy

1. Invoke any skill → verify `.openspace/skill_usage.jsonl` has a new JSONL line
2. Run `/vault` → verify it reads the log and calls `execute_task`
3. After evolution: `git diff .claude/skills/` shows rewritten skills
4. `openspace-status` shows execution count incrementing
5. After 5+ sessions: check SQLite for skill lineage records

## Rollback Plan

1. Remove PostToolUse Skill hook from `.claude/settings.json`
2. Remove Job 4.5 from `.claude/skills/vault/SKILL.md`
3. Remove `mcp__openspace__execute_task` from vault allowed-tools
4. Delete `.claude/hooks/skill-usage-logger.sh`
5. `rm -rf .openspace/`
6. `git checkout .claude/skills/` to revert any evolution changes

## Changelog

| Date | Verdict | Incumbent | Notes |
|------|---------|-----------|-------|
| 2026-03-29 | UPGRADE | OpenSpace v0.1.0 (dormant) | Initial. Deepened integration: usage hook + vault evolution step. |
