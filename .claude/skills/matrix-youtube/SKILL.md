---
name: matrix-youtube
description: >
  Extract structured knowledge from YouTube videos and map to current project implementations.
  Library-first: every video is permanently ingested into NotebookLM + Vault. Techniques
  are classified against the project's current code and produce ticket-ready implementation specs
  for skills, hooks, agents, and patterns.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion, WebFetch, mcp__perplexity__perplexity_search, mcp__perplexity__perplexity_ask, mcp__notebooklm-mcp__notebook_create, mcp__notebooklm-mcp__notebook_list, mcp__notebooklm-mcp__notebook_get, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__source_add, mcp__notebooklm-mcp__source_list_drive, mcp__notebooklm-mcp__note, mcp__notebooklm-mcp__tag
user-invocable: true
---

# /matrix-youtube — YouTube Video Integration Matrix

Extract structured knowledge from any YouTube video and map it to concrete project implementations. Produces a deduplicated technical outline, classifies each technique against the project's current code, and generates ticket-ready specs for applicable techniques.

**Library-first architecture:** Every video is permanently ingested into NotebookLM + Vault as a library entry. The outline (what the video teaches) is permanent. The project assessment (which techniques apply and how) is temporal — recomputable when the project changes.

**Run immediately. No preamble.**

---

## Project context

When assessing a video against DiveDispatch, these files are ground truth:

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

Techniques must be evaluated against current code, not generic best practices. Propose a technique only after grepping `convex/lib/` and `src/lib/` for existing implementations.

---

## Usage

```
/matrix-youtube <youtube-url>
/matrix-youtube <youtube-url-1> <youtube-url-2>
/matrix-youtube <youtube-url-1> <youtube-url-2> --compare
/matrix-youtube review
/matrix-youtube review <video-id>
```

Accepts any YouTube URL format:
- `https://www.youtube.com/watch?v=...`
- `https://youtu.be/...`
- `https://youtube.com/watch?v=...`
- `https://www.youtube.com/live/...`

Multiple URLs: process each sequentially through the full pipeline.

With `--compare`: process each video through Phases 0-7, then run Phase 8 (Comparison) across all results.

With `review`: skip analysis, go straight to the interview phase (Phase 9). Reviews all applicable findings across the library that don't have tickets yet. With a video ID, reviews only that video's findings.

---

## Phase 0: Read Project Config

Before anything else, load the project's Matrix Config.

### 0-config. Extract Config from CLAUDE.md

1. Read the CWD's `CLAUDE.md` file.
2. Find the `## Matrix Config` section.
3. Extract:
   - `{PROJECT}` — the `project:` value (e.g., "DiveDispatch")
   - `{VAULT}` — the `vault:` path (e.g., "~/Desktop/RiskNeutral/Vaults/DiveDispatch")
   - `{KEY_FILES}` — the list under `key_files:`, each entry is `path — description`
4. Derive `{PROJECT_LAYERS}` from `{KEY_FILES}` — group paths by their top-level directory (e.g., `convex/schema.ts` and `convex/bookings/` both map to `convex`; `src/lib/hooks/` maps to `src`; `.claude/skills/` maps to `.claude`). Each unique top-level directory plus any standalone files (like `package.json`, `CLAUDE.md`) becomes a layer name. Use these as the valid classification values for `project_layers` in Phase 4.

If the `## Matrix Config` section is missing from CLAUDE.md:
```
Matrix Config not found in CLAUDE.md.

Add a ## Matrix Config section with:
  - project: {project name}
  - vault: {vault base path}
  - key_files: {list of files to read for assessment}

See DiveDispatch/CLAUDE.md for an example.
```
Stop.

Store these variables for use throughout the pipeline: `{PROJECT}`, `{VAULT}`, `{KEY_FILES}`, `{PROJECT_LAYERS}`.

---

## Centralized Stores

