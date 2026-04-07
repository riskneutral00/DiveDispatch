---
name: pre-search
description: "Two-step research: broad WebSearch first, then refined Perplexity query. Required guardrail — no direct Perplexity calls."
allowed-tools: Read, Write, Edit, Grep, Glob, AskUserQuestion, WebSearch, mcp__perplexity__perplexity_search, mcp__perplexity__perplexity_ask, mcp__perplexity__perplexity_research, mcp__perplexity__perplexity_reason, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__notebook_list, mcp__notebooklm-mcp__source_get_content, mcp__notebooklm-mcp__source_list_drive
user-invocable: true
---

# /pre-search — Two-Step Research

Two steps. Step 1 is free and fast. Step 2 costs money and is targeted.

**Execute immediately. No preamble.**

---

## Phase 1 — Extract (silent)

Parse the user's input. Extract what you can into 5 dimensions:

| Dimension | What to extract | Status |
|-----------|----------------|--------|
| **Core question** | The single specific thing they want answered | clear or unclear |
| **Context source** | Reference to a vault or NotebookLM notebook | found or none |
| **Domain constraints** | Geography, industry, source types, specific sites | clear or unclear |
| **Time relevance** | Does recency matter? How recent? | clear or unclear |
| **Depth** | Quick fact vs. comprehensive report | clear or unclear |

**Context source detection — parse input for:**
- `vault`, `funding notes`, `risk neutral`, `dive dispatch`, etc. → Read files from `~/Desktop/RiskNeutral/Vaults/`
- `funding`, `grants`, `accelerator` → Read from `~/Desktop/RiskNeutral/Vaults/Grants and Accelerators/Strategy/`
- `notebook`, `NotebookLM`, or a specific notebook name → Query via `mcp__notebooklm-mcp__notebook_query`

**If a context source is found:**
1. Pull relevant content (read vault files via `Read`/`Grep`, or query NotebookLM via MCP)
2. Extract what the user already knows about this topic
3. Identify the **knowledge gap** — what the search should target
4. Both Step 1 and Step 2 queries should seek what is NOT already in the context

**Context pull limits:** Use `Grep` to find relevant files by keyword, not bulk reads. Read at most 3 files.

**Do not output anything yet.**

---

## Phase 2 — Adaptive Interview

Only ask about dimensions marked unclear. Skip anything already clear from the input.

**Shortcut:** If the user provides a clear, specific query — skip the interview entirely. Go straight to Step 1.

- Use `AskUserQuestion` — one question at a time
- Each question has a recommended answer + alternatives
- Max 2 rounds. If all dimensions are clear, skip to Step 1.

---

## Step 1 — WebSearch (broad, free)

Cast a wide net using the built-in `WebSearch` tool.

1. **Build a broad query** from the extracted dimensions. Include key terms but don't over-constrain — the goal is discovery.
2. **Execute `WebSearch`** with the query. Use `allowed_domains` or `blocked_domains` if domain constraints were identified.
3. **Present findings to the user:**

```
═══════════════════════════════
Step 1: WebSearch Results
═══════════════════════════════
Query:       {the WebSearch query used}
Found:
  - {key finding 1}
  - {key finding 2}
  - {key finding 3}
  ...

Sources:
  [1] {title} — {url}
  [2] {title} — {url}
  ...

Gaps:        {what's still unanswered or unclear}
═══════════════════════════════
```

4. **Gate: Ask the user what to do next.**

   After displaying Step 1 results, **always** use `AskUserQuestion` to prompt the user. Do not proceed to Step 2 without explicit approval.

   Present three options:
   - **Continue to Perplexity** — proceed to Step 2 using Step 1 findings to build a refined query. Recommend this option if gaps remain.
   - **Save & stop** — save WebSearch results to vault as-is. Use when Step 1 fully answered the question.
   - **No-save & stop** — done, don't persist anything. Use for throwaway lookups.

   **CRITICAL: Do not proceed past this gate without the user's response. This is a hard stop.**

---

## Step 2 — Perplexity (refined, targeted)

Build a refined Perplexity query using what Step 1 found.

### Build the Perplexity spec

**From Step 1 results, extract:**
- Specific domains that had relevant content → feed into `search_domain_filter`
- Terminology and keywords that appeared in good results → use in the query
- What's still missing → this becomes the core of the Perplexity query

**Tool selection — default to `perplexity_search` unless synthesis is needed:**

