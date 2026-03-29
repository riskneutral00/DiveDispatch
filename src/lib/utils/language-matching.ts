import type { Language } from '@/lib/types/language'
import { languageToCode } from '@/lib/constants/dive-languages'

interface CustomerWithLanguages {
  flags?: Language[]
}

/**
 * Returns the intersection of all customers' language codes.
 * If any customer has no languages set, returns empty array.
 */
export function getSharedLanguages(customers: CustomerWithLanguages[]): Language[] {
  if (customers.length === 0) return []

  const customersWithLangs = customers.filter((c) => c.flags && c.flags.length > 0)
  if (customersWithLangs.length === 0) return []

  // Start with first customer's languages
  const first = customersWithLangs[0].flags!
  const sharedCodes = first.filter((lang) =>
    customersWithLangs.every((c) => c.flags!.some((f) => f.code === lang.code)),
  )

  return sharedCodes
}

/**
 * Returns true if 2+ customers share no common language.
 * Only meaningful when all customers have at least one language set.
 */
export function hasLanguageConflict(customers: CustomerWithLanguages[]): boolean {
  const withLangs = customers.filter((c) => c.flags && c.flags.length > 0)
  if (withLangs.length < 2) return false
  return getSharedLanguages(withLangs).length === 0
}

export type MatchTier = 'full' | 'partial' | 'none'

/**
 * Score how well an instructor's languages cover the customer language requirements.
 * - full: instructor covers ALL customer languages
 * - partial: instructor covers some but not all
 * - none: zero overlap (or either side is empty)
 *
 * Both sides are normalized via languageToCode() to handle name/ISO-639/locale mismatches.
 */
export function scoreLanguageMatch(
  instructorLanguages: string[],
  customerLanguageCodes: string[],
): { tier: MatchTier; matchCount: number; total: number } {
  const total = customerLanguageCodes.length
  if (total === 0 || instructorLanguages.length === 0) {
    return { tier: 'none', matchCount: 0, total }
  }

  const instructorCodes = new Set(
    instructorLanguages.map((l) => languageToCode(l)).filter(Boolean),
  )

  let matchCount = 0
  for (const code of customerLanguageCodes) {
    const normalized = languageToCode(code)
    if (normalized && instructorCodes.has(normalized)) matchCount++
  }

  const tier: MatchTier =
    matchCount === 0 ? 'none' : matchCount >= total ? 'full' : 'partial'

  return { tier, matchCount, total }
}
