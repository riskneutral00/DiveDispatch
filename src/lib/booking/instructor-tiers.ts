import { languageToCode } from '@/lib/constants/dive-languages'
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
 * Both sides are normalized via languageToCode() to handle name-vs-code mismatches.
 */
export function splitInstructorTiers<T extends TierableOption>(
  options: T[],
  customerLanguageCodes: string[],
): InstructorTiers<T> {
  // Normalize customer language codes
  const customerCodes = new Set(
    customerLanguageCodes.map(c => languageToCode(c)).filter(Boolean),
  )

  const tier1: T[] = []
  const tier2: T[] = []
  const tier3: T[] = []
  const tier4: T[] = []

  for (const opt of options) {
    const isPreferred = opt.isPreferred === true
    const hasLanguageMatch = customerCodes.size > 0 && (opt.languages ?? []).some(lang => {
      const code = languageToCode(lang)
      return code !== '' && customerCodes.has(code)
    })

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

  // Sort language-matched tiers by match quality (full before partial)
  const byMatchQuality = (a: T, b: T) => {
    const aScore = scoreLanguageMatch(a.languages ?? [], customerLanguageCodes)
    const bScore = scoreLanguageMatch(b.languages ?? [], customerLanguageCodes)
    return bScore.matchCount - aScore.matchCount
  }
  tier1.sort(byMatchQuality)
  tier2.sort(byMatchQuality)

  return { tier1, tier2, tier3, tier4 }
}
