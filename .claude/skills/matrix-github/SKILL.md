---
name: matrix-github
description: >
  Deep integration analysis for any GitHub repo against the current project. Clones repo,
  reads source, builds compatibility matrix (capabilities x project layers), designs
  automation for interactive steps, proposes project adaptations. Library-first: every
  repo is permanently ingested into NotebookLM + Vault. Verdicts are temporal —
  computed against the project's current code, re-assessable when the project changes.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion, WebFetch, mcp__perplexity__perplexity_search, mcp__perplexity__perplexity_ask, mcp__openspace__search_skills, mcp__notebooklm-mcp__notebook_create, mcp__notebooklm-mcp__notebook_list, mcp__notebooklm-mcp__notebook_get, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__source_add, mcp__notebooklm-mcp__source_list_drive, mcp__notebooklm-mcp__note, mcp__notebooklm-mcp__tag
user-invocable: true
---

# /matrix-github — GitHub Repo Integration Matrix

Deep-analyze any GitHub repository for integration into the current project. Produces a structured compatibility matrix, adaptation specs, and automation designs.

**Library-first architecture:** Every assessed repo is permanently ingested into NotebookLM + Vault as a library entry. Verdicts are temporal — they reflect the project's current code state and can change when the project changes. The library grows forever; you always have the full shelf to pick from.

**Run immediately. No preamble.**

---

## Project context

When assessing a repo against DiveDispatch, these files are ground truth:

- **project:** DiveDispatch
- **vault:** `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`
- **key_files:**
  - `convex/schema.ts` — data model
  - `package.json` — dependencies
  - `convex/bookings/` — state machine, core mutations
  - `convex/lib/` — shared utilities
  - `src/lib/hooks/` — hook patterns
  - `.claude/skills/` — existing skills
  - `.claude/settings.json` — existing hooks
  - `design-system/MASTER.md` — UI system
  - `CLAUDE.md` — project invariants
  - `Architecture/*-invariants.md` — architectural laws
  - `Vaults/DiveDispatch/wiki/PatternLibrary/` — reusable patterns

Verdicts must cite these files. Proposing a pattern that duplicates an existing utility in `convex/lib/` or `src/lib/` is an error.

---

## Usage

```
/matrix-github <github-url>
/matrix-github <github-url> --focus=<area>
/matrix-github <url1> <url2> [<url3>] --compare
```

Accepts: `https://github.com/{owner}/{repo}`, `github.com/{owner}/{repo}`, `{owner}/{repo}`. Strips `/tree/`, `/blob/`, trailing slashes. Optional `--focus` narrows to: `mcp`, `npm`, `api`, `cli`, `security`, `ui`.

`--compare` mode: run 2-3 repos for the same domain, then produce a head-to-head comparison table with a single decision point. All repos get full library entries regardless of which wins.

---

## Phase 0: Read Project Config

**Before anything else**, read the CWD's `CLAUDE.md` and locate the `## Matrix Config` section.

1. Extract:
   - `{PROJECT}` — project name
   - `{VAULT}` — vault base path
   - `{KEY_FILES}` — list of key files with descriptions

2. Derive `{PROJECT_LAYERS}` from `{KEY_FILES}` — group by top-level directory:
   - `convex/schema.ts` and `convex/bookings/` both map to `convex/`
   - `src/lib/hooks/` maps to `src/lib`
   - `.claude/skills/` maps to `.claude/`
   - Each unique top-level grouping becomes a column in the compatibility matrix

3. If the `## Matrix Config` section is missing: print `"No Matrix Config found in CLAUDE.md. Add a ## Matrix Config section with project, vault, and key_files. See any existing project's CLAUDE.md for an example."` — stop.

Store these as variables used throughout: `{PROJECT}`, `{VAULT}`, `{KEY_FILES}`, `{PROJECT_LAYERS}`.

---

## Centralized Stores

All runs share these centralized locations. Never create per-repo notebooks or vault files.

| Store | Location | Pattern |
|-------|----------|---------|
| **NotebookLM** | Notebook titled `Matrix — GitHub` | Find-or-create once. Add sources per run (deduped). Cross-repo queries work natively. |
| **Vault** | `~/Desktop/RiskNeutral/Vaults/Matrix-GitHub/Integrations.md` | Two sections: Current Picks table (temporal) + Library (permanent, grouped by domain). |
| **Skeleton** | `.SKELETON.md` in CWD (if it exists) | Add `Integrations matrix` row pointing to `~/Desktop/RiskNeutral/Vaults/Matrix-GitHub/Integrations.md`. Once, idempotent. |
| **Detail** | `.claude/runs/{owner}-{repo}.md` | Per-repo file. Top half = Library (permanent). Bottom half = Assessment (temporal, recomputable). |

---

## Phase 0a-d: Parse + Validate + Gate

### 0a. Parse URL

Extract `owner` and `repo`:
- Strip protocol, `www.`, `github.com/`
- Strip `/tree/{anything}`, `/blob/{anything}`, trailing `/`
- Result: two variables `OWNER` and `REPO`

