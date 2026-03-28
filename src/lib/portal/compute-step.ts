import type { PortalProgress, PortalStep } from '../../../convex/portalDraft'

/** Client-side portal step type (includes 'safety' which is UI-only). */
export type ClientPortalStep = PortalStep | 'safety'

const VALID_CLIENT_STEPS: ReadonlySet<string> = new Set([
  'contact',
  'medical',
  'waiver',
  'equipment',
  'safety',
  'submit',
])

/**
 * Derives the current portal step from server progress.
 * Returns 'contact' as fallback when progress is not yet loaded
 * or the server returns an unrecognized step value.
 */
export function computeStep(
  progress: PortalProgress | null | undefined,
): ClientPortalStep {
  if (!progress) return 'contact'
  const step = progress.firstIncompleteStep
  if (VALID_CLIENT_STEPS.has(step)) return step
  return 'contact'
}
