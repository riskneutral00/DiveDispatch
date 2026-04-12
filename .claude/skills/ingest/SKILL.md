---
name: ingest
description: "General-purpose source ingest per Schema/ingest-contract.md. Reads a URL/PDF/transcript/PR body/meeting note, discusses takeaways, writes raw + summary entity + log entry, revises affected entity pages."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch
user-invocable: true
---

# /ingest — Source → Vault

Contract: `~/Desktop/RiskNeutral/Vaults/DiveDispatch/Schema/ingest-contract.md`

Adds an external source to the vault in Karpathy-wiki shape: raw capture + semantic entity page + backlinks on affected entities + log entry.

## Invocation

- `/ingest <url>` — fetch and ingest a web page, PDF, YouTube video, GitHub repo, etc.
- `/ingest <path>` — ingest a local file (PDF, .md, .txt, transcript)
- `/ingest` — prompt Matt to paste text (meeting notes, Slack thread, PR body)

Specialized ingest skills exist and should be preferred when they match:
- `/matrix-youtube <video-url>` — YouTube with NotebookLM sync
- `/matrix-github <repo-url>` — GitHub repo compatibility matrix

`/ingest` is the general fallback for everything else.

## Six steps (from ingest-contract.md)

1. **Read the source.** Use WebFetch for URLs, Read for local paths, or prompt for paste. Parse into plain text.
2. **Discuss takeaways.** Interactive. Use AskUserQuestion with A/B/free-form format per `communication-ux.md`. Goal: which concepts are new, which extend existing entities, which contradict existing entities?
3. **Write raw.** Append source (verbatim or linkable pointer + SHA256) to `Vaults/DiveDispatch/raw/Ingest/YYYY-MM-DD-<slug>.md` with frontmatter `type: raw, tier: episodic, source: /ingest`.
4. **Write summary entity.** Create `Vaults/DiveDispatch/wiki/Architecture/entities/<slug>.md` with frontmatter `type: entity, tier: semantic, decay: 90d, source: /ingest`. Body: key takeaways, citations back to `[[raw/Ingest/<file>]]`, cross-links to existing entities.
5. **Revise affected entities.** Grep `wiki/Architecture/entities/` for matching tags/concepts. Update 5–15 entities with new `[[wiki-link]]` + stamped `updated`. If source contradicts an existing entity, propose `supersedes:` / `superseded_by:` pair; write diff and ask Matt to approve.
6. **Append log entry.** One line to `Vaults/DiveDispatch/log.md`: `YYYY-MM-DD HH:MM ingest [[raw/Ingest/<file>]] → [[<entity>]] + {n} revised`.

## Output

Print a compact summary:

```
INGEST: {source}
  raw:     Vaults/DiveDispatch/raw/Ingest/<file>.md
  summary: Vaults/DiveDispatch/wiki/Architecture/entities/<slug>.md
  revised: {n} entity pages
  log:     appended
```

## Anti-patterns (enforced by /vault lint)

- ❌ Writing only raw without a summary entity — raw alone doesn't compound
- ❌ Writing a summary entity without backlinks to raw source — breaks provenance
- ❌ Skipping the discussion step — silent ingest drops Matt's context
- ❌ Revising more than 15 entities in one run — scope creep; split the source

## Failure modes

- **Source unreachable** → do not write raw/Ingest/. Report failure and stop.
- **Duplicate source detected** (same SHA256 in existing raw/Ingest/) → skip raw write; update existing entity instead.
- **Source too large for one ingest** → suggest splitting; do not write partial.