| Store | Location | Pattern |
|-------|----------|---------|
| **NotebookLM** | Notebook titled `Matrix — YouTube` | Find-or-create once. Add video URL as source (deduped). Cross-video queries work natively. |
| **Vault** | `~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/{topic}/{slug}.md` | Full outline + project summary. Topic folders created on demand. Index.md regenerated. |
| **Skeleton** | `.SKELETON.md` -> Reference Docs table (if file exists) | Add `YouTube library` row pointing to `~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/Index.md`. Once, idempotent. |
| **Detail** | `.claude/runs/yt-{video-id}.md` | Per-video file. Top half = Library (permanent outline). Bottom half = Assessment (temporal project analysis). |

---

## Phase 0a: Parse + Gate

### 0a. Parse Arguments

If argument is `review` or `review <video-id>`: jump directly to **Phase 9 (Review Mode)**. Skip all other phases.

Otherwise, extract video ID from URL:
- `youtube.com/watch?v={ID}` -> extract `v` parameter
- `youtu.be/{ID}` -> extract path
- `youtube.com/live/{ID}` -> extract path
- Strip any query params after the ID (`&t=`, `&list=`, etc.)

Result: `VIDEO_ID` variable.

If no valid YouTube URL found and not `review`: print usage hint and stop.

### 0b. Check Existing Entry

```bash
ls .claude/runs/yt-{VIDEO_ID}.md 2>/dev/null
```

If exists:

1. Read the file. Extract from frontmatter: `title`, `assessed` date, `topic`, and from the assessment section: technique count, applicable count.

2. Detect what changed since last assessment:
   - **Project side:** Quick scan of `package.json` mtime, key schema/config files from `{KEY_FILES}` mtime, `.claude/skills/` listing, `.claude/settings.json` mtime. If any are newer than `assessed` date -> flag as `PROJECT_CHANGED`.

3. Print rich gate:
   ```
   Already in library ({YYYY-MM-DD}):
     "{title}"
     Topic: {topic} | Techniques: {N applicable} of {N total}

   {PROJECT} changes: {detected / none since last assessment}

     A) Skip — verdict still valid <- default if no changes
     B) Re-assess — recompute {PROJECT} analysis against current code <- default if changes detected
     C) View existing — show the full file
   ```

4. **Skip:** Print existing summary and stop.
5. **View existing:** Read and display the full file, stop.
6. **Re-assess:** Continue. Preserve library top-half, recompute assessment bottom-half. Do NOT re-add NLM source (dedup). Skip Phase 1 clone. Preserve changelog rows, add new row.

### 0c. Fetch Video Metadata

```bash
gh api -X GET "https://noembed.com/embed?url=https://www.youtube.com/watch?v={VIDEO_ID}" 2>/dev/null
```

Extract: `title`, `author_name` (channel). If fails, try WebFetch on the YouTube URL and parse the `<title>` tag.

If video is unavailable (private, deleted): `"Cannot access video. It may be private, deleted, or age-restricted."` — stop.

---

## Phase 1: NLM Ingest

### 1a. Find or Create Notebook

1. `notebook_list()` — search for notebook titled `Matrix — YouTube`
2. If not found: `notebook_create(title="Matrix — YouTube")`

### 1b. Source Dedup Check

`source_list_drive(notebook_id=...)` — check if a source URL matching this video ID already exists. If so, skip adding. Five runs of the same video = one source.

### 1c. Add Source

```
source_add(notebook_id=..., source_type="url", url="https://www.youtube.com/watch?v={VIDEO_ID}")
```

NotebookLM will process the video transcript.

### 1d. Tag Notebook

```
tag(action="add", notebook_id=..., tags="matrix,youtube,{TOPIC}")
```

(Topic is determined after Phase 2. Tag can be added then.)

---

## Phase 2: Extract Outline

### 2a. Single Comprehensive Extraction

One query captures everything. Do NOT split into multiple queries — prior runs showed 80%+ overlap between separate technique/implementation/organizational queries, wasting ~30K tokens.

