import { NotFoundCard } from '@/components/ui/not-found-card'

export default function AuthNotFound() {
  return (
    <NotFoundCard
      href="/sign-in"
      linkText="Back to sign in"
      message="The page you're looking for doesn't exist or has been moved."
    />
  )
}
