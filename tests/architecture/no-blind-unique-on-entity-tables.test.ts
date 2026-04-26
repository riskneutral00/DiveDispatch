// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')

const ENTITY_TABLES = ['compressors', 'venues', 'diveCenters', 'equipment', 'boats'] as const

const ALLOWLIST = new Set<string>([
  'convex/lib/completeness/resolveProfile.ts',
  'convex/admin/upsertVenue.ts',
])

const QUERY_RE = /\.query\((['"])(\w+)\1\)/g
const UNIQUE_RE = /\.unique\s*\(/
const BY_SLUG_RE = /withIndex\(\s*['"]by_slug['"]/

describe('architecture: no blind .unique() against entity-role tables', () => {
  it('outside the allowlist, .unique() on entity tables must be slug-keyed', async () => {
    const files = await glob('convex/**/*.ts', {
      cwd: REPO_ROOT,
      ignore: ['**/_generated/**', '**/*.test.ts'],
      absolute: true,
    })

    const offenders: Array<{ file: string; snippet: string }> = []

    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      if (ALLOWLIST.has(rel)) continue
      const source = readFileSync(file, 'utf-8')

      let m: RegExpExecArray | null
      const re = new RegExp(QUERY_RE.source, 'g')
      while ((m = re.exec(source)) !== null) {
        const tableName = m[2]
        if (!(ENTITY_TABLES as readonly string[]).includes(tableName)) continue
        const start = m.index
        // Slice forward until the immediate chain terminates: a blank line, a
        // line that doesn't start with a chain dot (`.`), or any subsequent
        // `await ctx.db` / `.query(` (next statement). Anything past that is
        // unrelated and would produce false positives.
        const tail = source.slice(start + m[0].length)
        const lines = tail.split('\n')
        const chainLines: string[] = []
        for (let i = 0; i < lines.length; i += 1) {
          const ln = lines[i]
          const trimmed = ln.trim()
          if (i === 0) {
            chainLines.push(ln)
            continue
          }
          if (trimmed === '') break
          if (!trimmed.startsWith('.')) break
          chainLines.push(ln)
        }
        const chain = chainLines.join('\n')
        if (!UNIQUE_RE.test(chain)) continue
        if (BY_SLUG_RE.test(chain)) continue
        const lineNumber = source.slice(0, start).split('\n').length
        offenders.push({
          file: `${rel}:${lineNumber}`,
          snippet: chain.replace(/\s+/g, ' ').slice(0, 140),
        })
      }
    }

    expect(
      offenders,
      `Blind .unique() on multi-row entity tables found:\n  ` +
        offenders.map((o) => `${o.file} — ${o.snippet}`).join('\n  ') +
        `\n\nUse entityProfilesMine / entityProfilesByUser (returns []) or` +
        ` entityProfileBySlug (slug-keyed, .unique() is fine on by_slug).`,
    ).toEqual([])
  })
})