If no valid owner/repo extracted: print usage hint and stop.

If `--compare` flag present with multiple URLs: parse all URLs, then run the full pipeline for each repo sequentially (Phases 0-5). After all repos are done, proceed to Phase 6 (Comparison). Skip the compare phase for single-repo invocations.

### 0b. Check Existing Entry

```bash
ls .claude/runs/{OWNER}-{REPO}.md 2>/dev/null
```

If exists:

1. Read the file. Extract from frontmatter and assessment section: `verdict`, `assessed` date, `domain`, incumbent at the time, `risk`.

2. Detect what changed since last assessment:
   - **Project side:** Run Phase 0d incumbent scan (below). Compare the current incumbent to what's recorded in the assessment's "Project state at time of assessment" section. If different -> flag as `PROJECT_CHANGED`.
   - **Repo side:** `gh api repos/{OWNER}/{REPO} --jq '.pushed_at'` — compare against the `assessed:` date in frontmatter. If repo has been pushed since -> flag as `REPO_CHANGED`.

3. Print rich gate:
   ```
   Already in library ({YYYY-MM-DD}):
     Domain: {domain} | Verdict: {verdict} | Incumbent was: {incumbent}

   Changes detected:
     {PROJECT}: {incumbent changed from X to Y / no change}
     Repo: {N commits since last assessment / no change}

     A) Skip — nothing changed, verdict still valid <- default if no changes
     B) Re-assess — recompute verdict against current project state <- default if changes detected
     C) View existing — show the full file
   ```

4. **Skip:** Print existing verdict summary and stop.
5. **View existing:** Read and display the full file, stop.
6. **Re-assess:** Continue to Phase 0c. On re-assessment:
   - Preserve the library top-half of the detail file (do not overwrite)
   - Recompute the assessment bottom-half against current project state
   - Preserve changelog rows from the existing file, add new row
   - Do NOT re-add NLM sources — check source titles before adding (dedup)
   - Skip Phase 1 clone if `/tmp/{OWNER}-{REPO}` still exists or sources are unchanged

### 0c. Validate Access + Metadata

```bash
gh repo view {OWNER}/{REPO} --json name,description,primaryLanguage,defaultBranchRef,isFork,stargazerCount,updatedAt,repositoryTopics 2>&1
```

If fails: try `WebFetch(url="https://github.com/{OWNER}/{REPO}")` as fallback.
If both fail: `"Cannot access {OWNER}/{REPO}. If private, run: ! gh auth login"` — stop.

### 0d. Incumbent Scan

Identify the domain this repo addresses based on metadata, description, and topics. Then scan the project for an existing solution.

Iterate `{KEY_FILES}` to identify incumbent solutions:
1. **Package manifests** (package.json, pyproject.toml, Cargo.toml, go.mod, etc.) — existing packages for this domain?
2. **Schema/data files** — existing tables or models for this domain?
3. **Hook/utility directories** — wrappers around an existing solution?
4. **`.claude/runs/*.md`** — prior library entries in same domain? Read frontmatter for `domain:` matches.
5. **Environment files** (.env.local, .env.example, etc.) — env vars for an existing service?

Which files to check is determined by `{KEY_FILES}`. Not every project will have all of these.

Produce:
```
INCUMBENT: {package/feature name, or "None — new domain for {PROJECT}"}
INCUMBENT_EVIDENCE: {which files, which tables, which hooks}
DOMAIN: {email|payments|auth|storage|search|analytics|logging|testing|ui-components|mcp|database|messaging|scheduling|maps|media|ai|devtools|other}
PRIOR_LIBRARY: [{slug, verdict, date} for each prior library entry in same domain]
SWITCHING_COST: {None|Low|Medium|High}
  - None: new domain, nothing to replace
  - Low: swap a package, same patterns
  - Medium: new adapter + test rewrites
  - High: schema migration + state machine changes
```

Print one-line summary:
```
"{PROJECT} currently uses {INCUMBENT} for {DOMAIN}. Switching cost: {level}."
OR: "New domain for {PROJECT} — no incumbent."
```

If `PRIOR_LIBRARY` is non-empty, also print:
```
"Library has {N} prior entry(ies) for {DOMAIN}: {list with verdicts}."
```

---

## Phase 1: Clone + Ingest

### 1a. Sparse Clone

```bash
git clone --depth 1 --filter=blob:none --sparse "https://github.com/{OWNER}/{REPO}.git" "/tmp/{OWNER}-{REPO}" 2>&1
cd "/tmp/{OWNER}-{REPO}"
git sparse-checkout set '/*' '!assets/' '!dist/' '!build/' '!node_modules/' '!vendor/' '!__pycache__/' '!*.min.js' '!*.min.css' '!*.wasm' '!*.pb' '!*.pb.go'
```

If clone fails (private, too large): fall back to `gh api` tree endpoint + WebFetch for key files only.

### 1b. Identify Key Files

