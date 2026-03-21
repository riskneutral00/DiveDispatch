import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/portal(.*)',   // Customer portal is tokenized, no auth required
  '/api/webhooks(.*)',
])

// Auth'd users on sign-in → bounce to dashboard.
// sign-up is NOT listed: auth'd users stay on /sign-up for the role/profile wizard steps.
const isAuthRoute = createRouteMatcher([
  '/sign-in(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Authenticated users on auth pages → bounce to dashboard
  if (isAuthRoute(req)) {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  if (isPublicRoute(req)) return NextResponse.next()

  const { userId } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
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
