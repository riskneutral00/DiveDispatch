import { scoreLanguageMatch } from '@/lib/utils/language-matching'

export interface TierableOption {
  id: string
  label: string
  languages?: string[]
  isPreferred?: boolean
}

export interface InstructorTiers<T extends TierableOption = TierableOption> {
  /** Preferred + language match */
  tier1: T[]
  /** Language match, not preferred */
  tier2: T[]
  /** Preferred, no language match */
  tier3: T[]
  /** Neither preferred nor language match */
  tier4: T[]
}

/**
 * Split instructor options into 4 tiers based on preferred status and language match.
 *
 * Language match: instructor has at least 1 language that overlaps with any customer language.
 * Both sides are normalized via scoreLanguageMatch() to handle name-vs-code mismatches.
 */
export function splitInstructorTiers<T extends TierableOption>(
  options: T[],
  customerLanguageCodes: string[],
): InstructorTiers<T> {
  const tier1: T[] = []
  const tier2: T[] = []
  const tier3: T[] = []
  const tier4: T[] = []

  // Score each option once; use for both tier assignment and sort
  const scoreCache = new Map<string, number>()

  for (const opt of options) {
    const score = scoreLanguageMatch(opt.languages ?? [], customerLanguageCodes)
    scoreCache.set(opt.id, score.matchCount)
    const isPreferred = opt.isPreferred === true
    const hasLanguageMatch = score.matchCount > 0

    if (isPreferred && hasLanguageMatch) {
      tier1.push(opt)
    } else if (!isPreferred && hasLanguageMatch) {
      tier2.push(opt)
    } else if (isPreferred && !hasLanguageMatch) {
      tier3.push(opt)
    } else {
      tier4.push(opt)
    }
  }

  tier1.sort((a, b) => (scoreCache.get(b.id) ?? 0) - (scoreCache.get(a.id) ?? 0))
  tier2.sort((a, b) => (scoreCache.get(b.id) ?? 0) - (scoreCache.get(a.id) ?? 0))

  return { tier1, tier2, tier3, tier4 }
}
