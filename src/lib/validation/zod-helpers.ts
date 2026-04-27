import type { ZodIssue } from 'zod'

export function zodIssuesToFieldErrors(issues: ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (!errors[path]) errors[path] = issue.message
  }
  return errors
}

export function zodIssuesForField(issues: ZodIssue[], field: string): string | undefined {
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (path === field) return issue.message
  }
  return undefined
}

export function zodIssuesForFieldOrChild(issues: ZodIssue[], field: string): string | undefined {
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (path === field || path.startsWith(`${field}.`)) return issue.message
  }
  return undefined
}

export const RESERVED_ERROR_KEYS: ReadonlySet<string> = new Set(['_form', ''])
