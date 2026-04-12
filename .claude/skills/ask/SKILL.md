---
name: ask
description: "Vault query that writes findings back as entity pages (Karpathy query-writes-back). Reads index.md first, drills into entities, synthesizes with citations, persists the answer."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
user-invocable: true
---

# /ask — Query-Writes-Back

Karpathy's lesson: queries persist as new entity pages so the wiki compounds. Every `/ask` contributes to the vault.

## Invocation

- `/ask <question>` — e.g. `/ask "how does auth work across stakeholders?"`
- `/ask <question> --dry` — synthesize without writing the answer page

## Flow

1. **Read index first.** Open `Vaults/DiveDispatch/index.md`. Identify relevant entity pages via summary + tags.
2. **Drill into entities.** Read the 3–8 most-relevant pages from `wiki/Architecture/entities/`, `wiki/PatternLibrary/`, `wiki/Architecture/invariants/`.
3. **Cross-reference raw if needed.** If the answer requires recent specifics, also check `raw/Sessions/`, `raw/Failures/`, `raw/Ingest/` for the last 14 days.
4. **Synthesize.** Produce a structured answer with inline `[[wiki-link]]` citations.
5. **Write the answer as an entity page.** Create `wiki/Architecture/entities/q-<slug>.md` (slug derived from question, max 60 chars, kebab-case):
   ```yaml
   type: entity
   tier: semantic
   summary: "Q: {question}"
   tags: [q, {derived-tags}]
   updated: YYYY-MM-DD
   confidence: high|medium|low
   decay: 90d
   source: /ask
   ```
   Body: the question, the answer with citations, list of sources read.
6. **Update existing entity if the question extends it.** If an existing entity closely matches the question, update that page instead of creating `q-<slug>.md`. The existing entity gains an "FAQ" section with the Q+A pair.
7. **Append to log.** `YYYY-MM-DD HH:MM ask "{question}" → [[wiki/Architecture/entities/q-<slug>]]`.

## Output to Matt

Render the synthesized answer with citations inline. End with:

```
PERSISTED: wiki/Architecture/entities/q-<slug>.md
(use /ask <question> --dry to skip persistence)
```

## Anti-patterns

- ❌ Answering without reading the index first — defeats the pattern's efficiency claim
- ❌ Writing the answer without citations — breaks traceability
- ❌ Creating `q-<slug>.md` when an existing entity with 90%+ overlap already exists (update that one instead)

## Relationship to /ingest

- `/ingest` adds NEW external knowledge to the vault
- `/ask` SYNTHESIZES existing vault knowledge into a persistent answer

Both increase the entity graph; both write to log. Use `/ingest` when the seed is an external source; `/ask` when the seed is a question.
