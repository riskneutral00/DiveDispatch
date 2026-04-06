import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Concatenate class names with conflict resolution.
 * Uses clsx for conditional logic + tailwind-merge to deduplicate conflicting utilities.
 *
 * Usage: cn('base', condition && 'conditional', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
