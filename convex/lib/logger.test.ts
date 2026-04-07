import { resolve, dirname } from 'path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { log } from './logger'
import { execFileSync } from 'child_process'

const CONVEX_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

describe('structured logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  function getLastLoggedJson(): Record<string, unknown> {
    expect(consoleSpy).toHaveBeenCalled()
    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]
    const raw = lastCall[0]
    if (typeof raw !== 'string') throw new Error('Expected string log output')
    return JSON.parse(raw)
  }

  it.each(['info', 'warn', 'error'] as const)(
    'log.%s emits valid JSON with level, message, timestamp',
    (level) => {
      log[level](`${level} message`)
      const output = getLastLoggedJson()
      expect(output.level).toBe(level)
      expect(output.message).toBe(`${level} message`)
      expect(new Date(String(output.timestamp)).toISOString()).toBe(output.timestamp)
    },
  )

  it('spreads context fields into the JSON output', () => {
    log.info('user action', { userId: 'abc123', action: 'login' })
    const output = getLastLoggedJson()
    expect(output.level).toBe('info')
    expect(output.message).toBe('user action')
    expect(output.userId).toBe('abc123')
    expect(output.action).toBe('login')
  })

  it('context does not override level, message, or timestamp', () => {
    log.warn('msg', { level: 'hacked', message: 'overridden', timestamp: 'fake' })
    const output = getLastLoggedJson()
    expect(output.level).toBe('warn')
    expect(output.message).toBe('msg')
    expect(output.timestamp).not.toBe('fake')
  })

  it('works with no context argument', () => {
    log.error('bare error')
    const output = getLastLoggedJson()
    expect(output.level).toBe('error')
    expect(output.message).toBe('bare error')
    expect(Object.keys(output).sort()).toEqual(['level', 'message', 'timestamp'])
  })

})

describe('no raw console.warn/console.log in convex/', () => {
  it('convex/ source files do not contain raw console.log or console.warn', () => {
    let result: string
    try {
      result = execFileSync('grep', [
        '-rn', 'console\\.\\(log\\|warn\\)',
        '--include=*.ts', 'convex/',
      ], { cwd: resolve(CONVEX_ROOT, '..'), encoding: 'utf-8' })
    } catch {
      result = ''
    }

    const violations = result
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !line.includes('.test.'))
      .filter((line) => !line.includes('_generated/'))
      .filter((line) => !line.includes('logger.ts'))

    expect(violations).toEqual([])
  })
})
