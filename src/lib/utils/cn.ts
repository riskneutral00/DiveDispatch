/**
 * Concatenate class names, filtering out falsy values.
 * Standardizes the className construction pattern across the codebase.
 *
 * Usage: cn('base', condition && 'conditional', className)
 */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ')
}