Read the file tree and identify:
- **Entry points**: `index.ts`, `main.py`, `src/index.*`, `lib/index.*`, `cmd/main.go`, etc.
- **Package manifest**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.
- **Config examples**: `.env.example`, `config.example.*`, `docker-compose.yml`
- **Documentation**: `README.md`, `docs/`, `CONTRIBUTING.md`, `ARCHITECTURE.md`
- **Tests**: `test/`, `tests/`, `__tests__/`, `*_test.go`, `*.test.ts`
- **CI**: `.github/workflows/`
- **MCP indicators**: `mcp.json`, files importing `@modelcontextprotocol/sdk`, README mentioning "MCP"

### 1c. NotebookLM Ingest

NLM ingest is library-building, not verdict-dependent. A KEEP_CURRENT repo gets the same NLM treatment as an INTEGRATE repo. The notebook is the shelf; the verdict is which book you pull.

1. `notebook_list()` — search for notebook titled `Matrix — GitHub`
2. If not found: `notebook_create(title="Matrix — GitHub")`
3. **Source dedup check:** List existing sources in the notebook. If sources with titles matching `{OWNER}/{REPO}` already exist (from a prior run), skip adding duplicates. Only add new/changed sources.
4. Add sources (max 5-7 per run to respect processing budget):
   - README: `source_add(notebook_id=..., source_type="url", url="https://raw.githubusercontent.com/{OWNER}/{REPO}/{DEFAULT_BRANCH}/README.md")`
   - Key docs from clone: `source_add(notebook_id=..., source_type="file", file_path="/tmp/{OWNER}-{REPO}/docs/...")`
   - If the repo has an ARCHITECTURE.md or similar: prioritize it
5. Tag the notebook: `tag(action="add", notebook_id=..., tags="matrix,integrations,{DOMAIN}")`

---

## Phase 2: Deep Analysis — 3 Parallel Agents

Launch all three simultaneously with `model: "sonnet"`. Each agent reads from the clone at `/tmp/{OWNER}-{REPO}`.

### Agent 1: Repo Architecture

**Prompt the agent with:** Read the actual source code in `/tmp/{OWNER}-{REPO}`. Not just README — read entry points, core modules, config files.

Produce:

```
MODULE_MAP:
  {module_name}: {purpose} ({key files})
  ...

API_SURFACE:
  {function/class/command}: {signature} — {what it does}
  ...

DATA_MODEL:
  {entity}: {key fields} — {relationships}
  ...

CONFIG_REQUIREMENTS:
  {env var or config key}: {purpose} — {required|optional} — {how to obtain}
  ...

INTERACTIVE_STEPS:
  {step description}: {classification: api-key-signup|oauth-flow|cli-wizard|manual-config|account-creation|dashboard-setup}
  ...

TYPE: {mcp-server|npm-package|python-package|cli-tool|api-service|framework|skill-source|reference}
INSTALL_CMD: {the command, or "manual" with explanation}
```

### Agent 2: Security + Ecosystem

**Prompt the agent with:** Analyze security and ecosystem health.
2. `mcp__perplexity__perplexity_search(query="{OWNER}/{REPO} CVE vulnerability security issue site:nvd.nist.gov OR site:github.com/advisories")` — known CVEs
3. Runtime permissions: does it need network? filesystem? shell exec? crypto? elevated privileges?
4. Dependency tree: count deps, identify known-bad deps (event-stream, colors, etc.)
5. Maintenance: last commit, release cadence, contributor count, open/closed issues ratio
6. `mcp__openspace__search_skills(query="{REPO} {repo purpose}")` — existing community skills

Produce:

```
CVES: [{list or "None found"}]
PERMISSIONS: {network|fs|shell|crypto|elevated} — {which and why}
DEP_COUNT: {N runtime, M dev}
DEP_FLAGS: [{known-bad deps or "Clean"}]
MAINTENANCE: {active|maintained|slow|stale|abandoned} — {last commit, release freq, contributors}
OPENSPACE: [{matching skills or "None found"}]
BUNDLE_SIZE: {if npm: estimated size, otherwise N/A}
```

### Agent 3: Project Compatibility Matrix + Incumbent Comparison

**Prompt the agent with:** Read the project's actual architecture files and compare against the repo analysis from Agent 1. For EACH repo capability, determine which project layers it touches and what the integration path is. **Also compare against the incumbent solution.**

Read the project's key files as declared in Matrix Config (`{KEY_FILES}`):
{Each file listed in key_files with its description}

Also read the project's CLAUDE.md for architectural rules and constraints.

**Provide the agent with incumbent context from Phase 0d:**
```
INCUMBENT CONTEXT:
{PROJECT} currently uses {INCUMBENT} for {DOMAIN}.
Evidence: {INCUMBENT_EVIDENCE}.
Switching cost: {SWITCHING_COST}.
Prior library entries for this domain: {PRIOR_LIBRARY}.

For each repo capability:
- If the project already has this via the incumbent: mark the cell as "overlap" and assess
  whether the challenger is meaningfully better (not just different).
- "Meaningfully better" = fixes a known pain point, adds a capability
  the project actually needs, or reduces complexity. "Different API" is not better.
- For "overlap" cells: provide a direct comparison (incumbent vs challenger)
  with honest pros/cons for BOTH sides.
```

