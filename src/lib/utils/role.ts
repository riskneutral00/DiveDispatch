/**
 * Re-export facade for convex/lib/rolePrecedence and convex/lib/validators.
 * Keeps dependency direction correct: src/ → convex/ via explicit facade.
 */
export { deriveDefaultRole, ROLE_PRECEDENCE } from '../../../convex/lib/rolePrecedence'
export type { StakeholderRole } from '../../../convex/lib/validators'
export { effectiveResourceType } from '../../../convex/lib/validators'
