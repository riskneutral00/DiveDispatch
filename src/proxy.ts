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

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  const settingsLegacy = /^\/([^/]+)\/([^/]+)\/settings$/.exec(req.nextUrl.pathname)
  if (settingsLegacy) {
    return NextResponse.redirect(
      new URL(`/${settingsLegacy[1]}/${settingsLegacy[2]}/dashboard`, req.url),
      308,
    )
  }

  const meta = sessionClaims?.publicMetadata as { slug?: string; role?: string } | undefined
  const claimsSlug = meta?.slug
  const claimsRole = meta?.role as ClerkRole | undefined
  const claimsRoleConfig = claimsRole ? ROLE_BY_CLERK_ROLE[claimsRole] : undefined

  if (req.nextUrl.pathname === '/dashboard') {
    if (claimsSlug && claimsRoleConfig) {
      return NextResponse.redirect(new URL(`/${claimsSlug}/${claimsRoleConfig.key}/dashboard`, req.url))
    }
  }

  const dashboardPath = /^\/([^/]+)\/([^/]+)(\/.*)?$/.exec(req.nextUrl.pathname)

  if (dashboardPath) {
    const [, urlSlug, urlRole, subPath] = dashboardPath

    if (ROLE_BY_KEY[urlRole as RoleKey]) {
      if (claimsSlug && urlSlug !== claimsSlug) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }

      if (!subPath || subPath === '/') {
        return NextResponse.redirect(
          new URL(`/${urlSlug}/${urlRole}/dashboard`, req.url),
        )
      }
    } else if (claimsSlug && urlSlug === claimsSlug) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