```
notebook_query(notebook_id=..., query="From the video '{TITLE}':
Create a comprehensive, deduplicated outline of EVERYTHING taught. Cover ALL of these dimensions in a SINGLE pass:
- Techniques, tools, commands, libraries — with implementation steps, prerequisites, gotchas
- Organizational principles — what goes where, file/directory structure, routing rules
- Decision frameworks — when to use X vs Y, criteria, thresholds, rules of thumb
- Anti-patterns and warnings — what NOT to do, failure modes, and why
- Mental models, philosophy, and reasoning about why things matter
- Configuration examples — actual file contents, directory layouts shown
- Workflow sequences — multi-step processes, not just individual tools

Rules:
- Remove ALL repetition, filler, promotional content, verbal padding
- Preserve EXACT tool names, library names, commands, configuration details
- Preserve EXACT implementation steps and organizational advice
- Include timestamps for key moments (e.g., [12:34])
- Group by TOPIC, not by video timeline
- Each point = one distinct idea. Consolidate repeats into single entries.

Format as structured outline with clear headers and bullet points.")
```

**IMPORTANT — NLM response handling:** Extract ONLY the `answer` field from the NLM response. Discard the `references`, `citations`, and `cited_text` arrays entirely — they contain raw transcript excerpts (~15K tokens per query) that are never used downstream. The answer field contains everything needed for the outline.

### 2b. Assemble Outline

The single query response IS the outline. Clean up formatting if needed but do not re-query. This is the permanent library content.

Derive `TOPIC` from the outline content. Use a short slug:
- `ai-agents`, `testing`, `architecture`, `devops`, `design`, `performance`, `security`, `database`, `frontend`, `backend`, `business`, `diving`, `workflow`, `deployment`, `observability`, `other`

Not a fixed set — pick the most accurate slug. Create topic folder on demand.

---

## Phase 3: Cross-Video Query (conditional)

Phase 2's single comprehensive query already covers techniques, implementation details, AND organizational/philosophical content. No additional video-scoped query is needed.

### 3a. Cross-Video Query (conditional)

When `.claude/runs/yt-*.md` files exist with the same `topic:` field, query across videos:

```
notebook_query(notebook_id=..., query="Compare techniques from '{TITLE}' against other {TOPIC} videos: What overlaps? What's new? Which video's approach is more practical for a Next.js + Convex stack?")
```

Pick up to 3 prior videos for comparison: prioritize most recent date.

Store the response as `CROSS_VIDEO_COMPARISON` for use in Phase 4.

This works because all prior videos' transcripts are already in the shared NLM notebook — cross-video queries are native.

---

## Phase 4: Project Analysis — Sequential Agents

**IMPORTANT: Sequential, not parallel.** Agent 1 classifies first. Agent 2 specs ONLY applicable techniques. Prior runs showed parallel execution wasted ~70% of Agent 2's work speccing techniques that turned out to be already-done.

### Agent 1: Technique Mapping (run first)

Launch with `model: "sonnet"`.

**Prompt the agent with:** Read the outline below and classify each technique against {PROJECT}'s current codebase.

Provide the outline from Phase 2. Have the agent read the files listed in `{KEY_FILES}` (reading directory listings for directory entries, file contents for file entries).

For each distinct technique in the outline, classify:

```
TECHNIQUES:
  {technique_name}:
    classification: {applicable|already-done|not-applicable|future}
    reasoning: {one line — why this classification}
    project_overlap: {what {PROJECT} already has that's similar, or "None"}
    project_layers: [{layers derived from {PROJECT_LAYERS}}]
    timestamp: {from video, if available}

  ...
```

Classification rules:
- `applicable` — {PROJECT} should adopt this. The technique solves a real problem or improves an existing pattern. {PROJECT} has the infrastructure to support it.
- `already-done` — {PROJECT} already implements the **specific techniques**, not just the concept. Verify each sub-technique individually against the codebase — having a related file, directory, or tool is NOT sufficient. The actual workflow or pattern must exist and be in active use. When in doubt, classify as `applicable`.
- `not-applicable` — **Architecturally incompatible** with the project: requires a completely different tech stack, targets a domain that doesn't exist here, or is physically impossible given the project's constraints (e.g., Java-specific technique in a Node project, mobile-native API on a web app). "I can't immediately see how" is NOT sufficient — default to `applicable` or `future` when uncertain. Reserve `not-applicable` only for techniques that could never apply regardless of future project direction.
- `future` — Would be valuable but depends on features {PROJECT} doesn't have yet. Note the dependency.

