---
description: Pair short form fields with dense content blocks to eliminate vertical waste
globs: src/components/**/*.tsx
---

## Paired-column density
When a form section contains a fixed-height content block (flag grid, checkbox matrix, file upload zone, map preview, photo grid), pair it side-by-side with shorter fields that stack vertically to fill the same height. Use `grid grid-cols-1 sm:grid-cols-2 gap-4` so neither column can push the other. The dense column is the height anchor — the sparse column arranges to match, not the reverse.

## Never stack what can pair
Three or more short fields (name, phone, email, date) stacked vertically above or below a dense block wastes half the card's width. Group the short fields into one column and place the dense block beside them.

## Height budget
Before building a form card, estimate the height of the tallest content block. The paired column's stacked fields should fill that height naturally. If there's significant leftover space, the column split is wrong or the fields need regrouping.
