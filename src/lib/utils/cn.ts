import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom tailwind-merge that recognises DiveDispatch's design-token font-size
 * utilities (text-body, text-label, text-section-header, text-page-title,
 * text-card-title). Without this, twMerge treats them as text-COLOR classes
 * and strips whichever appears first when paired with text-primary /
 * text-secondary / text-accent etc.
 */
const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['body', 'label', 'page-title', 'card-title', 'section-header'] },
      ],
    },
  },
})

/**
 * Concatenate class names with conflict resolution.
 * Uses clsx for conditional logic + tailwind-merge to deduplicate conflicting utilities.
 *
 * Usage: cn('base', condition && 'conditional', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs))
}