### Agent 2: Implementation Specs (run after Agent 1 completes)

Launch with `model: "sonnet"` ONLY after Agent 1 returns classifications.

**Prompt the agent with:** Agent 1 classified these techniques as `applicable`: {list only the applicable technique names and their one-line reasoning}. For each, design a concrete {PROJECT} implementation.

Have the agent read the files listed in `{KEY_FILES}` relevant to the applicable techniques' `project_layers`.

For each applicable technique, produce:

```
SPECS:
  {technique_name}:
    build: {skill|hook|agent|schema-change|new-pattern|config-change|dependency|refactor}
    summary: {2-3 sentences — what to build and why}
    project_files: [{list of project files to create or modify}]
    effort: {S|M|L}
    risk: {what could go wrong}
    steps:
      1. {concrete implementation step}
      2. {step}
      ...
    ticket_ready: {true|false — is this detailed enough for /spec?}

    skill_spec: {if build=skill}
      name: {skill name}
      trigger: {when to invoke}
      tools: {allowed-tools}

    hook_spec: {if build=hook}
      type: {PreToolUse|PostToolUse}
      matcher: {tool pattern}
      logic: {what it checks}

    agent_spec: {if build=agent}
      type: {subagent_type}
      when: {when to spawn}
      autonomy: {interactive|autonomous}
```

If there are 0 applicable techniques, skip Agent 2 entirely.

---

## Phase 5: Build Output

### 5a. Technique Table

Merge Agent 1 classifications and Agent 2 specs. Build the summary table:

```
| # | Technique | Classification | Risk | Implementation | Test Type | Effort | Project Layers |
|---|-----------|---------------|------|----------------|-----------|--------|----------------|
| 1 | {name}    | applicable    | LOW  | New skill      | hook      | S      | .claude/skills |
| 2 | {name}    | already-done  | ---  | ---            | ---       | ---    | convex/lib |
| 3 | {name}    | applicable    | MED  | Hook + config  | unit      | M      | .claude/settings |
| 4 | {name}    | not-applicable| ---  | ---            | ---       | ---    | --- |
| 5 | {name}    | future        | ---  | ---            | ---       | ---    | {dependency} |
```

### 5b. Implementation Specs

For each `applicable` technique, write a ticket-ready spec:

```markdown
### Spec: {Technique Name}
**Source:** {video title} at [{timestamp}]
**Build:** {skill|hook|agent|schema-change|new-pattern|config-change}
**Project layers:** {which layers}
**Files affected:** {list}
**Effort:** S / M / L
**Risk level:** LOW / MEDIUM / HIGH / CRITICAL
**Test type:** unit / behavioral / integration / e2e / hook
**Risk:** {what could go wrong}

**What it does:**
{2-3 sentences describing what this adds to {PROJECT} and why it matters}

**How to build it:**
1. {concrete step with file paths}
2. {step}
...

**Ticket-ready:** Yes -- /spec ready
```

### 5c. Decision Points

For techniques where classification is ambiguous or where multiple implementation approaches exist:

```markdown
**Decision {N}:** {technique name} -- {the question}
- **A)** {recommended approach} <- recommended
- **B)** {alternative}
- **C)** {free-form}
- **Impact:** {what changes based on the answer}
```

### 5d. Risk Assessment

For each applicable technique, classify risk based on implementation scope:

| Level | Criteria |
|-------|----------|
| **LOW** | No project code changes, config-only, skill or hook addition, no new deps |
| **MEDIUM** | New dependency, touches utility/lib layers, <5 files affected |
| **HIGH** | Touches schema/data layer, changes state machine or core logic, >5 files, new env vars |
| **CRITICAL** | Touches core invariants, requires data migration, security implications |

Add `risk_level: {LOW|MEDIUM|HIGH|CRITICAL}` to each technique's spec in the technique table (Phase 5a).

### 5e. Testing Strategy

For each applicable technique's implementation spec, recommend the cheapest test type that catches regressions:

- **Unit tests** -- pure functions: validation, calculation, transformation added by the technique
- **Behavioral tests** -- mutations and state transitions introduced by the technique
- **Integration tests** -- multi-step chains where the technique's output feeds existing logic
- **E2E tests** -- only when the technique adds frontend<->backend wiring
- **Hook tests** -- verify enforcement hooks block correctly (if build=hook)

Add `test_type: {unit|behavioral|integration|e2e|hook}` to each applicable technique's implementation spec.

---

## Phase 6: Write + Output

### 6a. Detail File

Write `.claude/runs/yt-{VIDEO_ID}.md`:

**Top half -- Library (permanent, survives re-assessment):**

```markdown
---
video_id: {VIDEO_ID}
url: https://www.youtube.com/watch?v={VIDEO_ID}
title: {video title}
channel: {channel name}
assessed: {YYYY-MM-DD}
topic: {topic slug}
technique_count: {N}
---

# {Video Title} -- Library Entry

**Channel:** {channel name}
**Topic:** {topic}
**URL:** {url}

## Outline

{the full deduplicated structured outline from Phase 2}

## Techniques Identified

{numbered list of all techniques with one-line descriptions and timestamps}
```

**Bottom half -- Assessment (temporal, recomputed on re-assessment):**

```markdown
---

# {PROJECT} Assessment — {YYYY-MM-DD}

**Applicable:** {N} | **Already done:** {N} | **Not applicable:** {N} | **Future:** {N}

## Technique Table

{full table from 5a}

## Implementation Specs

{all specs from 5b -- only for applicable techniques}

## Already Done in {PROJECT}

{for each already-done technique: what {PROJECT} has and where}

## Future Opportunities

{for each future technique: what {PROJECT} would need first}

## Decision Points

{from 5c}

## Changelog

| Date | Applicable | Already Done | Notes |
|------|-----------|-------------|-------|
| {date} | {N} | {N} | Initial assessment |
```

**On re-assessment:** Read the existing file. Preserve library top-half. Read existing changelog. Replace assessment bottom-half, append changelog row:

```
| {new date} | {N} | {N} | Re-assessment: {what changed in {PROJECT}} |
```

### 6b. Vault File

Derive slug from video title: lowercase, spaces to hyphens, strip special characters, max 60 chars.

Create topic directory if needed:
```bash
mkdir -p ~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/{TOPIC}/
```

Write `~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/{TOPIC}/{slug}.md`:

**Vault file is a summary + pointer — NOT a duplicate of the outline.** The full outline lives only in the detail file (`.claude/runs/yt-{VIDEO_ID}.md`). This saves ~2-5K tokens per video.

```markdown
# {Video Title}

**Source:** [{url}]({url})
**Channel:** {channel name}
**Analyzed:** {YYYY-MM-DD}
**Topic:** {topic}

## Key Takeaways

{3-5 bullet points — the most important non-obvious insights from the video}

## Project Applicability

{N} of {N} techniques applicable to {PROJECT}.

| Technique | Status | Implementation |
|-----------|--------|---------------|
| {name} | applicable | {what to build} |
| {name} | already-done | {where in {PROJECT}} |
| ...    | ... | ... |

**Full outline:** `.claude/runs/yt-{VIDEO_ID}.md`
```

### 6c. Vault Index

Read `~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/Index.md`. If doesn't exist, create it.

Regenerate the full index from all vault files:

```markdown
# YouTube Library

All videos analyzed via /matrix-youtube. Grouped by topic.

## {Topic}

| Video | Channel | Date | Applicable | Detail |
|-------|---------|------|-----------|--------|
| [{title}]({topic}/{slug}.md) | {channel} | {date} | {N}/{total} | `.claude/runs/yt-{id}.md` |
```

### 6d. Skeleton Update (conditional)

Check if `.SKELETON.md` exists in the project root.

If it exists:
1. Read `.SKELETON.md`. Check if `YouTube library` already appears in the Reference Docs table.
2. If not: add row `| YouTube library | ~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/Index.md |`
3. If already present: skip.

If `.SKELETON.md` does not exist: skip this step entirely.

### 6e. NotebookLM Note

Create a note in the `Matrix — YouTube` notebook:

