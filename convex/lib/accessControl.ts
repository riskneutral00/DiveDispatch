export function isResourceAccessible(
  resource: { isAllowed?: string[]; notAllowed?: string[] },
  requesterSlug: string,
): boolean {
  if (resource.notAllowed?.includes(requesterSlug)) return false
  if (!resource.isAllowed || resource.isAllowed.length === 0) return true
  return resource.isAllowed.includes(requesterSlug)
}
