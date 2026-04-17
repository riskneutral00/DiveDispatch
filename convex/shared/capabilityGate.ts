import { AGENCY_CONFIGS, type ActivityCode } from './activityCatalog'

export interface GateResult {
  allowed: boolean
  reason?: { kind: 'rank' | 'rating'; detail: string }
}

export interface Credential {
  agency: string
  level: string
  specialtyRatings?: string[]
}

export function getIsInstructor(credential: { agency: string; level: string }): boolean | null {
  const config = AGENCY_CONFIGS[credential.agency]
  if (!config) return null
  const levelDef = config.levels.find((l) => l.code === credential.level)
  return levelDef?.isInstructor ?? null
}

export function canConductActivity(
  credential: Credential,
  activityCode: ActivityCode,
  specialtyCode?: string,
): GateResult {
  const config = AGENCY_CONFIGS[credential.agency]
  if (!config) {
    return { allowed: true }
  }

  const levelDef = config.levels.find((l) => l.code === credential.level)
  if (!levelDef) {
    return { allowed: false, reason: { kind: 'rank', detail: `Unknown level: ${credential.level} for ${credential.agency}` } }
  }

  const rule = config.activityRules[activityCode]
  if (!rule) {
    return { allowed: false, reason: { kind: 'rank', detail: `${config.name} does not offer ${activityCode}` } }
  }

  if (rule.requiresInstructor && !levelDef.isInstructor) {
    return {
      allowed: false,
      reason: {
        kind: 'rank',
        detail: `${credential.agency} ${credential.level} cannot teach courses (requires instructor)`,
      },
    }
  }

  if (rule.requiresRating && specialtyCode) {
    if (config.automaticAuthority.includes(specialtyCode)) {
      return { allowed: true }
    }
    if (!credential.specialtyRatings?.includes(specialtyCode)) {
      return {
        allowed: false,
        reason: {
          kind: 'rating',
          detail: `Missing ${specialtyCode} specialty rating`,
        },
      }
    }
  }

  return { allowed: true }
}

export function staffCanConductActivity(
  credentials: Credential[],
  activityCode: ActivityCode,
  specialtyCode?: string,
): GateResult {
  if (credentials.length === 0) {
    return { allowed: false, reason: { kind: 'rank', detail: 'No credentials' } }
  }

  let lastResult: GateResult = { allowed: false, reason: { kind: 'rank', detail: 'No credentials' } }

  for (const cred of credentials) {
    const result = canConductActivity(cred, activityCode, specialtyCode)
    if (result.allowed) return result
    lastResult = result
  }

  return lastResult
}