For each repo capability, determine:
- Which project layers it touches (columns derived from `{PROJECT_LAYERS}`)
- Integration path per cell: `fit` | `repo~` | `proj~` | `both~` | `overlap` | `clash` | `N/A`
- If `proj~` or `both~`: what project change is needed (ticket-ready detail)
- If `overlap`: what the incumbent does vs what the challenger does
- Existing overlap: does the project already have something similar?

Produce:

```
MATRIX:
  {capability}:
    {layer}: {fit|repo~|proj~|both~|overlap|clash|N/A}
    ...

OVERLAPS:
  {capability}: {existing project feature that overlaps, or "None"}
  ...

PROJECT_ADAPTATIONS:
  {capability} x {layer}:
    direction: {repo|project|both}
    why: {what doesn't fit}
    repo_side: {adapter spec, or N/A}
    project_side: {change spec — files affected, what changes, or N/A}
    effort: {S|M|L}
  ...

INCUMBENT_COMPARISON:
  {capability}:
    incumbent: {how the project does it today, or "N/A — new domain"}
    challenger: {how this repo does it}
    winner: {incumbent|challenger|tie} — {why}
    delta: {marginal|significant|transformative}
  ...

PROVIDER_IMPACT: {none|addition|reorder — detail}
```

---

## Phase 3: NotebookLM Deep Query

After Phase 2 agents complete, query the `Matrix — GitHub` notebook for deeper understanding.

### 3a. Repo-Scoped Queries

1. `notebook_query(notebook_id=..., query="From the {REPO} documentation: What are the core abstractions, and how do they depend on each other?")`
2. `notebook_query(notebook_id=..., query="From the {REPO} documentation: What setup steps or configuration require human interaction or manual decisions?")`
3. `notebook_query(notebook_id=..., query="From the {REPO} documentation: What are the extension points, plugin APIs, or integration hooks available?")`

Use these answers to enrich the matrix — they may reveal capabilities or interactive steps that Agent 1 missed from reading code alone.

### 3b. Cross-Repo Query (conditional)

When `PRIOR_LIBRARY` from Phase 0d is non-empty (there are prior library entries in the same domain), add a cross-repo comparison query:

```
notebook_query(notebook_id=..., query="Compare {REPO} against {PRIOR_REPO_1} and {PRIOR_REPO_2} for {DOMAIN}: What does each do better? Where do they overlap? What are the key tradeoffs? Which is simplest to integrate into a Next.js + Convex stack?")
```

Pick up to 3 prior repos for comparison: prioritize verdict=INTEGRATE first, then most recent date.

Store the response as `CROSS_REPO_COMPARISON` for use in Phase 4 verdict logic.

This works because all prior repos' docs are already in the shared NLM notebook — cross-repo queries are native.

---

## Phase 4: Build the Matrix + Specs

### 4a. Assemble Compatibility Matrix

Combine Agent 1 (capabilities), Agent 2 (security/ecosystem), Agent 3 (project mapping + incumbent comparison), and Phase 3 (deep queries) into the structured matrix.

Column headers are derived from `{PROJECT_LAYERS}` — the top-level directories extracted from key_files. Add "External API" as a standard column if the repo involves external services.

Example for a Next.js + Convex project:
```
                    | convex/ | src/lib | src/       | src/  | .claude/ | Config/ | External
                    |         |         | components | app   |          |         | API
--------------------+---------+---------+------------+-------+----------+---------+---------
{Capability A}      | {cell}  | {cell}  | {cell}     | {cell}| {cell}   | {cell}  | {cell}
{Capability B}      | {cell}  | {cell}  | {cell}     | {cell}| {cell}   | {cell}  | {cell}
...
```

Example for a Python project:
```
                    | src/   | tests/ | config/ | .claude/ | External
                    |        |        |         |          | API
--------------------+--------+--------+---------+----------+---------
{Capability A}      | {cell} | {cell} | {cell}  | {cell}   | {cell}
...
```

Cell values:
- `fit` — direct integration, no friction
- `repo~` — repo adapts to project (adapter spec below)
- `proj~` — project adapts to repo (ticket-ready change spec below)
- `both~` — coordinated changes on both sides (spec below)
- `overlap` — project already has this via incumbent; challenger offers a variant
- `+N var` — requires N new environment variables
- `hook` — needs enforcement hook (spec below)
- `skill` — needs automation skill (spec below)
- `route` — needs new app route
- `clash` — fundamental conflict
- `N/A` — not applicable

### 4b. Adaptation Specs

For every cell marked `repo~`, `proj~`, or `both~`, write:

