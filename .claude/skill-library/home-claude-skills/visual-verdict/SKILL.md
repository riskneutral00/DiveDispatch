---
name: visual-verdict
description: "Structured visual QA: compare UI screenshots against references, return JSON verdict with 0-100 score. Pass threshold: 90+."
allowed-tools: Read, Bash, Glob, mcp__playwright
user-invocable: true
---

# /visual-verdict — Screenshot Comparison Verdict

Compare generated UI screenshots against reference images. Return structured JSON verdict with actionable suggestions.

**Execute immediately. No preamble.**

## When to Use

- Visual fidelity requirements (layout, spacing, typography, component styling)
- After UI implementation to verify against design
- User says `visual verdict`, `compare screenshot`, `design check`
- Iterating on UI until it matches reference

## Args

| Input | Description |
|-------|-------------|
| `<reference_path>` | Reference image(s) to compare against |
| `<screenshot_path>` | Current UI screenshot (or take one via Playwright) |
| *(none)* | Take screenshot of current page via Playwright, compare to nearest reference |

## Workflow

### 1. Capture

If no screenshot provided:
- Use Playwright MCP to navigate to the relevant page
- Take a screenshot: `mcp__playwright browser_take_screenshot`
- Save to `.tmp/visual-verdict/current.png`

### 2. Compare

Read both reference and generated screenshot. Evaluate:
- Layout and spacing
- Typography (font, size, weight)
- Colors and contrast
- Component hierarchy
- Responsive behavior (if multiple breakpoints)
- DD design system compliance (if applicable)

### 3. Verdict

Return **JSON only**:

```json
{
  "score": 87,
  "verdict": "revise",
  "differences": [
    "Top nav spacing is tighter than reference",
    "Primary button uses smaller font weight"
  ],
  "suggestions": [
    "Increase nav item horizontal padding by 4px",
    "Set primary button font-weight to 600"
  ],
  "reasoning": "Core layout matches, but style details still diverge."
}
```

**Rules:**
- `score`: integer 0-100
- `verdict`: `pass` (90+), `revise` (50-89), or `fail` (<50)
- `differences[]`: concrete visual mismatches
- `suggestions[]`: actionable CSS/component changes tied to differences
- `reasoning`: 1-2 sentence summary

### 4. Loop

If `score < 90`:
- Apply suggestions
- Re-screenshot
- Re-run `/visual-verdict`
- Repeat until 90+ or user stops

## Rules

- **Pass threshold is 90.** Do not treat visual work as complete below this.
- **Concrete suggestions.** "Looks off" is not acceptable. Name the property and value.
- **JSON output only.** No prose wrapping the verdict.
- **Compare structure first, details second.** Layout issues outrank color tweaks.
