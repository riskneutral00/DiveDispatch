import posthog from 'posthog-js'

type ErrorContext = Record<string, string>

export function reportError(error: Error, context?: ErrorContext): void {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.captureException(error, { properties: context })
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[reportError]', error, context) // comments-ok
  }
}