```markdown
### Adaptation: {Capability} x {Project Layer}
**Direction:** repo adapts | project adapts | both
**Why:** {what doesn't fit and why}

**Repo side:** *(if applicable)*
- {wrapper/adapter to build}
- {where it lives in the project's directory structure}

**Project side:** *(if applicable)*
- {what project change is needed — schema migration, new validator, new hook, pattern change}
- {which project files are affected}
- {ticket-ready: this spec could go straight to /spec -> /board}

**Effort:** S / M / L
**Risk:** {what could go wrong}

**Build type:** {skill|hook|agent|schema-change|new-pattern|config-change|dependency|refactor}

**Skill spec:** *(if build type = skill)*
  - **Name:** {skill name}
  - **Trigger:** {when to invoke}
  - **Tools:** {allowed-tools}

**Hook spec:** *(if build type = hook)*
  - **Type:** PreToolUse | PostToolUse
  - **Matcher:** {tool pattern}
  - **Logic:** {what it checks}

**Agent spec:** *(if build type = agent)*
  - **Type:** {subagent_type}
  - **When:** {when to spawn}
  - **Autonomy:** interactive | autonomous
```

### 4c. Automation Specs

For each interactive step from Agent 1's `INTERACTIVE_STEPS`:

**Classification -> Automation design:**

| Type | Automation | Skill spec |
|------|-----------|------------|
| `api-key-signup` | Skill: guide user through signup once. Hook: PreToolUse check that env var exists before any tool using the integration. | Setup skill + enforcement hook |
| `oauth-flow` | Playwright-based skill that automates the browser OAuth flow (modeled on `/clerk-signin` pattern). | Playwright skill |
| `cli-wizard` | Bash wrapper with flag-based non-interactive mode (`--yes`, `--defaults`, etc.) or pipe answers via heredoc. | Bash skill |
| `manual-config` | Skill that generates the config file from the project's existing env vars and context. No human input. | Generator skill |
| `account-creation` | Flag as one-time human step. Design verification hook that checks account exists before proceeding. | Verification hook only |
| `dashboard-setup` | Playwright skill if web-based. If CLI: same as `cli-wizard`. | Playwright or Bash skill |

For each, produce:

```markdown
### Automation: {step description}
**Classification:** {type}
**Can automate?** Full / Partial (one-time human step) / No

**SKILL:** {name}
- **Type:** setup | verification | enforcement
- **Trigger:** {when to run — first use, every use, on-demand}
- **Tools:** {allowed-tools list}
- **Steps:**
  1. Check if already configured (idempotent gate)
  2. {specific automation steps}
  3. Verify success

**HOOK:** *(if needed)*
- **Type:** PreToolUse | PostToolUse
- **Matcher:** {tool name pattern}
- **Logic:** {pseudocode — check env var, verify config, etc.}
- **Block message:** {what to tell Claude if check fails}
```

### 4d. Risk Assessment

| Level | Criteria |
|-------|----------|
| **LOW** | No project code changes, no new deps, MCP/CLI/skill only |
| **MEDIUM** | New dependency, touches library/utility layers, <5 files |
| **HIGH** | Touches data layer or core logic, changes provider nesting, >5 files, new env vars |
| **CRITICAL** | Touches core invariants, security implications, data migration required |

### 4e. Testing Strategy

- Unit tests for new utility functions or adapters
- Integration tests for actions calling external services
- E2E tests for new UI flows (only if repo adds UI)
- Contract tests for API response shapes (if repo is an API)
- Hook tests: verify enforcement hooks block correctly

### 4f. Verdict Logic

**If no incumbent (new domain for the project):**
Normal `INTEGRATE` / `DEFER` / `REJECT` logic based on risk, fit, maintenance.

**If incumbent exists:**

Check the `INCUMBENT_COMPARISON` from Agent 3:

1. Count capabilities where challenger wins, and at what delta:
   - Challenger wins 0-1 capabilities with `delta=marginal` -> **KEEP_CURRENT**
   - Challenger wins 2+ capabilities with `delta=significant` -> **Decision point for Matt**
   - Challenger wins any capability with `delta=transformative` -> **Recommend INTEGRATE**
   - `SWITCHING_COST=High` and no `transformative` delta -> **KEEP_CURRENT**

2. When ambiguous, present as a decision point (see 4g).

**Verdict values:**
- `INTEGRATE` — replace incumbent or add to a new domain. Worth the change.
- `KEEP_CURRENT` — repo is fine, but the project's current solution is good enough. Switching cost outweighs the delta. Stays in library for future re-assessment.
- `DEFER` — not ready yet (missing features, immature, wait for next release).
- `REJECT` — security risk or fundamental architectural clash.
- `UPGRADE` — already installed in the project; assess upgrade path (breaking changes, migration, affected files).
- `REFERENCE` — not an integration target; documentation or reference material preserved in library for knowledge.

### 4g. Decision Points

Identify questions only Matt can answer. Format each as:

```markdown
**Decision {N}:** {question}
- **A)** {recommended answer} <- recommended
- **B)** {alternative}
- **C)** {free-form — describe your own approach}
- **Impact:** {what changes based on the answer}
```

**When an incumbent exists**, the FIRST decision point must be the incumbent comparison:

