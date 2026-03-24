import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/portal(.*)',   // Customer portal is tokenized, no auth required
  '/api/webhooks(.*)',
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

  // Server-side redirect: /dashboard → /{slug}/{roleSlug}/dashboard
  // Eliminates the client-side Convex query that hangs when tokenIdentifiers are out of sync.
  if (req.nextUrl.pathname === '/dashboard') {
    const meta = sessionClaims?.publicMetadata as { slug?: string; role?: string } | undefined
    const slug = meta?.slug
    const role = meta?.role as ClerkRole | undefined
    const roleConfig = role ? ROLE_BY_CLERK_ROLE[role] : undefined

    if (slug && roleConfig) {
      return NextResponse.redirect(new URL(`/${slug}/${roleConfig.key}/dashboard`, req.url))
    }
    // No metadata — fall through to client-side trampoline as fallback
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
