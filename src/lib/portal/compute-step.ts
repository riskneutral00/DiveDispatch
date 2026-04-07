import type { PortalProgress, PortalStep } from '../../../convex/portalDraft'

export type ClientPortalStep = PortalStep | 'safety'

const VALID_CLIENT_STEPS: ReadonlySet<string> = new Set([
  'contact',
  'medical',
  'waiver',
  'equipment',
  'safety',
  'submit',
])

export function computeStep(
  progress: PortalProgress | null | undefined,
): ClientPortalStep {
  if (!progress) return 'contact'
  const step = progress.firstIncompleteStep
  if (VALID_CLIENT_STEPS.has(step)) return step
  return 'contact'
}