```markdown
**Decision 1:** {PROJECT} uses {INCUMBENT} for {DOMAIN}. {REPO} is {assessment} at:
  - {capability}: {winner} ({delta})
  - {capability}: {winner} ({delta})
  Switching cost: {level}

- **A)** KEEP_CURRENT — stick with {INCUMBENT} <- {recommended if marginal}
- **B)** INTEGRATE — replace {INCUMBENT} with {REPO}
- **C)** DEFER — revisit when {condition}
- **Impact:** A = no code changes, repo stays in library. B = integration plan runs. C = library entry, revisit later.
```

Common additional decision points:
- "Add as dependency or vendor the code?"
- "Use in production or dev-only?"
- "Accept the bundle size increase?"
- "Add to all stakeholder roles or specific ones?"

---

## Phase 5: Write + Output

### 5a. Detail File

Write `.claude/runs/{OWNER}-{REPO}.md` with two distinct halves:

**Top half — Library (permanent, survives re-assessment):**

```markdown
---
repo: {OWNER}/{REPO}
url: {original github url}
assessed: {YYYY-MM-DD}
type: {mcp-server|npm-package|python-package|cli-tool|api-service|framework|skill-source|reference}
domain: {email|payments|auth|storage|search|analytics|logging|testing|ui-components|mcp|database|messaging|scheduling|maps|media|ai|devtools|other}
maintenance: {active|maintained|slow|stale|abandoned}
---

# {REPO} — Library Entry

**Purpose:** {what it does — permanent description}
**Capabilities:**
- {capability 1}
- {capability 2}
- ...

## Architecture

{MODULE_MAP, API_SURFACE, DATA_MODEL from Agent 1}

## Security and Ecosystem

- **CVEs:** {list or "None found"}
- **Permissions:** {what it needs and why}
- **Dependencies:** {N runtime, M dev} — {flags}
- **Maintenance:** {status} (last commit: {date}, {N} contributors)
- **OpenSpace skills:** {matches or "None"}
- **Bundle size:** {estimate or N/A}

## Interactive Steps

{INTERACTIVE_STEPS + automation specs from 4c — these are properties of the repo itself}

## NotebookLM Sources

- {source 1 title — URL or file}
- {source 2 title — URL or file}
- ...
```

**Bottom half — Assessment (temporal, recomputed on re-assessment):**

```markdown
---

# Assessment — {PROJECT} — {YYYY-MM-DD}

**Project state at time of assessment:**
- Incumbent: {what the project currently uses for this domain, or "None — new domain"}
- Incumbent evidence: {files/packages/hooks}
- Switching cost: {None|Low|Medium|High}
- Prior library entries: {list of domain peers with verdicts, or "None"}

**Verdict:** {INTEGRATE|DEFER|KEEP_CURRENT|REJECT}
**Risk:** {level} — {one-line justification}
**Verdict reasoning:** {2-3 sentences: why this verdict given the incumbent and switching cost}

## Compatibility Matrix

{the full matrix table from 4a — built against the project's CURRENT code}

## Adaptation Specs

{all specs from 4b}

## vs Incumbent

{if incumbent exists:}
| Capability | Incumbent ({name}) | Challenger ({REPO}) | Winner | Delta |
|------------|-------------------|---------------------|--------|-------|
| {cap 1}    | {how incumbent does it} | {how challenger does it} | {winner} | {marginal/significant/transformative} |
| {cap 2}    | ... | ... | ... | ... |

**Summary:** {honest assessment — what challenger does better, what incumbent does better, is the delta worth the switching cost}

{if no incumbent: "New domain for {PROJECT} — no incumbent comparison."}

## Already Done in {PROJECT}

{For each capability where the matrix shows `overlap` or where the incumbent comparison shows `winner: incumbent`:}
| Capability | Current Solution | Where | Notes |
|------------|-----------------|-------|-------|
| {cap} | {how {PROJECT} does it} | {files/packages} | {any delta the challenger offers} |

## Future Opportunities

{For capabilities classified as future or deferred:}
| Capability | Blocker | When Viable | Potential Value |
|------------|---------|-------------|----------------|
| {cap} | {what's missing in {PROJECT}} | {condition} | {what it would enable} |

## Integration Plan

{only if verdict = INTEGRATE}

1. {step — exact command or action}
2. {step}
...

### Environment Variables
| Variable | Purpose | Where to add |
|----------|---------|-------------|
| ... | ... | Project env config |

### Files to Create
| Path | Purpose |
|------|---------|
| ... | ... |

### Files to Modify
| Path | Change |
|------|--------|
| ... | ... |

### Project-Side Changes (if any)
| Change | Files | Ticket-ready? |
|--------|-------|---------------|
| ... | ... | Yes — /spec ready |

## Testing Strategy

{from 4e}

## Decision Points

{all from 4g, numbered}

## Rollback Plan

{how to fully revert: packages to remove, files to delete, config to restore}

## Changelog

| Date | Verdict | Incumbent | Notes |
|------|---------|-----------|-------|
| {date} | {verdict} | {incumbent at the time} | Initial |

<details>
<summary>Raw Agent Outputs</summary>

### Agent 1: Repo Architecture
{full output}

### Agent 2: Security + Ecosystem
{full output}

### Agent 3: Project Compatibility + Incumbent Comparison
{full output}

### NotebookLM Queries
{query responses}
</details>
```