```
note(notebook_id=..., action="create", title="{Video Title} — Matrix Digest",
  content="{topic}. {N}/{total} techniques applicable to {PROJECT}.
  Applicable: {list of applicable technique names}.
  Already done: {list}.
  Key insight: {one sentence -- the most valuable takeaway for {PROJECT}}.")
```

### 6f. Tag Update

Now that topic is known:
```
tag(action="add", notebook_id=..., tags="matrix,youtube,{TOPIC}")
```

### 6g. Conversation Output

```
{Video Title} -- Matrix Complete
------------------------------------
Channel: {channel}
Topic: {topic}
Techniques: {N total} -- {N applicable}, {N already-done}, {N not-applicable}, {N future}
Specs: {N} ticket-ready

{technique table from 5a}

Top spec:
  {highest-effort applicable technique -- name, what to build, effort}

Saved:
  Detail -> .claude/runs/yt-{VIDEO_ID}.md
  Vault  -> ~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/{topic}/{slug}.md
  Index  -> ~/Desktop/RiskNeutral/Vaults/Matrix-YouTube/Index.md
  KB     -> NotebookLM "Matrix — YouTube"
```

If there are decision points, present the FIRST one:

```
Decision 1 of {N}: {question}
  A) {recommended} <- recommended
  B) {alternative}
  C) Something else -- describe
```

Wait for Matt's answer before presenting the next.

### 6h. Interview — Applicable Findings

After all decision points are resolved (or immediately if there are none), run a one-at-a-time interview for every applicable technique.

**Opening digest first:**

```
Key insights from this video:
  1. {most surprising or non-obvious thing the video taught}
  2. {second insight}
  3. {third insight}
  (keep to 3-5, only non-obvious insights — skip things already well-known)

{N} applicable findings for {PROJECT}. Walking through them now.
```

**Then for each applicable technique, one at a time:**

```
Finding {i} of {N}: {technique name}
─────────────────────────────────────
What the video teaches:
  {1-2 sentences — what Nick actually said/showed about this}

How it applies to {PROJECT}:
  {1-2 sentences — specific to the project's current state, not generic}

The benefit:
  {1 sentence — concrete improvement: faster X, fewer Y, prevents Z}

Effort: {S|M|L}  Risk: {LOW|MEDIUM|HIGH}  Build: {skill|hook|agent|refactor|etc}

  A) Yes — create ticket  ← recommended
  B) Skip
  C) Tell me more / discuss
```

Wait for the answer before presenting the next finding.

**If answer is A (create ticket):**

Acquire ticket ID via lockfile counter:
```bash
LOCK=".tickets/.counter.lock"
COUNTER=".tickets/.counter"
for i in 1 2 3 4 5; do
  if (set -C; echo $$ > "$LOCK") 2>/dev/null; then break; fi
  sleep 0.1
done
ACTUAL_MAX=$(ls .tickets/DD-*.md 2>/dev/null | sed 's/.*DD-//;s/\.md//' | sort -n | tail -1)
NUM=$(cat "$COUNTER" 2>/dev/null || echo "${ACTUAL_MAX:-0}")
NEXT=$((NUM + 1))
echo "$NEXT" > "$COUNTER"
rm -f "$LOCK"
```

Write `.tickets/DD-{NEXT}.md`:

```markdown
---
id: DD-{NEXT}
title: "{technique name} — {short benefit phrase}"
status: ready
priority: P2
category: tooling
assigned_to: null
branch: null
blocked_by: []
pr: null
side_effects: [{project_files from spec}]
size: {S|M|L}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

**Source:** {video title} by {channel} — {url}

**Spec:** {summary from spec}

**Changes:**
{numbered steps from spec}

**Risk:** {risk} ({risk_level})

**Acceptance:**
- {concrete outcome, not "spec steps followed"}
- {test_type} tests pass

**Test plan:**
- {test_type}: {what to verify}
```

Confirm: `✓ DD-{NEXT} created.` Then continue to the next finding.

**If answer is B (skip):** Acknowledge and move to next.

**If answer is C (discuss):** Answer the question, then re-present the same finding with A/B/C.

**After all findings:**

