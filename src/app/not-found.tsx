import { auth } from '@clerk/nextjs/server'
import { NotFoundCard } from '@/components/ui/not-found-card'

// Global catch-all 404. Proxy handles most auth-based redirects at the edge,
// but if a request slips through (e.g., a route outside any layout group),
// show a styled 404 with context-appropriate navigation.
export default async function GlobalNotFound() {
  const { userId } = await auth()

  return (
    <NotFoundCard
      href={userId ? '/dashboard' : '/sign-in'}
      linkText={userId ? 'Back to dashboard' : 'Sign in'}
    />
  )
}
