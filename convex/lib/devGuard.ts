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

export function isDevSwitchEnabled(): boolean {
  return isDevEnvironment() && process.env.ALLOW_DEV_SWITCH === 'true'
}

export function requireDevSwitchEnabled(): void {
  if (!isDevSwitchEnabled()) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Dev switcher disabled' })
  }
}
