import type { QueryCtx } from '../../_generated/server'
import type { Doc, Id } from '../../_generated/dataModel'
import { ROLE_SPECS } from './roleSpecs'

export async function evaluateRowCompleteness(
  ctx: QueryCtx,
  userDoc: Doc<'users'>,
  role: string,
  row: Record<string, unknown>,
  activeOrgId: Id<'organizations'> | null,
): Promise<{ complete: boolean; incomplete: string[] }> {
  const evaluators = ROLE_SPECS[role] ?? []
  const incomplete: string[] = []
  for (const evaluator of evaluators) {
    const { incomplete: inc } = await evaluator({
      ctx,
      userDoc,
      profile: row,
      role,
      activeOrgId,
    })
    for (const label of inc) incomplete.push(label)
  }
  return { complete: incomplete.length === 0, incomplete }
}
