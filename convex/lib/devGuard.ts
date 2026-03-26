import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

/**
 * Single source of truth for dev-environment detection.
 * All dev-only endpoints must use this instead of ad-hoc env var checks.
 *
 * Returns true when ENVIRONMENT === 'development', false otherwise.
 */
export function isDevEnvironment(): boolean {
  return process.env.ENVIRONMENT === 'development'
}

/**
 * Throws ConvexError FORBIDDEN when not in dev environment.
 * Use in mutations / actions that should never run in production.
 */
export function requireDevEnvironment(): void {
  if (!isDevEnvironment()) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Dev-only endpoint' })
  }
}