```
Done. {N} tickets created: {DD-XXX, DD-XXX, ...}
{N} skipped.

Run /board to review.
```

If zero tickets were created: `No tickets created. Library entry saved — findings available for future review.`

---

## Phase 7: Cleanup

No temp files to clean (NLM processes the video URL directly, no local clone needed).

---

## Phase 8: Comparison (--compare mode only)

This phase runs only when `--compare` flag was used with multiple URLs. All videos have completed Phases 0-7 individually by this point.

### 8a. Head-to-Head Table

Build a comparison table across all videos:

```
| | {Video 1 title} | {Video 2 title} | {Video 3 title} |
|-|-----------------|-----------------|-----------------|
| **Topic** | {topic} | {topic} | {topic} |
| **Techniques** | {N total} | {N total} | {N total} |
| **Applicable** | {N} | {N} | {N} |
| **Already done** | {N} | {N} | {N} |
| **Unique techniques** | {N not in other videos} | {N} | {N} |
| **Key strength** | {one line} | {one line} | {one line} |
| **Key weakness** | {one line} | {one line} | {one line} |
```

### 8b. Technique Overlap

For each technique that appears in multiple videos:
```
{Technique}: {Video 1}={classification} | {Video 2}={classification}
```

Highlight where videos disagree on approach or where one video covers a technique more thoroughly.

### 8c. Recommendation

```markdown
**Best resource for {TOPIC}:** {Video X}
**Why:** {2-3 sentences comparing coverage, depth, and applicability to {PROJECT}}

**Unique value from each:**
- {Video 1}: {what only this video teaches}
- {Video 2}: {what only this video teaches}
```

All videos remain in the library regardless of recommendation.

---

## Edge Cases

### Video with no captions/transcript
NotebookLM requires spoken content to process. If `source_add` fails or returns minimal content:
`"Video has no captions or transcript. NotebookLM cannot process it. Try a video with spoken content."`
Stop. Do not create a library entry.

### Very short video (< 2 minutes)
Likely a clip or trailer. Process normally but expect fewer techniques. If outline extraction returns very little:
`"Short video with minimal technical content. {N} techniques extracted."`
Continue with whatever was found.

### Non-technical video
If the outline extraction finds zero techniques, tools, or actionable recommendations:
1. Still save the outline to vault (it has value as reference material)
2. Skip the project analysis (nothing to map)
3. Mark as `reference` in the detail file
4. `"No technical techniques found. Saved as reference material to vault."`

### Multiple videos
Process each sequentially through Phases 0-7. After all complete, show combined summary:
```
Processed {N} videos:
  1. {title} -- {N applicable}/{N total} techniques
  2. {title} -- {N applicable}/{N total} techniques
  ...
```
If `--compare` flag was used, continue to Phase 8 (Comparison) after the combined summary.

