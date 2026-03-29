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

## Usage

```
/matrix-youtube <youtube-url>
/matrix-youtube <youtube-url-1> <youtube-url-2>
/matrix-youtube <youtube-url-1> <youtube-url-2> --compare
```

Accepts any YouTube URL format:
- `https://www.youtube.com/watch?v=...`
- `https://youtu.be/...`
- `https://youtube.com/watch?v=...`
- `https://www.youtube.com/live/...`

Multiple URLs: process each sequentially through the full pipeline.

With `--compare`: process each video through Phases 0-7, then run Phase 8 (Comparison) across all results.

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

### 0a. Parse URL

Extract video ID from URL:
- `youtube.com/watch?v={ID}` -> extract `v` parameter
- `youtu.be/{ID}` -> extract path
- `youtube.com/live/{ID}` -> extract path
- Strip any query params after the ID (`&t=`, `&list=`, etc.)

Result: `VIDEO_ID` variable.

If no valid YouTube URL found: print usage hint and stop.

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

### 2a. Primary Extraction

Query the notebook for a structured, deduplicated technical outline:

```
notebook_query(notebook_id=..., query="From the video '{TITLE}':
Create a comprehensive technical outline of every unique concept, technique,
tool, command, and recommendation presented.

Rules:
- Remove ALL repetition, filler, promotional content, and verbal padding
- Preserve EXACT tool names, library names, commands, configuration details
- Preserve EXACT actionable steps and implementation details
- Include timestamps for key moments (e.g., [12:34])
- Group by TOPIC, not by video timeline
- Each point should be a distinct, non-overlapping idea
- If a technique is mentioned multiple times, consolidate into one entry with all details

Format as a structured outline with clear headers and bullet points.")
```

### 2b. Depth Extraction

Second query for implementation-level detail:

```
notebook_query(notebook_id=..., query="From the video '{TITLE}':
What specific implementation details are demonstrated or recommended?
For each technique or tool mentioned:
- What problem does it solve?
- What are the prerequisites or dependencies?
- What are the exact steps to implement it?
- What are the gotchas, warnings, or failure modes mentioned?
- Are there specific code patterns, architecture decisions, or configuration shown?
Cite timestamps where available.")
```

### 2c. Assemble Outline

Merge responses from 2a and 2b into a single structured outline. Deduplicate any overlap between the two queries. This merged outline is the permanent library content.

Derive `TOPIC` from the outline content. Use a short slug:
- `ai-agents`, `testing`, `architecture`, `devops`, `design`, `performance`, `security`, `database`, `frontend`, `backend`, `business`, `diving`, `workflow`, `deployment`, `observability`, `other`

Not a fixed set — pick the most accurate slug. Create topic folder on demand.

---

## Phase 3: NLM Deep Query

After Phase 2 completes, query the `Matrix — YouTube` notebook for deeper understanding before project analysis.

### 3a. Video-Scoped Query

```
notebook_query(notebook_id=..., query="From '{TITLE}': What are the key implementation patterns, and what prerequisites does each require?")
```

Use to enrich the outline with details NLM extracted that the structured queries in Phase 2 may have missed.

### 3b. Cross-Video Query (conditional)

When `.claude/runs/yt-*.md` files exist with the same `topic:` field, query across videos:

```
notebook_query(notebook_id=..., query="Compare techniques from '{TITLE}' against other {TOPIC} videos: What overlaps? What's new? Which video's approach is more practical for a Next.js + Convex stack?")
```

Pick up to 3 prior videos for comparison: prioritize most recent date.

Store the response as `CROSS_VIDEO_COMPARISON` for use in Phase 4.

This works because all prior videos' transcripts are already in the shared NLM notebook — cross-video queries are native.

---

## Phase 4: Project Analysis — 2 Parallel Agents

Launch both simultaneously after Phase 3 completes.

### Agent 1: Technique Mapping

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
- `already-done` — {PROJECT} already does this or something equivalent. Note where (file/skill/hook).
- `not-applicable` — Doesn't apply to {PROJECT}'s architecture, domain, or tech stack (e.g., Java-specific, mobile-native, irrelevant domain).
- `future` — Would be valuable but depends on features {PROJECT} doesn't have yet. Note the dependency.

### Agent 2: Implementation Specs

**Prompt the agent with:** For each technique classified as `applicable` by Agent 1, design a concrete {PROJECT} implementation.

**Note:** Agent 2 must wait for Agent 1's classification output. If running in parallel, Agent 2 should read the same outline and project files, and produce specs for ALL techniques — the applicable filter is applied when merging results in Phase 4.

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

```markdown
# {Video Title}

**Source:** [{url}]({url})
**Channel:** {channel name}
**Analyzed:** {YYYY-MM-DD}
**Topic:** {topic}

## Outline

{the full deduplicated structured outline from Phase 2 -- this IS the permanent value}

## Project Applicability

{N} of {N} techniques applicable to {PROJECT}.

| Technique | Status | Implementation |
|-----------|--------|---------------|
| {name} | applicable | {what to build} |
| {name} | already-done | {where in {PROJECT}} |
| ...    | ... | ... |

Detail: `.claude/runs/yt-{VIDEO_ID}.md`
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