**On re-assessment:** Read the existing file. Preserve everything above the `---` separator (the library top-half). Read the existing changelog table. Replace the entire assessment bottom-half with fresh analysis, appending a new changelog row:

```
| {new date} | {new verdict} | {current incumbent} | Re-assessment: {what changed — e.g., "project removed Resend", "repo added feature X"} |
```

### 5b. Vault — Current Picks + Library

Read `~/Desktop/RiskNeutral/Vaults/Matrix-GitHub/Integrations.md`.
- If file doesn't exist: create it with the structure below.

The vault file has two sections:

**Section 1: Current Picks (regenerated on every write)**

Scan all `.claude/runs/*.md` files. For each domain, find the repo with verdict=INTEGRATE or verdict=UPGRADE (or note the built-in solution). When rebuilding, filter `.claude/runs/*.md` to only include entries that have an assessment for the current `{PROJECT}`. Rebuild the table:

```markdown
# Integration Library

## Current Picks

What {PROJECT} uses now for each domain. Regenerated on every assessment.

| Domain | Current Solution | Type | Since | Detail |
|--------|-----------------|------|-------|--------|
| {domain} | {OWNER}/{REPO} | {type} | {date} | `.claude/runs/{file}` |
| {domain} | {incumbent name} (KEEP_CURRENT over {REPO}) | built-in | — | `.claude/runs/{file}` |
| {domain} | {package} (UPGRADE available via {REPO}) | built-in | — | `.claude/runs/{file}` |
```

Skip `verdict=REFERENCE` entries in Current Picks — they are knowledge, not solutions.

**Section 2: Library (grouped by domain, permanent)**

If `## {OWNER}/{REPO}` already exists under the domain heading: replace that entry (re-assessment).
Otherwise: append under the correct `### {Domain}` heading (create heading if new domain).

```markdown
## Library

### {Domain}

#### {OWNER}/{REPO} — {YYYY-MM-DD}

**Verdict:** {verdict} | **Risk:** {level} | **Type:** {type}

{2-3 sentence summary: what it does, why the project wants it or why it was assessed, key finding}

**vs Incumbent:** {one-line: "No incumbent", "Comparable to Resend — not worth switching", "Significantly better at X than current solution", etc.}

**Matrix highlights:**
- {most impactful cell 1: capability x layer = path}
- {most impactful cell 2}
- {most impactful cell 3}

**Project changes proposed:** {bullet list of project-side adaptations, or "None — fits as-is" or "N/A — KEEP_CURRENT"}

Detail: `.claude/runs/{OWNER}-{REPO}.md`
```

### 5c. Skeleton Update (idempotent)

If `.SKELETON.md` exists in CWD: check if `Integrations` already appears in the Reference Docs table.
- If not: add row `| Integrations matrix | ~/Desktop/RiskNeutral/Vaults/Matrix-GitHub/Integrations.md |`
- If already present: skip.

If no `.SKELETON.md`: skip this step.

### 5d. NotebookLM Note

Create a note in the `Matrix — GitHub` notebook for cross-repo querying:

```
note(notebook_id=..., action="create", title="{OWNER}/{REPO} — Matrix Digest", content="{verdict} ({YYYY-MM-DD}). Incumbent: {INCUMBENT}. {2-3 sentence summary}. Key capabilities: {list}. Project layers touched: {list}. Risk: {level}. Domain: {DOMAIN}.")
```

### 5e. Conversation Output

Print summary:

```
{OWNER}/{REPO} — Matrix Complete
----------------------------------
Domain: {domain}
Type: {type}
Risk: {level}
Maintenance: {status}

Incumbent: {name} | Switching cost: {level}
Verdict: {INTEGRATE / KEEP_CURRENT / DEFER / REJECT / UPGRADE / REFERENCE}
Reason: {one sentence}

Matrix:
{condensed matrix — top 5 capabilities only, or full if <=5}

vs Incumbent: {summary line}
Project changes: {count} proposed ({list of layers affected, or "None"})
Automation: {count} interactive steps identified, {count} fully automatable

Library: {N} total entries for {DOMAIN} domain

Saved:
  Detail  -> .claude/runs/{OWNER}-{REPO}.md
  Vault   -> Architecture/Integrations.md
  KB      -> NotebookLM "Matrix — GitHub"
```

If there are decision points, present the FIRST one immediately:

```
Decision 1 of {N}: {question}
  A) {recommended} <- recommended
  B) {alternative}
  C) Something else — describe
```

Wait for Matt's answer before presenting the next decision.

---

## Phase 6: Comparison (--compare mode only)

This phase runs only when `--compare` flag was used with multiple URLs. All repos have completed Phases 0-5 individually by this point.

### 6a. Head-to-Head Table

Build a comparison table across all repos:

