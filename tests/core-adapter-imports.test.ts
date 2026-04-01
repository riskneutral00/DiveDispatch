/**
 * Enforces CLAUDE.md dependency direction: core must not import adapters,
 * except documented exceptions (notify fire-and-forget; equipmentBags from inventoryRelease).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..')

function coreSourceFiles(): string[] {
  const out: string[] = []
  const bookingsDir = path.join(REPO_ROOT, 'convex', 'bookings')
  for (const name of readdirSync(bookingsDir)) {
    if (name.endsWith('.ts')) out.push(path.join(bookingsDir, name))
  }
  for (const f of [
    'availability.ts',
    'reservationsMutations.ts',
    'bookingResources.ts',
    'bookingAuditLog.ts',
  ]) {
    out.push(path.join(REPO_ROOT, 'convex', f))
  }
  return out
}

const ADAPTER_TOP_LEVEL = new Set([
  'bookingLinks',
  'portalSubmission',
  'portalDraft',
  'email',
  'equipmentInventory',
  'equipmentWidget',
  'equipment',
  'seed',
  'seedData',
  'demoBookings',
])

const NOTIFICATION_ALLOW = new Set(['notify', 'notifyReleasedInventory'])

function normalizeImportPath(importPath: string): string[] {
  const s = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '')
  return s.split('/').filter(Boolean)
}

function parseNamedImports(importBlock: string): string[] {
  const open = importBlock.indexOf('{')
  const close = importBlock.indexOf('}', open + 1)
  if (open === -1 || close === -1) return []
  const inner = importBlock.slice(open + 1, close)
  return inner
    .split(',')
    .map((p) =>
      p
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim(),
    )
    .filter(Boolean)
}

function checkFile(filePath: string): string[] {
  const rel = path.relative(REPO_ROOT, filePath)
  const base = path.basename(filePath)
  const content = readFileSync(filePath, 'utf8')
  const violations: string[] = []

  const importLine =
    /import\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  let im: RegExpExecArray | null
  while ((im = importLine.exec(content)) !== null) {
    const full = im[0]
    const p = im[1]
    if (p.startsWith('convex/')) continue
    const segments = normalizeImportPath(p)
    if (segments.length === 0) continue
    if (segments[0] === 'lib' || segments[0] === 'shared' || segments[0] === '_generated') continue
    if (segments[0] === 'bookings') continue

    const top = segments[0]

    if (top === 'notifications') {
      const names = parseNamedImports(full)
      for (const n of names) {
        if (!NOTIFICATION_ALLOW.has(n)) {
          violations.push(
            `${rel}: forbidden import "${n}" from notifications (allowed: ${[...NOTIFICATION_ALLOW].join(', ')})`,
          )
        }
      }
      continue
    }

    if (top === 'equipmentBags') {
      if (base !== 'inventoryRelease.ts') {
        violations.push(`${rel}: core must not import equipmentBags except from bookings/inventoryRelease.ts`)
      }
      continue
    }

    if (ADAPTER_TOP_LEVEL.has(top)) {
      violations.push(`${rel}: core must not import adapter module "${top}" (import path: ${p})`)
    }
  }

  return violations
}

describe('core → adapter import boundaries', () => {
  it('core source files do not import adapters (except allowed notify / equipmentBags)', () => {
    const all: string[] = []
    for (const f of coreSourceFiles()) {
      if (!statSync(f).isFile()) continue
      all.push(...checkFile(f))
    }
    expect(all, all.join('\n')).toEqual([])
  })
})