| Signal | Tool | Returns | Cost |
|--------|------|---------|------|
| Find specific URLs/sources | `perplexity_search` | Ranked links with snippets | $ |
| Single-answer question | `perplexity_ask` | AI summary with citations | $$ |
| Comparison, tradeoff, or multi-factor analysis | `perplexity_reason` | Reasoned answer with citations | $$$ |
| Deep multi-source investigation (30s+) | `perplexity_research` | Detailed report with citations | $$$$ |

**Default parameters per tool:**

`perplexity_search`:
- `max_results`: 5
- `max_tokens_per_page`: 1024
- `country`: set if geography identified

`perplexity_ask`:
- `search_context_size`: "low"
- `search_domain_filter`: domains discovered in Step 1 (prefix with `-` to exclude)
- `search_recency_filter`: set if time relevance identified

`perplexity_reason`:
- `search_context_size`: "low"
- `search_domain_filter`: domains discovered in Step 1
- `search_recency_filter`: set if time relevance identified
- `strip_thinking`: true

`perplexity_research`:
- `reasoning_effort`: "medium"
- `strip_thinking`: true
- Note: NO domain/recency filters available on this tool

**Depth escalation:** If depth is "comprehensive", bump `search_context_size` from "low" to "medium" for `ask`/`reason`. Never default to "high".

**Compression rules for API prompt:**
- Strip filler words, articles, hedging
- Never include few-shot examples
- Never ask for URLs in the prompt (real URLs come from the `citations` field)
- Target the knowledge gap specifically — don't re-ask what WebSearch already answered
- `perplexity_search`: keyword-dense fragments, search-engine style
- `ask`/`reason`/`research`: short structured sentences preserving intent

### Present spec for approval

```
═══════════════════════════════
Step 2: Perplexity Spec
═══════════════════════════════
Informed by:  Step 1 found {summary of what WebSearch revealed}
Gap:          {what Step 1 didn't answer}
API prompt:   {compressed query targeting the gap}
Tool:         {tool}
Params:       {only real params for the selected tool}
Save to:      {vault path}
═══════════════════════════════
Approve? (y / n / edit / no-save)
```

**Approval options:**
- **y** → execute, save to shown path
- **n** → abort, no API call
- **edit** → user changes any part, re-display
- **no-save** → execute and display, don't write to vault

**CRITICAL: No Perplexity MCP tool is called until the user explicitly approves with "y".**

### Execute, Rehydrate & Save

1. Call the approved Perplexity MCP tool
2. **Rehydrate** — take Perplexity's raw response (text blob + `citations` array) and format into clean, readable output:

```
═══════════════════════════════
Step 2: Perplexity Results
═══════════════════════════════
Answer:
  {Clear summary of findings}

Key Facts:
  - {fact 1}
  - {fact 2}

Sources:
  [1] {url from citations}
  [2] {url from citations}

Saved to:     {vault path}
═══════════════════════════════
```

3. Save to vault as Obsidian-compatible markdown:

```markdown
---
source: pre-search
date: {YYYY-MM-DD}
---

# {Topic Title}

## WebSearch Findings (Step 1)
{Summary of what WebSearch found}

### Sources
- [Source title]({url})

## Perplexity Findings (Step 2)
Tool: {tool used}
Query: "{API prompt}"

{Perplexity answer}

### Key Facts
- {fact 1}
- {fact 2}

### Sources
- [Source title]({url from citations})
```

**Save path logic:**
- If context was pulled from a vault, save to the same vault area
- If no context source, infer from topic: business/funding → `~/Desktop/RiskNeutral/Vaults/Grants and Accelerators/Strategy/`, ocean/dive → `~/Desktop/RiskNeutral/Vaults/DiveDispatch/`, strategy/vision → `~/Desktop/RiskNeutral/Vaults/RiskNeutral/Strategy/`
- If topic doesn't clearly map → `~/Desktop/RiskNeutral/Vaults/Grants and Accelerators/Strategy/{topic-slug}.md`
- File name is a kebab-case slug of the core topic

---

## Rules

- **Step 1 (WebSearch) always runs first.** It's free and gives Perplexity better input.
- **No Perplexity tool is called before the user approves the Step 2 spec.**
- **Default to `perplexity_search`.** Only escalate when synthesis is needed.
- **One core question per search.** Split if sub-questions need different sources or tools.
- **Interview is adaptive.** Clear input = no questions. Max 2 rounds.
- **Only use URLs from Perplexity's `citations` field.** Never fabricate URLs.
- **If Perplexity MCP is unavailable:** Report it plainly. Offer to do a second, more targeted WebSearch instead. Don't silently fall back.
- **Execute immediately.** No preamble, no methodology explanation.
