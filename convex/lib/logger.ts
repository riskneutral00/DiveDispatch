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
  console.log(JSON.stringify(entry)) // comments-ok
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
