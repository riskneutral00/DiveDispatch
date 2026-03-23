---
name: youtube
description: "Analyze YouTube videos via NotebookLM. Extracts lessons, insights, and takeaways into structured documents saved to YouTubeVault."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, mcp__notebooklm-mcp__notebook_create, mcp__notebooklm-mcp__notebook_list, mcp__notebooklm-mcp__notebook_get, mcp__notebooklm-mcp__notebook_query, mcp__notebooklm-mcp__source_add, mcp__notebooklm-mcp__note
user-invocable: true
---

# /youtube — YouTube Video Analysis

Analyze YouTube videos via NotebookLM. Extract structured lessons and save to `~/Desktop/YouTubeVault/`. No questions, no prompts — just execute.

---

## Usage

```
/youtube <youtube-url>
/youtube <youtube-url-1> <youtube-url-2>
```

---

## Instructions

### Step 1 — Parse URLs

Extract all YouTube URLs from the arguments. Accept any YouTube format:
- `https://www.youtube.com/watch?v=...`
- `https://youtu.be/...`
- `https://youtube.com/watch?v=...`

If no valid YouTube URLs found, output usage hint and stop.

### Step 2 — Triage: classify the video

Find or create the **yt-triage** notebook:
1. `notebook_list()` — search for a notebook with "YT Triage" in the title.
2. If not found, `notebook_create(title="YT Triage")` and note the ID.

For each URL:
1. `source_add(notebook_id=<triage_id>, source_type="url", url=<URL>)`
2. Wait for processing to complete.
3. Query the triage notebook:
   > "For the video from [URL]: What is the exact title of this video? Classify it into exactly ONE of these categories: AI/Tech, Entertainment, Business/Strategy, Diving/Marine, Education, Other. Respond in this format: TITLE: <title> | CATEGORY: <category>"
4. Parse the title and category from the response.

### Step 3 — Route to category notebook

Map the category to a notebook name:

| Category | Notebook title |
|----------|---------------|
| AI/Tech | YT — AI & Tech |
| Entertainment | YT — Entertainment |
| Business/Strategy | YT — Business & Strategy |
| Diving/Marine | YT — Diving & Marine |
| Education | YT — Education |
| Other | YT — Other |

1. `notebook_list()` — search for the matching notebook title.
2. If not found, `notebook_create(title=<notebook_title>)`.
3. `source_add(notebook_id=<category_id>, source_type="url", url=<URL>)` — add the video to the category notebook.

### Step 4 — Extract lessons

Run **two queries** against the category notebook, scoped to the video just added.

**Query 1 — Universal:**
> "From the video '[video title]': What are the key lessons, insights, or takeaways? List each as a distinct point. Include specific examples, quotes, and timestamps where relevant. Cite specific moments from the video."

**Query 2 — Category-specific:**

| Category | Query |
|----------|-------|
| AI/Tech | "From the video '[video title]': What specific tools, frameworks, architectures, or techniques are discussed? What are the practical implementation details, code patterns, or workflow tips?" |
| Entertainment | "From the video '[video title]': What storytelling techniques, creative decisions, production choices, or cultural observations are notable? What makes this content effective or memorable?" |
| Business/Strategy | "From the video '[video title]': What strategic frameworks, market insights, business models, or decision-making principles are presented? What's the core thesis?" |
| Diving/Marine | "From the video '[video title]': What safety protocols, equipment considerations, dive planning details, or marine biology facts are covered? How does this relate to dive operator workflows?" |
| Education | "From the video '[video title]': What concepts are taught and how? What's the teaching methodology? What prerequisites are assumed? What mental models are introduced?" |
| Other | "From the video '[video title]': What is most notable, surprising, or useful about this content? What would someone want to remember after watching?" |

### Step 5 — Format document

Combine both query responses into a single structured document:

```markdown
# [Video Title]

**Source:** [YouTube URL]
**Category:** [classification]
**Analyzed:** [YYYY-MM-DD]

## Key Lessons
1. **[Lesson title]** — [description with sourcing/timestamps]
2. ...

## Notable Details
- [supporting observations, quotes, techniques, specifics from category query]

## Actionable Takeaways
- [ ] [concrete next step, thing to try, or thing to remember]
```

Guidelines:
- **Lessons** should be substantive — not "the video was interesting" but the actual insight.
- **Sourcing** — include timestamps (e.g., "at 12:34") when NotebookLM provides them.
- **Actionable Takeaways** should be concrete, not vague. Something you could put on a to-do list.
- Keep the document scannable. Prefer bullet points over paragraphs.

### Step 6 — Save to YouTubeVault

1. Derive a slug from the video title: lowercase, spaces to hyphens, strip special characters, max 60 chars.
2. Map category to folder name: `AI-Tech/`, `Entertainment/`, `Business-Strategy/`, `Diving-Marine/`, `Education/`, `Other/`.
3. Create the category directory if it doesn't exist: `mkdir -p ~/Desktop/YouTubeVault/<folder>/`
4. Write the document to `~/Desktop/YouTubeVault/<folder>/<slug>.md`

### Step 7 — Create NotebookLM note

In the **category notebook** (not triage), create a note for future cross-referencing:

`note(notebook_id=<category_id>, action="create", title="[video title] — Digest", content=<the Key Lessons section only>)`

This enables querying across multiple videos in the same category later.

### Step 8 — Vault cross-post (conditional)

If the video's category maps to a DiveVault domain, append a summary to the relevant Research.md:

| Category | Vault target |
|---|---|
| Diving/Marine | `~/Desktop/DiveVault/DiveDispatch/Product/Research.md` |
| Business/Strategy | `~/Desktop/DiveVault/RiskNeutral/Strategy/Research.md` |
| AI/Tech | Skip |
| Other categories | Skip |

**Format appended:**
```markdown
## [video title] — [YYYY-MM-DD]
[1-line summary derived from Key Lessons]
Full: ~/Desktop/YouTubeVault/<folder>/<slug>.md
```

**Rules:**
1. Read the target file first. If the video title already appears, skip (no duplicates).
2. If the file doesn't exist, create it with a `# Research` heading first, then append.
3. If it exists, append under the existing content.

### Step 9 — Output

Display the full formatted document in chat. Then print:

```
Saved: ~/Desktop/YouTubeVault/<folder>/<slug>.md
Notebook: <notebook title> (source + note added)
```

If a vault cross-post occurred, also print:
```
Vault: cross-posted to ~/Desktop/DiveVault/.../Research.md
```

If multiple videos were processed, repeat Steps 2–8 for each, then show all outputs together.

---

## Error Handling

- **NotebookLM auth error:** Output "NotebookLM auth expired. Run `nlm login` in terminal, then retry."
- **Source add fails:** Output "Could not process [URL]. NotebookLM may not support this video (private, age-restricted, or no captions)."
- **Empty transcript:** If the lesson extraction returns very little content, note: "Video may have minimal spoken content. Lessons extracted from available transcript."
