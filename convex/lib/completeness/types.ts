import type { QueryCtx } from '../../_generated/server'
import type { Doc, Id } from '../../_generated/dataModel'

export interface EvaluatorContext {
  ctx: QueryCtx
  userDoc: Doc<'users'>
  profile: Record<string, unknown> | null
  role: string
  activeOrgId: Id<'organizations'> | null
}

export interface SlotContribution {
  slots: number
  incomplete: string[]
}

export type Evaluator = (evalCtx: EvaluatorContext) => Promise<SlotContribution>

export const str = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0

export const arr = (v: unknown): boolean => Array.isArray(v) && v.length > 0
