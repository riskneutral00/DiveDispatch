// ── Server-side Zod validation helper ────────────────────────────────────────
// Last line of defense in Convex mutations. Re-validates mutation args even when
// the client already validated — never trust the client.
//
// Throws ConvexError({ code: 'VALIDATION', field, reason }) on first failure.

import { ConvexError } from 'convex/values'
import { z } from 'zod'

/**
 * Validates `data` against `schema` and returns the parsed result.
 * On validation failure, throws `ConvexError({ code: 'VALIDATION', field, reason })`
 * where `field` is the dot-separated path to the failing field and `reason` is
 * the human-readable Zod error message.
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  const field = issue.path.join('.')
  throw new ConvexError({ code: 'VALIDATION', field, reason: issue.message })
}
