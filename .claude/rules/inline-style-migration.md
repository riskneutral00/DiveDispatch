## Migrate tokenizable inline styles on contact

When editing a file with inline `style={{}}` props that use `var(--color-*)` tokens, migrate them to Tailwind classes. Do not copy these patterns into new code.

| Inline style | Tailwind class |
|---|---|
| `color: 'var(--color-text-primary)'` | `text-primary` |
| `color: 'var(--color-text-secondary)'` | `text-secondary` |
| `color: 'var(--color-text-on-primary)'` | `text-on-primary` |
| `color: 'var(--color-success)'` | `text-success` |
| `color: 'var(--color-warning)'` | `text-warning` |
| `color: 'var(--color-destructive)'` | `text-destructive` |
| `color: 'var(--color-accent)'` | `text-accent` |
| `background: 'var(--color-glass-bg)'` | `bg-glass-bg` |
| `background: 'var(--color-surface)'` | `bg-surface` |
| `background: 'var(--color-surface-elevated)'` | `bg-surface-elevated` |
| `borderColor: 'var(--color-glass-border)'` | `border-glass-border` |
| `borderBottom: '1px solid var(--color-glass-border)'` | `glass-divider` |

Leave conditional/dynamic values (`isX ? 'var(--a)' : 'var(--b)'`) as inline styles.

This applies to `src/components/` feature code only. `src/components/ui/` uses variant Record objects — those are the design system definition, not feature code.
