export type ParsedTokenIdentifier = {
  issuer: string
  clerkUserId: string
}

export function parseTokenIdentifier(tokenIdentifier: string): ParsedTokenIdentifier | null {
  const pipeIdx = tokenIdentifier.indexOf('|')
  if (pipeIdx <= 0 || pipeIdx === tokenIdentifier.length - 1) return null
  return {
    issuer: tokenIdentifier.slice(0, pipeIdx),
    clerkUserId: tokenIdentifier.slice(pipeIdx + 1),
  }
}

export function isLikelyClerkIssuer(issuer: string): boolean {
  return issuer.startsWith('https://')
}

export function isAllowedRebind(
  existingTokenIdentifier: string,
  incomingTokenIdentifier: string,
): boolean {
  const existing = parseTokenIdentifier(existingTokenIdentifier)
  const incoming = parseTokenIdentifier(incomingTokenIdentifier)
  if (!existing || !incoming) return false
  if (!isLikelyClerkIssuer(incoming.issuer)) return false
  if (!isLikelyClerkIssuer(existing.issuer)) return true
  return existing.issuer === incoming.issuer
}
