// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { glob } from 'glob'

const REPO_ROOT = resolve(__dirname, '../..')
const THRESHOLD = 3

const QUERY_RE = /(useQuery|useStableQuery)\(/g
const OPT_OUT_RE = /query-budget-ok:/

const PROVIDER_RE = /(?:-provider|Provider)\.tsx$/

const KNOWN_OFFENDERS: Record<string, { count: number; targetMigration: string }> = {
  'src/components/booking/itinerary-step.tsx': {
    count: 11,
    targetMigration: 'itinerary.wizardContext (Phase 2A)',
  },
  'src/components/profiles/preferred-list.tsx': {
    count: 6,
    targetMigration: 'preferred.listContext (Phase 2D)',
  },
  'src/components/onboarding/organizer-basic-step.tsx': {
    count: 5,
    targetMigration: 'organizer.basicStepContext (Phase 2D)',
  },
  'src/components/layout/dashboard-content.tsx': {
    count: 5,
    targetMigration: 'dashboard.shellContext (Phase 2C)',
  },
}

async function listScreenFiles(): Promise<string[]> {
  const patterns = ['src/components/**/*.tsx', 'src/app/**/*.tsx']
  const ignored = ['**/__tests__/**', '**/*.test.tsx', '**/*.stories.tsx']
  const all = new Set<string>()
  for (const p of patterns) {
    const matches = await glob(p, { cwd: REPO_ROOT, ignore: ignored, absolute: true })
    for (const m of matches) all.add(m)
  }
  return Array.from(all).filter((f) => !PROVIDER_RE.test(f))
}

describe('screen-shaped queries: budget enforcement', () => {
  it(`no NEW component issues more than ${THRESHOLD} useQuery / useStableQuery calls`, async () => {
    const files = await listScreenFiles()
    const newViolations: { file: string; count: number }[] = []
    const ratchetRegressions: { file: string; was: number; now: number }[] = []
    const fixedOffenders: string[] = []

    for (const file of files) {
      const rel = relative(REPO_ROOT, file)
      const source = readFileSync(file, 'utf-8')
      if (OPT_OUT_RE.test(source)) continue
      const matches = source.match(QUERY_RE) ?? []
      const count = matches.length
      const known = KNOWN_OFFENDERS[rel]

      if (count > THRESHOLD) {
        if (!known) {
          newViolations.push({ file: rel, count })
        } else if (count > known.count) {
          ratchetRegressions.push({ file: rel, was: known.count, now: count })
        }
      } else if (known) {
        fixedOffenders.push(rel)
      }
    }

    const errors: string[] = []
    if (newViolations.length > 0) {
      const list = newViolations
        .sort((a, b) => b.count - a.count)
        .map((v) => `  ${v.file} — ${v.count} subscriptions (cap: ${THRESHOLD})`)
        .join('\n')
      errors.push(
        `New component(s) exceeding the screen-query budget:\n${list}\n\n` +
          `Per .claude/rules/screen-shaped-queries.md, fold into one aggregation query, ` +
          `lift to a provider, or annotate the file with // query-budget-ok: <reason>.`,
      )
    }
    if (ratchetRegressions.length > 0) {
      const list = ratchetRegressions
        .map((r) => `  ${r.file} — was ${r.was}, now ${r.now}`)
        .join('\n')
      errors.push(
        `Known offender(s) got worse — the ratchet only allows movement toward the cap:\n${list}`,
      )
    }
    if (fixedOffenders.length > 0) {
      const list = fixedOffenders.map((f) => `  ${f}`).join('\n')
      errors.push(
        `Known offender(s) now within budget — remove from KNOWN_OFFENDERS in this test:\n${list}`,
      )
    }

    if (errors.length > 0) {
      throw new Error(
        errors.join('\n\n') +
          `\n\nSee Vaults/DiveDispatch/wiki/PatternLibrary/screen-shaped-queries.md`,
      )
    }
    expect(errors).toEqual([])
  })

  it('catalogs known offenders for the migration backlog', () => {
    const offenders = Object.entries(KNOWN_OFFENDERS)
    expect(offenders.length).toBeGreaterThan(0)
    for (const [file, { count, targetMigration }] of offenders) {
      expect(count).toBeGreaterThan(THRESHOLD)
      expect(targetMigration).toMatch(/Phase \d/)
      expect(file).toMatch(/\.tsx$/)
    }
  })
})
