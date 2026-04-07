import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

const CONVEX_DIR = path.resolve(__dirname, '..', 'convex')

const GATEWAY_FILES = new Set([
  'bookings/status.ts',
  'bookings/inventoryRelease.ts',
  'bookings/autoAdvance.ts',
  'reservationsMutations.ts',
  'users.ts',
  'availability.ts',
])

const FSM_STATUS_PREFIXES = ['BOOKING_STATUS.', 'RESERVATION_STATUS.']

const STATUS_PATTERN = /status:\s*(?:BOOKING_STATUS|RESERVATION_STATUS)\./

function getAllTsFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_generated' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(full)
    }
  }
  return results
}

function isPatchContext(lines: string[], index: number): boolean {
  const start = Math.max(0, index - 3)
  for (let i = start; i <= index; i++) {
    if (lines[i].includes('.patch(')) return true
  }
  return false
}

function hasFsmOk(lines: string[], index: number): boolean {
  const start = Math.max(0, index - 3)
  for (let i = start; i <= index; i++) {
    if (lines[i].includes('// fsm-ok')) return true
  }
  return false
}

describe('FSM gateway invariant', () => {
  it('status patches only occur in gateway files or with // fsm-ok', () => {
    const violations: { file: string; line: number; content: string }[] = []

    for (const filePath of getAllTsFiles(CONVEX_DIR)) {
      const rel = path.relative(CONVEX_DIR, filePath)
      if (GATEWAY_FILES.has(rel)) continue

      const content = readFileSync(filePath, 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!STATUS_PATTERN.test(line)) continue
        if (hasFsmOk(lines, i)) continue
        if (!isPatchContext(lines, i)) continue

        violations.push({ file: rel, line: i + 1, content: line.trim() })
      }
    }

    const message = violations
      .map((v) => `  ${v.file}:${v.line} → ${v.content}`)
      .join('\n')

    expect(violations, `FSM status patches outside gateway files:\n${message}`).toEqual([])
  })
})
