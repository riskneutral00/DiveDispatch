import type { Evaluator, EvaluatorContext } from './types'
import { str, arr } from './types'

export function scalarString(field: string): Evaluator {
  return async ({ profile }) => {
    if (!profile) return { slots: 1, incomplete: [field] }
    return { slots: 1, incomplete: str(profile[field]) ? [] : [field] }
  }
}

export function nestedAddress(): Evaluator {
  return async ({ profile }) => {
    if (!profile) return { slots: 1, incomplete: ['address'] }
    const addr = profile.address as { city?: unknown; country?: unknown } | undefined
    const ok = !!addr && str(addr.city) && str(addr.country)
    return { slots: 1, incomplete: ok ? [] : ['address'] }
  }
}

export interface ArrayNonEmptyOptions {
  deepValid?: (entries: unknown[]) => boolean
}

export function arrayNonEmpty(field: string, opts: ArrayNonEmptyOptions = {}): Evaluator {
  return async ({ profile }) => {
    if (!profile) return { slots: 1, incomplete: [field] }
    const value = profile[field]
    if (!arr(value)) return { slots: 1, incomplete: [field] }
    if (opts.deepValid && !opts.deepValid(value as unknown[])) {
      return { slots: 1, incomplete: [field] }
    }
    return { slots: 1, incomplete: [] }
  }
}

export interface CredentialOptions {
  requireSpecialties: boolean
}

export function credentialEvaluator({ requireSpecialties }: CredentialOptions): Evaluator {
  return arrayNonEmpty('credential', {
    deepValid: (entries) =>
      entries.every((e) => {
        const c = e as Record<string, unknown>
        if (requireSpecialties && !Array.isArray(c.specialtyRatings)) return false
        return str(c.agency) && str(c.level) && str(c.agencyID)
      }),
  })
}

export interface AssociationOptions {
  minSpecialties: number
}

export function associationEvaluator({ minSpecialties }: AssociationOptions): Evaluator {
  return arrayNonEmpty('associations', {
    deepValid: (entries) =>
      entries.every((e) => {
        const a = e as Record<string, unknown>
        if (!str(a.agency) || !str(a.number)) return false
        if (minSpecialties > 0) {
          const specs = a.selectedSpecialties
          if (!Array.isArray(specs) || specs.length < minSpecialties) return false
        }
        return true
      }),
  })
}

export function fleetEvaluator(): Evaluator {
  return arrayNonEmpty('fleet', {
    deepValid: (entries) =>
      entries.every((e) => {
        const f = e as Record<string, unknown>
        const maxPax = f.maxPax
        return (
          str(f.boatName) &&
          typeof maxPax === 'number' &&
          Number.isFinite(maxPax) &&
          maxPax >= 1
        )
      }),
  })
}

export interface NestedPathPredicateOptions {
  label: string
  predicate: (profile: Record<string, unknown>) => boolean
}

export function nestedPathPredicate({ label, predicate }: NestedPathPredicateOptions): Evaluator {
  return async ({ profile }) => {
    if (!profile) return { slots: 1, incomplete: [label] }
    return { slots: 1, incomplete: predicate(profile) ? [] : [label] }
  }
}

export interface SubTableEnumSlotsOptions<Row> {
  labelPrefix: string
  enumValues: readonly string[]
  fetch: (evalCtx: EvaluatorContext) => Promise<Row[]>
  enumOf: (row: Row) => string
  itemComplete: (row: Row, enumValue: string) => boolean
}

export function subTableEnumSlots<Row>(opts: SubTableEnumSlotsOptions<Row>): Evaluator {
  return async (evalCtx) => {
    if (!evalCtx.profile) {
      return {
        slots: opts.enumValues.length,
        incomplete: opts.enumValues.map((v) => `${opts.labelPrefix}:${v}`),
      }
    }
    const rows = await opts.fetch(evalCtx)
    const incomplete: string[] = []
    for (const v of opts.enumValues) {
      const items = rows.filter((r) => opts.enumOf(r) === v)
      if (items.length === 0) {
        incomplete.push(`${opts.labelPrefix}:${v}`)
        continue
      }
      if (!items.some((it) => opts.itemComplete(it, v))) {
        incomplete.push(`${opts.labelPrefix}:${v}`)
      }
    }
    return { slots: opts.enumValues.length, incomplete }
  }
}
