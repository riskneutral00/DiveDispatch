import { ConvexError } from 'convex/values'
import { z } from 'zod'
import { ErrorCode } from './errorCodes'

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  const field = issue.path.join('.')
  throw new ConvexError({ code: ErrorCode.VALIDATION, field, reason: issue.message })
}
