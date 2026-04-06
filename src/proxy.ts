import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { ROLE_BY_CLERK_ROLE, ROLE_BY_KEY, type ClerkRole, type RoleKey } from '@/lib/constants/roles'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/portal(.*)',   // Customer portal is tokenized, no auth required
  '/api/webhooks(.*)',
  '/api/health',
])

// sign-in and sign-up are public routes — the page components handle
// authenticated-user interstitials (resume signup, sign in with different account).

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // Legacy bookmarks: /{slug}/{roleSlug}/settings → /dashboard
  const settingsLegacy = /^\/([^/]+)\/([^/]+)\/settings$/.exec(req.nextUrl.pathname)
  if (settingsLegacy) {
    return NextResponse.redirect(
      new URL(`/${settingsLegacy[1]}/${settingsLegacy[2]}/dashboard`, req.url),
      308,
    )
  }

  // ── Proxy-as-authority: single routing state machine ─────────────────────

  const meta = sessionClaims?.publicMetadata as { slug?: string; role?: string } | undefined
  const claimsSlug = meta?.slug
  const claimsRole = meta?.role as ClerkRole | undefined
  const claimsRoleConfig = claimsRole ? ROLE_BY_CLERK_ROLE[claimsRole] : undefined

  // /dashboard → /{slug}/{role}/dashboard (resolve from session claims)
  if (req.nextUrl.pathname === '/dashboard') {
    if (claimsSlug && claimsRoleConfig) {
      return NextResponse.redirect(new URL(`/${claimsSlug}/${claimsRoleConfig.key}/dashboard`, req.url))
    }
    // No metadata — fall through to client-side trampoline as fallback
  }

  // Match /{slug}/{role} or /{slug}/{role}/* patterns
  const dashboardPath = /^\/([^/]+)\/([^/]+)(\/.*)?$/.exec(req.nextUrl.pathname)

  if (dashboardPath) {
    const [, urlSlug, urlRole, subPath] = dashboardPath

    // Only treat as a dashboard route if the second segment is a valid role key.
    // This lets non-dashboard two-segment routes (/admin/*, /api/*, etc.) pass through.
    if (ROLE_BY_KEY[urlRole as RoleKey]) {
      // Slug ownership: URL slug must match session claims slug
      if (claimsSlug && urlSlug !== claimsSlug) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }

      // Role-root catch: /{slug}/{role} without sub-path → append /dashboard
      if (!subPath || subPath === '/') {
        return NextResponse.redirect(
          new URL(`/${urlSlug}/${urlRole}/dashboard`, req.url),
        )
      }
    } else if (claimsSlug && urlSlug === claimsSlug) {
      // User's slug + invalid role → redirect to their dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // All other authenticated routes → pass through to Next.js (not-found.tsx handles 404s)
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
