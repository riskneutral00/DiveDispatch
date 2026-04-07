import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

export function isDevEnvironment(): boolean {
  return process.env.ENVIRONMENT === 'development'
}

export function requireDevEnvironment(): void {
  if (!isDevEnvironment()) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Dev-only endpoint' })
  }
}
