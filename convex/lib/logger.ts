/**
 * Structured JSON logger for Convex runtime.
 *
 * Zero dependencies — uses only console.log (available in Convex).
 * All output is valid JSON with `level`, `message`, `timestamp` fields
 * plus any additional context spread into the object.
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    ...context,
    level,
    message,
    timestamp: new Date().toISOString(),
  }
  // Single console.log call — Convex runtime captures stdout
  console.log(JSON.stringify(entry))
}

export const log = {
  info(message: string, context?: LogContext): void {
    emit('info', message, context)
  },
  warn(message: string, context?: LogContext): void {
    emit('warn', message, context)
  },
  error(message: string, context?: LogContext): void {
    emit('error', message, context)
  },
}
