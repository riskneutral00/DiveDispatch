---
description: Chinese variants use native script labels, not country flags
paths:
  - "src/**/language*"
  - "src/**/locale*"
  - "src/**/i18n*"
  - "convex/**/language*"
---

Flags represent nations, not languages. For Chinese variants, use native script labels (简体/繁體) from `CHINESE_SCRIPT_LABELS` in `dive-languages.ts`. No politically safe flag exists for Simplified vs Traditional Chinese. Other 1:1 language-country mappings can keep flags.
