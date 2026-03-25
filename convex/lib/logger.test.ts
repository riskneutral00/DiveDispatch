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
    return JSON.parse(lastCall[0] as string)
  }

  it('log.info emits valid JSON with level, message, timestamp', () => {
    log.info('test message')
    const output = getLastLoggedJson()
    expect(output.level).toBe('info')
    expect(output.message).toBe('test message')
    expect(new Date(output.timestamp as string).toISOString()).toBe(output.timestamp)
  })

  it('log.warn emits level "warn" with ISO timestamp', () => {
    log.warn('warning message')
    const output = getLastLoggedJson()
    expect(output.level).toBe('warn')
    expect(output.message).toBe('warning message')
    expect(new Date(output.timestamp as string).toISOString()).toBe(output.timestamp)
  })

  it('log.error emits level "error" with ISO timestamp', () => {
    log.error('error message')
    const output = getLastLoggedJson()
    expect(output.level).toBe('error')
    expect(output.message).toBe('error message')
    expect(new Date(output.timestamp as string).toISOString()).toBe(output.timestamp)
  })

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
    // Should only have level, message, timestamp
    expect(Object.keys(output).sort()).toEqual(['level', 'message', 'timestamp'])
  })

})

describe('no raw console.warn/console.log in convex/', () => {
  it('convex/ source files do not contain raw console.log or console.warn', () => {
    // Using execFileSync with explicit args array — no shell injection risk
    let result: string
    try {
      result = execFileSync('grep', [
        '-rn', 'console\\.\\(log\\|warn\\)',
        '--include=*.ts', 'convex/',
      ], { cwd: resolve(CONVEX_ROOT, '..'), encoding: 'utf-8' })
    } catch {
      // grep exits 1 when no matches — that's the success case
      result = ''
    }

    // Filter out test files, _generated, and the logger itself
    const violations = result
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !line.includes('.test.'))
      .filter((line) => !line.includes('_generated/'))
      .filter((line) => !line.includes('logger.ts'))

    expect(violations).toEqual([])
  })
})