```markdown
## Head-to-Head: {DOMAIN}

|                    | {REPO_1}        | {REPO_2}        | {REPO_3}        |
|--------------------|-----------------|-----------------|-----------------|
| **Verdict**        | {verdict}       | {verdict}       | {verdict}       |
| **Risk**           | {level}         | {level}         | {level}         |
| **Maintenance**    | {status}        | {status}        | {status}        |
| **Project changes**| {count}         | {count}         | {count}         |
| **Switching cost** | {level}         | {level}         | {level}         |
| **Bundle size**    | {size}          | {size}          | {size}          |
| **Key strength**   | {one line}      | {one line}      | {one line}      |
| **Key weakness**   | {one line}      | {one line}      | {one line}      |
```

### 6b. Capability Comparison

For each capability that appears in any repo's matrix:

```
{Capability}: {REPO_1}={cell} | {REPO_2}={cell} | {REPO_3}={cell}
```

### 6c. Recommendation + Decision

```markdown
**Recommendation:** {REPO_X} for {DOMAIN}
**Why:** {2-3 sentences comparing the finalists}

Decision: Which repo to integrate for {DOMAIN}?
  A) {REPO_1} — {one-line case} <- {recommended if applicable}
  B) {REPO_2} — {one-line case}
  C) {REPO_3} — {one-line case}
  D) None — keep current / defer all
```

All repos remain in the library regardless of which wins.

---

## Phase 7: Cleanup

```bash
rm -rf "/tmp/{OWNER}-{REPO}"
```

---

## Edge Cases

### Private repos
`gh repo view` works if `gh auth` is configured. If not:
`"Cannot access {OWNER}/{REPO}. If private: ! gh auth login"`

### Monorepos
Detect via: root contains `packages/`, `apps/`, `crates/`, `modules/`, or `lerna.json` / `pnpm-workspace.yaml`.
1. List top-level packages with one-line descriptions
2. Ask: `"This is a monorepo. Which package? (list options)"`
3. Re-scope all analysis to that sub-package's directory within the clone

### Non-code repos (docs, awesome-lists, datasets)
If no package manifest AND no `src/` directory:
1. Classify as `reference` type
2. Skip compatibility matrix — produce a shortened library entry
3. Still add to NotebookLM (the docs ARE the value)
4. Append to vault library with verdict `REFERENCE`
5. Ask: `"This is reference material, not an integration target. Useful for {PROJECT}? (yes — save to vault / no — discard)"`

### Already-installed packages
If the repo's npm package name appears in the project's package manifest:
1. Note current version vs latest
2. Switch to **upgrade analysis** mode:
   - Breaking changes between versions
   - Migration path
   - Project files affected by upgrade
3. Verdict becomes `UPGRADE` instead of `INTEGRATE`

### Re-assessment
If `.claude/runs/{OWNER}-{REPO}.md` exists and user chooses re-assess:
- Library top-half is preserved (capabilities, architecture, security — these are properties of the repo)
- Assessment bottom-half is recomputed against the project's current code
- Changelog table is preserved and appended to
- NLM sources are NOT re-added if they already exist (dedup by title)
- Vault library entry is replaced (not appended) under the same domain heading
- Current Picks table is regenerated from all entries

---

## Rules

1. **Run immediately.** No preamble, no methodology recap.
2. **Never auto-install.** Output is always a plan. Matt decides.
3. **No blocking gates.** Every repo gets full analysis regardless of license or maintenance status. You're learning patterns, not copying code.
4. **Project is adaptable.** Every clash gets an adaptation spec — repo side, project side, or both.
5. **One decision at a time.** Present decision points sequentially, wait for each answer.
6. **Parallel agents.** All three Phase 2 agents run simultaneously.
7. **Centralized stores.** One NotebookLM notebook, one vault file. Never create per-repo.
8. **Adaptation specs are ticket-ready.** Project-side changes should be detailed enough to go straight to `/spec`.
9. **Automation specs are skill-ready.** Interactive step specs should be detailed enough to implement directly.
10. **Any language.** Works for JS, Python, Rust, Go, Java, Ruby, C++, or any repo.
11. **Target 2-3 minutes.** Clone is fast (depth 1). Agents run in parallel. NotebookLM adds ~30s.
12. **Library is permanent.** Every assessed repo stays in NLM + Vault + detail file forever. KEEP_CURRENT and REJECT repos are library entries, not deletions. The library is the shelf you can always go back to.
13. **Verdicts are temporal.** They reflect the project's code state at assessment time. A KEEP_CURRENT today might be INTEGRATE next month if the project's code changes. Re-assessment recomputes the verdict.
14. **Incumbent advantage.** Working, tested, integrated code gets credit. Challengers must demonstrate meaningful improvement — not just difference. "Different API" is not better.
15. **Never auto-switch.** When an incumbent exists, always present the comparison and let Matt decide. The default recommendation is KEEP_CURRENT unless the delta is significant or transformative.
16. **Current Picks table is regenerated.** Every vault write rebuilds the Current Picks table from detail file state. It is a derived view, not manually maintained.
17. **NLM sources are deduplicated.** Check existing source titles before adding. Five runs of the same repo = one set of sources.
