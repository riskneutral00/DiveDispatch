import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ALLOWED_FILES = new Set([
  'convex/users.ts',
  'convex/seed.ts',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '_generated' || entry === 'node_modules') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

describe('architecture: users insert is sealed to runtime + seed', () => {
  it('only convex/users.ts and convex/seed.ts insert into users at runtime', () => {
    const offenders: string[] = []
    for (const file of walk('convex')) {
      const rel = file.startsWith('./') ? file.slice(2) : file
      if (ALLOWED_FILES.has(rel)) continue
      const src = readFileSync(file, 'utf8')
      if (/ctx\.db\.insert\(['"]users['"]/.test(src)) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  it('convex/users.ts has exactly one runtime users insert (createUser)', () => {
    const src = readFileSync('convex/users.ts', 'utf8')
    const matches = src.match(/ctx\.db\.insert\(['"]users['"]/g) ?? []
    expect(matches.length).toBe(1)
  })
})
