// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, relative } from 'path'

const REPO_ROOT = resolve(__dirname, '../..')
const SRC_ROOT = resolve(REPO_ROOT, 'src')
const ROLE_REGISTRY_PATH = resolve(SRC_ROOT, 'lib/constants/roles.ts')
const ROLE_SECTION_BINDINGS_PATH = resolve(SRC_ROOT, 'components/profiles/role-section-registry.tsx')

const ALLOWED_FILES = new Set([ROLE_REGISTRY_PATH, ROLE_SECTION_BINDINGS_PATH])

const ROLE_KEY_LITERALS = [
  'dive-center',
  'agent',
  'instructor',
  'boat',
  'equipment',
  'compressor',
  'venue',
] as const
const CLERK_ROLE_LITERALS = [
  'DiveCenter',
  'Agent',
  'Instructor',
  'Boat',
  'Equipment',
  'Compressor',
  'Venue',
] as const

function walkTs(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = resolve(root, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '_generated' || entry === 'node_modules' || entry === '.next') continue
      walkTs(full, out)
      continue
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue
    if (entry.endsWith('.stories.tsx')) continue
    out.push(full)
  }
  return out
}

function isAllowed(file: string): boolean {
  return ALLOWED_FILES.has(file)
}

describe('architecture: role registry is sealed', () => {
  it('no parallel `Record<RoleKey, ...>` or `Record<ClerkRole, ...>` exports outside roles.ts / role-section-registry.tsx', () => {
    const offenders: string[] = []
    const recordKeyRe = /Record<\s*(RoleKey|ClerkRole)\s*,/g
    for (const file of walkTs(SRC_ROOT)) {
      if (isAllowed(file)) continue
      const content = readFileSync(file, 'utf8')
      if (!recordKeyRe.test(content)) continue
      // Allow read-only consumption (typed parameter, function return, etc.) — only flag exported maps.
      // Heuristic: a literal `Record<RoleKey,` followed by `=` (assignment) or `:` followed by `{` is a registry definition.
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        if (!/Record<\s*(RoleKey|ClerkRole)\s*,/.test(line)) return
        // Skip type-only declarations (e.g. function param types, return types) — allow `:` with no `=` on this line, or `as Record<...>` casts.
        const isExportedConst = /^\s*export\s+const\s+\w+\s*(?::\s*Record<\s*(RoleKey|ClerkRole)\s*,|=\s*(?:Object\.fromEntries|\{))/.test(line)
        const isObjectFromEntriesAssignment = /(?:as|:)\s*Record<\s*(RoleKey|ClerkRole)\s*,/.test(line) && /Object\.fromEntries/.test(line)
        if (isExportedConst || isObjectFromEntriesAssignment) {
          offenders.push(`${relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`)
        }
      })
    }
    expect(
      offenders,
      `Parallel role-keyed registries must live in src/lib/constants/roles.ts or src/components/profiles/role-section-registry.tsx.\n  Offending lines:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('no exhaustive role switch / chained-if branching over more than 2 RoleKey literals outside roles.ts / role-section-registry.tsx', () => {
    const offenders: string[] = []
    for (const file of walkTs(SRC_ROOT)) {
      if (isAllowed(file)) continue
      const content = readFileSync(file, 'utf8')

      // RoleKey switch
      const switchMatch = content.match(/switch\s*\(\s*\w+\s*\)\s*\{[\s\S]*?\}/g)
      if (switchMatch) {
        for (const block of switchMatch) {
          const literals = new Set<string>()
          for (const lit of [...ROLE_KEY_LITERALS, ...CLERK_ROLE_LITERALS]) {
            if (new RegExp(`case\\s+['"\`]${lit}['"\`]\\s*:`).test(block)) {
              literals.add(lit)
            }
          }
          if (literals.size > 2) {
            offenders.push(`${relative(REPO_ROOT, file)}: switch over ${literals.size} role literals (${[...literals].join(', ')})`)
          }
        }
      }

      // chained `if (role === 'X')`
      const chainLiterals = new Set<string>()
      for (const lit of [...ROLE_KEY_LITERALS, ...CLERK_ROLE_LITERALS]) {
        const re = new RegExp(`(?:if|else if)\\s*\\(\\s*\\w+\\s*===\\s*['"\`]${lit}['"\`]\\s*\\)`)
        if (re.test(content)) {
          chainLiterals.add(lit)
        }
      }
      if (chainLiterals.size > 2) {
        offenders.push(`${relative(REPO_ROOT, file)}: chained if/else-if over ${chainLiterals.size} role literals (${[...chainLiterals].join(', ')})`)
      }
    }
    expect(
      offenders,
      `Exhaustive role-keyed branching must live in src/lib/constants/roles.ts or src/components/profiles/role-section-registry.tsx. Use a registry/config lookup instead.\n  Offending:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
