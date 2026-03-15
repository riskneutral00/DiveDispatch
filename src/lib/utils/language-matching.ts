import type { Language } from '@/lib/types/language'

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
