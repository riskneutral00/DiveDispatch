/**
 * Resource access control — isAllowed / notAllowed enforcement.
 * Pure function, no DB or framework dependency.
 *
 * Rules:
 * 1. notAllowed takes precedence — if you're on the blacklist, blocked.
 * 2. Empty/undefined isAllowed = open access (anyone can use it).
 * 3. Non-empty isAllowed = whitelist — only listed slugs may use it.
 */

export function isResourceAccessible(
  resource: { isAllowed?: string[]; notAllowed?: string[] },
  requesterSlug: string,
): boolean {
  if (resource.notAllowed?.includes(requesterSlug)) return false
  if (!resource.isAllowed || resource.isAllowed.length === 0) return true
  return resource.isAllowed.includes(requesterSlug)
}