### Video already in library (re-submission)
Handled by Phase 0b rich gate. Key behaviors:
- NLM source is NOT re-added (dedup by URL)
- Library top-half preserved (outline doesn't change)
- Assessment bottom-half recomputed if project changed
- Changelog tracks the re-assessment

### Playlist URLs
If URL contains `&list=`: strip the list parameter, process only the single video. Print note:
`"Playlist detected. Processing single video only. Run /matrix-youtube on each video separately."`

---

## Phase 9: Review Mode (`/matrix-youtube review`)

Triggered by `review` argument. Skips all analysis — works from existing library entries.

### 9a. Load Library

```bash
ls .claude/runs/yt-*.md
```

If no files: `"No videos in library. Run /matrix-youtube <url> to analyze a video first."` Stop.

If a specific video ID was given (`review <video-id>`): load only `.claude/runs/yt-{video-id}.md`. If not found: `"Video {video-id} not in library."` Stop.

### 9b. Collect Applicable Findings

Read each detail file. From the assessment section, extract every technique with `classification: applicable`.

Cross-reference against existing `.tickets/DD-*.md` files: search for ticket titles containing the technique name or the video title. If a ticket already exists for a finding, mark it as `ticketed` and exclude from the interview.

Build the review queue:

```
REVIEW_QUEUE = []
for each detail file:
  for each applicable technique:
    if not already ticketed:
      REVIEW_QUEUE.append({
        video_title, video_url, technique_name,
        summary, steps, effort, risk, risk_level,
        test_type, build_type, project_files
      })
```

If `REVIEW_QUEUE` is empty:
```
All applicable findings already have tickets, or no applicable findings exist.
Library: {N} videos, {N} total techniques, {N} applicable, {N} ticketed.
```
Stop.

### 9c. Library Summary

```
YouTube Library Review
──────────────────────
{N} videos analyzed | {N} applicable findings | {N} already ticketed | {N} to review

Videos:
  {title} ({channel}, {date}) — {N applicable}/{N total}
  {title} ({channel}, {date}) — {N applicable}/{N total}
  ...
```

### 9d. Key Insights Digest

Read the outline sections from each video's detail file. Synthesize 3-5 non-obvious insights across all videos (not just technique names — mental models, anti-patterns, decision frameworks):

```
Key insights across your library:
  1. {most surprising or non-obvious insight}
  2. {second insight}
  3. {third insight}
```

### 9e. Interview — One Finding at a Time

Run the same interview pattern as Phase 6h, but pulling from `REVIEW_QUEUE` across all videos:

```
Finding {i} of {N}: {technique name}
─────────────────────────────────────
Source: {video title} by {channel}

What the video teaches:
  {1-2 sentences}

How it applies to {PROJECT}:
  {1-2 sentences — specific to project's current state}

The benefit:
  {1 sentence — concrete improvement}

Effort: {S|M|L}  Risk: {LOW|MEDIUM|HIGH}  Build: {skill|hook|agent|refactor|etc}

  A) Yes — create ticket  ← recommended
  B) Skip
  C) Tell me more / discuss
```

Wait for answer before next finding. Handle A/B/C exactly as Phase 6h.

### 9f. Review Summary

After all findings reviewed:

```
Review complete.
  {N} tickets created: {DD-XXX, DD-XXX, ...}
  {N} skipped
  {N} already ticketed (not shown)

Run /board to review and queue.
```

---

## Rules

1. **Run immediately.** No preamble, no methodology recap.
2. **Outline quality is everything.** The outline must be exhaustive, deduplicated, and technically precise. Every unique idea, zero filler.
3. **Library is permanent.** Every video stays in NLM + Vault + detail file forever. The outline is the shelf.
4. **Project assessment is temporal.** Technique classifications reflect {PROJECT}'s current code. Re-assessment recomputes them.
5. **Implementation specs are ticket-ready.** Each spec should be detailed enough to go straight to `/spec` then `/board`.
6. **One decision at a time.** Present ambiguous techniques sequentially.
7. **Already-done is valuable.** Confirming {PROJECT} already does something is useful signal, not wasted work.
8. **NLM sources are deduplicated.** Check before adding. Same video = one source.
9. **Vault index is regenerated.** Every write rebuilds Index.md from vault file state.
10. **Topic folders are dynamic.** Created on demand, not a fixed set. Pick the most accurate topic.
11. **Cross-video queries are native.** All videos share one NLM notebook. Query patterns across videos.
12. **Outline before analysis.** Never skip the outline step. Even if no techniques apply to {PROJECT}, the outline has standalone value.
13. **Strip NLM citation blocks.** Every `notebook_query` response contains an `answer` field (~1K tokens) and a `references` array (~15K tokens of raw transcript excerpts). Use ONLY `answer`. Discard `references`, `citations`, and `cited_text` — they are never used downstream and waste ~15K tokens per query.
14. **One NLM query, not three.** Phase 2 uses a single comprehensive query. Prior runs showed 80%+ overlap between technique/implementation/organizational queries. One well-structured query captures everything.
15. **Sequential agents, not parallel.** Agent 1 (classification) must complete before Agent 2 (specs) starts. Agent 2 specs ONLY applicable techniques. Prior runs wasted ~70% of Agent 2's work speccing already-done techniques.
16. **Vault file = summary + pointer.** Full outline lives in the detail file only. Vault file gets key takeaways + applicability table + pointer. No content duplication.
