---
name: research
description: "Fan-out/fan-in research orchestrator. Spawns parallel Sonnet researchers on different axes, synthesizes with Opus. Supports code, web, vault, and mixed research types."
allowed-tools: Read, Glob, Grep, Bash, Agent, WebSearch, WebFetch, mcp__perplexity__perplexity_search, mcp__perplexity__perplexity_ask, mcp__perplexity__perplexity_research, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__cross_notebook_query
user-invocable: true
---

# /research — Fan-out / Fan-in Research Orchestrator

Parallel research on any question. Cheap models explore, expensive model synthesizes.

**Usage:** `/research <question>` or `/research --type=web <question>`

**Execute immediately. No preamble.**

---

## Phase 0: Parse & Route

Extract the question and research type from the input.

**Type detection** (if `--type` not specified, auto-detect):

| Signal | Type |
|--------|------|
| References files, functions, code, schema, architecture | `code` |
| References competitors, market, standards, regulations, pricing | `web` |
| References past decisions, vault, lessons, sessions, "what did we decide" | `vault` |
| Mixed signals or unclear | `mixed` |

**Tool sets per type:**

| Type | Researcher Tools | Notes |
|------|-----------------|-------|
| `code` | Read, Grep, Glob, Bash (readonly) | Codebase exploration only |
| `web` | WebSearch, WebFetch, mcp__perplexity__perplexity_search, mcp__perplexity__perplexity_ask | External research |
| `vault` | Read, Glob, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__cross_notebook_query | Internal knowledge |
| `mixed` | All of the above | Full toolkit |

---

## Phase 1: Axis Generation

Before spawning researchers, decompose the question into 3-5 independent research axes. Each axis explores a different angle of the problem.

**Rules for axis generation:**
- Axes must be genuinely independent — not "part 1, part 2, part 3" of a sequential answer
- Each axis should produce findings that could stand alone
- Overlap between axes is expected and desirable — convergence signals confidence
- At least one axis should be contrarian or adversarial ("what could go wrong", "who disagrees", "what's the counterargument")

**Output format (internal, not displayed):**

```
QUESTION: {original question}
TYPE: {code|web|vault|mixed}
AXES:
  1. {axis name}: {focused sub-question}
  2. {axis name}: {focused sub-question}
  3. {axis name}: {focused sub-question}
  [4. optional]
  [5. optional]
```

Print the axes as a brief status update:

```
Research: {TYPE} | {N} axes
  1. {axis name}
  2. {axis name}
  3. {axis name}
Dispatching researchers...
```

---

## Phase 2: Fan-out (Parallel Sonnet Researchers)

Spawn all researcher agents **in a single message** (parallel execution). Each agent:

- Uses `model: "sonnet"` — cheaper, faster, fresh context
- Uses `subagent_type: "general-purpose"`
- Gets the original question + its specific axis
- Gets tool access scoped to the research type
- Returns structured findings

**Researcher prompt template:**

```
You are a focused researcher investigating one specific angle of a larger question.

ORIGINAL QUESTION: {original_question}
YOUR AXIS: {axis_name}
YOUR SUB-QUESTION: {focused_sub_question}

Research this axis thoroughly using available tools. Return your findings in this exact format:

AXIS: {axis_name}
FINDINGS:
  - CLAIM: {specific factual claim}
    EVIDENCE: {what you found that supports this — file path, URL, quote, data point}
    CONFIDENCE: {high|medium|low}
    SOURCE: {file path, URL, or tool used}

  - CLAIM: {next claim}
    EVIDENCE: ...
    CONFIDENCE: ...
    SOURCE: ...

SURPRISES: {anything unexpected you found that doesn't fit neatly into claims}
GAPS: {what you couldn't find or couldn't verify}
```

**Do not proceed until all researchers return.**

---

## Phase 3: Fan-in (Opus Synthesizer)

Concatenate all researcher outputs into a single payload. Spawn 1 synthesis agent:

- Uses `model: "opus"` — heavy reasoning for integration and judgment
- Uses `subagent_type: "general-purpose"`
- Gets the full researcher output + the synthesis prompt below

**Synthesizer prompt:**

```
You are a synthesis expert. You have received {N} independent research reports
on the question: "{original_question}"

Each researcher explored a different axis independently with a fresh context.
Your job is to integrate their findings into a single coherent answer.

RESEARCHER OUTPUTS:
{concatenated researcher outputs}

INSTRUCTIONS:

1. MERGE OVERLAPPING FINDINGS. If 2+ researchers found the same thing from
   different angles, consolidate into one finding with higher confidence.
   Note the convergence — independent discovery of the same fact is strong signal.

2. FLAG HIGH-VARIANCE OUTLIERS. If one researcher found something that
   contradicts or is completely absent from all others, flag it as an outlier.
   Don't discard — outliers may be the most valuable finding. Mark them clearly.

3. RANK BY CONFIDENCE. Score each consolidated finding:
   - HIGH: 2+ researchers converge, evidence is concrete and verifiable
   - MEDIUM: 1 researcher, strong evidence from authoritative source
   - LOW: 1 researcher, weak or circumstantial evidence
   - OUTLIER: contradicts other findings or stands alone with no corroboration

4. IDENTIFY RESEARCH GAPS. What wasn't covered? What follow-up questions emerge?

5. PRODUCE THE FINAL ANSWER in this exact structure:

## Answer
[Direct answer to the original question — 2-3 paragraphs, plain language,
actionable. Lead with the conclusion, not the reasoning.]

## Key Findings
[Ranked list, highest confidence first. Each entry:]
- **{finding title}** (CONFIDENCE: {HIGH|MEDIUM|LOW})
  {1-2 sentence summary}
  Sources: {list of researcher axes that found this}

## Outliers Worth Investigating
[Findings that diverged from consensus — may be noise, may be signal]
- **{outlier title}** — {why it's interesting, which researcher found it}

## Research Gaps
[What wasn't covered, what follow-up questions remain]
- {gap description}

## Convergence Map
[Which axes agreed on what — shows where independent research reinforced itself]
```

---

## Phase 4: Output

Print the synthesizer's output directly. Then append:

```
───────────────────────
Research complete: {N} axes × Sonnet → Opus synthesis
Type: {code|web|vault|mixed}
```

---

## Rules

- **Execute immediately.** No methodology explanation. Parse → axes → dispatch → synthesize → output.
- **Model routing is mandatory.** Researchers = `model: "sonnet"`. Synthesizer = `model: "opus"`. No exceptions.
- **All researchers launch in one message.** Parallel execution, not sequential.
- **Researchers get fresh contexts.** Each starts clean — no shared state, no context bleed.
- **The synthesizer gets ALL researcher output.** Don't filter or summarize before synthesis — let Opus see everything.
- **Vault-first for domain questions.** If type is `vault` or `mixed`, researchers should check NotebookLM and vault files before web searching. Matt's curated interpretations are canonical.
- **Pre-search guardrail still applies.** For `web` and `mixed` types, researchers should use WebSearch first, then Perplexity for refinement — not Perplexity directly.
- **3 axes minimum, 5 maximum.** Fewer than 3 doesn't provide enough coverage. More than 5 has diminishing returns.
- **One contrarian axis required.** At least one researcher must look for reasons the obvious answer is wrong.
