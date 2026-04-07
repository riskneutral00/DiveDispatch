import { auth } from '@clerk/nextjs/server'
import { NotFoundCard } from '@/components/ui/not-found-card'

export default async function GlobalNotFound() {
  const { userId } = await auth()

  return (
    <NotFoundCard
      href={userId ? '/dashboard' : '/sign-in'}
      linkText={userId ? 'Back to dashboard' : 'Sign in'}
    />
  )
}
