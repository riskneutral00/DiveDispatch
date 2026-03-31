import type { Language } from '@/lib/types/language'
import { languageToCode } from '@/lib/constants/dive-languages'

interface CustomerWithLanguages {
  flags?: Language[]
}

/**
 * Returns the intersection of all customers' language codes.
 * Ignores customers who do not have any languages specified.
 */
export function getSharedLanguages(customers: CustomerWithLanguages[]): Language[] {
  const validCustomers = customers.filter((c) => c.flags && c.flags.length > 0)
  
  if (validCustomers.length === 0) return []

  const firstCustomerLanguages = validCustomers[0].flags ?? []
  
  return firstCustomerLanguages.filter((baseLang) =>
    validCustomers.every((customer) => 
      customer.flags?.some((customerLang) => customerLang.code === baseLang.code)
    )
  )
}

/**
 * Returns true if 2+ customers share no common language.
 * Only evaluates customers that have at least one language set.
 */
export function hasLanguageConflict(customers: CustomerWithLanguages[]): boolean {
  const validCustomerCount = customers.filter((c) => c.flags && c.flags.length > 0).length
  
  if (validCustomerCount < 2) return false
  
  return getSharedLanguages(customers).length === 0
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
  if (customerLanguageCodes.length === 0 || instructorLanguages.length === 0) {
    return { tier: 'none', matchCount: 0, total: customerLanguageCodes.length }
  }

  const normalizedInstructorCodes = new Set(
    instructorLanguages.map((l) => languageToCode(l)).filter(Boolean)
  )

  const matchCount = customerLanguageCodes.filter((code) => {
    const normalizedCode = languageToCode(code)
    return normalizedCode && normalizedInstructorCodes.has(normalizedCode)
  }).length

  const tier: MatchTier =
    matchCount === 0 ? 'none' : matchCount >= customerLanguageCodes.length ? 'full' : 'partial'

  return { tier, matchCount, total: customerLanguageCodes.length }
}
