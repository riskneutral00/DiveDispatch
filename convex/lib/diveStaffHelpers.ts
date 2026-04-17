import { ConvexError } from 'convex/values'
import { AGENCY_CONFIGS } from '../shared/activityCatalog'
import type { Credential } from '../shared/capabilityGate'
import { ErrorCode } from './errorCodes'

function isInstructorLevel(cred: Credential): boolean {
  const config = AGENCY_CONFIGS[cred.agency]
  if (!config) return false
  const levelDef = config.levels.find((l) => l.code === cred.level)
  return levelDef?.isInstructor === true
}

function isDivemasterLevel(cred: Credential): boolean {
  const config = AGENCY_CONFIGS[cred.agency]
  if (!config) return false
  const levelDef = config.levels.find((l) => l.code === cred.level)
  return levelDef !== undefined && levelDef.isInstructor === false
}

export function hasInstructorLevelCredential(credentials: readonly Credential[] | undefined): boolean {
  if (!credentials) return false
  return credentials.some(isInstructorLevel)
}

export function hasDivemasterLevelCredential(credentials: readonly Credential[] | undefined): boolean {
  if (!credentials) return false
  return credentials.some((c) => isDivemasterLevel(c) || isInstructorLevel(c))
}

export function getHighestCredentialClass(
  credentials: readonly Credential[] | undefined,
): 'instructor' | 'divemaster' | null {
  if (!credentials || credentials.length === 0) return null
  if (hasInstructorLevelCredential(credentials)) return 'instructor'
  if (credentials.some(isDivemasterLevel)) return 'divemaster'
  return null
}

export function assertNitroxCapable(
  staff: { nitroxCertified?: boolean; name?: string } | null | undefined,
  bookingNeedsNitrox: boolean,
): void {
  if (!bookingNeedsNitrox) return
  if (!staff) return
  if (staff.nitroxCertified === true) return
  throw new ConvexError({
    code: ErrorCode.CAPABILITY_GAP,
    reason: 'nitroxRequired',
    staffName: staff.name ?? null,
  })
}
