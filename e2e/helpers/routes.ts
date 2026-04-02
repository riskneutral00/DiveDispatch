/**
 * Exhaustive route list derived from src/app/ directory structure.
 *
 * Public routes require no auth.
 * Authenticated routes redirect to /sign-in if not logged in.
 * Portal routes use a tokenized BookingLink (no Clerk auth).
 */

// ── Public routes ──────────────────────────────────────────────────────────────

export const PUBLIC_ROUTES = {
  landing: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  portalExpired: '/portal/expired',
  portalWithToken: (token: string) => `/portal/${token}`,
} as const

// ── Authenticated routes (no role-slug needed) ────────────────────────────────

export const AUTH_ROUTES = {
  /** Generic dashboard redirect — sends user to role-scoped dashboard */
  dashboard: '/dashboard',
  account: '/account',
  directory: '/directory',
  help: '/help',
  bookingById: (id: string) => `/booking/${id}`,
  bookingEdit: (id: string) => `/booking/${id}/edit`,
} as const

// ── Role-scoped dashboard routes ───────────────────────────────────────────────

/**
 * Returns the dashboard URL for a given role and user slug.
 * Pattern: /{userSlug}/{roleSlug}/dashboard
 */
export function dashboardRoute(roleSlug: string, userSlug: string): string {
  return `/${userSlug}/${roleSlug}/dashboard`
}

/**
 * Returns the workspace URL for a given role and user slug.
 * Pattern: /{userSlug}/{roleSlug}/workspace
 */
export function workspaceRoute(roleSlug: string, userSlug: string): string {
  return `/${userSlug}/${roleSlug}/workspace`
}

// ── Per-role route sets ────────────────────────────────────────────────────────

/**
 * All routes accessible to a user with the given roleSlug and userSlug.
 * Used to drive exhaustive smoke tests.
 */
export function routesForRole(roleSlug: string, userSlug: string): string[] {
  return [
    dashboardRoute(roleSlug, userSlug),
    workspaceRoute(roleSlug, userSlug),
  ]
}
