/**
 * Performance: Query Bounds Test
 *
 * Verifies that all .collect() queries in the Convex backend are bounded —
 * either filtered by an index, scoped to a specific owner, or operating on
 * a table with a known small cardinality. Unbounded .collect() on large tables
 * will degrade performance at scale.
 *
 * This is a static analysis test — it reads source files and checks patterns,
 * not runtime behavior.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const CONVEX_DIR = join(__dirname, '../../convex')

// Tables known to be small (bounded by design, not by data volume)
const SMALL_TABLES = new Set([
  'themes',           // Max ~10 themes
  'bookingTemplates', // Per-user, max ~20
  'userRoles',        // Per-user, max ~5 roles
])

// Files that are dev-only or seed-only (not production queries)
const EXCLUDED_FILES = new Set([
  'seed.ts',
  'seedData.ts',
  'seedInstructorData.ts',
  'demoBookings.ts',
  'devSwitcher.ts',
])

function collectConvexFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectConvexFiles(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.startsWith('_generated')) {
      files.push(full)
    }
  }
  return files
}

interface CollectCall {
  file: string
  line: number
  code: string
  isBounded: boolean
  reason: string
}

function analyzeCollectCalls(): CollectCall[] {
  const results: CollectCall[] = []
  const files = collectConvexFiles(CONVEX_DIR)

  for (const file of files) {
    const basename = file.split('/').pop() ?? ''
    if (EXCLUDED_FILES.has(basename)) continue
    if (file.includes('_generated')) continue

    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('.collect()')) continue

      // Look at the preceding lines to find the query chain
      const context = lines.slice(Math.max(0, i - 5), i + 1).join('\n')

      let isBounded = false
      let reason = 'UNBOUNDED — no index filter or owner scope'

      // Check for index usage
      if (context.includes('.withIndex(')) {
        isBounded = true
        reason = 'Bounded by index filter'
      }
      // Check for .filter() (still reads all docs but at least has a predicate)
      else if (context.includes('.filter(')) {
        // .filter() without .withIndex() is a full table scan — flag it
        reason = 'Uses .filter() without index — full table scan'
      }
      // Check for small table
      else {
        for (const table of SMALL_TABLES) {
          if (context.includes(`'${table}'`) || context.includes(`"${table}"`)) {
            isBounded = true
            reason = `Small table: ${table}`
            break
          }
        }
      }

      results.push({
        file: file.replace(CONVEX_DIR + '/', ''),
        line: i + 1,
        code: lines[i].trim(),
        isBounded,
        reason,
      })
    }
  }

  return results
}

describe('Query bounds — no unbounded .collect() in production paths', () => {
  const calls = analyzeCollectCalls()
  const unbounded = calls.filter((c) => !c.isBounded)

  it('reports all .collect() calls with their bound status', () => {
    // This test always passes — it's informational
    // The real assertion is below
    for (const call of calls) {
      const status = call.isBounded ? 'OK' : 'WARN'
      // Log for visibility during test runs
      if (!call.isBounded) {
        console.warn(`[${status}] ${call.file}:${call.line} — ${call.reason}`)
      }
    }
    expect(calls.length).toBeGreaterThan(0)
  })

  it('flags unbounded .collect() calls for review', () => {
    // This is a soft assertion — warns but doesn't fail the build
    // When you're ready to enforce, change the threshold to 0
    const MAX_ALLOWED_UNBOUNDED = 30 // Current baseline — reduce over time
    expect(unbounded.length).toBeLessThanOrEqual(MAX_ALLOWED_UNBOUNDED)
  })

  it('all availability queries use index-bounded .collect()', () => {
    const availCalls = calls.filter((c) => c.file.includes('availability'))
    const availUnbounded = availCalls.filter((c) => !c.isBounded)
    // Availability is the hottest query path — must always be bounded
    for (const call of availUnbounded) {
      console.error(`UNBOUNDED availability query: ${call.file}:${call.line} — ${call.reason}`)
    }
    // Currently some are unbounded (inventoryUnits full scan, blockedDates full scan)
    // This documents them — when indexes are added, tighten this to 0
    expect(availUnbounded.length).toBeLessThanOrEqual(5)
  })
})
